'use client';

import { useDeferredValue, useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';
import { mergeRefs, resolvePerformanceQuality, useAutoPerformanceQuality, useInView, usePrefersReducedMotion, type PerformanceQuality } from '@/lib/containment';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NebulaProps = {
	className?: string;
	/** Primary particle glow color (6-char hex). */
	color1?: string;
	/** Secondary particle glow color (6-char hex). */
	color2?: string;
	/** Number of Canvas 2D glowing orbital particles. */
	particleCount?: number;
	/** Orbital speed multiplier — higher = faster drift. */
	speed?: number;
	/** CSS dot grid cell size in px. */
	dotSpacing?: number;
	/** CSS dot radius in px. */
	dotSize?: number;
	/** CSS dot opacity (0–1). */
	dotOpacity?: number;
	/** Runtime performance tier. @default 'auto' */
	quality?: PerformanceQuality;
	/** React 19: passed as a plain prop — no forwardRef needed. */
	ref?: React.Ref<HTMLDivElement>;
};

// ─── Internal types ───────────────────────────────────────────────────────────

type Particle = {
	/** Orbit center X, as fraction of canvas width */
	cx: number;
	/** Orbit center Y, as fraction of canvas height */
	cy: number;
	/** Orbit X radius, as fraction of canvas width */
	rx: number;
	/** Orbit Y radius, as fraction of canvas height */
	ry: number;
	/** Current angle (radians) */
	angle: number;
	/** Angular velocity (rad/s), can be negative */
	angularSpeed: number;
	/** Base glow radius in logical px (scaled by dpr at draw time) */
	baseRadius: number;
	/** Pulse oscillation amplitude (fraction of baseRadius) */
	pulseFactor: number;
	/** Pulse oscillation frequency (Hz) */
	pulseSpeed: number;
	/** Pulse phase offset (radians) */
	pulsePhase: number;
	/** Hex color (#rrggbb) */
	color: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
	const h = hex.replace('#', '');
	const r = parseInt(h.slice(0, 2), 16);
	const g = parseInt(h.slice(2, 4), 16);
	const b = parseInt(h.slice(4, 6), 16);
	return `rgba(${r},${g},${b},${alpha})`;
}

function lerpColor(hex1: string, hex2: string, t: number): string {
	const a = hex1.replace('#', '');
	const b = hex2.replace('#', '');
	const r = Math.round(parseInt(a.slice(0, 2), 16) * (1 - t) + parseInt(b.slice(0, 2), 16) * t);
	const g = Math.round(parseInt(a.slice(2, 4), 16) * (1 - t) + parseInt(b.slice(2, 4), 16) * t);
	const bl = Math.round(parseInt(a.slice(4, 6), 16) * (1 - t) + parseInt(b.slice(4, 6), 16) * t);
	return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

function makeParticles(count: number, color1: string, color2: string): Particle[] {
	return Array.from({ length: count }, () => ({
		cx: 0.05 + Math.random() * 0.9,
		cy: 0.05 + Math.random() * 0.9,
		rx: 0.04 + Math.random() * 0.2,
		ry: 0.03 + Math.random() * 0.13,
		angle: Math.random() * Math.PI * 2,
		angularSpeed: (0.06 + Math.random() * 0.16) * (Math.random() < 0.5 ? 1 : -1),
		baseRadius: 22 + Math.random() * 62,
		pulseFactor: 0.12 + Math.random() * 0.28,
		pulseSpeed: 0.3 + Math.random() * 0.7,
		pulsePhase: Math.random() * Math.PI * 2,
		color: lerpColor(color1, color2, Math.random()),
	}));
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * CSS dot field (pattern-craft style) illuminated by Canvas 2D glowing orbital
 * particles. `mix-blend-mode: screen` on the canvas causes each particle bloom
 * to brighten the dots it drifts over — creating a layered nebula depth effect.
 *
 * - Layer 1 (bottom): CSS `radial-gradient` dot matrix — always rendered, zero JS cost.
 * - Layer 2 (top):    Canvas 2D blobs with screen blend — pauses off-screen.
 * - Reduced-motion:   CSS dots + static ambient gradients; no Canvas.
 *
 * React 19: `ref` accepted as a plain prop — no `forwardRef` wrapper.
 */
export function Nebula({
	ref,
	className,
	color1 = '#6366f1',
	color2 = '#a855f7',
	particleCount = 42,
	speed = 1.0,
	dotSpacing = 22,
	dotSize = 1,
	dotOpacity = 0.18,
	quality = 'auto',
}: NebulaProps) {
	const reducedMotion = usePrefersReducedMotion();
	const autoQuality = useAutoPerformanceQuality();
	const resolvedQuality = resolvePerformanceQuality(quality, autoQuality);
	const { ref: inViewRef, inView } = useInView();
	const rootRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const loopControlsRef = useRef<{ start: () => void; stop: () => void } | null>(null);

	// Mutable refs let the draw loop read the latest values without restarting
	const inViewMut = useRef(inView);
	useEffect(() => {
		inViewMut.current = inView;
	}, [inView]);

	const speedRef = useRef(speed);
	useEffect(() => {
		speedRef.current = speed;
	}, [speed]);

	// Deferred color values prevent the draw loop from blocking renders
	const dColor1 = useDeferredValue(color1);
	const dColor2 = useDeferredValue(color2);
	const qualityParticleScale = resolvedQuality === 'low' ? 0.5 : resolvedQuality === 'medium' ? 0.75 : 1;
	const qualitySpeedScale = resolvedQuality === 'low' ? 0.7 : resolvedQuality === 'medium' ? 0.85 : 1;

	// Particle array — rebuilt when count or palette changes, not the rAF loop
	const particlesRef = useRef<Particle[]>([]);
	useEffect(() => {
		const adjustedCount = Math.max(16, Math.round(particleCount * qualityParticleScale));
		particlesRef.current = makeParticles(adjustedCount, dColor1, dColor2);
	}, [particleCount, dColor1, dColor2, qualityParticleScale]);

	// Canvas animation loop — only restarts when reducedMotion state changes
	useEffect(() => {
		if (reducedMotion) return;
		if (import.meta.env.DEV) performance.mark('nebula:init:start');

		const canvas = canvasRef.current;
		const container = rootRef.current;
		if (!canvas || !container) return;

		// Seed particles on first mount if the effect above hasn't run yet
		if (particlesRef.current.length === 0) {
			particlesRef.current = makeParticles(particleCount, dColor1, dColor2);
		}

		const dpr = window.devicePixelRatio || 1;
		let rafId: number | null = null;
		let lastTime = 0;

		function resize() {
			if (!canvas || !container) return;
			const w = container.offsetWidth;
			const h = container.offsetHeight;
			canvas.width = w * dpr;
			canvas.height = h * dpr;
			canvas.style.width = `${w}px`;
			canvas.style.height = `${h}px`;
		}

		const ro = new ResizeObserver(resize);
		ro.observe(container);
		resize();

		function stopLoop() {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
				if (import.meta.env.DEV) performance.mark('nebula:loop:stop');
			}
		}

		function startLoop() {
			if (rafId === null) {
				lastTime = performance.now();
				rafId = requestAnimationFrame(draw);
				if (import.meta.env.DEV) performance.mark('nebula:loop:start');
			}
		}

		function draw(timestamp: number) {
			rafId = null;
			if (!inViewMut.current) return;

			const dt = Math.min((timestamp - lastTime) * 0.001, 0.05); // cap at 50ms to avoid jump on tab focus
			lastTime = timestamp;

			const ctx = canvas!.getContext('2d');
			if (!ctx) return;

			const W = canvas!.width;
			const H = canvas!.height;

			ctx.clearRect(0, 0, W, H);

			for (const p of particlesRef.current) {
				p.angle += p.angularSpeed * speedRef.current * qualitySpeedScale * dt;

				const px = (p.cx + Math.cos(p.angle) * p.rx) * W;
				const py = (p.cy + Math.sin(p.angle) * p.ry) * H;

				// Pulse the glow radius to breathe life into static drift
				const pulseR =
					p.baseRadius *
					dpr *
					(1 + p.pulseFactor * Math.sin(timestamp * 0.001 * p.pulseSpeed + p.pulsePhase));

				const grad = ctx.createRadialGradient(px, py, 0, px, py, pulseR);
				grad.addColorStop(0, hexToRgba(p.color, 0.62));
				grad.addColorStop(0.35, hexToRgba(p.color, 0.22));
				grad.addColorStop(1, hexToRgba(p.color, 0));

				ctx.beginPath();
				ctx.arc(px, py, pulseR, 0, Math.PI * 2);
				ctx.fillStyle = grad;
				ctx.fill();
			}
			startLoop();
		}

		loopControlsRef.current = { start: startLoop, stop: stopLoop };
		if (inViewMut.current) startLoop();
		if (import.meta.env.DEV) performance.mark('nebula:init:end');

		return () => {
			stopLoop();
			loopControlsRef.current = null;
			ro.disconnect();
		};
	}, [reducedMotion, qualitySpeedScale]); // speed / colors / count update via their own refs

	useEffect(() => {
		const controls = loopControlsRef.current;
		if (!controls) return;
		if (inView) controls.start();
		else controls.stop();
	}, [inView]);

	// CSS dot field — pattern-craft radial-gradient dot matrix, always on
	const dotStyle: React.CSSProperties = {
		backgroundImage: `radial-gradient(circle, rgba(255,255,255,${dotOpacity}) ${dotSize}px, transparent ${dotSize}px)`,
		backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
		// Radial mask fades the hard-edge dot field into the dark background
		maskImage: 'radial-gradient(ellipse 90% 90% at 50% 50%, black 38%, transparent 100%)',
		WebkitMaskImage: 'radial-gradient(ellipse 90% 90% at 50% 50%, black 38%, transparent 100%)',
	};

	return (
		<div
			ref={mergeRefs(ref, inViewRef, rootRef)}
			className={cn('relative h-full w-full overflow-hidden', className)}
		>
			{/* Layer 1 (bottom): CSS dot field — pattern-craft style, always rendered */}
			<div className="pointer-events-none absolute inset-0" style={dotStyle} aria-hidden />

			{/* Layer 2 (top): Canvas particles — screen blend illuminates the dots they orbit over */}
			{!reducedMotion && (
				<canvas
					ref={canvasRef}
					className="pointer-events-none absolute inset-0"
					style={{ mixBlendMode: 'screen' }}
					aria-hidden
				/>
			)}

			{/* Reduced-motion: soft ambient gradients over the dot field — no animation */}
			{reducedMotion && (
				<div
					className="pointer-events-none absolute inset-0"
					style={{
						background: `radial-gradient(ellipse 70% 60% at 28% 38%, ${color1}2a 0%, transparent 60%), radial-gradient(ellipse 55% 48% at 74% 64%, ${color2}22 0%, transparent 55%)`,
					}}
					aria-hidden
				/>
			)}
		</div>
	);
}
