/**
 * Emits shadcn-compatible registry JSON under public/r/ for static hosting.
 * Set REGISTRY_ORIGIN for registryDependencies URLs (default: https://ui.philippekam.dev).
 */
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'public', 'r');
const srcReact = join(root, 'src', 'components', 'react');
const srcLib = join(root, 'src', 'lib', 'utils.ts');
const srcContainment = join(root, 'src', 'lib', 'containment.ts');
const srcBlackHolePhysical = join(root, 'src', 'lib', 'blackHolePhysical');
const srcShaders = join(root, 'src', 'shaders');

const ORIGIN = (process.env.REGISTRY_ORIGIN || 'https://ui.philippekam.dev').replace(/\/$/, '');
const UTILS_URL = `${ORIGIN}/r/kam-utils.json`;
const CONTAINMENT_URL = `${ORIGIN}/r/kam-containment.json`;

const SCHEMA_REGISTRY = 'https://ui.shadcn.com/schema/registry.json';
const SCHEMA_ITEM = 'https://ui.shadcn.com/schema/registry-item.json';

const DEPS = ['clsx@^2.1.1', 'tailwind-merge@^3.5.0'];
const OGL = 'ogl@^1.0.11';

const COMPONENTS = [
	{
		name: 'chromatic-leaks',
		title: 'Chromatic Leaks',
		description:
			'Four animated corner radials — each leaks colour from its corner while leaving the composition centre transparent. Independent Lissajous drift and breathing per radial, with mouse-parallax follow.',
		file: 'ChromaticLeaks.tsx',
		registryDependencies: [UTILS_URL, CONTAINMENT_URL],
		dependencies: [...DEPS],
	},
	{
		name: 'halo-ring',
		title: 'Halo Ring',
		description:
			'Animated radial ring — transparent centre, glowing colour band, transparent outer zone. The band breathes, the ring drifts, the centre follows the cursor.',
		file: 'HaloRing.tsx',
		registryDependencies: [UTILS_URL, CONTAINMENT_URL],
		dependencies: [...DEPS],
	},
	{
		name: 'shimmer-ring',
		title: 'Shimmer Ring',
		description:
			'WebGL shader ring — transparent centre, noise-shimmered colour band, transparent outer zone. Angle-dependent simplex noise deforms the band edges so the ring is never a perfect circle.',
		file: 'ShimmerRing.tsx',
		registryDependencies: [UTILS_URL, CONTAINMENT_URL],
		dependencies: [...DEPS, OGL],
	},
	{
		name: 'crown-glow',
		title: 'Crown Glow',
		description:
			'WebGL shader halo whose centre is above the visible canvas — only the lower arc shows, creating a glowing crown at the top of the composition. Two concentric rings shimmer with noise.',
		file: 'CrownGlow.tsx',
		registryDependencies: [UTILS_URL, CONTAINMENT_URL],
		dependencies: [...DEPS, OGL],
	},
	{
		name: 'chromatic-field',
		title: 'Chromatic Field',
		description:
			'Procedural organic domain-warp field with rotating light streaks. RGB channels are sampled at offset UVs to produce chromatic aberration — lens-split colour fringing at every bright edge. Dark cinematic palette.',
		file: 'ChromaticField.tsx',
		registryDependencies: [UTILS_URL, CONTAINMENT_URL],
		dependencies: [...DEPS, OGL],
	},
	{
		name: 'solar-flare',
		title: 'Solar Flare',
		description:
			'Procedural WebGL sun: limb-darkened photosphere, chromosphere band, fibrous corona from radial noise sampling, activity via flareCount. Warm accent on deep space.',
		file: 'SolarFlare.tsx',
		registryDependencies: [UTILS_URL, CONTAINMENT_URL],
		dependencies: [...DEPS, OGL],
	},
	{
		name: 'radiant-veil',
		title: 'Radiant Veil',
		description:
			'Transparent radial overlay with Lissajous drift. CSS vars + rAF — the coloured fringe moves while the centre stays clear.',
		file: 'RadiantVeil.tsx',
		registryDependencies: [UTILS_URL, CONTAINMENT_URL],
		dependencies: [...DEPS],
	},
	{
		name: 'mesh-gradient',
		title: 'Mesh Gradient',
		description:
			'Four soft colour blobs drift on simplex-noise paths, blending like liquid paint. WebGL shader with cubic hermite falloff. Subtle film grain adds analog texture.',
		file: 'MeshGradient.tsx',
		registryDependencies: [UTILS_URL, CONTAINMENT_URL],
		dependencies: [...DEPS, OGL],
	},
	{
		name: 'atmospheric-sky',
		title: 'Atmospheric Sky',
		description:
			'Procedural atmospheric sky — Rayleigh/Mie scattering, animated sun, day/night cycle with cirrus clouds, crepuscular rays, sun bloom, and twinkling stars. All analytic, no precomputed textures.',
		file: 'AtmosphericSky.tsx',
		registryDependencies: [UTILS_URL, CONTAINMENT_URL],
		dependencies: [...DEPS, OGL],
	},
	{
		name: 'milky-way',
		title: 'Milky Way',
		description:
			'Milky Way panorama from ESA Gaia DR2 colour data projected onto a sky dome. Procedural star overlay, slow galactic rotation. Requires public/milky-way/milky-way.jpg (~945 KB) — download from the kam-ui repo.',
		file: 'MilkyWay.tsx',
		registryDependencies: [UTILS_URL, CONTAINMENT_URL],
		dependencies: [...DEPS, OGL],
	},
	{
		name: 'black-hole',
		title: 'Black Hole',
		description:
			'Schwarzschild black hole + accretion disc (Eric Bruneton beam-tracing shader, BSD-3-Clause). Ships TS + GLSL; copy public/black-hole/*.dat from kam-ui or rebuild with github.com/ebruneton/black_hole_shader. WebGL2 float extensions + Vite ?raw imports required.',
		file: 'BlackHole.tsx',
		registryDependencies: [UTILS_URL, CONTAINMENT_URL],
		dependencies: [...DEPS],
	},
];

function blackHoleRegistryFileContents(componentTsx) {
	return [
		{
			path: 'components/kam/black-hole.tsx',
			type: 'registry:component',
			target: 'components/kam/black-hole.tsx',
			content: componentTsx,
		},
		{
			path: 'lib/blackHolePhysical/webgl.ts',
			type: 'registry:lib',
			target: 'lib/blackHolePhysical/webgl.ts',
			content: readFileSync(join(srcBlackHolePhysical, 'webgl.ts'), 'utf8'),
		},
		{
			path: 'lib/blackHolePhysical/model.ts',
			type: 'registry:lib',
			target: 'lib/blackHolePhysical/model.ts',
			content: readFileSync(join(srcBlackHolePhysical, 'model.ts'), 'utf8'),
		},
		{
			path: 'lib/blackHolePhysical/discParticleGlsl.ts',
			type: 'registry:lib',
			target: 'lib/blackHolePhysical/discParticleGlsl.ts',
			content: readFileSync(join(srcBlackHolePhysical, 'discParticleGlsl.ts'), 'utf8'),
		},
		{
			path: 'shaders/blackHolePhysicalCore.glsl',
			type: 'registry:lib',
			target: 'shaders/blackHolePhysicalCore.glsl',
			content: readFileSync(join(srcShaders, 'blackHolePhysicalCore.glsl'), 'utf8'),
		},
		{
			path: 'shaders/blackHolePhysicalFragment.glsl',
			type: 'registry:lib',
			target: 'shaders/blackHolePhysicalFragment.glsl',
			content: readFileSync(join(srcShaders, 'blackHolePhysicalFragment.glsl'), 'utf8'),
		},
		{
			path: 'shaders/blackHolePhysicalVertex.glsl',
			type: 'registry:lib',
			target: 'shaders/blackHolePhysicalVertex.glsl',
			content: readFileSync(join(srcShaders, 'blackHolePhysicalVertex.glsl'), 'utf8'),
		},
	];
}

function readComponent(file) {
	return readFileSync(join(srcReact, file), 'utf8');
}

function writeJson(name, data) {
	writeFileSync(join(outDir, `${name}.json`), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

mkdirSync(outDir, { recursive: true });

const utilsContent = readFileSync(srcLib, 'utf8');
const containmentContent = readFileSync(srcContainment, 'utf8');

const utilsItem = {
	$schema: SCHEMA_ITEM,
	name: 'kam-utils',
	type: 'registry:lib',
	title: 'kam-ui utils',
	description: 'cn() helper combining clsx + tailwind-merge (shadcn-style).',
	dependencies: ['clsx@^2.1.1', 'tailwind-merge@^3.5.0'],
	files: [
		{
			path: 'lib/utils.ts',
			type: 'registry:lib',
			target: 'lib/utils.ts',
			content: utilsContent,
		},
	],
};

const containmentItem = {
	$schema: SCHEMA_ITEM,
	name: 'kam-containment',
	type: 'registry:lib',
	title: 'kam-ui containment',
	description: 'Viewport visibility, reduced-motion, hover-capable queries, ref merge helpers.',
	dependencies: [],
	files: [
		{
			path: 'lib/containment.ts',
			type: 'registry:lib',
			target: 'lib/containment.ts',
			content: containmentContent,
		},
	],
};

writeJson('kam-utils', utilsItem);
writeJson('kam-containment', containmentItem);

const indexItems = [];

for (const c of COMPONENTS) {
	const content = readComponent(c.file);
	const files =
		c.name === 'black-hole'
			? blackHoleRegistryFileContents(content)
			: [
					{
						path: `components/kam/${c.name}.tsx`,
						type: 'registry:component',
						content,
					},
				];
	const item = {
		$schema: SCHEMA_ITEM,
		name: c.name,
		type: 'registry:component',
		title: c.title,
		description: c.description,
		dependencies: c.dependencies,
		registryDependencies: c.registryDependencies,
		files,
	};
	writeJson(c.name, item);
	indexItems.push({
		name: c.name,
		type: 'registry:component',
		title: c.title,
		description: c.description,
		dependencies: c.dependencies,
		registryDependencies: c.registryDependencies,
		files: files.map((f) => ({ path: f.path, type: f.type })),
	});
}

indexItems.unshift({
	name: 'kam-containment',
	type: 'registry:lib',
	title: 'kam-ui containment',
	description: 'Viewport pause + motion/hover query hooks for specimens.',
	dependencies: [],
	files: [
		{
			path: 'lib/containment.ts',
			type: 'registry:lib',
		},
	],
});

indexItems.unshift({
	name: 'kam-utils',
	type: 'registry:lib',
	title: 'kam-ui utils',
	description: 'cn() helper combining clsx + tailwind-merge (shadcn-style).',
	dependencies: ['clsx@^2.1.1', 'tailwind-merge@^3.5.0'],
	files: [
		{
			path: 'lib/utils.ts',
			type: 'registry:lib',
		},
	],
});

const registry = {
	$schema: SCHEMA_REGISTRY,
	name: 'kam-ui',
	homepage: ORIGIN,
	items: indexItems,
};

writeJson('registry', registry);

try {
	unlinkSync(join(outDir, 'artsy-utils.json'));
} catch {
	/* already removed */
}

console.log(`Registry built → ${outDir} (origin: ${ORIGIN})`);
