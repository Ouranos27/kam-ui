import { useEffect, useState } from 'react';

type Props = {
	/** Registry slug or short label (shown in the preview strip) */
	previewLabel: string;
	/** Optional secondary line in the preview strip */
	modeDescriptor?: string;
	/** When false, FPS sampling is paused (preview hidden / inactive). */
	active?: boolean;
};

/** Discard the first sample window (startup / hydration skew) then show FPS or idle standby. */
const SAMPLE_MS = 800;
const MIN_FPS_TO_SHOW = 22;

export function TelemetryReadout({ previewLabel, modeDescriptor, active = true }: Props) {
	const [line, setLine] = useState('Idle');
	const [reducedMotion, setReducedMotion] = useState(true);

	useEffect(() => {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		const sync = () => setReducedMotion(mq.matches);
		sync();
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	}, []);

	useEffect(() => {
		if (!active || reducedMotion) {
			setLine('Idle');
			return;
		}

		let frame = 0;
		let windowStart = performance.now();
		let raf = 0;
		let completedWindows = 0;

		const loop = (t: number) => {
			frame += 1;
			if (t - windowStart >= SAMPLE_MS) {
				const fps = Math.round((frame * 1000) / (t - windowStart));
				frame = 0;
				windowStart = t;
				completedWindows += 1;
				// First window is often ~1–5 fps during paint; ignore for credible readout
				if (completedWindows >= 2) {
					if (fps < MIN_FPS_TO_SHOW) setLine('Idle');
					else setLine(`${Math.min(fps, 120)} fps`);
				}
			}
			raf = requestAnimationFrame(loop);
		};

		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	}, [active, reducedMotion]);

	return (
		<div
			className="text-muted-foreground flex min-h-9 flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-3 py-2 font-mono text-[10px] font-medium tracking-wide"
			role="status"
			aria-live="polite"
			aria-label={`Preview: ${previewLabel}, React 19, ${line}`}
		>
			<span className="text-foreground">{previewLabel}</span>
			{modeDescriptor ? <span className="text-muted-foreground max-w-56 truncate sm:max-w-none">{modeDescriptor}</span> : null}
			<span className="text-muted-foreground/80">React 19</span>
			<span>{line}</span>
		</div>
	);
}
