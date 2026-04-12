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

/** macOS traffic-light dots */
function TrafficLights() {
	return (
		<div className="flex shrink-0 items-center gap-[7px]" aria-hidden>
			<span className="size-[11px] rounded-full bg-[#ff5f57]" />
			<span className="size-[11px] rounded-full bg-[#febc2e]" />
			<span className="size-[11px] rounded-full bg-[#28c840]" />
		</div>
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
		<div className="mt-0" id={id}>
			{/* macOS window frame */}
			<div className="overflow-hidden rounded-lg border border-white/[0.06] shadow-[0_2px_12px_-4px_rgba(0,0,0,0.5)]">

				{/* Clipping wrapper for collapsed state */}
				<div
					className={cn('relative', isCollapsed && 'overflow-hidden')}
					style={isCollapsed ? { maxHeight: collapsedHeight } : undefined}
				>
					{/* Title bar */}
					<div className="flex h-10 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0a0a0a] px-4">
						<TrafficLights />

						{/* Centered filename */}
						<span className="pointer-events-none absolute inset-x-0 overflow-hidden text-ellipsis text-center font-mono text-[11px] tracking-wider text-white/25 select-none px-24 whitespace-nowrap">
							{filename}
						</span>

						{/* Copy button */}
						<button
							type="button"
							onClick={onCopy}
							aria-label={copied ? 'Copied' : 'Copy code'}
							className={cn(
								'relative z-10 flex size-7 cursor-pointer items-center justify-center rounded transition-colors duration-150',
								copied
									? 'text-white'
									: 'text-white/25 hover:text-white/60',
							)}
						>
							{copied ? (
								<svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
									<path d="M5 13l4 4L19 7" />
								</svg>
							) : (
								<svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
									<rect x="9" y="9" width="13" height="13" rx="2" />
									<path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
								</svg>
							)}
						</button>
					</div>

					{/* Code body — HTML from Shiki (build-time, trusted source) */}
					<div
						className="mac-window-code bg-[#0f0f0f] [&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:rounded-none [&_pre]:border-0 [&_pre]:bg-transparent! [&_pre]:pl-0! [&_pre]:pr-4 [&_pre]:py-4 [&_pre]:text-[13px] [&_pre]:leading-relaxed"
						dangerouslySetInnerHTML={{ __html: html }}
					/>

					{/* Gradient fade when collapsed */}
					{isCollapsed && (
						<div
							className="pointer-events-none absolute bottom-0 left-0 right-0 h-24"
							style={{ background: 'linear-gradient(to bottom, transparent, #0f0f0f 90%)' }}
							aria-hidden
						/>
					)}
				</div>

				{/* Expand / Collapse toggle */}
				{collapsible && (
					<div className="flex items-center justify-between border-t border-white/[0.06] bg-[#0a0a0a] px-4 py-2">
						<span className="select-none font-mono text-[10px] tracking-wider text-white/20">
							{lineCount} lines
						</span>
						<button
							type="button"
							onClick={() => setExpanded((e) => !e)}
							className="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] font-medium tracking-wider uppercase text-white/40 transition-colors duration-150 hover:text-white/70"
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
