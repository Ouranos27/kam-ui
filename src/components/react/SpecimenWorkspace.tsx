import { useCallback, useEffect, useId, useRef, useState } from 'react';

import type { PropDoc } from '@/data/componentPropDocs';
import type { ComponentSlug } from '@/data/componentRegistry';
import type { ChamberWellStyle } from '@/data/nav';
import type { ShowcasePresentation } from '@/data/showcasePresentation';

import { cn } from '@/lib/utils';

import { ComponentPlayground } from './ComponentPlayground';
import { ContainmentChamber } from './ContainmentChamber';
import { DependenciesPanel } from './DependenciesPanel';
import { PropsReferencePanel } from './PropsReferencePanel';
import { RegistryInstallTabs } from './RegistryInstallTabs';
import { ShowcaseObserverRootContext } from './ShowcaseObserverRootContext';
import { ShikiSourceBlock } from './ShikiSourceBlock';

const HASH_OPENS_PREVIEW = new Set(['props', 'dependencies']);
const HASH_OPENS_CODE = new Set(['procedure', 'source', 'usage']);

export type SpecimenWorkspaceProps = {
	slug: ComponentSlug;
	propDocs: PropDoc[];
	source: string;
	filename: string;
	usageExample: string;
	/** One-line registry install, e.g. npx shadcn@latest add https://…/r/item.json */
	shadcnAddCommand: string;
	previewWrapClassName?: string;
	/** Registry specimen code (e.g. "BG-03") — kept for hero display */
	specimenCode: string;
	chamberSurface: 'dark' | 'light';
	/** Light chamber interior: grid (opt-in) or solid (default) */
	chamberWellStyle?: ChamberWellStyle;
	itemJsonUrl: string;
	depsPkgsForPm: string;
	depPackages: string[];
	depNote?: string;
	/** Build-time Shiki HTML for the full source file */
	highlightedHtml: string;
	/** Build-time Shiki HTML for the usage/import snippet */
	highlightedUsageHtml: string;
	/** Registry specimen display title (hero + a11y) */
	specimenTitle: string;
	/** Per-component frame copy and preview ergonomics */
	showcase: ShowcasePresentation;
	/**
	 * When false (e.g. background components that already show a full-viewport
	 * hero preview), the mini ContainmentChamber preview and the Preview/Code
	 * tab split are hidden entirely. All content — Observation, Props,
	 * Procedure, Usage, Source — is rendered inline in one scroll.
	 * @default true
	 */
	showPreview?: boolean;
};

const PREVIEW_ALIGN_CLASS: Record<ShowcasePresentation['previewAlign'], string> = {
	center: 'items-center justify-center',
	start: 'items-start justify-center',
	end: 'items-end justify-center',
	stretch: 'items-stretch justify-center',
};

function IconEye({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden
		>
			<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
			<circle cx="12" cy="12" r="3" />
		</svg>
	);
}

function IconCode({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden
		>
			<path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
		</svg>
	);
}

function WorkspaceSectionHeading({ title, id }: { title: string; id: string }) {
	return (
		<div className="scroll-mt-28">
			<h2
				id={id}
				className="font-sans text-foreground m-0 text-xl tracking-tight sm:text-2xl"
			>
				{title}
			</h2>
		</div>
	);
}

export function SpecimenWorkspace({
	slug,
	propDocs,
	source,
	filename,
	usageExample,
	shadcnAddCommand,
	previewWrapClassName,
	specimenCode,
	chamberSurface,
	chamberWellStyle = 'solid',
	itemJsonUrl,
	depsPkgsForPm,
	depPackages,
	depNote,
	highlightedHtml,
	highlightedUsageHtml,
	specimenTitle,
	showcase,
	showPreview = true,
}: SpecimenWorkspaceProps) {
	const [showcaseDisplayRoot, setShowcaseDisplayRoot] = useState<HTMLDivElement | null>(null);
	const [tab, setTab] = useState<'preview' | 'code'>('preview');
	/** First Code open mounts tab body (Chakra Tabs `lazyMount` parity with react-bits). */
	const [codeEverOpened, setCodeEverOpened] = useState(false);
	const baseId = useId();
	const prevId = `${baseId}-preview`;
	const codeId = `${baseId}-code`;
	const prevBtnRef = useRef<HTMLButtonElement>(null);
	const codeBtnRef = useRef<HTMLButtonElement>(null);
	const codeScrollRef = useRef<HTMLDivElement>(null);

	const goPreview = () => {
		setTab('preview');
		requestAnimationFrame(() => prevBtnRef.current?.focus());
	};

	const goCode = () => {
		setCodeEverOpened(true);
		setTab('code');
		requestAnimationFrame(() => codeBtnRef.current?.focus());
	};

	useEffect(() => {
		const syncFromHash = () => {
			const raw = window.location.hash.slice(1);
			if (!raw) return;
			if (HASH_OPENS_PREVIEW.has(raw)) {
				setTab('preview');
				requestAnimationFrame(() => {
					document.getElementById(raw)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
				});
				return;
			}
			if (HASH_OPENS_CODE.has(raw)) {
				setCodeEverOpened(true);
				setTab('code');
				requestAnimationFrame(() => {
					const el = document.getElementById(raw);
					if (el) {
						el.scrollIntoView({ behavior: 'smooth', block: 'start' });
					} else {
						codeScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
					}
				});
			}
		};
		syncFromHash();
		window.addEventListener('hashchange', syncFromHash);
		return () => window.removeEventListener('hashchange', syncFromHash);
	}, []);

	/* ── Flat (no-tab) layout for components that already have a full-viewport hero ── */
	if (!showPreview) {
		return (
			<div className="flex min-h-0 flex-col gap-10">
				{/* Observation */}
				<div className="flex flex-wrap items-start gap-x-12 gap-y-4">
					<div className="min-w-0">
						<p className="text-foreground font-display text-lg font-semibold tracking-tight">
							{showcase.observationTitle}
						</p>
						<p className="text-muted-foreground mt-2 max-w-xl text-base leading-relaxed">{showcase.observationBody}</p>
					</div>
				</div>

			{/* Procedure */}
			<div className="border-t border-border/30 pt-12 mt-4">
				<section className="flex flex-col gap-4" aria-labelledby="procedure">
					<WorkspaceSectionHeading title="Procedure" id="procedure" />
					<p className="text-muted-foreground max-w-2xl text-base leading-relaxed">
						Execute one of the following in a project that already uses Tailwind CSS and the shadcn CLI.
					</p>
					<RegistryInstallTabs itemJsonUrl={itemJsonUrl} depsPkgs={depsPkgsForPm} />
				</section>
			</div>

			{/* Props */}
			<div className="flex flex-col gap-8 border-t border-border/30 pt-12 mt-4">
				<section id="props" className="scroll-mt-28" aria-labelledby="flat-props-heading">
					<h3 id="flat-props-heading" className="font-sans text-foreground m-0 text-lg tracking-tight sm:text-xl">
						Props
					</h3>
					<PropsReferencePanel docs={propDocs} />
				</section>
			</div>

			{/* Dependencies */}
			<div className="border-t border-border/30 pt-12 mt-4">
				<div id="dependencies" className="scroll-mt-28">
					<DependenciesPanel variant="observation" packages={depPackages} note={depNote} />
				</div>
			</div>

				{/* Usage */}
				<div className="border-t border-border/30 pt-12 mt-4">
					<section className="flex flex-col gap-4" aria-labelledby="usage">
						<WorkspaceSectionHeading title="Usage" id="usage" />
						<div className="flex flex-col gap-4">
							<div>
							{/* macOS terminal window for the one-liner */}
							<div className="overflow-hidden rounded-xl shadow-[0_4px_16px_-4px_oklch(0_0_0/0.4),0_0_0_1px_rgba(255,255,255,0.05)]">
								<div className="flex h-10 shrink-0 items-center gap-2 border-b border-white/6 bg-[#1e1f2b] px-4">
									<div className="flex shrink-0 items-center gap-[7px]" aria-hidden>
										<span className="size-[11px] rounded-full bg-[#ff5f57] shadow-[inset_0_0_0_0.5px_oklch(0_0_0/0.25)]" />
										<span className="size-[11px] rounded-full bg-[#febc2e] shadow-[inset_0_0_0_0.5px_oklch(0_0_0/0.25)]" />
										<span className="size-[11px] rounded-full bg-[#28c840] shadow-[inset_0_0_0_0.5px_oklch(0_0_0/0.25)]" />
									</div>
									<span className="font-mono text-[10px] tracking-[0.15em] uppercase text-white/30 select-none">
										Terminal
									</span>
								</div>
								<div className="overflow-x-auto bg-[#1a1b26] px-5 py-3">
									<pre className="m-0 font-mono text-[13px] leading-relaxed">
										<code>
											<span className="mr-3 select-none text-white/20" aria-hidden>$</span>
											<span className="text-[#abb2bf]">{shadcnAddCommand}</span>
										</code>
									</pre>
								</div>
							</div>
						</div>
						<ShikiSourceBlock
							html={highlightedUsageHtml}
							plainSource={usageExample}
							filename="usage.tsx"
							collapsible
							collapsedHeight="14rem"
						/>
					</div>
				</section>
			</div>

			{/* Source */}
			<div className="border-t border-border/30 pt-12 mt-4">
				<section className="flex flex-col gap-4 scroll-mt-28" aria-labelledby="source">
					<WorkspaceSectionHeading title="Source" id="source" />
					<ShikiSourceBlock
						html={highlightedHtml}
						plainSource={source}
						filename={filename}
						collapsible
					/>
				</section>
			</div>
		</div>
	);
}

	return (
		<div className="flex min-h-0 flex-col gap-6">
			{/* react-bits TabsLayout: pill Preview / Code row + optional subline */}
			<div className="flex flex-col gap-3">
				<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
					<div
						role="tablist"
						aria-label={`${specimenTitle} showcase`}
						className="flex flex-wrap gap-2"
					>
						<button
							ref={prevBtnRef}
							type="button"
							role="tab"
							id={prevId}
							aria-selected={tab === 'preview'}
							aria-controls={`${prevId}-panel`}
							tabIndex={tab === 'preview' ? 0 : -1}
							data-active={tab === 'preview'}
							className="kam-rb-pill kam-rb-pill--lg"
							onClick={() => goPreview()}
							onKeyDown={(e) => {
								if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
									e.preventDefault();
									goCode();
								}
								if (e.key === 'End') {
									e.preventDefault();
									goCode();
								}
								if (e.key === 'Home') {
									e.preventDefault();
									goPreview();
								}
							}}
						>
							<IconEye className="size-4 shrink-0 opacity-90" />
							Preview
						</button>
						<button
							ref={codeBtnRef}
							type="button"
							role="tab"
							id={codeId}
							aria-selected={tab === 'code'}
							aria-controls={`${codeId}-panel`}
							tabIndex={tab === 'code' ? 0 : -1}
							data-active={tab === 'code'}
							className="kam-rb-pill kam-rb-pill--lg"
							onClick={() => goCode()}
							onKeyDown={(e) => {
								if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
									e.preventDefault();
									goPreview();
								}
								if (e.key === 'Home') {
									e.preventDefault();
									goPreview();
								}
								if (e.key === 'End') {
									e.preventDefault();
									goCode();
								}
							}}
						>
							<IconCode className="size-4 shrink-0 opacity-90" />
							Code
						</button>
					</div>
				</div>
				<p className="text-muted-foreground m-0 max-w-2xl font-mono text-[10px] tracking-[0.12em]">
					<span className="text-foreground/90 font-semibold tracking-[0.18em] uppercase">{showcase.frameLabel}</span>
					{showcase.frameSubline ? (
						<>
							{' '}
							<span className="text-muted-foreground">·</span> {showcase.frameSubline}
						</>
					) : null}
				</p>
			</div>

			<div
				id={`${prevId}-panel`}
				role="tabpanel"
				aria-labelledby={prevId}
				hidden={tab !== 'preview'}
				inert={tab !== 'preview' ? true : undefined}
				className={cn('flex min-h-0 flex-col gap-4', tab !== 'preview' && 'hidden')}
			>
			<ShowcaseObserverRootContext.Provider value={showcaseDisplayRoot}>
				<div
					ref={setShowcaseDisplayRoot}
					className="flex w-full min-w-0 flex-col min-h-0"
					data-showcase-display
				>
					<ContainmentChamber
						surface={chamberSurface}
						wellStyle={chamberSurface === 'light' ? chamberWellStyle : undefined}
						className={cn('min-h-0 w-full', showcase.chamberClassName)}
					>
						<div
							className={cn(
								'flex min-h-0 min-w-0 flex-1 flex-col',
								showcase.wellBackdropClassName,
							)}
							data-showcase-island={slug}
						>
							<div
								className={cn(
									'flex w-full min-h-0 flex-1',
									PREVIEW_ALIGN_CLASS[showcase.previewAlign],
									showcase.previewShellClassName,
								)}
								data-preview-align={showcase.previewAlign}
							>
								<div
									className={cn(
										'w-full min-h-0 min-w-0',
										previewWrapClassName ?? 'w-full',
										showcase.previewPaddingClassName,
									)}
									data-kam-demo-stage
								>
									<ComponentPlayground slug={slug} />
								</div>
							</div>
						</div>
					</ContainmentChamber>
				</div>
			</ShowcaseObserverRootContext.Provider>

			<div className="border-border/30 flex flex-col gap-10 border-t pt-12 mt-4">
				<div className="flex flex-wrap items-start gap-x-12 gap-y-4">
					<div className="min-w-0">
						<p className="text-foreground font-display text-lg font-semibold tracking-tight">
							{showcase.observationTitle}
						</p>
						<p className="text-muted-foreground mt-2 max-w-xl text-base leading-relaxed">{showcase.observationBody}</p>
					</div>
				</div>
				<div id="dependencies" className="scroll-mt-28">
					<DependenciesPanel variant="observation" packages={depPackages} note={depNote} />
				</div>
			</div>

				<div className="flex flex-col gap-8 border-t border-border/30 pt-12 mt-4">
					<section
						id="props"
						className="scroll-mt-28"
						aria-labelledby={`${prevId}-props-heading`}
					>
						<h3 id={`${prevId}-props-heading`} className="font-sans text-foreground m-0 text-lg tracking-tight sm:text-xl">
							Props
						</h3>
						<PropsReferencePanel docs={propDocs} />
					</section>
				</div>
			</div>

		<div
			id={`${codeId}-panel`}
			role="tabpanel"
			aria-labelledby={codeId}
			hidden={tab !== 'code'}
			inert={tab !== 'code' ? true : undefined}
			className={cn('min-h-72 border-border/60 sm:min-h-80', tab !== 'code' && 'hidden')}
			ref={codeScrollRef}
		>
			{codeEverOpened ? (
			<div className="flex flex-col gap-11 px-4 py-6 sm:px-6 sm:py-8">
				<section className="flex flex-col gap-4" aria-labelledby="procedure">
					<WorkspaceSectionHeading title="Procedure" id="procedure" />
					<p className="text-muted-foreground max-w-2xl text-base leading-relaxed">
						Execute one of the following in a project that already uses Tailwind CSS and the shadcn CLI.
					</p>
					<RegistryInstallTabs itemJsonUrl={itemJsonUrl} depsPkgs={depsPkgsForPm} />
				</section>

				<section className="flex flex-col gap-4" aria-labelledby="usage">
					<WorkspaceSectionHeading title="Usage" id="usage" />
					<div className="flex flex-col gap-4">
						<div>
						{/* macOS terminal window for the one-liner */}
						<div className="overflow-hidden rounded-xl shadow-[0_4px_16px_-4px_oklch(0_0_0/0.4),0_0_0_1px_rgba(255,255,255,0.05)]">
							<div className="flex h-10 shrink-0 items-center gap-2 border-b border-white/6 bg-[#1e1f2b] px-4">
								<div className="flex shrink-0 items-center gap-[7px]" aria-hidden>
									<span className="size-[11px] rounded-full bg-[#ff5f57] shadow-[inset_0_0_0_0.5px_oklch(0_0_0/0.25)]" />
									<span className="size-[11px] rounded-full bg-[#febc2e] shadow-[inset_0_0_0_0.5px_oklch(0_0_0/0.25)]" />
									<span className="size-[11px] rounded-full bg-[#28c840] shadow-[inset_0_0_0_0.5px_oklch(0_0_0/0.25)]" />
								</div>
								<span className="font-mono text-[10px] tracking-[0.15em] uppercase text-white/30 select-none">
									Terminal
								</span>
							</div>
							<div className="overflow-x-auto bg-[#1a1b26] px-5 py-3">
								<pre className="m-0 font-mono text-[13px] leading-relaxed">
									<code>
										<span className="mr-3 select-none text-white/20" aria-hidden>$</span>
										<span className="text-[#abb2bf]">{shadcnAddCommand}</span>
									</code>
								</pre>
							</div>
						</div>
					</div>
						<ShikiSourceBlock
							html={highlightedUsageHtml}
							plainSource={usageExample}
							filename="usage.tsx"
							collapsible
							collapsedHeight="14rem"
						/>
					</div>
				</section>

				<section className="flex flex-col gap-4 scroll-mt-28" aria-labelledby="source">
					<WorkspaceSectionHeading title="Source" id="source" />
					<ShikiSourceBlock
						html={highlightedHtml}
						plainSource={source}
						filename={filename}
						collapsible
					/>
				</section>
			</div>
			) : null}
		</div>
	</div>
	);
}

