import radiantVeilSource from '../components/react/RadiantVeil.tsx?raw';
import chromaticLeaksSource from '../components/react/ChromaticLeaks.tsx?raw';
import haloRingSource from '../components/react/HaloRing.tsx?raw';
import shimmerRingSource from '../components/react/ShimmerRing.tsx?raw';
import crownGlowSource from '../components/react/CrownGlow.tsx?raw';
import chromaticFieldSource from '../components/react/ChromaticField.tsx?raw';
import solarFlareSource from '../components/react/SolarFlare.tsx?raw';
import blackHoleSource from '../components/react/BlackHole.tsx?raw';
import meshGradientSource from '../components/react/MeshGradient.tsx?raw';
import atmosphericSkySource from '../components/react/AtmosphericSky.tsx?raw';
import milkyWaySource from '../components/react/MilkyWay.tsx?raw';
import gasGiantSource from '../components/react/GasGiant.tsx?raw';

export type ComponentSlug =
	| 'radiant-veil'
	| 'chromatic-leaks'
	| 'halo-ring'
	| 'shimmer-ring'
	| 'crown-glow'
	| 'chromatic-field'
	| 'solar-flare'
	| 'black-hole'
	| 'mesh-gradient'
	| 'atmospheric-sky'
	| 'milky-way'
	| 'gas-giant';

export type SourceEntry = {
	source: string;
	filename: string;
};

export const componentRegistry = {
	'radiant-veil': {
		source: radiantVeilSource,
		filename: 'RadiantVeil.tsx',
	},
	'chromatic-leaks': {
		source: chromaticLeaksSource,
		filename: 'ChromaticLeaks.tsx',
	},
	'halo-ring': {
		source: haloRingSource,
		filename: 'HaloRing.tsx',
	},
	'shimmer-ring': {
		source: shimmerRingSource,
		filename: 'ShimmerRing.tsx',
	},
	'crown-glow': {
		source: crownGlowSource,
		filename: 'CrownGlow.tsx',
	},
	'chromatic-field': {
		source: chromaticFieldSource,
		filename: 'ChromaticField.tsx',
	},
	'solar-flare': {
		source: solarFlareSource,
		filename: 'SolarFlare.tsx',
	},
	'black-hole': {
		source: blackHoleSource,
		filename: 'BlackHole.tsx',
	},
	'mesh-gradient': {
		source: meshGradientSource,
		filename: 'MeshGradient.tsx',
	},
	'atmospheric-sky': {
		source: atmosphericSkySource,
		filename: 'AtmosphericSky.tsx',
	},
	'milky-way': {
		source: milkyWaySource,
		filename: 'MilkyWay.tsx',
	},
	'gas-giant': {
		source: gasGiantSource,
		filename: 'GasGiant.tsx',
	},
} satisfies Record<ComponentSlug, SourceEntry>;
