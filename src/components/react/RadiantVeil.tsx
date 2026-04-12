'use client';

import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';
import { mergeRefs, resolvePerformanceQuality, useAutoPerformanceQuality, useInView, usePrefersReducedMotion, type PerformanceQuality } from '@/lib/containment';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Named focal-point presets matching pattern-craft radial positions. */
export type RadiantFrom =
	| 'top'
	| 'bottom'
	| 'left'
	| 'right'
	| 'center'
	| 'top-left'
	| 'top-right'
	| 'bottom-left'
	| 'bottom-right'
	| [number, number]; // arbitrary [x%, y%]

export type RadiantVeilVariant = 'default' | 'morph' | 'dual';

export type RadiantVeilProps = {
	/**
	 * Animation variant.
	 * - `default` — single radial with drift, breathe, and mouse follow.
	 * - `morph` — single radial whose accent colour cycles through `color` → `color2` → `color3`.
	 * - `dual` — two independent radial sources (`color` + `color2`) drifting on separate paths.
	 * @default 'default'
	 */
	variant?: RadiantVeilVariant;
	/**
	 * Gradient accent colour — the color at the outer edge of the radial.
	 * The inner zone is always `transparent`, letting the surface beneath show through.
	 */
	color?: string;
	/**
	 * Secondary accent colour — used by `morph` (palette endpoint) and `dual` (second radial source).
	 * @default '#ef4444'
	 */
	color2?: string;
	/**
	 * Tertiary accent colour — mid-palette waypoint for `morph` variant.
	 * @default '#ec4899'
	 */
	color3?: string;
	/**
	 * Focal-point position: preset name or explicit `[x%, y%]` pair.
	 * @default 'top'
	 */
	from?: RadiantFrom;
	/**
	 * Where the transparent zone ends and colour begins (0–100).
	 * `40` means the inner 40% is clear, colour starts there and fills to the edge.
	 * @default 40
	 */
	clearStop?: number;
	/** Gradient ellipse size as % of container dimensions. @default 125 */
	size?: number;
	/** Focal-point drift radius in percent. @default 12 */
	drift?: number;
	/** Animation speed multiplier. @default 0.5 */
	speed?: number;
	/**
	 * Colour zone breathes — clearStop oscillates ±amplitude pp.
	 * @default true
	 */
	breathe?: boolean;
	/** Breathing amplitude in percentage points. @default 14 */
	breatheAmplitude?: number;
	/**
	 * Focal point follows mouse (react-bits style smooth lerp).
	 * Mouse tracking uses `window` mousemove so `pointer-events: none` is preserved.
	 * @default true
	 */
	mouseReact?: boolean;
	quality?: PerformanceQuality;
	/** React 19: passed as a plain prop — no forwardRef needed. */
	ref?: React.Ref<HTMLDivElement>;
	className?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRESETS: Record<string, [number, number]> = {
	top: [50, 10],
	bottom: [50, 90],
	left: [10, 50],
	right: [90, 50],
	center: [50, 50],
	'top-left': [10, 10],
	'top-right': [90, 10],
	'bottom-left': [10, 90],
	'bottom-right': [90, 90],
};

function resolveFrom(from: RadiantFrom): [number, number] {
	if (Array.isArray(from)) return from;
	return PRESETS[from] ?? PRESETS['top']!;
}

function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace('#', '');
	const n = h.length === 3
		? parseInt(h[0] + h[0] + h[1] + h[1] + h[2] + h[2], 16)
		: parseInt(h, 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpRgb(
	a: [number, number, number],
	b: [number, number, number],
	t: number,
): string {
	const r = Math.round(a[0] + (b[0] - a[0]) * t);
	const g = Math.round(a[1] + (b[1] - a[1]) * t);
	const bl = Math.round(a[2] + (b[2] - a[2]) * t);
	return `rgb(${r},${g},${bl})`;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Transparent radial-gradient overlay — animated pattern-craft radials.
 *
 * The inner zone is `transparent`; whatever sits beneath shows through.
 * Three simultaneous animation dimensions (react-bits principles):
 *
 *  1. **Focal drift** — Lissajous path wandering ±`drift`% from the base position.
 *  2. **Breathe** — `clearStop` oscillates ±`breatheAmplitude` pp, making the
 *     colour zone visibly expand and contract.
 *  3. **Mouse follow** — `window` mousemove → smooth lerp of focal point toward
 *     cursor. `pointer-events: none` is preserved; tracking via `window` instead.
 *
 * Animation always runs — no inView gating (CSS var updates cost ~0 CPU).
 * Reduced-motion: static gradient, no rAF started.
 *
 * React 19: `ref` is a plain prop — no `forwardRef` wrapper.
 */
export function RadiantVeil({
	ref,
	className,
	variant = 'default',
	color = '#7c3aed',
	color2 = '#ef4444',
	color3 = '#ec4899',
	from = 'top',
	clearStop = 40,
	size = 125,
	drift = 12,
	speed = 0.5,
	breathe = true,
	breatheAmplitude = 14,
	mouseReact = true,
	quality = 'auto',
}: RadiantVeilProps) {
	const reducedMotion = usePrefersReducedMotion();
	const autoQuality = useAutoPerformanceQuality();
	const resolvedQuality = resolvePerformanceQuality(quality, autoQuality);
	const { ref: inViewRef, inView } = useInView();
	const rootRef = useRef<HTMLDivElement>(null);
	const loopControlsRef = useRef<{ start: () => void; stop: () => void } | null>(null);
	const speedScale = resolvedQuality === 'low' ? 0.7 : resolvedQuality === 'medium' ? 0.85 : 1;
	const motionScale = resolvedQuality === 'low' ? 0.6 : resolvedQuality === 'medium' ? 0.8 : 1;

	const [baseX, baseY] = resolveFrom(from);

	useEffect(() => {
		const el = rootRef.current;
		if (!el) return;

		// Seed static values — visible immediately, no pop
		el.style.setProperty('--cx', `${baseX}%`);
		el.style.setProperty('--cy', `${baseY}%`);
		el.style.setProperty('--cs', `${clearStop}%`);
		if (variant === 'dual') {
			el.style.setProperty('--cx2', `${100 - baseX}%`);
			el.style.setProperty('--cy2', `${100 - baseY}%`);
		}
		if (variant === 'morph') {
			el.style.setProperty('--accent', color);
		}

		if (reducedMotion) return;

		// React-bits pattern: smooth lerp state
		const mouse = { x: baseX, y: baseY };     // raw mouse target (% of element)
		const lerped = { x: baseX, y: baseY };     // smoothed current position

		// Track via window so pointer-events: none is preserved on overlay
		function onMouseMove(e: MouseEvent) {
			const rect = el!.getBoundingClientRect();
			mouse.x = ((e.clientX - rect.left) / rect.width) * 100;
			mouse.y = ((e.clientY - rect.top) / rect.height) * 100;
		}
		if (mouseReact) window.addEventListener('mousemove', onMouseMove, { passive: true });

		// React-bits: always-on rAF — no inView gate (CSS vars are essentially free)
		let rafId: number | null = null;
		const t0 = performance.now();

		// Morph palette (pre-parsed outside loop)
		const morphColors = variant === 'morph'
			? (() => {
				const c1 = hexToRgb(color);
				const c2 = hexToRgb(color2);
				const c3 = hexToRgb(color3);
				return [c1, c2, c3, c2, c1] as [number, number, number][];
			})()
			: null;

		function update(now: number) {
			rafId = null;
			if (!inView) return;
			startLoop();

			const t = (now - t0) * 0.001 * speed * speedScale; // elapsed seconds × speed

			if (variant === 'dual') {
				// Two independent drifting radial sources
				const x1 = baseX + Math.sin(t * 0.4) * drift * motionScale;
				const y1 = baseY + Math.cos(t * 0.3) * drift * 0.6 * motionScale;
				const x2 = (100 - baseX) + Math.sin(t * 0.35 + 2.0) * drift * 0.8 * motionScale;
				const y2 = (100 - baseY) + Math.cos(t * 0.45 + 1.0) * drift * 0.7 * motionScale;

				if (mouseReact) {
					lerped.x += 0.04 * (mouse.x - lerped.x);
					lerped.y += 0.04 * (mouse.y - lerped.y);
					const mx = (lerped.x - 50) * 0.15;
					const my = (lerped.y - 50) * 0.15;
					el!.style.setProperty('--cx', `${x1 + mx}%`);
					el!.style.setProperty('--cy', `${y1 + my}%`);
					el!.style.setProperty('--cx2', `${x2 - mx}%`);
					el!.style.setProperty('--cy2', `${y2 - my}%`);
				} else {
					el!.style.setProperty('--cx', `${x1}%`);
					el!.style.setProperty('--cy', `${y1}%`);
					el!.style.setProperty('--cx2', `${x2}%`);
					el!.style.setProperty('--cy2', `${y2}%`);
				}

				if (breathe) {
					const cs = clearStop + Math.sin(t * 0.7) * breatheAmplitude * motionScale;
					el!.style.setProperty('--cs', `${Math.max(5, cs)}%`);
				}
				return;
			}

			// ① Lissajous autonomous drift (default + morph)
			const driftX = Math.sin(t) * drift * motionScale;
			const driftY = Math.cos(t * 0.73) * drift * 0.55 * motionScale;

			// ② React-bits smooth lerp toward mouse (lerp factor 0.04 = soft follow)
			if (mouseReact) {
				lerped.x += 0.04 * (mouse.x - lerped.x);
				lerped.y += 0.04 * (mouse.y - lerped.y);
				el!.style.setProperty('--cx', `${lerped.x + driftX * 0.25}%`);
				el!.style.setProperty('--cy', `${lerped.y + driftY * 0.25}%`);
			} else {
				el!.style.setProperty('--cx', `${baseX + driftX}%`);
				el!.style.setProperty('--cy', `${baseY + driftY}%`);
			}

			// ③ Breathe — clearStop oscillates on a different frequency than drift
			if (breathe) {
				const cs = clearStop + Math.sin(t * 0.7) * breatheAmplitude * motionScale;
				el!.style.setProperty('--cs', `${Math.max(5, cs)}%`);
			}

			// ④ Morph — cycle accent colour
			if (variant === 'morph' && morphColors) {
				const progress = (t * 0.3) % (morphColors.length - 1);
				const idx = Math.floor(progress);
				const morphed = lerpRgb(morphColors[idx], morphColors[(idx + 1) % morphColors.length], progress - idx);
				el!.style.setProperty('--accent', morphed);
			}
		}

		function stopLoop() {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
		}

		function startLoop() {
			if (rafId === null) {
				rafId = requestAnimationFrame(update);
			}
		}

		loopControlsRef.current = { start: startLoop, stop: stopLoop };
		if (inView) startLoop();

		return () => {
			stopLoop();
			loopControlsRef.current = null;
			if (mouseReact) window.removeEventListener('mousemove', onMouseMove);
		};
	}, [reducedMotion, variant, color, color2, color3, drift, speed, breathe, breatheAmplitude, baseX, baseY, clearStop, mouseReact, motionScale, speedScale]);

	useEffect(() => {
		const controls = loopControlsRef.current;
		if (!controls) return;
		if (inView) controls.start();
		else controls.stop();
	}, [inView]);

	const dualBg = [
		`radial-gradient(${size * 0.72}% ${size * 0.72}% at var(--cx, ${baseX}%) var(--cy, ${baseY}%), ${color} 0%, transparent 70%)`,
		`radial-gradient(${size * 0.64}% ${size * 0.64}% at var(--cx2, ${100 - baseX}%) var(--cy2, ${100 - baseY}%), ${color2} 0%, transparent 65%)`,
	].join(', ');

	const style: React.CSSProperties = variant === 'dual'
		? { background: dualBg }
		: variant === 'morph'
			? { background: `radial-gradient(${size}% ${size}% at var(--cx, ${baseX}%) var(--cy, ${baseY}%), transparent var(--cs, ${clearStop}%), var(--accent, ${color}) 100%)` }
			: { background: `radial-gradient(${size}% ${size}% at var(--cx, ${baseX}%) var(--cy, ${baseY}%), transparent var(--cs, ${clearStop}%), ${color} 100%)` };

	return (
		<div
			ref={mergeRefs(ref, inViewRef, rootRef)}
			className={cn('pointer-events-none absolute inset-0', className)}
			style={style}
			aria-hidden
		/>
	);
}
