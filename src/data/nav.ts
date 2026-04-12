export type ChamberSurface = 'dark' | 'light';

/** Light chamber interior: blueprint grid vs flat fill (grid is optional). */
export type ChamberWellStyle = 'grid' | 'solid';

export type ComponentCategoryId = 'backgrounds';

export const COMPONENT_CATEGORY_LABELS: Record<ComponentCategoryId, string> = {
	backgrounds: 'Backgrounds',
};

export const COMPONENT_CATEGORY_ORDER: ComponentCategoryId[] = ['backgrounds'];

export type NavItem = {
	title: string;
	href: string;
	slug?: string;
	openInNewTab?: boolean;
	description?: string;
	widePreview?: boolean;
	chamberSurface?: ChamberSurface;
	chamberWellStyle?: ChamberWellStyle;
	dependencyPackages?: string[];
	specimenEngine?: string;
	specimenCode?: string;
	category?: ComponentCategoryId;
};

export const mainNav: NavItem[] = [
	{ title: 'Overview', href: '/' },
	{ title: 'Design System', href: '/design-system' },
	{ title: 'Registry (JSON)', href: '/r/registry.json', openInNewTab: true },
];

export const componentNav: NavItem[] = [
	{
		title: 'Radiant Veil',
		href: '/components/radiant-veil',
		slug: 'radiant-veil',
		category: 'backgrounds',
		description:
			'Transparent radial-gradient overlay (pattern-craft radial style). The inner zone is truly transparent — content shows through. Only the coloured fringe animates via a gentle focal-point drift.',
		widePreview: true,
		chamberSurface: 'light',
		specimenEngine: 'CSS vars · rAF',
		specimenCode: 'BG-03',
		dependencyPackages: ['kam-containment (registry lib — copy `lib/containment.ts`)'],
	},
	{
		title: 'Chromatic Leaks',
		href: '/components/chromatic-leaks',
		slug: 'chromatic-leaks',
		category: 'backgrounds',
		description:
			'Four animated corner radials (pattern-craft style) — each leaks colour from its corner while leaving the composition centre transparent. Independent Lissajous drift and breathing per radial, with mouse-parallax follow.',
		widePreview: true,
		chamberSurface: 'dark',
		specimenEngine: 'CSS vars · rAF',
		specimenCode: 'BG-04',
		dependencyPackages: ['kam-containment (registry lib — copy `lib/containment.ts`)'],
	},
	{
		title: 'Halo Ring',
		href: '/components/halo-ring',
		slug: 'halo-ring',
		category: 'backgrounds',
		description:
			'Animated radial ring — transparent centre, glowing colour band, transparent outer zone. The band breathes (pulsates between thin and wide), the ring drifts on a Lissajous path, and the centre follows the cursor.',
		widePreview: true,
		chamberSurface: 'dark',
		specimenEngine: 'CSS vars · rAF',
		specimenCode: 'BG-05',
		dependencyPackages: ['kam-containment (registry lib — copy `lib/containment.ts`)'],
	},
	{
		title: 'Shimmer Ring',
		href: '/components/shimmer-ring',
		slug: 'shimmer-ring',
		category: 'backgrounds',
		description:
			'WebGL shader ring — transparent centre, noise-shimmered colour band, transparent outer zone. Angle-dependent simplex noise deforms the band edges so the ring is never a perfect circle: it shimmers, sparks, and pulses.',
		widePreview: true,
		chamberSurface: 'dark',
		specimenEngine: 'WebGL · ogl',
		specimenCode: 'BG-06',
		dependencyPackages: ['ogl', 'kam-containment (registry lib — copy `lib/containment.ts`)'],
	},
	{
		title: 'Crown Glow',
		href: '/components/crown-glow',
		slug: 'crown-glow',
		category: 'backgrounds',
		description:
			'WebGL shader halo whose centre is positioned above the visible canvas — only the lower arc is visible, creating a glowing crown at the top of the composition. Two concentric rings (tight inner + wide outer haze) shimmer with noise. The animated Lovable-style radial glow.',
		widePreview: true,
		chamberSurface: 'dark',
		specimenEngine: 'WebGL · ogl',
		specimenCode: 'BG-07',
		dependencyPackages: ['ogl', 'kam-containment (registry lib — copy `lib/containment.ts`)'],
	},
	{
		title: 'Chromatic Field',
		href: '/components/chromatic-field',
		slug: 'chromatic-field',
		category: 'backgrounds',
		description:
			'Procedural organic domain-warp field with rotating light streaks. RGB channels are sampled at offset UVs to produce chromatic aberration — a lens-split colour fringe at every bright edge. Dark cinematic palette.',
		widePreview: true,
		chamberSurface: 'dark',
		specimenEngine: 'WebGL · ogl',
		specimenCode: 'BG-08',
		dependencyPackages: ['ogl', 'kam-containment (registry lib — copy `lib/containment.ts`)'],
	},
	{
		title: 'Solar Flare',
		href: '/components/solar-flare',
		slug: 'solar-flare',
		category: 'backgrounds',
		description:
			'Procedural WebGL sun with domain-warped plasma surface (limb-darkened), soft outer corona, and up to 7 animated arch flares that orbit, breathe, and pulse. Warm orange palette in deep space. Sun parallax-tracks the cursor.',
		widePreview: true,
		chamberSurface: 'dark',
		specimenEngine: 'WebGL · ogl',
		specimenCode: 'BG-09',
		dependencyPackages: ['ogl', 'kam-containment (registry lib — copy `lib/containment.ts`)'],
	},
	{
		title: 'Black Hole',
		href: '/components/black-hole',
		slug: 'black-hole',
		category: 'backgrounds',
		description:
			'Physical Schwarzschild black hole + accretion disc (Bruneton beam-tracing shader, BSD-3-Clause): precomputed deflection textures, relativistic disc shading, HDR + tone map. Static black sky. Needs /public/black-hole/*.dat.',
		widePreview: true,
		chamberSurface: 'dark',
		specimenEngine: 'WebGL · ogl',
		specimenCode: 'BG-10',
		dependencyPackages: ['ogl', 'kam-containment (registry lib — copy `lib/containment.ts`)'],
	},
	{
		title: 'Mesh Gradient',
		href: '/components/mesh-gradient',
		slug: 'mesh-gradient',
		category: 'backgrounds',
		description:
			'Stripe-style animated mesh gradient — four colour blobs drift on noise-driven paths, blending like liquid paint where they overlap. WebGL shader with cubic hermite falloff for premium soft edges.',
		widePreview: true,
		chamberSurface: 'dark',
		specimenEngine: 'WebGL · ogl',
		specimenCode: 'BG-11',
		dependencyPackages: ['ogl', 'kam-containment (registry lib — copy `lib/containment.ts`)'],
	},
	{
		title: 'Atmospheric Sky',
		href: '/components/atmospheric-sky',
		slug: 'atmospheric-sky',
		category: 'backgrounds',
		description:
			'Procedural atmospheric sky — Rayleigh/Mie scattering approximation with animated sun, day/night cycle, sunset horizon glow, and twinkling star field. Zero precomputed data.',
		widePreview: true,
		chamberSurface: 'dark',
		specimenEngine: 'WebGL · ogl',
		specimenCode: 'BG-12',
		dependencyPackages: ['ogl', 'kam-containment (registry lib — copy `lib/containment.ts`)'],
	},
	{
		title: 'Milky Way',
		href: '/components/milky-way',
		slug: 'milky-way',
		category: 'backgrounds',
		description:
			'Milky Way panorama from ESA Gaia DR2 colour data, projected onto a sky dome with procedural stars and slow galactic rotation. Equirectangular texture + WebGL shader.',
		widePreview: true,
		chamberSurface: 'dark',
		specimenEngine: 'WebGL · ogl',
		specimenCode: 'BG-13',
		dependencyPackages: ['ogl', 'kam-containment (registry lib — copy `lib/containment.ts`)'],
	},
];

export const firstComponentHref = componentNav[0]!.href;
export const firstRegistrySlug = componentNav[0]!.slug!;

export type ComponentNavGroup = {
	id: ComponentCategoryId;
	label: string;
	items: NavItem[];
	emptyHint?: string;
};

export const componentNavGrouped: ComponentNavGroup[] = COMPONENT_CATEGORY_ORDER.map((id) => ({
	id,
	label: COMPONENT_CATEGORY_LABELS[id],
	items: componentNav.filter((c) => c.category === id),
}));

export function getComponentBySlug(slug: string) {
	return componentNav.find((c) => c.slug === slug);
}

export function getComponentNeighbors(slug: string): { prev: NavItem | null; next: NavItem | null } {
	const i = componentNav.findIndex((c) => c.slug === slug);
	if (i === -1) return { prev: null, next: null };
	return {
		prev: i > 0 ? componentNav[i - 1]! : null,
		next: i < componentNav.length - 1 ? componentNav[i + 1]! : null,
	};
}
