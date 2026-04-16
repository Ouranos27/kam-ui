import { Suspense, lazy } from 'react';

import type { ComponentSlug } from '../../data/componentRegistry';
import { componentDefaults } from '../../data/componentDefaults';
import type { PerformanceQuality } from '@/lib/containment';

const LazyChromaticField = lazy(async () => ({ default: (await import('./ChromaticField')).ChromaticField }));
const LazyChromaticLeaks = lazy(async () => ({ default: (await import('./ChromaticLeaks')).ChromaticLeaks }));
const LazyCrownGlow = lazy(async () => ({ default: (await import('./CrownGlow')).CrownGlow }));
const LazyHaloRing = lazy(async () => ({ default: (await import('./HaloRing')).HaloRing }));
const LazyRadiantVeil = lazy(async () => ({ default: (await import('./RadiantVeil')).RadiantVeil }));
const LazyShimmerRing = lazy(async () => ({ default: (await import('./ShimmerRing')).ShimmerRing }));
const LazyBlackHole = lazy(async () => ({ default: (await import('./BlackHole')).BlackHole }));
const LazySolarFlare = lazy(async () => ({ default: (await import('./SolarFlare')).SolarFlare }));
const LazyMeshGradient = lazy(async () => ({ default: (await import('./MeshGradient')).MeshGradient }));
const LazyAtmosphericSky = lazy(async () => ({ default: (await import('./AtmosphericSky')).AtmosphericSky }));
const LazyMilkyWay = lazy(async () => ({ default: (await import('./MilkyWay')).MilkyWay }));
const LazyGasGiant = lazy(async () => ({ default: (await import('./GasGiant')).GasGiant }));

// ─── Types ────────────────────────────────────────────────────────────────────

export type ComponentPlaygroundProps = {
	slug: ComponentSlug;
	/**
	 * Optional prop overrides — merged with the component's built-in defaults.
	 * Provided by `LivePlayground` when the user adjusts controls.
	 */
	propsOverride?: Record<string, unknown>;
	quality?: PerformanceQuality;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BG_STAGE =
	'relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-transparent';

function fallbackForSlug(slug: ComponentSlug) {
	const base = 'absolute inset-0 pointer-events-none';
	switch (slug) {
		case 'radiant-veil':
			return (
				<div
					className={base}
					style={{
						background:
							'radial-gradient(125% 125% at 50% 10%, transparent 40%, rgba(124,58,237,0.68) 100%)',
					}}
					aria-hidden
				/>
			);
		case 'chromatic-leaks':
			return (
				<div
					className={base}
					style={{
						background:
							'radial-gradient(110% 110% at 7% 7%, transparent 42%, #7c3aed 100%), radial-gradient(110% 110% at 93% 93%, transparent 42%, #f97316 100%), radial-gradient(110% 110% at 93% 7%, transparent 42%, #0ea5e9 100%), radial-gradient(110% 110% at 7% 93%, transparent 42%, #10b981 100%)',
					}}
					aria-hidden
				/>
			);
		case 'halo-ring':
			return (
				<div
					className={base}
					style={{
						background:
							'radial-gradient(130% 130% at 50% 50%, transparent 28%, #a855f7 47%, transparent 66%)',
					}}
					aria-hidden
				/>
			);
		case 'shimmer-ring':
			return (
				<div
					className={base}
					style={{
						background:
							'radial-gradient(74% 74% at 50% 50%, transparent 44%, rgba(168,85,247,0.9) 60%, transparent 74%)',
					}}
					aria-hidden
				/>
			);
		case 'crown-glow':
			return (
				<div
					className={base}
					style={{
						background:
							'radial-gradient(ellipse 120% 55% at 50% -10%, rgba(168,85,247,0.35) 0%, rgba(124,58,237,0.22) 35%, transparent 65%)',
					}}
					aria-hidden
				/>
			);
		case 'chromatic-field':
			return (
				<div
					className={base}
					style={{
						background:
							'radial-gradient(circle 28% at 50% 50%, #000 26%, rgba(180,204,223,0.8) 30%, rgba(180,204,223,0.28) 50%, transparent 76%), #050508',
					}}
					aria-hidden
				/>
			);
		case 'solar-flare':
			return (
				<div
					className={base}
					style={{
						background:
							'radial-gradient(circle 26% at 50% 50%, #fff7d6 0%, #ffbe73 20%, rgba(255,136,64,0.85) 30%, rgba(255,136,64,0.35) 56%, transparent 78%), #0a0502',
					}}
					aria-hidden
				/>
			);
		case 'atmospheric-sky':
			return (
				<div
					className={base}
					style={{
						background:
							'linear-gradient(to bottom, #0a1628 0%, #1e4a8a 30%, #6ba3d6 60%, #b8d4e8 100%)',
					}}
					aria-hidden
				/>
			);
		case 'mesh-gradient':
			return (
				<div
					className={base}
					style={{
						background:
							'radial-gradient(ellipse 60% 55% at 30% 30%, rgba(99,102,241,0.5) 0%, transparent 70%), radial-gradient(ellipse 55% 50% at 70% 70%, rgba(236,72,153,0.5) 0%, transparent 65%), radial-gradient(ellipse 65% 60% at 50% 40%, rgba(20,184,166,0.4) 0%, transparent 70%)',
					}}
					aria-hidden
				/>
			);
		case 'black-hole':
			return (
				<div
					className={base}
					style={{
						background:
							'radial-gradient(ellipse 56% 11% at 50% 50%, rgba(255,69,0,0.5) 0%, transparent 80%), radial-gradient(ellipse 26% 48% at 50% 39%, rgba(255,69,0,0.28) 0%, transparent 60%), radial-gradient(ellipse 30% 26% at 50% 63%, rgba(139,69,19,0.35) 0%, transparent 64%), radial-gradient(circle 12% at 50% 50%, #000 0%, #000 58%, rgba(255,255,255,0.55) 64%, transparent 72%), radial-gradient(ellipse 100% 85% at 50% 50%, rgba(139,69,19,0.22) 0%, transparent 50%), #000000',
					}}
					aria-hidden
				/>
			);
		default:
			return null;
	}
}

/** Resolve a prop value: use override if present, otherwise fall back to the component default. */
function p<T>(slug: ComponentSlug, override: Record<string, unknown> | undefined, key: string): T {
	const val = override?.[key] ?? componentDefaults[slug]?.[key];
	return val as T;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Renders the appropriate background component for a given slug.
 *
 * Prop values come from `propsOverride` (controlled by `LivePlayground`) merged
 * with the defaults from `componentDefaults`. This keeps the playground stateless —
 * all state lives in `LivePlayground`.
 */
export function ComponentPlayground({ slug, propsOverride, quality = 'auto' }: ComponentPlaygroundProps) {
	const fallback = (
		<div className={BG_STAGE} aria-hidden>
			{fallbackForSlug(slug)}
		</div>
	);

	switch (slug) {
		case 'radiant-veil':
			return (
				<div className={BG_STAGE}>
					<Suspense fallback={fallback}>
						<LazyRadiantVeil
						variant={p<'default'>(slug, propsOverride, 'variant')}
						color={p<string>(slug, propsOverride, 'color')}
						color2={p<string>(slug, propsOverride, 'color2')}
						color3={p<string>(slug, propsOverride, 'color3')}
						from={p<'top'>(slug, propsOverride, 'from')}
						clearStop={p<number>(slug, propsOverride, 'clearStop')}
						size={p<number>(slug, propsOverride, 'size')}
						drift={p<number>(slug, propsOverride, 'drift')}
						speed={p<number>(slug, propsOverride, 'speed')}
						breathe={p<boolean>(slug, propsOverride, 'breathe')}
						breatheAmplitude={p<number>(slug, propsOverride, 'breatheAmplitude')}
						mouseReact={p<boolean>(slug, propsOverride, 'mouseReact')}
						quality={quality}
						/>
					</Suspense>
				</div>
			);

		case 'chromatic-leaks':
			return (
				<div className={BG_STAGE}>
					<Suspense fallback={fallback}>
						<LazyChromaticLeaks
						color1={p<string>(slug, propsOverride, 'color1')}
						color2={p<string>(slug, propsOverride, 'color2')}
						color3={p<string>(slug, propsOverride, 'color3')}
						color4={p<string>(slug, propsOverride, 'color4')}
						size={p<number>(slug, propsOverride, 'size')}
						clearStop={p<number>(slug, propsOverride, 'clearStop')}
						drift={p<number>(slug, propsOverride, 'drift')}
						speed={p<number>(slug, propsOverride, 'speed')}
						breathe={p<boolean>(slug, propsOverride, 'breathe')}
						breatheAmplitude={p<number>(slug, propsOverride, 'breatheAmplitude')}
						mouseReact={p<boolean>(slug, propsOverride, 'mouseReact')}
						quality={quality}
						/>
					</Suspense>
				</div>
			);

		case 'halo-ring':
			return (
				<div className={BG_STAGE}>
					<Suspense fallback={fallback}>
						<LazyHaloRing
						color={p<string>(slug, propsOverride, 'color')}
						cx={p<number>(slug, propsOverride, 'cx')}
						cy={p<number>(slug, propsOverride, 'cy')}
						size={p<number>(slug, propsOverride, 'size')}
						innerStop={p<number>(slug, propsOverride, 'innerStop')}
						bandWidth={p<number>(slug, propsOverride, 'bandWidth')}
						drift={p<number>(slug, propsOverride, 'drift')}
						speed={p<number>(slug, propsOverride, 'speed')}
						breathe={p<boolean>(slug, propsOverride, 'breathe')}
						breatheAmplitude={p<number>(slug, propsOverride, 'breatheAmplitude')}
						mouseReact={p<boolean>(slug, propsOverride, 'mouseReact')}
						quality={quality}
						/>
					</Suspense>
				</div>
			);

		case 'shimmer-ring':
			return (
				<div className={BG_STAGE}>
					<Suspense fallback={fallback}>
						<LazyShimmerRing
						className="min-h-full flex-1"
						color={p<string>(slug, propsOverride, 'color')}
						cx={p<number>(slug, propsOverride, 'cx')}
						cy={p<number>(slug, propsOverride, 'cy')}
						innerRadius={p<number>(slug, propsOverride, 'innerRadius')}
						bandWidth={p<number>(slug, propsOverride, 'bandWidth')}
						shimmer={p<number>(slug, propsOverride, 'shimmer')}
						bandFibers={p<number>(slug, propsOverride, 'bandFibers')}
						drift={p<number>(slug, propsOverride, 'drift')}
						speed={p<number>(slug, propsOverride, 'speed')}
						mouseReact={p<boolean>(slug, propsOverride, 'mouseReact')}
						quality={quality}
						/>
					</Suspense>
				</div>
			);

		case 'crown-glow':
			return (
				<div className={BG_STAGE}>
					<Suspense fallback={fallback}>
						<LazyCrownGlow
						className="min-h-full flex-1"
						color1={p<string>(slug, propsOverride, 'color1')}
						color2={p<string>(slug, propsOverride, 'color2')}
						centerY={p<number>(slug, propsOverride, 'centerY')}
						radius1={p<number>(slug, propsOverride, 'radius1')}
						radius2={p<number>(slug, propsOverride, 'radius2')}
						shimmer={p<number>(slug, propsOverride, 'shimmer')}
						arcFibers={p<number>(slug, propsOverride, 'arcFibers')}
						speed={p<number>(slug, propsOverride, 'speed')}
						quality={quality}
						/>
					</Suspense>
				</div>
			);

		case 'chromatic-field':
			return (
				<div className={BG_STAGE}>
					<Suspense fallback={fallback}>
						<LazyChromaticField
						className="min-h-full flex-1"
						color={p<string>(slug, propsOverride, 'color')}
						aberration={p<number>(slug, propsOverride, 'aberration')}
						speed={p<number>(slug, propsOverride, 'speed')}
						intensity={p<number>(slug, propsOverride, 'intensity')}
						sphereRadius={p<number>(slug, propsOverride, 'sphereRadius')}
						limb={p<number>(slug, propsOverride, 'limb')}
						coronaFibers={p<number>(slug, propsOverride, 'coronaFibers')}
						mouseReact={p<boolean>(slug, propsOverride, 'mouseReact')}
						mouseMoveSphere={p<boolean>(slug, propsOverride, 'mouseMoveSphere')}
						quality={quality}
						/>
					</Suspense>
				</div>
			);

		case 'solar-flare':
			return (
				<div className={BG_STAGE}>
					<Suspense fallback={fallback}>
						<LazySolarFlare
						className="min-h-full flex-1"
						color={p<string>(slug, propsOverride, 'color')}
						radius={p<number>(slug, propsOverride, 'radius')}
						flareCount={p<number>(slug, propsOverride, 'flareCount')}
						limbDark={p<number>(slug, propsOverride, 'limbDark')}
						speed={p<number>(slug, propsOverride, 'speed')}
						intensity={p<number>(slug, propsOverride, 'intensity')}
						coronaRadiiX={p<number>(slug, propsOverride, 'coronaRadiiX')}
						coronaRadiiY={p<number>(slug, propsOverride, 'coronaRadiiY')}
						quality={quality}
						/>
					</Suspense>
				</div>
			);

		case 'black-hole':
			return (
				<div className={BG_STAGE}>
					<Suspense fallback={fallback}>
						<LazyBlackHole
							className="min-h-full flex-1"
							discDensityIndex={p<number>(slug, propsOverride, 'discDensityIndex')}
							discOpacityIndex={p<number>(slug, propsOverride, 'discOpacityIndex')}
							discTemperatureIndex={p<number>(slug, propsOverride, 'discTemperatureIndex')}
							exposureIndex={p<number>(slug, propsOverride, 'exposureIndex')}
							bloomIndex={p<number>(slug, propsOverride, 'bloomIndex')}
							cameraDistanceIndex={p<number>(slug, propsOverride, 'cameraDistanceIndex')}
							orbitInclinationIndex={p<number>(slug, propsOverride, 'orbitInclinationIndex')}
							cameraYawIndex={p<number>(slug, propsOverride, 'cameraYawIndex')}
							cameraPitchIndex={p<number>(slug, propsOverride, 'cameraPitchIndex')}
							speed={p<number>(slug, propsOverride, 'speed')}
							quality={quality}
						/>
					</Suspense>
				</div>
			);

		case 'mesh-gradient':
			return (
				<div className={BG_STAGE}>
					<Suspense fallback={fallback}>
						<LazyMeshGradient
							className="min-h-full flex-1"
							color1={p<string>(slug, propsOverride, 'color1')}
							color2={p<string>(slug, propsOverride, 'color2')}
							color3={p<string>(slug, propsOverride, 'color3')}
							color4={p<string>(slug, propsOverride, 'color4')}
							bgColor={p<string>(slug, propsOverride, 'bgColor')}
							intensity={p<number>(slug, propsOverride, 'intensity')}
							blobScale={p<number>(slug, propsOverride, 'blobScale')}
							speed={p<number>(slug, propsOverride, 'speed')}
							quality={quality}
						/>
					</Suspense>
				</div>
			);

		case 'atmospheric-sky':
			return (
				<div className={BG_STAGE}>
					<Suspense fallback={fallback}>
						<LazyAtmosphericSky
							className="min-h-full flex-1"
							sunZenith={p<number>(slug, propsOverride, 'sunZenith')}
							sunAzimuth={p<number>(slug, propsOverride, 'sunAzimuth')}
							animateSun={p<boolean>(slug, propsOverride, 'animateSun')}
							exposure={p<number>(slug, propsOverride, 'exposure')}
							rayleighScale={p<number>(slug, propsOverride, 'rayleighScale')}
							mieScale={p<number>(slug, propsOverride, 'mieScale')}
							mieG={p<number>(slug, propsOverride, 'mieG')}
							sunColor={p<string>(slug, propsOverride, 'sunColor')}
							speed={p<number>(slug, propsOverride, 'speed')}
							quality={quality}
						/>
					</Suspense>
				</div>
			);

		case 'milky-way':
			return (
				<div className={BG_STAGE}>
					<Suspense fallback={fallback}>
						<LazyMilkyWay
							className="min-h-full flex-1"
							brightness={p<number>(slug, propsOverride, 'brightness')}
							rotation={p<number>(slug, propsOverride, 'rotation')}
							tilt={p<number>(slug, propsOverride, 'tilt')}
							speed={p<number>(slug, propsOverride, 'speed')}
							quality={quality}
						/>
					</Suspense>
				</div>
			);

		case 'gas-giant':
			return (
				<div className={BG_STAGE}>
					<Suspense fallback={fallback}>
						<LazyGasGiant
							className="min-h-full flex-1"
							textureUrl={p<string>(slug, propsOverride, 'textureUrl')}
							procedural={p<boolean>(slug, propsOverride, 'procedural')}
							radius={p<number>(slug, propsOverride, 'radius')}
							oblateness={p<number>(slug, propsOverride, 'oblateness')}
							atmosphereColor={p<string>(slug, propsOverride, 'atmosphereColor')}
							atmosphereIntensity={p<number>(slug, propsOverride, 'atmosphereIntensity')}
							lightDirection={p<[number, number, number]>(slug, propsOverride, 'lightDirection')}
							tilt={p<number>(slug, propsOverride, 'tilt')}
							speed={p<number>(slug, propsOverride, 'speed')}
							hasRings={p<boolean>(slug, propsOverride, 'hasRings')}
							ringColor={p<string>(slug, propsOverride, 'ringColor')}
							turbulence={p<number>(slug, propsOverride, 'turbulence')}
							starfield={p<boolean>(slug, propsOverride, 'starfield')}
							mouseReact={p<boolean>(slug, propsOverride, 'mouseReact')}
							bandColor1={p<string>(slug, propsOverride, 'bandColor1')}
							bandColor2={p<string>(slug, propsOverride, 'bandColor2')}
							quality={quality}
						/>
					</Suspense>
				</div>
			);

		default:
			return null;
	}
}
