import type { ComponentSlug } from './componentRegistry';

export type ShowcasePresentation = {
	frameLabel: string;
	frameSubline: string;
	observationTitle: string;
	observationBody: string;
	chamberClassName?: string;
	wellBackdropClassName?: string;
	previewWrapClassName?: string;
	previewShellClassName?: string;
	previewPaddingClassName?: string;
	previewAlign: 'center' | 'start' | 'end' | 'stretch';
	telemetryMode?: string;
};

const DEFAULT: ShowcasePresentation = {
	frameLabel: 'Preview',
	frameSubline: 'Resize the viewport or switch to Code for install steps',
	observationTitle: 'Live preview',
	observationBody:
		'Interact with the component here, then use the Code tab to copy install commands and source.',
	previewAlign: 'center',
	previewShellClassName: 'h-[400px] w-full shrink-0 sm:h-[600px]',
	previewPaddingClassName: 'p-4 sm:p-5',
};

const CHAMBER =
	'kam-chamber-bezel shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--foreground)_8%,transparent)] dark:shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--foreground)_10%,transparent)]';

const STRETCH_PREVIEW: Partial<ShowcasePresentation> = {
	previewAlign: 'stretch',
	previewWrapClassName: 'flex w-full max-w-none min-h-0 flex-1 flex-col',
	previewShellClassName: 'min-h-[520px] w-full shrink-0 sm:min-h-[720px] lg:min-h-[800px]',
	previewPaddingClassName: 'p-0',
	chamberClassName: CHAMBER,
};

const BY_SLUG: Record<ComponentSlug, Partial<ShowcasePresentation>> = {
	'radiant-veil': {
		frameLabel: 'Radiant veil',
		frameSubline: 'Transparent radial overlay · CSS vars · rAF drift',
		observationTitle: 'Pattern-craft radials, animated',
		observationBody:
			"The inner zone is `transparent` — the white content grid shows through. Only the coloured fringe moves: a gentle Lissajous drift of the focal point (via CSS custom property + rAF) makes the gradient breathe without layout shift. Reduced-motion: static gradient, zero JS.",
		...STRETCH_PREVIEW,
		wellBackdropClassName: 'kam-showcase-bg--radiant-veil',
		telemetryMode: 'MODE: BG · RADIANT-VEIL',
	},
	'chromatic-leaks': {
		frameLabel: 'Chromatic corner leaks',
		frameSubline: 'CSS 4-radial overlay · CSS vars · rAF drift',
		observationTitle: 'Colour from every corner — centre stays clear',
		observationBody:
			'Four transparent radial-gradient layers (pattern-craft style) are anchored to each corner of the composition. Each radial drifts on its own Lissajous path and breathes out-of-phase from the others. Mouse movement creates a parallax: all four corners shift gently toward the cursor, making the colour field feel alive. Centre remains fully transparent.',
		...STRETCH_PREVIEW,
		wellBackdropClassName: 'kam-showcase-bg--chromatic-leaks',
		telemetryMode: 'MODE: BG · CHROMATIC-LEAKS',
	},
	'halo-ring': {
		frameLabel: 'Halo ring',
		frameSubline: 'CSS radial band · CSS vars · rAF drift',
		observationTitle: 'A ring of light — transparent inside and out',
		observationBody:
			'A single radial gradient with three stops: transparent → colour → transparent. The result is a floating ring band that neither fills the centre nor bleeds to the edge, leaving content fully readable. The band breathes (inner and outer edges pulse in opposite directions), the ring drifts on a Lissajous path, and the centre smoothly follows the cursor. Reduced-motion: static ring, zero JS.',
		...STRETCH_PREVIEW,
		wellBackdropClassName: 'kam-showcase-bg--halo-ring',
		telemetryMode: 'MODE: BG · HALO-RING',
	},
	'shimmer-ring': {
		frameLabel: 'Shimmer ring',
		frameSubline: 'WebGL · ogl · simplex noise ring',
		observationTitle: 'A ring that was never perfectly round',
		observationBody:
			'The shader computes radial distance from the ring centre and applies two octaves of angle-dependent simplex noise to perturb the band edges at each azimuth. Fragment coordinates use the drawing-buffer size so cx/cy stay centred on retina. Optional polar-sampled GPU noise adds fibrous micro-detail on the band (bandFibers). The centre and outer zone stay fully transparent; mouse lerp keeps the ring anchored to the cursor.',
		...STRETCH_PREVIEW,
		wellBackdropClassName: 'kam-showcase-bg--shimmer-ring',
		telemetryMode: 'MODE: BG · SHIMMER-RING',
	},
	'crown-glow': {
		frameLabel: 'Crown glow',
		frameSubline: 'WebGL · ogl · horizon arc',
		observationTitle: 'The crown at the top of the world',
		observationBody:
			'The ring centre is positioned above the visible canvas, so only the lower arc is visible — a glowing crown. Fragment coordinates use the drawing-buffer size so the arc stays horizontally centred on retina displays. Two concentric rings create depth: a tight inner arc with angle-based simplex noise, a wide outer haze, plus optional polar-sampled GPU noise for fibrous micro-detail on the arcs. Static radial gradient fallback for reduced motion.',
		...STRETCH_PREVIEW,
		wellBackdropClassName: 'kam-showcase-bg--crown-glow',
		telemetryMode: 'MODE: BG · CROWN-GLOW',
	},
	'chromatic-field': {
		frameLabel: 'Chromatic field',
		frameSubline: 'WebGL · ogl · eclipse · ROYGBIV prism',
		observationTitle: 'The lens sees in five',
		observationBody:
			'The scene is sampled at five laterally offset UV positions spanning the full visible spectrum (red → orange → green-cyan → blue → violet). At every bright-to-dark edge — particularly the sharp sphere boundary — each wavelength band diverges by a different amount, printing a ROYGBIV prismatic fringe around the limb exactly as real eclipse optics do. The corona combines an angle-modulated limb ring (two slowly-rotating hot-spots), 14 radial streamers, IFS diffuse, and polar-sampled GPU noise (same fibrous recipe as the solar corona) on the outer layers only — the limb term stays smooth so CA stays crisp. A thin pale-blue atmospheric rim sits just inside the sphere edge. The sphere stays canvas-centred by default; optional `mouseMoveSphere` parallax-tracks the cursor independently of the CA axis.',
		...STRETCH_PREVIEW,
		wellBackdropClassName: 'kam-showcase-bg--chromatic-field',
		telemetryMode: 'MODE: BG · CHROMATIC-FIELD',
	},
	'solar-flare': {
		frameLabel: 'Solar flare',
		frameSubline: 'WebGL · ogl · procedural corona',
		observationTitle: 'A star, not a logo',
		observationBody:
			'Multi-octave noise is baked into a repeatable texture, then sampled in radial coordinates so streamers stay long and fibrous. The outer corona uses the same aspect-corrected UV as the disk so the silhouette stays circular by default; optional radii stretch the halo evenly on X and/or Y. Layered masks build a limb-darkened photosphere, a hot chromosphere ring, and outward corona tongues whose reach scales with `flareCount` as solar activity.',
		...STRETCH_PREVIEW,
		wellBackdropClassName: 'kam-showcase-bg--solar-flare',
		telemetryMode: 'MODE: BG · SOLAR-FLARE',
	},
	'mesh-gradient': {
		frameLabel: 'Mesh gradient',
		frameSubline: 'WebGL · ogl · 4-blob colour field',
		observationTitle: 'Liquid paint, living colour',
		observationBody:
			'Four soft colour blobs drift on independent simplex-noise paths. Each blob uses a cubic hermite falloff — where blobs overlap, colours blend smoothly like liquid paint. The result is a premium mesh gradient that constantly reshapes itself. Subtle film grain adds analog texture. No Three.js — pure ogl + GLSL.',
		...STRETCH_PREVIEW,
		wellBackdropClassName: 'kam-showcase-bg--mesh-gradient',
		telemetryMode: 'MODE: BG · MESH-GRADIENT',
	},
	'atmospheric-sky': {
		frameLabel: 'Atmospheric sky',
		frameSubline: 'WebGL · ogl · procedural scattering',
		observationTitle: 'Dawn to dusk in a fragment shader',
		observationBody:
			'Rayleigh phase functions produce the blue overhead sky, exponential optical depth reddens light at the horizon, and a Henyey-Greenstein Mie term creates the warm halo around the sun. The sun drifts automatically — the sky transitions through dawn, day, sunset, and a star-filled night. No precomputed textures; all analytic.',
		...STRETCH_PREVIEW,
		wellBackdropClassName: 'kam-showcase-bg--atmospheric-sky',
		telemetryMode: 'MODE: BG · ATMOSPHERIC-SKY',
	},
	'milky-way': {
		frameLabel: 'Milky Way',
		frameSubline: 'WebGL · ogl · ESA Gaia DR2 panorama',
		observationTitle: 'The galaxy, from Gaia\'s eyes',
		observationBody:
			'ESA\'s Gaia space observatory mapped ~1.7 billion stars. The colour panorama (Hammer → equirectangular reprojection) is textured onto a sky dome hemisphere. Procedural point stars with twinkle overlay the nebulosity. Slow galactic rotation. ~945 KB texture asset.',
		...STRETCH_PREVIEW,
		wellBackdropClassName: 'kam-showcase-bg--milky-way',
		telemetryMode: 'MODE: BG · MILKY-WAY',
	},
	'black-hole': {
		frameLabel: 'Black hole',
		frameSubline: 'WebGL2 · beam tracing · Bruneton shader',
		observationTitle: 'Schwarzschild disc, GR lensing',
		observationBody:
			'Eric Bruneton’s real-time black hole model (arXiv:2010.08735): precomputed deflection tables, accretion disc with Doppler/beaming, matte sky (stars off). HDR scene + Reinhard-style tone map. Requires public/black-hole/*.dat. Reduced motion: static orange radial fallback.',
		...STRETCH_PREVIEW,
		wellBackdropClassName: 'kam-showcase-bg--black-hole',
		telemetryMode: 'MODE: BG · BLACK-HOLE',
	},
};

export function getShowcasePresentation(slug: ComponentSlug): ShowcasePresentation {
	return { ...DEFAULT, ...BY_SLUG[slug] };
}
