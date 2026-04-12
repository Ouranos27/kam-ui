'use client';

import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';
import { mergeRefs, resolvePerformanceQuality, useAutoPerformanceQuality, useInView, usePrefersReducedMotion, type PerformanceQuality } from '@/lib/containment';

// ─── Types ────────────────────────────────────────────────────────────────────

export type HaloRingProps = {
	/**
	 * Ring colour — the colour at the band's peak.
	 * Inner zone and outer zone are transparent.
	 * @default '#a855f7'
	 */
	color?: string;
	/** Ring centre X position (0–100). @default 50 */
	cx?: number;
	/** Ring centre Y position (0–100). @default 50 */
	cy?: number;
	/** Gradient ellipse size as % of container dimensions. @default 130 */
	size?: number;
	/** Where the transparent inner zone ends and colour begins (0–100). @default 28 */
	innerStop?: number;
	/** Band width in percentage points (colour fades back to transparent after this). @default 38 */
	bandWidth?: number;
	/** Focal-point drift radius in percent. @default 10 */
	drift?: number;
	/** Animation speed multiplier. @default 0.45 */
	speed?: number;
	/**
	 * Band breathes — inner and outer edges oscillate, making the ring
	 * visibly widen and narrow.
	 * @default true
	 */
	breathe?: boolean;
	/** Breathing amplitude in percentage points. @default 12 */
	breatheAmplitude?: number;
	/**
	 * Ring centre follows mouse (react-bits smooth lerp).
	 * @default true
	 */
	mouseReact?: boolean;
	quality?: PerformanceQuality;
	className?: string;
	/** React 19: passed as a plain prop — no forwardRef needed. */
	ref?: React.Ref<HTMLDivElement>;
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Animated radial ring — transparent centre, colour band, transparent outer.
 *
 * Distinct from RadiantVeil: instead of colour bleeding to the edge, colour
 * occupies a floating band in the middle distance, leaving BOTH the centre
 * AND the outer zone clear. The band breathes and the ring drifts.
 *
 * react-bits animation model:
 *  1. **Drift** — ring centre wanders on a Lissajous path.
 *  2. **Breathe** — inner and outer edges of the band oscillate in opposite
 *     directions, so the ring pulses between a thin and a wide band.
 *  3. **Mouse follow** — centre lerps toward cursor position.
 *
 * Always-on rAF (CSS var updates cost ~0 CPU). No inView gate.
 * Reduced-motion: static ring, no rAF.
 *
 * React 19: `ref` is a plain prop — no `forwardRef` wrapper.
 */
export function HaloRing({
	ref,
	className,
	color = '#a855f7',
	cx = 50,
	cy = 50,
	size = 130,
	innerStop = 28,
	bandWidth = 38,
	drift = 10,
	speed = 0.45,
	breathe = true,
	breatheAmplitude = 12,
	mouseReact = true,
	quality = 'auto',
}: HaloRingProps) {
	const reducedMotion = usePrefersReducedMotion();
	const autoQuality = useAutoPerformanceQuality();
	const resolvedQuality = resolvePerformanceQuality(quality, autoQuality);
	const { ref: inViewRef, inView } = useInView();
	const rootRef = useRef<HTMLDivElement>(null);
	const loopControlsRef = useRef<{ start: () => void; stop: () => void } | null>(null);
	const speedScale = resolvedQuality === 'low' ? 0.7 : resolvedQuality === 'medium' ? 0.85 : 1;
	const motionScale = resolvedQuality === 'low' ? 0.6 : resolvedQuality === 'medium' ? 0.8 : 1;

	useEffect(() => {
		const el = rootRef.current;
		if (!el) return;

		// Seed static values — ring visible immediately without pop
		el.style.setProperty('--hr-cx', `${cx}%`);
		el.style.setProperty('--hr-cy', `${cy}%`);
		el.style.setProperty('--hr-ri', `${innerStop}%`);
		el.style.setProperty('--hr-rm', `${innerStop + bandWidth / 2}%`);
		el.style.setProperty('--hr-ro', `${innerStop + bandWidth}%`);

		if (reducedMotion) return;

		const mouse = { x: cx, y: cy };
		const lerped = { x: cx, y: cy };

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

			// ① Lissajous drift of ring centre
			const dx = Math.sin(t) * drift * motionScale;
			const dy = Math.cos(t * 0.73) * drift * 0.55 * motionScale;

			// ② Mouse lerp + drift blend
			if (mouseReact) {
				lerped.x += 0.04 * (mouse.x - lerped.x);
				lerped.y += 0.04 * (mouse.y - lerped.y);
				el!.style.setProperty('--hr-cx', `${lerped.x + dx * 0.3}%`);
				el!.style.setProperty('--hr-cy', `${lerped.y + dy * 0.3}%`);
			} else {
				el!.style.setProperty('--hr-cx', `${cx + dx}%`);
				el!.style.setProperty('--hr-cy', `${cy + dy}%`);
			}

			// ③ Breathe — inner shrinks/expands opposite to outer edge
			if (breathe) {
				// sin(t) positive → inner grows inward, outer grows outward → band widens
				// sin(t) negative → inner shrinks, outer shrinks → band narrows
				const pulse = Math.sin(t * 0.65) * breatheAmplitude * motionScale;
				const ri = Math.max(2, innerStop - pulse * 0.5);
				const ro = Math.min(98, innerStop + bandWidth + pulse);
				const rm = (ri + ro) / 2;
				el!.style.setProperty('--hr-ri', `${ri}%`);
				el!.style.setProperty('--hr-rm', `${rm}%`);
				el!.style.setProperty('--hr-ro', `${ro}%`);
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
	}, [reducedMotion, cx, cy, innerStop, bandWidth, drift, speed, breathe, breatheAmplitude, mouseReact, motionScale, speedScale]);

	useEffect(() => {
		const controls = loopControlsRef.current;
		if (!controls) return;
		if (inView) controls.start();
		else controls.stop();
	}, [inView]);

	// CSS vars animate the stops; color is a prop-literal in the gradient string.
	const background = [
		`radial-gradient(${size}% ${size}% at var(--hr-cx, ${cx}%) var(--hr-cy, ${cy}%),`,
		`  transparent var(--hr-ri, ${innerStop}%),`,
		`  ${color} var(--hr-rm, ${innerStop + bandWidth / 2}%),`,
		`  transparent var(--hr-ro, ${innerStop + bandWidth}%)`,
		`)`,
	].join('\n');

	return (
		<div
			ref={mergeRefs(ref, inViewRef, rootRef)}
			className={cn('pointer-events-none absolute inset-0', className)}
			style={{ background }}
			aria-hidden
		/>
	);
}
