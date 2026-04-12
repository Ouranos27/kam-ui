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
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec2  uResolution;
uniform float uCenterY;    // UV Y of the crown centre — typically > 1 (above canvas)
uniform float uRadius1;    // inner ring radius in aspect-corrected UV units
uniform float uRadius2;    // outer haze radius in aspect-corrected UV units
uniform float uShimmer;    // noise amplitude on the ring edges (0–1)
uniform sampler2D uNoiseTexture;
uniform float uArcFibers;  // 0 = off, polar texture detail on the arcs

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
  // uResolution must match gl_FragCoord space (drawing buffer) so the crown
  // stays centred on HiDPI — same fix as ChromaticField / SolarFlare.
  vec2  uv      = gl_FragCoord.xy / uResolution;
  float aspect  = uResolution.x / uResolution.y;

  // Ring centre: horizontally canvas-centred, vertically at uCenterY (UV 0–1, bottom=0)
  vec2  pos     = vec2((uv.x - 0.5) * aspect, uv.y - uCenterY);
  float r       = length(pos);
  float angle   = atan(pos.y, pos.x);

  float t = uTime * uSpeed;

  // Polar-sampled cached noise — fibrous highlights along the arc (optional)
  float polarR  = r * 2.4;
  float polarA  = (2.0 * atan(pos.x, pos.y)) / 6.28318530718 * 0.32;
  vec2  puv     = vec2(polarR, polarA);
  float ft      = t * 0.5;
  vec4  nf1     = texture(uNoiseTexture, puv * vec2(0.24, 6.2) + vec2(-ft * 0.07, 0.0));
  vec4  nf2     = texture(uNoiseTexture, puv * vec2(0.16, 4.0) + vec2(-ft * 0.12, 0.0));
  float nBlend  = nf1.r * 0.55 + nf2.r * 0.45;
  float fiberMod = mix(1.0, 0.84 + 0.32 * nBlend, uArcFibers);

  // Organic noise along the ring azimuth
  float n1 = snoise(vec2(angle * 1.5 + t * 0.30, t * 0.12));
  float n2 = snoise(vec2(angle * 3.2 - t * 0.40, t * 0.18)) * 0.40;
  float n3 = snoise(vec2(angle * 6.8 + t * 0.80, t * 0.25)) * 0.20;
  float nv = n1 + n2 + n3;   // ≈ −1.6 … 1.6

  // ── Ring 1 — inner edge, tight and bright ──────────────────────────────────
  float disp1  = nv * uShimmer * uRadius1 * 0.09;
  float sigma1 = uRadius1 * 0.055;
  float ring1  = exp(-pow((r - uRadius1 - disp1) / max(sigma1, 0.001), 2.0));

  // Sparkle hot-spots on ring 1
  float spark1 = snoise(vec2(angle * 8.5 + t * 1.4, r * 6.0 - t * 0.5)) * 0.5 + 0.5;
  ring1 = ring1 * (1.0 + spark1 * uShimmer * 0.5);

  // ── Ring 2 — outer haze, wide and soft ────────────────────────────────────
  float disp2  = nv * uShimmer * uRadius2 * 0.07;
  float sigma2 = uRadius2 * 0.14;
  float ring2  = exp(-pow((r - uRadius2 - disp2) / max(sigma2, 0.001), 2.0)) * 0.55;

  ring1 *= fiberMod;
  ring2 *= mix(1.0, fiberMod, 0.72);

  // ── Compose ───────────────────────────────────────────────────────────────
  vec3  finalColor = uColor1 * ring1 + uColor2 * ring2;
  float alpha      = clamp(ring1 + ring2 * 0.70, 0.0, 1.0);

  fragColor = vec4(finalColor, alpha);
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

export type CrownGlowProps = {
	/**
	 * Inner ring colour — tight, bright arc (6-char hex).
	 * @default '#a855f7'
	 */
	color1?: string;
	/**
	 * Outer haze colour — wide, soft corona (6-char hex).
	 * @default '#7c3aed'
	 */
	color2?: string;
	/**
	 * UV Y of the ring centre in normalised canvas space, where 1.0 = top edge.
	 * Values > 1 place the centre above the visible canvas, exposing only the
	 * lower arc — the higher the value the more the crown is "pushed up".
	 * @default 1.25
	 */
	centerY?: number;
	/**
	 * Inner ring radius in aspect-corrected UV units.
	 * With the default centerY and a 16 ∶ 9 canvas, 0.65 gives a dramatic
	 * arc spanning most of the canvas width in the upper third.
	 * @default 0.65
	 */
	radius1?: number;
	/**
	 * Outer haze radius in aspect-corrected UV units.
	 * Should be larger than radius1.
	 * @default 0.9
	 */
	radius2?: number;
	/**
	 * Noise deformation amplitude — how organically the ring edges shimmer.
	 * 0 = smooth arc, 1 = highly turbulent.
	 * @default 0.55
	 */
	shimmer?: number;
	/**
	 * Polar-sampled GPU noise on the arcs (0 = off). Adds fine fibrous structure
	 * like the solar corona; independent of `shimmer`.
	 * @default 0.55
	 */
	arcFibers?: number;
	/** Shader time scale — higher = faster shimmer. @default 0.45 */
	speed?: number;
	quality?: PerformanceQuality;
	className?: string;
	/** React 19: ref as a plain prop — no forwardRef wrapper. */
	ref?: React.Ref<HTMLDivElement>;
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * WebGL shader crown glow — a large halo ring whose centre is positioned above
 * the visible canvas, so only the lower arc is visible: a glowing arch at the
 * top of the composition.
 *
 * Two concentric rings:
 *  1. An inner, tight arc that shimmers with angle-based simplex noise.
 *  2. An outer, wide haze that creates a corona / atmospheric depth.
 *  3. Optional polar-sampled cached noise for fibrous arc detail (HiDPI-centred UVs).
 *
 * This is the animated version of the "Lovable-style" radial glow —
 * same architectural aesthetic (dark background, coloured light bleeding in
 * from the top) but driven entirely by a WebGL fragment shader.
 *
 * Pauses when off-screen; static CSS gradient when `prefers-reduced-motion`.
 * React 19: `ref` is a plain prop — no `forwardRef` wrapper.
 */
export function CrownGlow({
	ref,
	className,
	color1 = '#a855f7',
	color2 = '#7c3aed',
	centerY = 1.25,
	radius1 = 0.65,
	radius2 = 0.9,
	shimmer = 0.55,
	arcFibers = 0.55,
	speed = 0.45,
	quality = 'auto',
}: CrownGlowProps) {
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

	const dColor1 = useDeferredValue(color1);
	const dColor2 = useDeferredValue(color2);
	const qualityScale = resolvedQuality === 'low' ? 0.7 : resolvedQuality === 'medium' ? 0.85 : 1;
	const dprCap = resolvedQuality === 'low' ? 1 : resolvedQuality === 'medium' ? 1.5 : 2;
	const depsKey = `${dColor1}-${dColor2}-${centerY}-${radius1}-${radius2}-${shimmer}-${arcFibers}-${speed}-${resolvedQuality}`;

	useEffect(() => {
		if (reducedMotion) return;
		if (import.meta.env.DEV) performance.mark('crownglow:init:start');
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
				uTime:       { value: 0 },
				uSpeed:      { value: speed * qualityScale },
				uColor1:     { value: hexToRgb(dColor1) },
				uColor2:     { value: hexToRgb(dColor2) },
				uResolution: { value: [w, h] },
				uCenterY:    { value: centerY },
				uRadius1:    { value: radius1 },
				uRadius2:    { value: radius2 },
				uShimmer:    { value: shimmer * qualityScale },
				uNoiseTexture: { value: noiseTexture },
				uArcFibers:  { value: Math.min(1, Math.max(0, arcFibers)) },
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

		function update(ts: number) {
			rafId = null;
			if (!inViewMut.current) return;
			program.uniforms.uTime.value = ts * 0.001;
			program.uniforms.uArcFibers.value = Math.min(1, Math.max(0, arcFibers));
			renderer.render({ scene: mesh });
			startLoop();
		}

		function stopLoop() {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
				if (import.meta.env.DEV) performance.mark('crownglow:loop:stop');
			}
		}

		function startLoop() {
			if (rafId === null) {
				rafId = requestAnimationFrame(update);
				if (import.meta.env.DEV) performance.mark('crownglow:loop:start');
			}
		}

		loopControlsRef.current = { start: startLoop, stop: stopLoop };
		if (inViewMut.current) startLoop();
		if (import.meta.env.DEV) performance.mark('crownglow:init:end');

		return () => {
			stopLoop();
			loopControlsRef.current = null;
			ro.disconnect();
			if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
		};
	}, [depsKey, reducedMotion, dprCap, qualityScale]);

	useEffect(() => {
		const controls = loopControlsRef.current;
		if (!controls) return;
		if (inView) controls.start();
		else controls.stop();
	}, [inView]);

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
						background: `radial-gradient(ellipse 120% 55% at 50% -10%, ${color1}55 0%, ${color2}30 35%, transparent 65%)`,
					}}
					aria-hidden
				/>
			)}
		</div>
	);
}
