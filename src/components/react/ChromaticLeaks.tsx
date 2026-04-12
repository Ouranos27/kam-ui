'use client';

import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';
import { mergeRefs, resolvePerformanceQuality, useAutoPerformanceQuality, useInView, usePrefersReducedMotion, type PerformanceQuality } from '@/lib/containment';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChromaticLeaksProps = {
	/** Top-left corner radial color. */
	color1?: string;
	/** Bottom-right corner radial color. */
	color2?: string;
	/** Top-right corner radial color. */
	color3?: string;
	/** Bottom-left corner radial color. */
	color4?: string;
	/** Gradient ellipse size as % of container. @default 110 */
	size?: number;
	/**
	 * Transparent zone radius (0–100). Larger = more of the center is clear.
	 * @default 42
	 */
	clearStop?: number;
	/** Autonomous drift radius for each radial in percent. @default 8 */
	drift?: number;
	/** Animation speed multiplier. @default 0.4 */
	speed?: number;
	/** Color zones breathe — clearStop oscillates independently per radial. @default true */
	breathe?: boolean;
	/** Breathing amplitude in percentage points. @default 10 */
	breatheAmplitude?: number;
	/**
	 * Focal points follow mouse (react-bits style smooth lerp).
	 * Each corner has a different attraction strength, creating a parallax effect.
	 * @default true
	 */
	mouseReact?: boolean;
	quality?: PerformanceQuality;
	className?: string;
	/** React 19: passed as a plain prop — no forwardRef needed. */
	ref?: React.Ref<HTMLDivElement>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

/** Base corner positions for the 4 radials [x%, y%]. */
const BASES: [number, number][] = [
	[7, 7],    // color1 — top-left
	[93, 93],  // color2 — bottom-right
	[93, 7],   // color3 — top-right
	[7, 93],   // color4 — bottom-left
];

/** Lissajous frequency multipliers per radial (makes each wander differently). */
const FREQ = [[1.0, 0.73], [0.9, 0.81], [0.7, 1.1], [1.3, 0.65]] as const;

/** Phase offsets so the four radials are never in sync. */
const PHASE = [0, Math.PI, Math.PI * 0.6, Math.PI * 1.4] as const;

/** Mouse attraction scale per corner (near corners attract more strongly). */
const MOUSE_SCALE = [0.09, 0.09, 0.09, 0.09] as const;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Four animated corner radials — each leaks colour from its corner while leaving
 * the centre of the composition transparent.
 *
 * react-bits animation model (same as RadiantVeil):
 *  1. **Lissajous drift** — each radial wanders on its own independent path.
 *  2. **Breathe** — each radial's clearStop oscillates out-of-phase.
 *  3. **Mouse parallax** — all four corners drift gently toward the cursor,
 *     creating a field-of-light following effect.
 *
 * Always-on rAF (CSS var updates cost ~0 CPU). No inView gate.
 * Reduced-motion: static gradients, no rAF.
 *
 * React 19: `ref` is a plain prop — no `forwardRef` wrapper.
 */
export function ChromaticLeaks({
	ref,
	className,
	color1 = '#7c3aed',
	color2 = '#f97316',
	color3 = '#0ea5e9',
	color4 = '#10b981',
	size = 110,
	clearStop = 42,
	drift = 8,
	speed = 0.4,
	breathe = true,
	breatheAmplitude = 10,
	mouseReact = true,
	quality = 'auto',
}: ChromaticLeaksProps) {
	const reducedMotion = usePrefersReducedMotion();
	const autoQuality = useAutoPerformanceQuality();
	const resolvedQuality = resolvePerformanceQuality(quality, autoQuality);
	const { ref: inViewRef, inView } = useInView();
	const rootRef = useRef<HTMLDivElement>(null);
	const loopControlsRef = useRef<{ start: () => void; stop: () => void } | null>(null);
	const speedScale = resolvedQuality === 'low' ? 0.7 : resolvedQuality === 'medium' ? 0.85 : 1;
	const motionScale = resolvedQuality === 'low' ? 0.6 : resolvedQuality === 'medium' ? 0.8 : 1;

	const colors = [color1, color2, color3, color4];

	useEffect(() => {
		const el = rootRef.current;
		if (!el) return;

		// Seed static values immediately — no flash before rAF fires
		BASES.forEach(([bx, by], i) => {
			el.style.setProperty(`--cl${i}x`, `${bx}%`);
			el.style.setProperty(`--cl${i}y`, `${by}%`);
			el.style.setProperty(`--cl${i}s`, `${clearStop}%`);
		});

		if (reducedMotion) return;

		const mouse = { x: 50, y: 50 };
		const lerped = BASES.map(([bx, by]) => ({ x: bx, y: by }));

		function onMouseMove(e: MouseEvent) {
			const rect = el!.getBoundingClientRect();
			mouse.x = ((e.clientX - rect.left) / rect.width) * 100;
			mouse.y = ((e.clientY - rect.top) / rect.height) * 100;
		}
		if (mouseReact) window.addEventListener('mousemove', onMouseMove, { passive: true });

		let rafId: number | null = null;
		const t0 = performance.now();

		function update(now: number) {
			rafId = null;
			if (!inView) return;
			startLoop();
			const t = (now - t0) * 0.001 * speed * speedScale;

			BASES.forEach(([bx, by], i) => {
				const [fx, fy] = FREQ[i]!;
				const ph = PHASE[i]!;

				// ① Autonomous Lissajous drift per radial
				const dx = Math.sin(t * fx + ph) * drift * motionScale;
				const dy = Math.cos(t * fy + ph) * drift * motionScale;

				// ② Mouse parallax — gentle bias toward cursor, each corner independently
				if (mouseReact) {
					const ms = MOUSE_SCALE[i]!;
					const tx = bx + (mouse.x - 50) * ms + dx;
					const ty = by + (mouse.y - 50) * ms + dy;
					lerped[i]!.x += 0.03 * (tx - lerped[i]!.x);
					lerped[i]!.y += 0.03 * (ty - lerped[i]!.y);
					el!.style.setProperty(`--cl${i}x`, `${lerped[i]!.x}%`);
					el!.style.setProperty(`--cl${i}y`, `${lerped[i]!.y}%`);
				} else {
					el!.style.setProperty(`--cl${i}x`, `${bx + dx}%`);
					el!.style.setProperty(`--cl${i}y`, `${by + dy}%`);
				}

				// ③ Independent breathing with per-radial phase offset
				if (breathe) {
					const cs = clearStop + Math.sin(t * 0.7 + ph * 0.5) * breatheAmplitude * motionScale;
					el!.style.setProperty(`--cl${i}s`, `${Math.max(5, cs)}%`);
				}
			});
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
	}, [reducedMotion, drift, speed, breathe, breatheAmplitude, clearStop, mouseReact, motionScale, speedScale]);

	useEffect(() => {
		const controls = loopControlsRef.current;
		if (!controls) return;
		if (inView) controls.start();
		else controls.stop();
	}, [inView]);

	// Colors are prop-literals in the gradient string; positions animate via CSS vars.
	const bgLayers = colors.map((color, i) =>
		`radial-gradient(${size}% ${size}% at var(--cl${i}x, ${BASES[i]![0]}%) var(--cl${i}y, ${BASES[i]![1]}%), transparent var(--cl${i}s, ${clearStop}%), ${color} 100%)`
	);

	return (
		<div
			ref={mergeRefs(ref, inViewRef, rootRef)}
			className={cn('pointer-events-none absolute inset-0', className)}
			style={{ background: bgLayers.join(', ') }}
			aria-hidden
		/>
	);
}
