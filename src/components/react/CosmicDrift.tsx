'use client';

import { Camera, Geometry, Mesh, Program, Renderer } from 'ogl';
import { useDeferredValue, useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';
import { mergeRefs, resolvePerformanceQuality, useAutoPerformanceQuality, useInView, usePrefersReducedMotion, type PerformanceQuality } from '@/lib/containment';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CosmicDriftProps = {
	className?: string;
	/** Sky-blue colour zone — tints particles and CSS gradient (6-char hex). */
	color1?: string;
	/** Violet colour zone (6-char hex). */
	color2?: string;
	/** Rose/pink colour zone (6-char hex). */
	color3?: string;
	/** Emerald colour zone (6-char hex). */
	color4?: string;
	/** Particle count. */
	particleCount?: number;
	/** Particle base size in pixels. */
	particleBaseSize?: number;
	/** Animation speed multiplier. */
	speed?: number;
	/** Runtime performance tier. @default 'auto' */
	quality?: PerformanceQuality;
	/** React 19: passed as a plain prop — no forwardRef needed. */
	ref?: React.Ref<HTMLDivElement>;
};

// ─── GLSL — react-bits Particles shaders ─────────────────────────────────────

const VERT = /* glsl */ `
  attribute vec3 position;
  attribute vec4 random;
  attribute vec3 color;

  uniform mat4 modelMatrix;
  uniform mat4 viewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uSpread;
  uniform float uBaseSize;
  uniform float uSizeRandomness;

  varying vec4 vRandom;
  varying vec3 vColor;

  void main() {
    vRandom = random;
    vColor  = color;

    vec3 pos  = position * uSpread;
    pos.z    *= 10.0;

    vec4 mPos = modelMatrix * vec4(pos, 1.0);
    float t   = uTime;
    mPos.x   += sin(t * random.z + 6.28 * random.w) * mix(0.1, 1.5, random.x);
    mPos.y   += sin(t * random.y + 6.28 * random.x) * mix(0.1, 1.5, random.w);
    mPos.z   += sin(t * random.w + 6.28 * random.y) * mix(0.1, 1.5, random.z);

    vec4 mvPos = viewMatrix * mPos;
    gl_PointSize = (uBaseSize * (1.0 + uSizeRandomness * (random.x - 0.5))) / length(mvPos.xyz);
    gl_Position  = projectionMatrix * mvPos;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  varying vec4 vRandom;
  varying vec3 vColor;

  void main() {
    vec2  uv     = gl_PointCoord.xy;
    float d      = length(uv - vec2(0.5));
    float circle = smoothstep(0.5, 0.4, d) * 0.8;
    gl_FragColor = vec4(vColor + 0.2 * sin(uv.yxx + uTime + vRandom.y * 6.28), circle);
  }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace('#', '');
	const n = parseInt(h, 16);
	return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function hexToRgba(hex: string, alpha: number): string {
	const h = hex.replace('#', '');
	return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${alpha})`;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Four CSS radial-gradient colour zones (pattern-craft `cosmic-aurora` style)
 * as a permanent base, with the react-bits ogl Particles shader floating above.
 *
 * The particle colours are drawn from the same four palette entries as the CSS
 * zones. `mix-blend-mode: screen` on the transparent WebGL canvas lets each
 * particle add light to whichever gradient zone it drifts through.
 *
 * - Layer 1 (bottom): CSS 4-zone radial gradient — instant, zero JS.
 * - Layer 2 (top):    ogl Particles (transparent, screen-blend) — pauses off-screen.
 * - Reduced-motion:   CSS gradient only.
 *
 * React 19: `ref` accepted as a plain prop — no `forwardRef` wrapper.
 */
export function CosmicDrift({
	ref,
	className,
	color1 = '#38bdf8',
	color2 = '#8b5cf6',
	color3 = '#ec4899',
	color4 = '#22c55e',
	particleCount = 180,
	particleBaseSize = 80,
	speed = 0.6,
	quality = 'auto',
}: CosmicDriftProps) {
	const reducedMotion = usePrefersReducedMotion();
	const autoQuality = useAutoPerformanceQuality();
	const resolvedQuality = resolvePerformanceQuality(quality, autoQuality);
	const { ref: inViewRef, inView } = useInView();
	const rootRef = useRef<HTMLDivElement>(null);
	const particlesRef = useRef<HTMLDivElement>(null);
	const loopControlsRef = useRef<{ start: () => void; stop: () => void } | null>(null);

	const inViewMut = useRef(inView);
	useEffect(() => {
		inViewMut.current = inView;
	}, [inView]);

	// Deferred so prop changes don't starve the rAF loop
	const dColor1 = useDeferredValue(color1);
	const dColor2 = useDeferredValue(color2);
	const dColor3 = useDeferredValue(color3);
	const dColor4 = useDeferredValue(color4);
	const qualityParticleScale = resolvedQuality === 'low' ? 0.45 : resolvedQuality === 'medium' ? 0.72 : 1;
	const qualitySpeedScale = resolvedQuality === 'low' ? 0.65 : resolvedQuality === 'medium' ? 0.82 : 1;
	const dSpeed = useDeferredValue(speed * qualitySpeedScale);

	const speedRef = useRef(dSpeed);
	useEffect(() => {
		speedRef.current = dSpeed;
	}, [dSpeed]);

	// ogl Particles — restarts when palette, count, size, or reducedMotion changes
	useEffect(() => {
		if (reducedMotion) return;
		if (import.meta.env.DEV) performance.mark('cosmicdrift:init:start');

		const container = particlesRef.current;
		if (!container) return;

		const palette = [dColor1, dColor2, dColor3, dColor4];
		const dpr = Math.min(window.devicePixelRatio || 1, 2);

		const renderer = new Renderer({ dpr, depth: false, alpha: true });
		const gl = renderer.gl;
		gl.clearColor(0, 0, 0, 0);
		container.appendChild(gl.canvas);

		const camera = new Camera(gl, { fov: 15 });
		camera.position.set(0, 0, 20);

		function resize() {
			const w = container!.clientWidth;
			const h = container!.clientHeight;
			renderer.setSize(w, h);
			camera.perspective({ aspect: gl.canvas.width / gl.canvas.height });
		}
		window.addEventListener('resize', resize);
		resize();

		// Build particle geometry
		const count = Math.max(48, Math.round(particleCount * qualityParticleScale));
		const positions = new Float32Array(count * 3);
		const randoms = new Float32Array(count * 4);
		const colors = new Float32Array(count * 3);

		for (let i = 0; i < count; i++) {
			let x: number, y: number, z: number, len: number;
			do {
				x = Math.random() * 2 - 1;
				y = Math.random() * 2 - 1;
				z = Math.random() * 2 - 1;
				len = x * x + y * y + z * z;
			} while (len > 1 || len === 0);
			const r = Math.cbrt(Math.random());
			positions.set([x * r, y * r, z * r], i * 3);
			randoms.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
			const col = hexToRgb(palette[Math.floor(Math.random() * palette.length)]!);
			colors.set(col, i * 3);
		}

		const geometry = new Geometry(gl, {
			position: { size: 3, data: positions },
			random: { size: 4, data: randoms },
			color: { size: 3, data: colors },
		});

		const program = new Program(gl, {
			vertex: VERT,
			fragment: FRAG,
			uniforms: {
				uTime: { value: 0 },
				uSpread: { value: 10 },
				uBaseSize: { value: particleBaseSize * dpr },
				uSizeRandomness: { value: 1 },
			},
			transparent: true,
			depthTest: false,
		});

		const mesh = new Mesh(gl, { mode: gl.POINTS, geometry, program });

		let rafId: number | null = null;
		let lastTime = performance.now();
		let elapsed = 0;

		function stopLoop() {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
				if (import.meta.env.DEV) performance.mark('cosmicdrift:loop:stop');
			}
		}

		function startLoop() {
			if (rafId === null) {
				lastTime = performance.now();
				rafId = requestAnimationFrame(update);
				if (import.meta.env.DEV) performance.mark('cosmicdrift:loop:start');
			}
		}

		function update(t: number) {
			rafId = null;
			if (!inViewMut.current) return;

			const delta = t - lastTime;
			lastTime = t;
			elapsed += delta * speedRef.current;

			program.uniforms.uTime.value = elapsed * 0.001;
			mesh.rotation.x = Math.sin(elapsed * 0.0002) * 0.1;
			mesh.rotation.y = Math.cos(elapsed * 0.0005) * 0.15;
			mesh.rotation.z += 0.01 * speedRef.current * 0.016;

			renderer.render({ scene: mesh, camera });
			startLoop();
		}
		loopControlsRef.current = { start: startLoop, stop: stopLoop };
		if (inViewMut.current) startLoop();
		if (import.meta.env.DEV) performance.mark('cosmicdrift:init:end');

		return () => {
			stopLoop();
			loopControlsRef.current = null;
			window.removeEventListener('resize', resize);
			if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
		};
	}, [reducedMotion, dColor1, dColor2, dColor3, dColor4, particleCount, particleBaseSize, qualityParticleScale]);

	useEffect(() => {
		const controls = loopControlsRef.current;
		if (!controls) return;
		if (inView) controls.start();
		else controls.stop();
	}, [inView]);

	// CSS base: cosmic-aurora 4-zone radial gradient
	const baseStyle: React.CSSProperties = {
		backgroundImage: [
			`radial-gradient(ellipse 120% 90% at 20% 30%, ${hexToRgba(color1, 0.38)} 0%, transparent 60%)`,
			`radial-gradient(ellipse 110% 100% at 80% 70%, ${hexToRgba(color2, 0.28)} 0%, transparent 70%)`,
			`radial-gradient(ellipse 100% 80% at 60% 20%, ${hexToRgba(color3, 0.22)} 0%, transparent 50%)`,
			`radial-gradient(ellipse 90% 110% at 40% 80%, ${hexToRgba(color4, 0.18)} 0%, transparent 65%)`,
		].join(', '),
	};

	return (
		<div
			ref={mergeRefs(ref, inViewRef, rootRef)}
			className={cn('relative h-full w-full overflow-hidden bg-[#0a0a0a]', className)}
		>
			{/* Layer 1 (bottom): CSS 4-zone radial gradient — pattern-craft cosmic-aurora style */}
			<div className="pointer-events-none absolute inset-0" style={baseStyle} aria-hidden />

			{/* Layer 2 (top): ogl Particles — screen-blends coloured sparks into each gradient zone */}
			{!reducedMotion && (
				<div
					ref={particlesRef}
					className="pointer-events-none absolute inset-0"
					style={{ mixBlendMode: 'screen' }}
					aria-hidden
				/>
			)}
		</div>
	);
}
