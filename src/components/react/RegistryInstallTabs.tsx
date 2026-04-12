import { useCallback, useId, useState } from 'react';

import { cn } from '@/lib/utils';

type Manager = 'npm' | 'pnpm' | 'bun';

const managers: Manager[] = ['npm', 'pnpm', 'bun'];

function buildCommands(itemJsonUrl: string, depsPkgs: string) {
	const shadcn = {
		npm: `npx shadcn@latest add ${itemJsonUrl}`,
		pnpm: `pnpm dlx shadcn@latest add ${itemJsonUrl}`,
		bun: `bunx shadcn@latest add ${itemJsonUrl}`,
	} as const;
	const install = {
		npm: `npm install ${depsPkgs}`,
		pnpm: `pnpm add ${depsPkgs}`,
		bun: `bun add ${depsPkgs}`,
	} as const;
	return { shadcn, install };
}

function PmTabs({
	tabId,
	manager,
	setManager,
}: {
	tabId: string;
	manager: Manager;
	setManager: (m: Manager) => void;
}) {
	return (
		<div role="tablist" aria-label="Package manager" className="flex gap-1">
			{managers.map((m) => (
				<button
					key={m}
					type="button"
					role="tab"
					aria-selected={manager === m}
					id={`${tabId}-${m}`}
					onClick={() => setManager(m)}
					className={cn(
						'cursor-pointer px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-widest transition-colors duration-150',
						manager === m
							? 'text-foreground'
							: 'text-muted-foreground/50 hover:text-muted-foreground',
					)}
				>
					{m}
				</button>
			))}
		</div>
	);
}

function CopyButton({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
	return (
		<button
			type="button"
			onClick={onCopy}
			aria-label={copied ? 'Copied' : 'Copy command'}
			className={cn(
				'flex size-7 cursor-pointer items-center justify-center transition-colors duration-150',
				copied
					? 'text-foreground'
					: 'text-muted-foreground/40 hover:text-foreground',
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
	);
}

function CommandBlock({
	tabId,
	label,
	manager,
	setManager,
	commands,
	copied,
	onCopy,
}: {
	tabId: string;
	label: string;
	manager: Manager;
	setManager: (m: Manager) => void;
	commands: Record<Manager, string>;
	copied: boolean;
	onCopy: () => void;
}) {
	return (
		<div>
			<div className="mb-2 flex items-center justify-between">
				<span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">{label}</span>
				<PmTabs tabId={tabId} manager={manager} setManager={setManager} />
			</div>
			<div className="flex items-center justify-between gap-3 border border-border/40 bg-card px-4 py-3">
				<pre className="m-0 min-w-0 overflow-x-auto font-mono text-sm leading-relaxed">
					<code className="text-foreground/80">{commands[manager]}</code>
				</pre>
				<CopyButton copied={copied} onCopy={onCopy} />
			</div>
		</div>
	);
}

export type RegistryInstallTabsProps = {
	itemJsonUrl: string;
	depsPkgs?: string;
	className?: string;
};

export function RegistryInstallTabs({
	itemJsonUrl,
	depsPkgs = 'clsx tailwind-merge',
	className,
}: RegistryInstallTabsProps) {
	const [pmRegistry, setPmRegistry] = useState<Manager>('npm');
	const [pmDeps, setPmDeps] = useState<Manager>('npm');
	const [copiedReg, setCopiedReg] = useState(false);
	const [copiedDeps, setCopiedDeps] = useState(false);
	const regTabId = useId();
	const depsTabId = useId();

	const { shadcn, install } = buildCommands(itemJsonUrl, depsPkgs);

	const copyReg = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(shadcn[pmRegistry]);
			setCopiedReg(true);
			window.setTimeout(() => setCopiedReg(false), 2000);
		} catch {
			/* ignore */
		}
	}, [pmRegistry, shadcn]);

	const copyDeps = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(install[pmDeps]);
			setCopiedDeps(true);
			window.setTimeout(() => setCopiedDeps(false), 2000);
		} catch {
			/* ignore */
		}
	}, [pmDeps, install]);

	return (
		<div className={cn('flex flex-col gap-5', className)}>
			<CommandBlock
				tabId={`${regTabId}-reg`}
				label="Install"
				manager={pmRegistry}
				setManager={setPmRegistry}
				commands={shadcn}
				copied={copiedReg}
				onCopy={copyReg}
			/>
			<CommandBlock
				tabId={`${depsTabId}-deps`}
				label="Dependencies"
				manager={pmDeps}
				setManager={setPmDeps}
				commands={install}
				copied={copiedDeps}
				onCopy={copyDeps}
			/>
			<p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
				Single-item JSON installs require <code className="bg-muted px-1.5 py-0.5 font-mono text-[0.8rem]">kam-utils</code> — registry items declare{' '}
				<code className="bg-muted px-1.5 py-0.5 font-mono text-[0.8rem]">registryDependencies</code> for{' '}
				<code className="bg-muted px-1.5 py-0.5 font-mono text-[0.8rem]">cn()</code>.
			</p>
		</div>
	);
}
