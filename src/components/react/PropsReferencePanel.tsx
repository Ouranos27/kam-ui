import type { PropDoc } from '@/data/componentPropDocs';

export type PropsReferencePanelProps = {
	docs: PropDoc[];
};

export function PropsReferencePanel({ docs }: PropsReferencePanelProps) {
	if (docs.length === 0) {
		return (
			<p className="text-muted-foreground mt-3 text-sm leading-relaxed">
				No documented props — this component uses internal defaults only.
			</p>
		);
	}

	return (
		<div className="mt-3 overflow-x-auto">
			<table className="w-full min-w-[min(100%,28rem)] border-collapse text-left text-sm">
				<caption className="sr-only">Props reference</caption>
				<thead>
					<tr className="border-b border-dashed border-black/20 dark:border-zinc-600">
						<th
							scope="col"
							className="text-muted-foreground py-2 pr-4 font-mono text-[10px] font-semibold tracking-[0.2em] uppercase"
						>
							Name
						</th>
						<th
							scope="col"
							className="text-muted-foreground py-2 pr-4 font-mono text-[10px] font-semibold tracking-[0.2em] uppercase"
						>
							Type
						</th>
						<th
							scope="col"
							className="text-muted-foreground py-2 pr-4 font-mono text-[10px] font-semibold tracking-[0.2em] uppercase"
						>
							Default
						</th>
						<th
							scope="col"
							className="text-muted-foreground py-2 font-mono text-[10px] font-semibold tracking-[0.2em] uppercase"
						>
							Notes
						</th>
					</tr>
				</thead>
				<tbody>
					{docs.map((row) => (
						<tr
							key={row.name}
							className="border-b border-dashed border-black/10 last:border-0 dark:border-zinc-700/80"
						>
							<td className="text-foreground py-2.5 pr-4 align-top font-mono text-[13px] font-medium">
								{row.name}
							</td>
							<td className="text-muted-foreground py-2.5 pr-4 align-top font-mono text-[12px] leading-snug">
								{row.type}
							</td>
							<td className="text-muted-foreground py-2.5 pr-4 align-top font-mono text-[12px] leading-snug">
								{row.default ?? '—'}
							</td>
							<td className="text-muted-foreground py-2.5 align-top leading-relaxed">
								{row.description ?? '—'}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
