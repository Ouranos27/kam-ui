import { useEffect, useRef, useState } from 'react';

import { createPhysicalBlackHoleRenderer } from '@/lib/blackHolePhysical/webgl';
import { BlackHolePhysicalModel } from '@/lib/blackHolePhysical/model';
import { cn } from '@/lib/utils';
import {
	mergeRefs,
	resolvePerformanceQuality,
	useAutoPerformanceQuality,
	useInView,
	usePrefersReducedMotion,
	type PerformanceQuality,
} from '@/lib/containment';

/**
 * Schwarzschild black hole + accretion disc using Eric Bruneton’s beam-tracing shader
 * (BSD-3-Clause). Ships precomputed data in `/public/black-hole/*.dat`.
 *
 * Slider indices (0–1000) match the original HTML demo’s quantized controls.
 *
 * @see https://github.com/ebruneton/black_hole_shader
 * @see https://arxiv.org/abs/2010.08735
 */
export type BlackHoleProps = {
	className?: string;
	ref?: React.Ref<HTMLDivElement>;
	/** URL prefix for `deflection.dat`, `noise_texture.png`, etc. */
	assetBase?: string;
	/** Disc density (demo slider 0–1000, default 500). */
	discDensityIndex?: number;
	/** Disc opacity (0–1000, default 300). */
	discOpacityIndex?: number;
	/** Disc temperature / black-body level (0–1000, default 430). */
	discTemperatureIndex?: number;
	/** Tone-map exposure (0–1000, default 500). */
	exposureIndex?: number;
	/**
	 * Highlight boost before tone map (0–1000, default 500). Maps to the demo’s bloom slider;
	 * this build does not run the full mip bloom pipeline—only scales effective exposure.
	 */
	bloomIndex?: number;
	/** Camera distance from the black hole (0–1000, default 940). Lower = closer = bigger. */
	cameraDistanceIndex?: number;
	/** Orbit inclination / tilt angle (0–1799, default 970). Controls viewing angle of the disc. */
	orbitInclinationIndex?: number;
	/** Camera yaw / horizontal rotation (0–36000, default 0). Pans the view left/right. */
	cameraYawIndex?: number;
	/** Camera pitch / vertical tilt (0–18000, default 9000). Tilts the view up/down. */
	cameraPitchIndex?: number;
	/** Multiplier on frame delta for proper-time evolution. */
	speed?: number;
	quality?: PerformanceQuality;
};

function defaultAssetBase(): string {
	const b = import.meta.env.BASE_URL || '/';
	const trimmed = b.endsWith('/') ? b.slice(0, -1) : b;
	return `${trimmed}/black-hole/`;
}

export function BlackHole({
	ref,
	className,
	assetBase: assetBaseProp,
	discDensityIndex = 500,
	discOpacityIndex = 300,
	discTemperatureIndex = 430,
	exposureIndex = 500,
	bloomIndex = 500,
	cameraDistanceIndex = 940,
	orbitInclinationIndex = 970,
	cameraYawIndex = 0,
	cameraPitchIndex = 9000,
	speed = 1,
	quality = 'auto',
}: BlackHoleProps) {
	const reducedMotion = usePrefersReducedMotion();
	const autoQuality = useAutoPerformanceQuality();
	const resolvedQuality = resolvePerformanceQuality(quality, autoQuality);
	const dprCap = resolvedQuality === 'low' ? 1 : resolvedQuality === 'medium' ? 1.5 : 2;

	const { ref: inViewRef, inView } = useInView();
	const rootRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const modelRef = useRef<BlackHolePhysicalModel | null>(null);
	if (!modelRef.current) modelRef.current = new BlackHolePhysicalModel();

	const rendererRef = useRef<ReturnType<typeof createPhysicalBlackHoleRenderer> | null>(null);
	const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	useEffect(() => {
		const m = modelRef.current!;
		m.discDensity.setIndex(Math.max(0, Math.min(1000, Math.round(discDensityIndex))));
		m.discOpacity.setIndex(Math.max(0, Math.min(1000, Math.round(discOpacityIndex))));
		m.discTemperature.setIndex(Math.max(0, Math.min(1000, Math.round(discTemperatureIndex))));
		m.exposure.setIndex(Math.max(0, Math.min(1000, Math.round(exposureIndex))));
		m.bloom.setIndex(Math.max(0, Math.min(1000, Math.round(bloomIndex))));
		m.startRadius.setIndex(Math.max(0, Math.min(1000, Math.round(cameraDistanceIndex))));
		m.orbitInclination.setIndex(Math.max(0, Math.min(1799, Math.round(orbitInclinationIndex))));
		m.cameraYaw.setIndex(Math.max(0, Math.min(36000, Math.round(cameraYawIndex))));
		m.cameraPitch.setIndex(Math.max(0, Math.min(18000, Math.round(cameraPitchIndex))));
		m.highDefinition.setValue(resolvedQuality === 'high');
		rendererRef.current?.setExposure(m.exposure.getValue());
	}, [
		discDensityIndex,
		discOpacityIndex,
		discTemperatureIndex,
		exposureIndex,
		bloomIndex,
		cameraDistanceIndex,
		orbitInclinationIndex,
		cameraYawIndex,
		cameraPitchIndex,
		resolvedQuality,
	]);

	useEffect(() => {
		rendererRef.current?.setTimeScale(speed);
	}, [speed]);

	useEffect(() => {
		if (reducedMotion) {
			setLoadState('idle');
			setErrorMessage(null);
			return;
		}
		const canvas = canvasRef.current;
		const container = rootRef.current;
		if (!canvas || !container) return;

		const model = modelRef.current!;
		const base = assetBaseProp ?? defaultAssetBase();

		setLoadState('loading');
		setErrorMessage(null);

		let renderer: ReturnType<typeof createPhysicalBlackHoleRenderer>;
		try {
			renderer = createPhysicalBlackHoleRenderer(canvas, {
				assetBase: base,
				model,
				exposure: model.exposure.getValue(),
				dprCap,
				timeScale: speed,
			});
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'WebGL initialization failed';
			setErrorMessage(msg);
			setLoadState('error');
			return;
		}

		rendererRef.current = renderer;
		renderer.setRunning(false);

		const ro = new ResizeObserver(() => {
			const cw = container.clientWidth || 800;
			const ch = container.clientHeight || 600;
			renderer.setSize(cw, ch, window.devicePixelRatio || 1);
		});
		ro.observe(container);
		renderer.setSize(container.clientWidth || 800, container.clientHeight || 600, window.devicePixelRatio || 1);

		void renderer
			.loadAll()
			.then(() => {
				if (rendererRef.current !== renderer) return;
				renderer.setExposure(model.exposure.getValue());
				setLoadState('ready');
				setErrorMessage(null);
			})
			.catch((e: unknown) => {
				if (rendererRef.current !== renderer) return;
				const msg =
					e instanceof Error
						? e.message
						: 'Failed to load black hole data (check assetBase and network).';
				setErrorMessage(msg);
				setLoadState('error');
			});

		return () => {
			ro.disconnect();
			rendererRef.current = null;
			renderer.dispose();
			setLoadState('idle');
			setErrorMessage(null);
		};
	}, [reducedMotion, assetBaseProp, dprCap, speed]);

	useEffect(() => {
		const r = rendererRef.current;
		if (!r || loadState !== 'ready') return;
		r.setRunning(inView);
	}, [inView, loadState]);

	return (
		<div
			ref={mergeRefs(ref, inViewRef, rootRef)}
			className={cn('relative h-full w-full overflow-hidden bg-black', className)}
		>
			<canvas
				ref={canvasRef}
				className={cn(
					'absolute inset-0 block h-full w-full touch-none',
					(loadState === 'loading' || loadState === 'error') && 'opacity-0',
				)}
				aria-hidden
			/>

			{loadState === 'loading' && !reducedMotion && (
				<div
					className="pointer-events-none absolute inset-0 flex items-center justify-center"
					role="status"
					aria-live="polite"
				>
					<p className="max-w-sm px-4 text-center text-sm text-zinc-500">
						Loading black hole data (~4&nbsp;MB)…
					</p>
				</div>
			)}

			{loadState === 'error' && errorMessage && (
				<div
					className="absolute inset-0 flex items-center justify-center p-4"
					role="alert"
					aria-live="assertive"
				>
					<p className="max-w-md text-center text-sm text-red-300/90">{errorMessage}</p>
				</div>
			)}

			{reducedMotion && (
				<div
					className="pointer-events-none absolute inset-0 bg-black"
					style={{
						backgroundImage: [
							'radial-gradient(ellipse 56% 11% at 50% 50%, color-mix(in oklch, #ff4500 55%, transparent), transparent 80%)',
							'radial-gradient(ellipse 26% 48% at 50% 39%, color-mix(in oklch, #ff4500 35%, transparent), transparent 60%)',
							'radial-gradient(ellipse 30% 26% at 50% 63%, color-mix(in oklch, #8b4513 40%, transparent), transparent 64%)',
							'radial-gradient(circle 12% at 50% 50%, #000 0%, #000 58%, color-mix(in oklch, #ffffff 85%, transparent) 64%, transparent 72%)',
						].join(', '),
					}}
					aria-hidden
				/>
			)}
		</div>
	);
}
