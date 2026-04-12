import { useId, useState } from 'react';

import { cn } from '@/lib/utils';

/** Demonstration control: ticked slider + numeric readout (pattern for future specimen props). */
export function LabDialSlider({ className }: { className?: string }) {
	const [value, setValue] = useState(42);
	const id = useId();

	return (
		<div className={cn('max-w-md', className)}>
			<label
				htmlFor={id}
				className="text-muted-foreground mb-3 block font-mono text-[10px] font-semibold tracking-[0.2em] uppercase"
			>
				Field strength
			</label>
			<div className="flex flex-wrap items-center gap-4">
				<input
					id={id}
					type="range"
					name="kam-lab-field-strength-demo"
					min={0}
					max={100}
					step={1}
					value={value}
					onChange={(e) => setValue(Number(e.target.value))}
					aria-label={`Field strength, ${value} percent`}
					className="kam-lab-range h-2 min-w-[min(100%,12rem)] flex-1 cursor-pointer appearance-none rounded-none bg-transparent accent-black dark:accent-zinc-200"
					style={{
						backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px)`,
						backgroundSize: '10% 100%',
					}}
				/>
				<span
					className="text-foreground min-w-14 font-mono text-sm font-semibold tabular-nums tracking-tight"
					aria-live="polite"
					aria-atomic="true"
				>
					{value}
					<span className="text-muted-foreground text-xs font-normal">%</span>
				</span>
			</div>
		</div>
	);
}
