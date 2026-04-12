import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import type { ChamberWellStyle } from '@/data/nav';

export type ContainmentChamberProps = {
	surface: 'dark' | 'light';
	/** Light well only. `grid` is optional; default solid fill. */
	wellStyle?: ChamberWellStyle;
	className?: string;
	children: ReactNode;
};

export function ContainmentChamber({
	surface,
	wellStyle = 'solid',
	className,
	children,
}: ContainmentChamberProps) {
	const wellClass =
		surface === 'dark'
			? 'bg-[var(--kam-chamber-dark)] text-zinc-100'
			: wellStyle === 'grid'
				? 'kam-chamber-grid text-foreground'
				: 'bg-background text-foreground';

	return (
		<div
			className={cn(
				'relative isolate flex flex-col overflow-hidden rounded-lg border border-border bg-background',
				className,
			)}
			data-chamber-surface={surface}
		>
			<div className={cn('min-h-0 min-w-0 flex-1', wellClass)}>{children}</div>
		</div>
	);
}
