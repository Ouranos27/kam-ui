import { useCallback, useId, useState } from 'react';

import { cn } from '@/lib/utils';

export type ShikiSourceBlockProps = {
	/** Server-rendered Shiki HTML (trusted — built from repo source at build time). */
	html: string;
	plainSource: string;
	filename: string;
	/**
	 * Clip to `collapsedHeight` and show a gradient fade + expand/collapse toggle.
	 * @default false
	 */
	collapsible?: boolean;
	/**
	 * CSS max-height value used when the block is in the collapsed state.
	 * @default '22rem'
	 */
	collapsedHeight?: string;
};

/** macOS traffic-light dot row */
function TrafficLights() {
	return (
		<div className="flex shrink-0 items-center gap-[7px]" aria-hidden>
			<span className="size-[11px] rounded-full bg-[#ff5f57] shadow-[inset_0_0_0_0.5px_oklch(0_0_0/0.25)]" />
			<span className="size-[11px] rounded-full bg-[#febc2e] shadow-[inset_0_0_0_0.5px_oklch(0_0_0/0.25)]" />
			<span className="size-[11px] rounded-full bg-[#28c840] shadow-[inset_0_0_0_0.5px_oklch(0_0_0/0.25)]" />
		</div>
	);
}

function IconCopy() {
	return (
		<svg className="size-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			<rect x="9" y="9" width="13" height="13" rx="2" />
			<path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
		</svg>
	);
}

function IconCheck() {
	return (
		<svg className="size-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			<path d="M5 13l4 4L19 7" />
		</svg>
	);
}

export function ShikiSourceBlock({
	html,
	plainSource,
	filename,
	collapsible = false,
	collapsedHeight = '22rem',
}: ShikiSourceBlockProps) {
	const id = useId().replace(/:/g, '');
	const [copied, setCopied] = useState(false);
	const [expanded, setExpanded] = useState(false);

	const lineCount = plainSource.split('\n').length;
	const isCollapsed = collapsible && !expanded;

	const onCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(plainSource);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			/* clipboard unavailable */
		}
	}, [plainSource]);

	return (
		<div className="-mx-1 mt-0 md:-mx-1" id={id}>
			{/* ── macOS window shell ── */}
			<div className="overflow-hidden rounded-xl shadow-[0_4px_16px_-4px_oklch(0_0_0/0.4),0_0_0_1px_rgba(255,255,255,0.05)]">

				{/* ── Clipping wrapper (controls visible height when collapsed) ── */}
				<div
					className={cn('relative', isCollapsed && 'overflow-hidden')}
					style={isCollapsed ? { maxHeight: collapsedHeight } : undefined}
				>
					{/* ── Title bar ── */}
					<div className="relative flex h-11 shrink-0 items-center justify-between border-b border-white/6 bg-[#1e1f2b] px-4">
						<TrafficLights />

						{/* Centered filename — clamped so it doesn't overlap the buttons */}
						<span className="pointer-events-none absolute inset-x-0 overflow-hidden text-ellipsis text-center font-mono text-[11px] tracking-[0.18em] uppercase text-white/35 select-none px-24 whitespace-nowrap">
							{filename}
						</span>

						{/* Copy icon */}
						<button
							type="button"
							onClick={onCopy}
							aria-label={copied ? 'Source extracted' : 'Extract source — copy code'}
							className={cn(
								'relative z-10 flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors duration-150',
								copied
									? 'text-[#28c840]'
									: 'text-white/40 hover:bg-white/8 hover:text-white/75',
							)}
						>
							{copied ? <IconCheck /> : <IconCopy />}
						</button>
					</div>

					{/* ── Code body ── */}
					<div
						className="mac-window-code [&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:rounded-none [&_pre]:border-0 [&_pre]:pl-0! [&_pre]:pr-4 [&_pre]:py-4 [&_pre]:text-xs"
						// eslint-disable-next-line react/no-danger -- HTML produced at build-time from checked-in source
						dangerouslySetInnerHTML={{ __html: html }}
					/>

					{/* Gradient fade — matches one-dark-pro's #282c34 bg */}
					{isCollapsed && (
						<div
							className="pointer-events-none absolute bottom-0 left-0 right-0 h-24"
							style={{ background: 'linear-gradient(to bottom, transparent, #282c34 90%)' }}
							aria-hidden
						/>
					)}
				</div>

				{/* ── Expand / Collapse toggle bar ── */}
				{collapsible && (
					<div className="flex items-center justify-between border-t border-white/6 bg-[#1e1f2b] px-4 py-2">
						<span className="select-none font-mono text-[10px] tracking-[0.15em] uppercase text-white/25">
							{lineCount} lines
						</span>
						<button
							type="button"
							onClick={() => setExpanded((e) => !e)}
							className="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.15em] uppercase text-foreground transition-colors duration-150 hover:text-foreground/70"
							aria-expanded={expanded}
						>
							{expanded ? (
								<>
									<svg className="size-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
										<path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
									</svg>
									Collapse
								</>
							) : (
								<>
									<svg className="size-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
										<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
									</svg>
									Expand full source
								</>
							)}
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

