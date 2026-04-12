import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { useDeferredValue, useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';
import { mergeRefs, resolvePerformanceQuality, useAutoPerformanceQuality, useInView, usePrefersReducedMotion, type PerformanceQuality } from '@/lib/containment';

// ─── GLSL ────────────────────────────────────────────────────────────────────

const VERT = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

/**
 * Animated mesh gradient — multiple soft colour blobs drifting on noise-driven
 * paths, blending where they overlap to produce organic, liquid-paint colour
 * fields. Inspired by Stripe's iconic gradient backgrounds.
 */
const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uSpeed;
uniform vec2  uResolution;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;
uniform vec3  uColor4;
uniform float uIntensity;
uniform float uBlobScale;

out vec4 fragColor;

// ── Simplex noise (2D) for smooth blob movement ─────────────────────
vec3 permute3(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

float snoise2(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute3(permute3(i.y + vec3(0.0, i1.y, 1.0))
                            + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m * m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// ── Blob: smooth radial falloff with noise-driven position ──────────
float blob(vec2 uv, vec2 center, float radius) {
  float d = length(uv - center);
  // Smooth cubic falloff — no hard edges
  float t = clamp(1.0 - d / radius, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  uv.x *= aspect;

  float t = uTime * uSpeed;

  // ── Four blob centres drift on independent noise-driven paths ───
  float scale = uBlobScale;

  vec2 c1 = vec2(
    0.3 * aspect + 0.25 * aspect * snoise2(vec2(t * 0.23, 0.0)),
    0.3 + 0.2 * snoise2(vec2(0.0, t * 0.19))
  );
  vec2 c2 = vec2(
    0.7 * aspect + 0.2 * aspect * snoise2(vec2(t * 0.17, 3.3)),
    0.7 + 0.25 * snoise2(vec2(4.1, t * 0.21))
  );
  vec2 c3 = vec2(
    0.5 * aspect + 0.3 * aspect * snoise2(vec2(t * 0.2, 7.7)),
    0.4 + 0.3 * snoise2(vec2(8.8, t * 0.15))
  );
  vec2 c4 = vec2(
    0.4 * aspect + 0.2 * aspect * snoise2(vec2(t * 0.15, 12.0)),
    0.6 + 0.2 * snoise2(vec2(13.5, t * 0.25))
  );

  // ── Compute blob influence ────────────────────────────────────────
  float b1 = blob(uv, c1, scale * 0.55);
  float b2 = blob(uv, c2, scale * 0.50);
  float b3 = blob(uv, c3, scale * 0.60);
  float b4 = blob(uv, c4, scale * 0.45);

  // ── Blend colours via blob weights ────────────────────────────────
  float totalWeight = b1 + b2 + b3 + b4;
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  if (totalWeight > 0.001) {
    col = (uColor1 * b1 + uColor2 * b2 + uColor3 * b3 + uColor4 * b4) / totalWeight;
    alpha = clamp(totalWeight * uIntensity, 0.0, 1.0);
    // Smoothstep for premium soft edge
    alpha = alpha * alpha * (3.0 - 2.0 * alpha);
  }

  // ── Subtle noise grain for premium texture ────────────────────────
  float grain = (snoise2(gl_FragCoord.xy * 0.8 + t * 50.0) - 0.5) * 0.012;
  col += grain;

  // Premultiplied alpha output
  fragColor = vec4(clamp(col * alpha, 0.0, 1.0), alpha);
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

// ─── Types ───────────────────────────────────────────────────────────────────

export type MeshGradientProps = {
	/** First blob colour (6-char hex). @default '#6366f1' */
	color1?: string;
	/** Second blob colour. @default '#ec4899' */
	color2?: string;
	/** Third blob colour. @default '#14b8a6' */
	color3?: string;
	/** Fourth blob colour. @default '#f59e0b' */
	color4?: string;
	/** Background colour behind the transparent blobs. @default '#030014' */
	bgColor?: string;
	/** Colour intensity / saturation of the blend (0.5–3). @default 1.5 */
	intensity?: number;
	/** Blob size multiplier (0.3–1.5). @default 0.8 */
	blobScale?: number;
	/** Animation speed multiplier. @default 0.4 */
	speed?: number;
	quality?: PerformanceQuality;
	className?: string;
	ref?: React.Ref<HTMLDivElement>;
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Animated mesh gradient — Stripe-style drifting colour fields.
 *
 * Four soft colour blobs drift on independent simplex-noise paths, blending
 * smoothly where they overlap. The result looks like liquid paint slowly
 * flowing across the canvas. Each blob uses a cubic hermite falloff for
 * premium soft edges — no hard boundaries.
 *
 * Powered by ogl (same lightweight WebGL wrapper as the other kam-ui shaders).
 * Pauses when off-screen; static CSS gradient fallback for reduced motion.
 */
export function MeshGradient({
	ref,
	className,
	color1 = '#6366f1',
	color2 = '#ec4899',
	color3 = '#14b8a6',
	color4 = '#f59e0b',
	bgColor = '#030014',
	intensity = 1.5,
	blobScale = 0.8,
	speed = 0.4,
	quality = 'auto',
}: MeshGradientProps) {
	const reducedMotion = usePrefersReducedMotion();
	const autoQuality = useAutoPerformanceQuality();
	const resolvedQuality = resolvePerformanceQuality(quality, autoQuality);
	const { ref: inViewRef, inView } = useInView();
	const rootRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLDivElement>(null);
	const loopControlsRef = useRef<{ start: () => void; stop: () => void } | null>(null);

	const inViewMut = useRef(inView);
	useEffect(() => { inViewMut.current = inView; }, [inView]);

	const dColor1 = useDeferredValue(color1);
	const dColor2 = useDeferredValue(color2);
	const dColor3 = useDeferredValue(color3);
	const dColor4 = useDeferredValue(color4);
	const qualityScale = resolvedQuality === 'low' ? 0.7 : resolvedQuality === 'medium' ? 0.85 : 1;
	const dprCap = resolvedQuality === 'low' ? 1 : resolvedQuality === 'medium' ? 1.5 : 2;
	const depsKey = `${dColor1}-${dColor2}-${dColor3}-${dColor4}-${speed}-${intensity}-${blobScale}-${resolvedQuality}`;

	useEffect(() => {
		if (reducedMotion) return;
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

		const program = new Program(gl, {
			vertex: VERT,
			fragment: FRAG,
			uniforms: {
				uTime:       { value: 0 },
				uSpeed:      { value: speed * qualityScale },
				uResolution: { value: [w, h] },
				uColor1:     { value: hexToRgb(dColor1) },
				uColor2:     { value: hexToRgb(dColor2) },
				uColor3:     { value: hexToRgb(dColor3) },
				uColor4:     { value: hexToRgb(dColor4) },
				uIntensity:  { value: intensity },
				uBlobScale:  { value: blobScale },
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
			style={{ backgroundColor: bgColor }}
		>
			<div ref={canvasRef} className="absolute inset-0" aria-hidden />

			{reducedMotion && (
				<div
					className="pointer-events-none absolute inset-0"
					style={{
						background: [
							`radial-gradient(ellipse 60% 55% at 30% 30%, ${color1}88 0%, transparent 70%)`,
							`radial-gradient(ellipse 55% 50% at 70% 70%, ${color2}88 0%, transparent 65%)`,
							`radial-gradient(ellipse 65% 60% at 50% 40%, ${color3}66 0%, transparent 70%)`,
							`radial-gradient(ellipse 50% 45% at 40% 60%, ${color4}55 0%, transparent 65%)`,
						].join(', '),
					}}
					aria-hidden
				/>
			)}
		</div>
	);
}
