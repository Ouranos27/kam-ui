'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';
import type { PerformanceQuality } from '@/lib/containment';
import type { PropDoc } from '../../data/componentPropDocs';

// ─── Types ────────────────────────────────────────────────────────────────────

type ControlType = 'color' | 'range' | 'toggle' | 'hidden';

/** Infer the right control widget from a PropDoc. */
function inferControlType(prop: PropDoc): ControlType {
	if (prop.control === 'hidden') return 'hidden';
	if (prop.name === 'className' || prop.name === 'ref') return 'hidden';
	if (prop.type === 'boolean') return 'toggle';
	if (prop.type === 'number') return 'range';
	// Hex color strings: default value is "'#rrggbb'"
	if (prop.type === 'string' && (prop.default ?? '').startsWith("'#")) return 'color';
	return 'hidden';
}

/** Parse a PropDoc default string into a JS value. */
function parseDefault(prop: PropDoc): unknown {
	const raw = prop.default;
	if (raw === undefined) return undefined;
	if (prop.type === 'boolean') return raw === 'true';
	if (prop.type === 'number') return Number(raw);
	return raw.replace(/^'|'$/g, '');
}

export type ControlValues = Record<string, unknown>;

export type ComponentControlsProps = {
	propDocs: PropDoc[];
	values: ControlValues;
	onChange: (name: string, value: unknown) => void;
	/** Open/close state is lifted so the parent can offset the floating label. */
	open: boolean;
	onToggle: (next: boolean) => void;
	surface: 'dark' | 'light';
	quality: PerformanceQuality;
	onQualityChange: (next: PerformanceQuality) => void;
	showCanvasBgControl: boolean;
	/** Canvas / hero background colour — playground-only, not a component prop. */
	canvasBg: string;
	onCanvasBgChange: (v: string) => void;
};

// ─── Individual control widgets ───────────────────────────────────────────────

/** Fixed-position rect for the portal popover. */
type PopoverRect = { top: number; left: number };

/**
 * Color swatch that opens a react-colorful HexColorPicker in a portal popover.
 * The popover is portalled to <body> so it escapes any overflow:hidden/auto ancestor.
 * Position is calculated from the swatch button's bounding rect.
 */
function ColorControl({
	prop,
	value,
	onChange,
	isDark,
}: {
	prop: PropDoc;
	value: string;
	onChange: (v: string) => void;
	isDark: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [rect, setRect] = useState<PopoverRect | null>(null);
	const swatchRef = useRef<HTMLButtonElement>(null);
	const popoverRef = useRef<HTMLDivElement>(null);
	const [hexDraft, setHexDraft] = useState(value);

	useEffect(() => {
		setHexDraft(value);
	}, [value]);

	// Compute position when opening, clamped to viewport edges
	useLayoutEffect(() => {
		if (!open || !swatchRef.current) return;
		const r = swatchRef.current.getBoundingClientRect();
		const POPOVER_WIDTH = 200;
		const POPOVER_GAP = 8;
		// Ideal centred position
		let left = r.left + r.width / 2;
		// Clamp so the popover stays within the viewport horizontally
		left = Math.max(POPOVER_WIDTH / 2 + 8, Math.min(left, window.innerWidth - POPOVER_WIDTH / 2 - 8));
		setRect({
			top: r.top - POPOVER_GAP, // translate(-50%,-100%) moves it above
			left,
		});
	}, [open]);

	// Close on outside click or Escape
	useEffect(() => {
		if (!open) return;
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') setOpen(false);
		}
		function onPointer(e: PointerEvent) {
			const target = e.target as Node;
			if (
				swatchRef.current?.contains(target) ||
				popoverRef.current?.contains(target)
			) return;
			setOpen(false);
		}
		document.addEventListener('keydown', onKey);
		document.addEventListener('pointerdown', onPointer);
		return () => {
			document.removeEventListener('keydown', onKey);
			document.removeEventListener('pointerdown', onPointer);
		};
	}, [open]);

	function handleHexInput(raw: string) {
		setHexDraft(raw);
		if (/^#[0-9a-fA-F]{6}$/.test(raw)) onChange(raw);
	}

	const popover = open && rect ? createPortal(
		<div
			ref={popoverRef}
			className={cn(
				'fixed z-9999 w-[200px] rounded-xl border p-3 shadow-2xl',
				isDark
					? 'border-white/12 bg-zinc-900/95 backdrop-blur-xl'
					: 'border-zinc-200/80 bg-white/95 backdrop-blur-xl'
			)}
			style={{
				top: rect.top,
				left: rect.left,
				transform: 'translate(-50%, -100%)',
			}}
		>
			<HexColorPicker
				color={value}
				onChange={(c) => {
					onChange(c);
					setHexDraft(c);
				}}
				style={{ width: '100%', height: '160px' }}
			/>
			<div
				className={cn(
					'mt-2.5 flex items-center gap-2 rounded-lg border px-2.5 py-1.5',
					isDark
						? 'border-white/10 bg-white/5 text-white'
						: 'border-zinc-200 bg-zinc-50 text-zinc-900'
				)}
			>
				<span
					className="h-4 w-4 shrink-0 rounded-full border"
					style={{
						background: value,
						borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
					}}
				/>
				<input
					type="text"
					value={hexDraft}
					onChange={(e) => handleHexInput(e.target.value)}
					maxLength={7}
					spellCheck={false}
					className={cn(
						'w-full bg-transparent font-mono text-xs tracking-wider outline-none',
						isDark ? 'text-white/80 placeholder:text-white/25' : 'text-zinc-700 placeholder:text-zinc-400'
					)}
					placeholder="#000000"
					aria-label={`${prop.name} hex value`}
				/>
			</div>
		</div>,
		document.body
	) : null;

	return (
		<div className="flex shrink-0 flex-col items-center gap-2">
			<span
				className={cn(
					'font-mono text-[9px] font-semibold tracking-[0.2em] uppercase',
					isDark ? 'text-white/50' : 'text-zinc-500'
				)}
			>
				{prop.name}
			</span>

			<button
				ref={swatchRef}
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-label={`Pick ${prop.name} colour`}
				className="h-6 w-6 cursor-pointer rounded-full border-2 shadow-sm transition-transform duration-150 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2"
				style={{
					background: value,
					borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
				}}
			/>

			{popover}
		</div>
	);
}

function RangeControl({
	prop,
	value,
	onChange,
	isDark,
}: {
	prop: PropDoc;
	value: number;
	onChange: (v: number) => void;
	isDark: boolean;
}) {
	const min = prop.min ?? 0;
	const max = prop.max ?? 10;
	const step = prop.step ?? 0.1;

	const displayVal =
		step < 1 ? value.toFixed(step < 0.05 ? 2 : 2) : String(Math.round(value));

	return (
		<label className="flex shrink-0 flex-col gap-2">
			<span
				className={cn(
					'font-mono text-[9px] font-semibold tracking-[0.2em] uppercase',
					isDark ? 'text-white/50' : 'text-zinc-500'
				)}
			>
				{prop.name}
			</span>
			<div className="flex items-center gap-2">
				<input
					type="range"
					min={min}
					max={max}
					step={step}
					value={value}
					onChange={(e) => onChange(Number(e.target.value))}
					className="w-20 cursor-pointer"
					style={{ accentColor: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' }}
					aria-label={prop.name}
				/>
				<span
					className={cn(
						'w-8 text-right font-mono text-[10px] tabular-nums',
						isDark ? 'text-white/60' : 'text-zinc-500'
					)}
				>
					{displayVal}
				</span>
			</div>
		</label>
	);
}

function ToggleControl({
	prop,
	value,
	onChange,
	isDark,
}: {
	prop: PropDoc;
	value: boolean;
	onChange: (v: boolean) => void;
	isDark: boolean;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={value}
			onClick={() => onChange(!value)}
			className="flex shrink-0 cursor-pointer flex-col items-center gap-2"
		>
			<span
				className={cn(
					'font-mono text-[9px] font-semibold tracking-[0.2em] uppercase',
					isDark ? 'text-white/50' : 'text-zinc-500'
				)}
			>
				{prop.name}
			</span>
			{/* Track */}
			<span
				className={cn(
					'relative inline-flex h-5 w-9 rounded-full border transition-colors duration-200',
					value
						? isDark
							? 'border-white/30 bg-white/25'
							: 'border-zinc-400/50 bg-zinc-900/20'
						: isDark
							? 'border-white/15 bg-white/8'
							: 'border-zinc-300 bg-zinc-100'
				)}
			>
				{/* Thumb */}
				<span
					className={cn(
						'absolute top-0.5 h-4 w-4 rounded-full transition-all duration-200',
						value
							? isDark
								? 'translate-x-4 bg-white'
								: 'translate-x-4 bg-zinc-900'
							: isDark
								? 'translate-x-0.5 bg-white/40'
								: 'translate-x-0.5 bg-zinc-400'
					)}
				/>
			</span>
		</button>
	);
}

// ─── Knob icon (6-point control) ─────────────────────────────────────────────

function KnobIcon({ className }: { className?: string }) {
	return (
		<svg
			width="11"
			height="11"
			viewBox="0 0 11 11"
			fill="none"
			aria-hidden
			className={className}
		>
			<circle cx="5.5" cy="5.5" r="1.75" fill="currentColor" />
			<circle cx="5.5" cy="1" r="1" fill="currentColor" />
			<circle cx="5.5" cy="10" r="1" fill="currentColor" />
			<circle cx="1" cy="5.5" r="1" fill="currentColor" />
			<circle cx="10" cy="5.5" r="1" fill="currentColor" />
			<circle cx="2.4" cy="2.4" r="0.8" fill="currentColor" />
			<circle cx="8.6" cy="8.6" r="0.8" fill="currentColor" />
		</svg>
	);
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Floating controls panel for the hero playground.
 *
 * Renders a compact toggle button when closed.
 * When open, slides up a frosted-glass bar with color pickers,
 * range sliders, and toggles derived from the component's propDocs.
 *
 * Open/close state is lifted to the parent so the floating label
 * can reposition itself above the panel.
 */
export function ComponentControls({
	propDocs,
	values,
	onChange,
	open,
	onToggle,
	surface,
	quality,
	onQualityChange,
	showCanvasBgControl,
	canvasBg,
	onCanvasBgChange,
}: ComponentControlsProps) {
	const isDark = surface === 'dark';

	const controllable = propDocs.filter((p) => inferControlType(p) !== 'hidden');

	// Synthetic prop doc for the canvas background colour control
	const canvasPropDoc: PropDoc = {
		name: 'canvas',
		type: 'string',
		default: `'${canvasBg}'`,
		description: 'Preview background colour',
	};

	return (
		<>
			{/* ── Toggle pill (shown when panel is closed) ── */}
			{!open && (
				<button
					type="button"
					onClick={() => onToggle(true)}
					className={cn(
						'absolute bottom-6 right-6 z-30 flex items-center gap-1.5 rounded-full border px-3 py-1.5',
						'font-mono text-[9px] font-semibold tracking-[0.2em] uppercase',
						'backdrop-blur-sm transition-all duration-200',
						isDark
							? 'border-white/20 bg-zinc-900/40 text-white/60 hover:bg-zinc-900/60 hover:text-white/90'
							: 'border-zinc-900/15 bg-white/40 text-zinc-600 hover:bg-white/70 hover:text-zinc-900'
					)}
				>
					<KnobIcon />
					Adjust
				</button>
			)}

			{/* ── Controls panel (shown when open) ── */}
			{open && (
				<div
					className={cn(
						'absolute bottom-0 left-0 right-0 z-30 border-t backdrop-blur-xl',
						isDark
							? 'border-white/10 bg-zinc-950/75 text-white'
							: 'border-zinc-200/80 bg-white/75 text-zinc-900'
					)}
				>
					{/* Header row */}
					<div
						className={cn(
							'flex items-center justify-between border-b px-4 py-2',
							isDark ? 'border-white/8' : 'border-zinc-200/60'
						)}
					>
						<span
							className={cn(
								'flex items-center gap-1.5 font-mono text-[9px] font-semibold tracking-[0.22em] uppercase',
								isDark ? 'text-white/40' : 'text-zinc-400'
							)}
						>
							<KnobIcon />
							Adjust
						</span>
						<button
							type="button"
							onClick={() => onToggle(false)}
							className={cn(
								'font-mono text-[9px] tracking-[0.15em] uppercase transition-opacity duration-150',
								isDark
									? 'text-white/40 hover:text-white/80'
									: 'text-zinc-400 hover:text-zinc-700'
							)}
						>
							Close ×
						</button>
					</div>

					<div
						className={cn(
							'flex flex-col gap-1.5 border-b px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3',
							isDark ? 'border-white/8' : 'border-zinc-200/60'
						)}
					>
						<label className="flex items-center gap-2">
							<span
								className={cn(
									'font-mono text-[9px] font-semibold tracking-[0.2em] uppercase',
									isDark ? 'text-white/55' : 'text-zinc-500'
								)}
							>
								Performance
							</span>
							<select
								value={quality}
								onChange={(e) => onQualityChange(e.target.value as PerformanceQuality)}
								className={cn(
									'cursor-pointer rounded border px-2 py-1 font-mono text-[10px] tracking-[0.08em] uppercase',
									isDark
										? 'border-white/15 bg-zinc-900/80 text-white/80'
										: 'border-zinc-300 bg-white text-zinc-700'
								)}
								aria-label="Performance quality"
							>
								<option value="auto">Auto</option>
								<option value="low">Low</option>
								<option value="medium">Medium</option>
								<option value="high">High</option>
							</select>
						</label>
						<p
							className={cn(
								'font-mono text-[9px] tracking-[0.08em] sm:text-right',
								isDark ? 'text-white/45' : 'text-zinc-500'
							)}
						>
							Higher fidelity can increase GPU load and battery usage.
						</p>
					</div>

					{/* Controls row — horizontally scrollable */}
					<div className="flex items-end gap-0 overflow-x-auto">
						{/* ── Canvas background section ── */}
						{showCanvasBgControl && (
							<div className="flex shrink-0 items-end gap-6 px-5 py-3.5">
								<ColorControl
									prop={canvasPropDoc}
									value={canvasBg}
									onChange={onCanvasBgChange}
									isDark={isDark}
								/>
							</div>
						)}

						{/* ── Divider (only when there are component props) ── */}
						{showCanvasBgControl && controllable.length > 0 && (
							<div
								className={cn(
									'mx-1 my-3 w-px self-stretch shrink-0',
									isDark ? 'bg-white/10' : 'bg-zinc-200'
								)}
							/>
						)}

						{/* ── Component props section ── */}
						{controllable.length > 0 && (
							<div className="flex shrink-0 items-end gap-6 px-5 py-3.5">
								{controllable.map((prop) => {
									const kind = inferControlType(prop);
									const val = values[prop.name] ?? parseDefault(prop);

									if (kind === 'color') {
										return (
											<ColorControl
												key={prop.name}
												prop={prop}
												value={(val as string) ?? '#000000'}
												onChange={(v) => onChange(prop.name, v)}
												isDark={isDark}
											/>
										);
									}
									if (kind === 'range') {
										return (
											<RangeControl
												key={prop.name}
												prop={prop}
												value={(val as number) ?? 0}
												onChange={(v) => onChange(prop.name, v)}
												isDark={isDark}
											/>
										);
									}
									if (kind === 'toggle') {
										return (
											<ToggleControl
												key={prop.name}
												prop={prop}
												value={(val as boolean) ?? false}
												onChange={(v) => onChange(prop.name, v)}
												isDark={isDark}
											/>
										);
									}
									return null;
								})}
							</div>
						)}
					</div>
				</div>
			)}
		</>
	);
}
