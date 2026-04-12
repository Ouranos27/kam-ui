import { Mesh, Program, Renderer, Texture, Triangle } from 'ogl';
import { useDeferredValue, useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';
import { mergeRefs, resolvePerformanceQuality, useAutoPerformanceQuality, useInView, usePrefersReducedMotion, type PerformanceQuality } from '@/lib/containment';

// ─── GLSL ────────────────────────────────────────────────────────────────────

const VERT = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uSpeed;
uniform vec3  uColor;
uniform vec2  uResolution;
uniform vec2  uCenter;
uniform float uInnerRadius;
uniform float uBandWidth;
uniform float uShimmer;
uniform sampler2D uNoiseTexture;
uniform float uBandFibers;

out vec4 fragColor;

vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i   = floor(v + dot(v, C.yy));
  vec2 x0  = v - i + dot(i, C.xx);
  vec2 i1  = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy  -= i1;
  i = mod(i, 289.0);
  vec3 p  = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                           + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m  = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m * m * m * m;
  vec3 x  = 2.0 * fract(p * C.www) - 1.0;
  vec3 h  = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  // Drawing-buffer resolution matches gl_FragCoord (retina-centred ring / cx·cy).
  vec2 uv      = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;

  vec2  pos   = vec2((uv.x - uCenter.x) * aspect, uv.y - uCenter.y);
  float r2    = max(dot(pos, pos), 1e-10);
  float r     = sqrt(r2);
  // Unit direction in aspect-corrected space — closes smoothly each orbit (no atan seam).
  vec2  dir   = pos * inversesqrt(r2);

  float t = uTime * uSpeed;

  float polarR = r * 3.0;
  // Azimuth from dir.xy only (periodic); avoids atan branch cuts on the fiber texture.
  vec2  pAng    = dir.xy * 4.2;
  vec2  puv     = vec2(polarR, pAng.x + pAng.y * 0.32);
  float ft      = t * 0.55;
  vec4  nf1     = texture(uNoiseTexture, puv * vec2(0.22, 1.75) + vec2(-ft * 0.08, ft * 0.02));
  vec4  nf2     = texture(uNoiseTexture, puv * vec2(0.15, 1.1) + vec2(-ft * 0.13, -ft * 0.015));
  float nBlend  = nf1.r * 0.55 + nf2.r * 0.45;
  float fiberMod = mix(1.0, 0.82 + 0.36 * nBlend, uBandFibers);

  // Two octaves: sample noise in dir-space so θ=0 matches θ=2π (continuous ring).
  float n1     = snoise(dir * 3.2 + vec2(t * 0.35, t * 0.18));
  float n2     = snoise(dir * 7.6 - vec2(t * 0.50, t * 0.22)) * 0.45;
  float nv     = n1 + n2;                      // ≈ −1.45 … 1.45

  // Perturb the band mid-radius and half-width by noise
  float mid     = uInnerRadius + uBandWidth * 0.5;
  float halfW   = uBandWidth   * 0.5;
  float rMid    = mid   + nv * uShimmer * uBandWidth * 0.35;
  float rHalf   = halfW * (1.0 + abs(nv) * uShimmer * 0.25);

  // Gaussian ring profile — smooth, luminous, never hard-edged
  float fromMid = r - rMid;
  float sigma   = max(rHalf * 0.6, 0.001);
  float ring    = exp(-(fromMid * fromMid) / (2.0 * sigma * sigma));

  // High-frequency sparkle — dir-based azimuth so the band meets itself seamlessly.
  float sparkle = snoise(dir * 12.0 + vec2(t * 1.2, r * 8.0 - t * 0.4)) * 0.5 + 0.5;
  sparkle *= ring * uShimmer * 0.40;

  ring    *= fiberMod;
  sparkle *= mix(1.0, fiberMod, 0.85);

  float intensity = clamp(ring + sparkle, 0.0, 1.0);
  fragColor = vec4(uColor * intensity, intensity);
}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace('#', '');
	return [
		parseInt(h.slice(0, 2), 16) / 255,
		parseInt(h.slice(2, 4), 16) / 255,
		parseInt(h.slice(4, 6), 16) / 255,
	];
}

function generateNoiseTexture(size: number): Uint8Array {
	const data = new Uint8Array(size * size * 4);

	function hash(x: number, y: number, seed: number): number {
		let n = x * 374761393 + y * 668265263 + seed * 1274126177;
		n = Math.imul(n ^ (n >>> 13), 1274126177);
		return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
	}

	function noise(px: number, py: number, frequency: number, seed: number): number {
		const fx = (px / size) * frequency;
		const fy = (py / size) * frequency;
		const ix = Math.floor(fx);
		const iy = Math.floor(fy);
		const tx = fx - ix;
		const ty = fy - iy;
		const wrap = frequency | 0;
		const v00 = hash(((ix % wrap) + wrap) % wrap, ((iy % wrap) + wrap) % wrap, seed);
		const v10 = hash((((ix + 1) % wrap) + wrap) % wrap, ((iy % wrap) + wrap) % wrap, seed);
		const v01 = hash(((ix % wrap) + wrap) % wrap, (((iy + 1) % wrap) + wrap) % wrap, seed);
		const v11 = hash((((ix + 1) % wrap) + wrap) % wrap, (((iy + 1) % wrap) + wrap) % wrap, seed);
		return v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
	}

	for (let y = 0; y < size; y += 1) {
		for (let x = 0; x < size; x += 1) {
			let sample = 0;
			let amplitude = 0.4;
			let totalAmplitude = 0;
			for (let octave = 0; octave < 8; octave += 1) {
				const frequency = 32 * (1 << octave);
				sample += amplitude * noise(x, y, frequency, octave * 31);
				totalAmplitude += amplitude;
				amplitude *= 0.65;
			}
			sample /= totalAmplitude;
			sample = (sample - 0.5) * 2.2 + 0.5;
			sample = Math.max(0, Math.min(1, sample));
			const value = Math.round(sample * 255);
			const index = (y * size + x) * 4;
			data[index] = value;
			data[index + 1] = value;
			data[index + 2] = value;
			data[index + 3] = 255;
		}
	}

	return data;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type ShimmerRingProps = {
	/** Ring colour at the band's luminance peak (6-char hex). @default '#a855f7' */
	color?: string;
	/** Ring centre X (0–100). @default 50 */
	cx?: number;
	/** Ring centre Y (0–100). @default 50 */
	cy?: number;
	/**
	 * Inner band edge as a fraction of canvas height from the centre (0–0.5).
	 * 0.22 means the transparent zone extends ~22 % of the canvas height from the centre
	 * in each direction before the colour band begins.
	 * @default 0.22
	 */
	innerRadius?: number;
	/**
	 * Band thickness as a fraction of canvas height (0–0.4).
	 * @default 0.15
	 */
	bandWidth?: number;
	/**
	 * Noise deformation amplitude — controls how much the band edges
	 * undulate and shimmer (0 = perfect circle, 1 = highly organic).
	 * @default 0.65
	 */
	shimmer?: number;
	/**
	 * Polar GPU-noise detail on the band (0 = off). Separate from `shimmer`.
	 * @default 0.55
	 */
	bandFibers?: number;
	/** Ring centre wander radius as a fraction of canvas height. @default 0.04 */
	drift?: number;
	/** Shader time scale — higher = faster shimmer and drift. @default 0.8 */
	speed?: number;
	/** Ring centre smoothly lerps toward the cursor. @default true */
	mouseReact?: boolean;
	quality?: PerformanceQuality;
	className?: string;
	/** React 19: ref passed as a plain prop — no forwardRef wrapper. */
	ref?: React.Ref<HTMLDivElement>;
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * WebGL shader ring — transparent centre, noise-shimmered colour band,
 * transparent outer zone.
 *
 * Powered by ogl (same pattern as Aurora). The key distinction over the
 * CSS-based `HaloRing`: the band edges are perturbed by angle-dependent
 * direction-based simplex noise (seamless each orbit), making the ring look alive — the band narrows, widens,
 * and sparks hot at noise peaks, never forming a perfect geometric circle.
 * Drawing-buffer UVs keep `cx`/`cy` centred on HiDPI; optional polar-sampled
 * texture adds fibrous micro-detail on the band.
 *
 * Pauses when off-screen; static CSS ring when `prefers-reduced-motion`.
 * React 19: `ref` is a plain prop — no `forwardRef` wrapper.
 */
export function ShimmerRing({
	ref,
	className,
	color = '#a855f7',
	cx = 50,
	cy = 50,
	innerRadius = 0.22,
	bandWidth = 0.15,
	shimmer = 0.65,
	bandFibers = 0.55,
	drift = 0.04,
	speed = 0.8,
	mouseReact = true,
	quality = 'auto',
}: ShimmerRingProps) {
	const reducedMotion = usePrefersReducedMotion();
	const autoQuality = useAutoPerformanceQuality();
	const resolvedQuality = resolvePerformanceQuality(quality, autoQuality);
	const { ref: inViewRef, inView } = useInView();
	const rootRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLDivElement>(null);
	const loopControlsRef = useRef<{ start: () => void; stop: () => void } | null>(null);

	const inViewMut = useRef(inView);
	useEffect(() => {
		inViewMut.current = inView;
	}, [inView]);

	const dColor = useDeferredValue(color);
	// Re-initialise WebGL when structural params change
	const qualityScale = resolvedQuality === 'low' ? 0.7 : resolvedQuality === 'medium' ? 0.85 : 1;
	const dprCap = resolvedQuality === 'low' ? 1 : resolvedQuality === 'medium' ? 1.5 : 2;
	const depsKey = `${dColor}-${cx}-${cy}-${speed}-${innerRadius}-${bandWidth}-${shimmer}-${bandFibers}-${drift}-${mouseReact}-${resolvedQuality}`;

	useEffect(() => {
		if (reducedMotion) return;
		if (import.meta.env.DEV) performance.mark('shimmerring:init:start');
		const container = canvasRef.current;
		if (!container) return;

		let renderer: Renderer;
		let rafId: number | null = null;

		try {
			renderer = new Renderer({
				alpha: true,
				premultipliedAlpha: true,
				antialias: false,
				dpr: Math.min(window.devicePixelRatio || 1, dprCap),
			});
		} catch {
			return;
		}

		const gl = renderer.gl;
		gl.clearColor(0, 0, 0, 0);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

		const geometry = new Triangle(gl);
		if (geometry.attributes.uv) delete geometry.attributes.uv;

		const w = container.offsetWidth || 800;
		const h = container.offsetHeight || 600;

		const textureSize = resolvedQuality === 'low' ? 128 : resolvedQuality === 'medium' ? 192 : 256;
		const noiseTexture = new Texture(gl, {
			image: generateNoiseTexture(textureSize),
			width: textureSize,
			height: textureSize,
			generateMipmaps: false,
			flipY: false,
		});
		noiseTexture.minFilter = gl.LINEAR;
		noiseTexture.magFilter = gl.LINEAR;
		noiseTexture.wrapS = gl.REPEAT;
		noiseTexture.wrapT = gl.REPEAT;

		const program = new Program(gl, {
			vertex: VERT,
			fragment: FRAG,
			uniforms: {
				uTime:        { value: 0 },
				uSpeed:       { value: speed * qualityScale },
				uColor:       { value: hexToRgb(dColor) },
				uResolution:  { value: [w, h] },
				uCenter:      { value: [cx / 100, cy / 100] },
				uInnerRadius: { value: innerRadius },
				uBandWidth:   { value: bandWidth * qualityScale },
				uShimmer:     { value: shimmer * qualityScale },
				uNoiseTexture: { value: noiseTexture },
				uBandFibers:  { value: Math.min(1, Math.max(0, bandFibers)) },
			},
		});

		const mesh = new Mesh(gl, { geometry, program });
		container.appendChild(gl.canvas);
		gl.canvas.className = 'absolute inset-0 block h-full w-full';

		function syncResolutionUniform() {
			const bw = gl.drawingBufferWidth;
			const bh = gl.drawingBufferHeight;
			if (bh < 1) return;
			program.uniforms.uResolution.value = [bw, bh];
		}

		const ro = new ResizeObserver(() => {
			const cw = container.offsetWidth;
			const ch = container.offsetHeight;
			renderer.setSize(cw, ch);
			syncResolutionUniform();
		});
		ro.observe(container);
		renderer.setSize(w, h);
		syncResolutionUniform();

		const mouse = { x: cx / 100, y: cy / 100 };
		const lerped = { x: cx / 100, y: cy / 100 };

		function onMouseMove(e: MouseEvent) {
			const rect = container!.getBoundingClientRect();
			mouse.x = (e.clientX - rect.left) / rect.width;
			mouse.y = 1.0 - (e.clientY - rect.top) / rect.height; // flip Y for GL
		}
		if (mouseReact) window.addEventListener('mousemove', onMouseMove, { passive: true });

		function update(ts: number) {
			rafId = null;
			if (!inViewMut.current) return;

			const time = ts * 0.001;

			// Lissajous drift of the ring centre
			const dx = Math.sin(time * speed * 0.7) * drift * qualityScale;
			const dy = Math.cos(time * speed * 0.51) * drift * 0.55 * qualityScale;

			if (mouseReact) {
				lerped.x += 0.04 * (mouse.x - lerped.x);
				lerped.y += 0.04 * (mouse.y - lerped.y);
				program.uniforms.uCenter.value = [lerped.x + dx * 0.4, lerped.y + dy * 0.4];
			} else {
				program.uniforms.uCenter.value = [cx / 100 + dx, cy / 100 + dy];
			}

			program.uniforms.uTime.value = time;
			program.uniforms.uBandFibers.value = Math.min(1, Math.max(0, bandFibers));
			renderer.render({ scene: mesh });
			startLoop();
		}

		function stopLoop() {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
				if (import.meta.env.DEV) performance.mark('shimmerring:loop:stop');
			}
		}

		function startLoop() {
			if (rafId === null) {
				rafId = requestAnimationFrame(update);
				if (import.meta.env.DEV) performance.mark('shimmerring:loop:start');
			}
		}

		loopControlsRef.current = { start: startLoop, stop: stopLoop };
		if (inViewMut.current) startLoop();
		if (import.meta.env.DEV) performance.mark('shimmerring:init:end');

		return () => {
			stopLoop();
			loopControlsRef.current = null;
			ro.disconnect();
			if (mouseReact) window.removeEventListener('mousemove', onMouseMove);
			if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
		};
	}, [depsKey, reducedMotion, dprCap, qualityScale]);

	useEffect(() => {
		const controls = loopControlsRef.current;
		if (!controls) return;
		if (inView) controls.start();
		else controls.stop();
	}, [inView]);

	// Reduced-motion: CSS ring approximation
	const innerPct = Math.round(innerRadius * 100);
	const midPct   = Math.round((innerRadius + bandWidth * 0.5) * 100);
	const outerPct = Math.round((innerRadius + bandWidth) * 100);

	return (
		<div
			ref={mergeRefs(ref, inViewRef, rootRef)}
			className={cn('relative h-full w-full overflow-hidden', className)}
		>
			<div ref={canvasRef} className="absolute inset-0" aria-hidden />

			{reducedMotion && (
				<div
					className="pointer-events-none absolute inset-0"
					style={{
						background: `radial-gradient(${outerPct * 2}% ${outerPct * 2}% at ${cx}% ${cy}%, transparent ${innerPct}%, ${color} ${midPct}%, transparent ${outerPct}%)`,
					}}
					aria-hidden
				/>
			)}
		</div>
	);
}
