export type DependenciesPanelProps = {
	packages: string[];
	/** e.g. path alias note for copy-paste */
	note?: string;
	/** Preview tab: peers for running the component; install docs stay on the Code tab */
	variant?: 'observation' | 'install';
};

export function DependenciesPanel({ packages, note, variant = 'install' }: DependenciesPanelProps) {
	const isObservation = variant === 'observation';
	return (
		<div className="kam-ds-spec kam-ds-dotfield p-5">
			<p className="text-muted-foreground mb-1 font-mono text-[10px] font-semibold tracking-[0.22em] uppercase">
				{isObservation ? 'Peers' : 'Packages'}
			</p>
			<h3 className="font-display text-foreground mb-2 text-lg font-semibold tracking-tight">Dependencies</h3>
			<p className="text-muted-foreground text-sm leading-relaxed">
				{isObservation
					? 'Peer packages this component expects alongside the copied source in your app.'
					: 'Install these in your React + Tailwind project before using the copied source.'}
			</p>
			{note ? (
				<p className="border-foreground/40 text-muted-foreground mt-4 border-l-2 border-dashed pl-4 text-sm leading-relaxed">
					{note}
				</p>
			) : null}
			<ul className="mt-4 flex flex-col gap-2">
				{packages.map((pkg) => (
					<li key={pkg}>
						<code className="bg-muted text-foreground rounded-none px-[0.3rem] py-[0.2rem] font-mono text-sm">{pkg}</code>
					</li>
				))}
			</ul>
		</div>
	);
}
