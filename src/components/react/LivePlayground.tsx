'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';
import type { PerformanceQuality } from '@/lib/containment';
import { componentCapabilities } from '../../data/componentCapabilities';
import { componentDefaults } from '../../data/componentDefaults';
import { componentPropDocs } from '../../data/componentPropDocs';
import type { ComponentSlug } from '../../data/componentRegistry';
import type { ChamberSurface } from '../../data/nav';
import { ComponentControls } from './ComponentControls';
import { ComponentPlayground } from './ComponentPlayground';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LivePlaygroundProps = {
	slug: ComponentSlug;
	/** Page title — shown in the hero floating label. */
	title: string;
	specimenCode: string;
	categoryLabel: string;
	specimenEngine: string;
	chamberSurface: ChamberSurface;
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Hero playground with live prop controls.
 *
 * Combines:
 *  - `ComponentPlayground` (the animated background, driven by controlled state)
 *  - `ComponentControls` (floating controls panel — color pickers, sliders, toggles)
 *  - Floating label (moved from Astro so it can shift up when the panel is open)
 *
 * State ownership: all prop values live here. `ComponentPlayground` is passed a
 * `propsOverride` object so it never has to manage its own state.
 *
 * React 19: no forwardRef, no context — props-down / callbacks-up only.
 */
/** Default canvas colours per surface, matching the Astro hero section class. */
const CANVAS_DEFAULTS: Record<string, string> = {
	dark: '#09090b',
	light: '#ffffff',
};

export function LivePlayground({
	slug,
	title,
	specimenCode,
	categoryLabel,
	specimenEngine,
	chamberSurface,
}: LivePlaygroundProps) {
	const [propValues, setPropValues] = useState<Record<string, unknown>>(
		() => ({ ...(componentDefaults[slug] ?? {}) })
	);
	const [controlsOpen, setControlsOpen] = useState(false);
	const [quality, setQuality] = useState<PerformanceQuality>('auto');
	const [canvasBg, setCanvasBg] = useState<string>(
		() => CANVAS_DEFAULTS[chamberSurface] ?? '#09090b'
	);

	const isDark = chamberSurface === 'dark';
	const propDocs = componentPropDocs[slug] ?? [];
	const showCanvasBgControl = componentCapabilities[slug]?.canvasBgAffectsPreview ?? true;

	function handleChange(name: string, value: unknown) {
		setPropValues((prev) => ({ ...prev, [name]: value }));
	}

	return (
		<div className="absolute inset-0 flex flex-col" style={{ backgroundColor: canvasBg }}>
			{/* ── Animated component ── */}
			<ComponentPlayground slug={slug} propsOverride={propValues} quality={quality} />

			{/* ── Floating label — shifts up when controls are open ── */}
			<div
				className={cn(
					'pointer-events-none absolute left-8 flex flex-col gap-1 transition-[bottom] duration-300 ease-out lg:left-12',
					controlsOpen ? 'bottom-30' : 'bottom-10',
					isDark ? 'text-white/85' : 'text-zinc-900/85'
				)}
			>
				<p className="font-mono text-[9px] font-semibold tracking-[0.22em] uppercase opacity-60">
					{categoryLabel} · {specimenCode}
				</p>
				<p
					className="font-display m-0 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl"
					style={{ letterSpacing: '-0.03em', lineHeight: '1.05' }}
				>
					{title}
				</p>
				<p className="mt-2 font-mono text-[10px] tracking-[0.15em] uppercase opacity-50">
					{specimenEngine} · Scroll for docs ↓
				</p>
			</div>

			{/* ── Controls panel ── */}
			<ComponentControls
				propDocs={propDocs}
				values={propValues}
				onChange={handleChange}
				open={controlsOpen}
				onToggle={setControlsOpen}
				surface={chamberSurface}
				quality={quality}
				onQualityChange={setQuality}
				showCanvasBgControl={showCanvasBgControl}
				canvasBg={canvasBg}
				onCanvasBgChange={setCanvasBg}
			/>
		</div>
	);
}
