import { Mesh, Program, Renderer, Texture, Triangle } from 'ogl';
import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';
import { mergeRefs, resolvePerformanceQuality, useAutoPerformanceQuality, useInView, usePrefersReducedMotion, type PerformanceQuality } from '@/lib/containment';

// ─── GLSL ────────────────────────────────────────────────────────────────────

const VERT = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

/**
 * Renders an equirectangular Milky Way panorama (from ESA Gaia DR2 data)
 * onto a sky dome, with optional slow rotation and brightness control.
 *
 * The panorama is in galactic coordinates. The shader maps screen UVs
 * to a hemisphere view, then converts to equirectangular texture lookup.
 */
const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uSpeed;
uniform vec2  uResolution;
uniform float uBrightness;
uniform float uRotation;
uniform float uTilt;
uniform sampler2D uPanorama;

in vec2 vUv;
out vec4 fragColor;

const float PI = 3.14159265359;

// ── Hash for stars ──────────────────────────────────────────────────
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453);
}

void main() {
  float aspect = uResolution.x / uResolution.y;

  // ── Panorama UV — direct equirectangular window ───────────────────
  // Screen centre = galactic equator (the bright Milky Way band).
  // uTilt shifts vertically (galactic latitude), uRotation shifts horizontally.
  float rot = uRotation + uTime * uSpeed * 0.03;

  // Field of view: how much of the panorama is visible vertically
  float fovY = 0.5;  // fraction of the full sphere visible vertically
  float fovX = fovY * aspect;

  vec2 panoUv = vec2(
    vUv.x * fovX - fovX * 0.5 + rot / (2.0 * PI),  // horizontal pan
    (1.0 - vUv.y) * fovY + (0.5 - fovY * 0.5) + uTilt / PI  // vertical, centred + tilt
  );
  // Wrap horizontally
  panoUv.x = fract(panoUv.x);
  // Clamp vertically to avoid wrapping artefacts
  panoUv.y = clamp(panoUv.y, 0.0, 1.0);

  // ── Sample Milky Way texture ──────────────────────────────────────
  vec3 milky = texture(uPanorama, panoUv).rgb;

  // Linearize from sRGB
  milky = pow(milky, vec3(2.2));
  milky *= uBrightness;

  // ── Point stars on top of nebulosity ──────────────────────────────
  vec3 starTotal = vec3(0.0);

  // Bright stars
  vec2 starUv1 = floor(gl_FragCoord.xy / 8.0);
  float h1 = hash(starUv1 + 0.31);
  float bright1 = step(0.985, h1);
  float twinkle1 = 0.7 + 0.3 * sin(uTime * (1.0 + h1 * 2.0) + h1 * 60.0);
  float temp1 = hash2(starUv1 + 0.17);
  vec3 starColor1 = mix(vec3(1.0, 0.85, 0.6), vec3(0.75, 0.85, 1.0), temp1);
  vec2 starCenter1 = (starUv1 + vec2(hash(starUv1), hash2(starUv1)) * 0.8 + 0.1) * 8.0;
  float px1 = length(gl_FragCoord.xy - starCenter1);
  float starShape1 = smoothstep(2.5, 0.5, px1);
  starTotal += starColor1 * bright1 * twinkle1 * starShape1 * 1.0;

  // Dim stars
  vec2 starUv2 = floor(gl_FragCoord.xy / 4.0);
  float h2 = hash(starUv2 + 0.73);
  float bright2 = step(0.99, h2);
  float twinkle2 = 0.5 + 0.5 * sin(uTime * (1.8 + h2 * 3.0) + h2 * 90.0);
  vec2 starCenter2 = (starUv2 + vec2(hash(starUv2 + 5.3), hash2(starUv2 + 5.3)) * 0.7 + 0.15) * 4.0;
  float px2 = length(gl_FragCoord.xy - starCenter2);
  float starShape2 = smoothstep(1.2, 0.2, px2);
  starTotal += vec3(0.6, 0.63, 0.72) * bright2 * twinkle2 * starShape2 * 0.35;

  // ── Deep background ───────────────────────────────────────────────
  vec3 bgColor = vec3(0.001, 0.002, 0.008);

  // ── Composite ─────────────────────────────────────────────────────
  vec3 color = bgColor + milky + starTotal;

  // Tone mapping — gentle Reinhard to preserve dark sky
  color = color / (1.0 + color);
  color = pow(color, vec3(1.0 / 2.2));

  fragColor = vec4(color, 1.0);
}`;

// ─── Types ───────────────────────────────────────────────────────────────────

export type MilkyWayProps = {
	/** Brightness multiplier for the Milky Way texture. @default 1.5 */
	brightness?: number;
	/** Initial rotation offset in radians. @default 0 */
	rotation?: number;
	/** Tilt angle in radians — pitches the galactic plane into view. @default 0.0 */
	tilt?: number;
	/** Animation speed multiplier. @default 0.15 */
	speed?: number;
	/** Path to the equirectangular panorama. @default '/milky-way/milky-way.jpg' */
	panoramaUrl?: string;
	quality?: PerformanceQuality;
	className?: string;
	ref?: React.Ref<HTMLDivElement>;
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Milky Way sky background using ESA Gaia DR2 colour data.
 *
 * Renders an equirectangular panorama of the Milky Way (derived from ESA's
 * Gaia space observatory colour map) onto a sky dome hemisphere. Procedural
 * point stars are layered on top for added sparkle. The galaxy slowly rotates.
 *
 * Star data credit: ESA/Gaia/DPAC (CC BY-SA 3.0 IGO).
 */
export function MilkyWay({
	ref,
	className,
	brightness = 1.5,
	rotation = 0,
	tilt = 0.0,
	speed = 0.15,
	panoramaUrl = '/milky-way/milky-way.jpg',
	quality = 'auto',
}: MilkyWayProps) {
	const reducedMotion = usePrefersReducedMotion();
	const autoQuality = useAutoPerformanceQuality();
	const resolvedQuality = resolvePerformanceQuality(quality, autoQuality);
	const { ref: inViewRef, inView } = useInView();
	const rootRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLDivElement>(null);
	const loopControlsRef = useRef<{ start: () => void; stop: () => void } | null>(null);

	const inViewMut = useRef(inView);
	useEffect(() => { inViewMut.current = inView; }, [inView]);

	const dprCap = resolvedQuality === 'low' ? 1 : resolvedQuality === 'medium' ? 1.5 : 2;
	const depsKey = `${brightness}-${rotation}-${tilt}-${speed}-${panoramaUrl}-${resolvedQuality}`;

	useEffect(() => {
		if (reducedMotion) return;
		const container = canvasRef.current;
		if (!container) return;

		let renderer: Renderer;
		let rafId: number | null = null;

		try {
			renderer = new Renderer({
				alpha: false,
				antialias: false,
				dpr: Math.min(window.devicePixelRatio || 1, dprCap),
			});
		} catch {
			return;
		}

		const gl = renderer.gl;
		gl.clearColor(0, 0, 0, 1);

		const geometry = new Triangle(gl);
		if (geometry.attributes.uv) delete geometry.attributes.uv;

		const w = container.offsetWidth || 800;
		const h = container.offsetHeight || 600;

		// Create placeholder texture, load panorama async
		const panoTexture = new Texture(gl, {
			generateMipmaps: false,
		});
		panoTexture.minFilter = gl.LINEAR;
		panoTexture.magFilter = gl.LINEAR;

		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => {
			panoTexture.image = img;
		};
		img.src = panoramaUrl;

		const program = new Program(gl, {
			vertex: VERT,
			fragment: FRAG,
			uniforms: {
				uTime:       { value: 0 },
				uSpeed:      { value: speed },
				uResolution: { value: [w, h] },
				uBrightness: { value: brightness },
				uRotation:   { value: rotation },
				uTilt:       { value: tilt },
				uPanorama:   { value: panoTexture },
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
			renderer.setSize(container.offsetWidth, container.offsetHeight);
			syncResolutionUniform();
		});
		ro.observe(container);
		renderer.setSize(w, h);
		syncResolutionUniform();

		function update(ts: number) {
			rafId = null;
			if (!inViewMut.current) return;

			program.uniforms.uTime.value = ts * 0.001;
			renderer.render({ scene: mesh });
			startLoop();
		}

		function stopLoop() {
			if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
		}

		function startLoop() {
			if (rafId === null) { rafId = requestAnimationFrame(update); }
		}

		loopControlsRef.current = { start: startLoop, stop: stopLoop };
		if (inViewMut.current) startLoop();

		return () => {
			stopLoop();
			loopControlsRef.current = null;
			ro.disconnect();
			if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
		};
	}, [depsKey, reducedMotion, dprCap]);

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
						background: 'linear-gradient(to bottom, #000510 0%, #020824 50%, #0a0a14 100%)',
					}}
					aria-hidden
				/>
			)}
		</div>
	);
}
