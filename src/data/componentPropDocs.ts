import type { ComponentSlug } from './componentRegistry';

export type PropDoc = {
	name: string;
	type: string;
	default?: string;
	description?: string;
	/** For number props: minimum value for the range slider. */
	min?: number;
	/** For number props: maximum value for the range slider. */
	max?: number;
	/** For number props: step increment for the range slider. */
	step?: number;
	/**
	 * Override how this prop is controlled.
	 * 'hidden' — never show a control (structural / complex type props).
	 * Omitting defaults to type inference: boolean→toggle, number→range, hex-string→color.
	 */
	control?: 'hidden';
};

const wrapperProps: PropDoc[] = [
	{
		name: 'className',
		type: 'string',
		description: 'Optional class on the root element.',
	},
];

export const componentPropDocs: Record<ComponentSlug, PropDoc[]> = {
	'radiant-veil': [
		{ name: 'variant', type: "'default' | 'morph' | 'dual'", default: "'default'", control: 'hidden', description: "Animation variant. default = single radial with drift/breathe. morph = accent colour cycles through color → color2 → color3. dual = two independent drifting radial sources." },
		{ name: 'color', type: 'string', default: "'#7c3aed'", description: 'Accent colour at the outer edge of the radial. The inner zone is always transparent.' },
		{ name: 'color2', type: 'string', default: "'#ef4444'", description: 'Secondary accent — used by morph (palette endpoint) and dual (second radial source).' },
		{ name: 'color3', type: 'string', default: "'#ec4899'", description: 'Tertiary accent — mid-palette waypoint for morph variant.' },
		{ name: 'from', type: "'top' | 'bottom' | 'left' | 'right' | 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | [number, number]", default: "'top'", control: 'hidden', description: "Focal-point preset or explicit [x%, y%] pair." },
		{ name: 'clearStop', type: 'number', default: '40', min: 5, max: 80, step: 1, description: 'Inner transparent zone size (0–100). The colour fringe begins here.' },
		{ name: 'size', type: 'number', default: '125', min: 50, max: 220, step: 5, description: 'Gradient ellipse size as % of container dimensions.' },
		{ name: 'drift', type: 'number', default: '12', min: 0, max: 40, step: 1, description: 'Focal-point drift radius in percent. 0 disables drift.' },
		{ name: 'speed', type: 'number', default: '0.5', min: 0.05, max: 2, step: 0.05, description: 'Animation speed multiplier.' },
		{ name: 'breathe', type: 'boolean', default: 'true', description: 'Colour zone breathes — clearStop oscillates ±breatheAmplitude pp.' },
		{ name: 'breatheAmplitude', type: 'number', default: '14', min: 0, max: 30, step: 1, description: 'Breathing amplitude in percentage points.' },
		{ name: 'mouseReact', type: 'boolean', default: 'true', description: 'Focal point smoothly follows the cursor.' },
		...wrapperProps,
	],
	'chromatic-leaks': [
		{ name: 'color1', type: 'string', default: "'#7c3aed'", description: 'Top-left corner radial colour.' },
		{ name: 'color2', type: 'string', default: "'#f97316'", description: 'Bottom-right corner radial colour.' },
		{ name: 'color3', type: 'string', default: "'#0ea5e9'", description: 'Top-right corner radial colour.' },
		{ name: 'color4', type: 'string', default: "'#10b981'", description: 'Bottom-left corner radial colour.' },
		{ name: 'size', type: 'number', default: '110', min: 50, max: 200, step: 5, description: 'Gradient ellipse size as % of container.' },
		{ name: 'clearStop', type: 'number', default: '42', min: 5, max: 80, step: 1, description: 'Transparent zone radius — larger = more of the centre is clear.' },
		{ name: 'drift', type: 'number', default: '8', min: 0, max: 25, step: 1, description: 'Autonomous drift radius per radial in percent.' },
		{ name: 'speed', type: 'number', default: '0.4', min: 0.05, max: 2, step: 0.05, description: 'Animation speed multiplier.' },
		{ name: 'breathe', type: 'boolean', default: 'true', description: "Each corner radial's clearStop oscillates independently." },
		{ name: 'breatheAmplitude', type: 'number', default: '10', min: 0, max: 25, step: 1, description: 'Breathing amplitude in percentage points.' },
		{ name: 'mouseReact', type: 'boolean', default: 'true', description: 'All four radials shift gently toward the cursor.' },
		...wrapperProps,
	],
	'halo-ring': [
		{ name: 'color', type: 'string', default: "'#a855f7'", description: "Ring colour — the colour at the band's luminance peak." },
		{ name: 'cx', type: 'number', default: '50', min: 0, max: 100, step: 1, description: 'Ring centre X position (0–100).' },
		{ name: 'cy', type: 'number', default: '50', min: 0, max: 100, step: 1, description: 'Ring centre Y position (0–100).' },
		{ name: 'size', type: 'number', default: '130', min: 50, max: 220, step: 5, description: 'Gradient ellipse size as % of container dimensions.' },
		{ name: 'innerStop', type: 'number', default: '28', min: 5, max: 70, step: 1, description: 'Where the transparent inner zone ends and colour begins (0–100).' },
		{ name: 'bandWidth', type: 'number', default: '38', min: 5, max: 80, step: 1, description: 'Ring band width in percentage points.' },
		{ name: 'drift', type: 'number', default: '10', min: 0, max: 40, step: 1, description: 'Ring centre drift radius in percent.' },
		{ name: 'speed', type: 'number', default: '0.45', min: 0.05, max: 2, step: 0.05, description: 'Animation speed multiplier.' },
		{ name: 'breathe', type: 'boolean', default: 'true', description: 'Ring band breathes — edges pulse in opposite directions.' },
		{ name: 'breatheAmplitude', type: 'number', default: '12', min: 0, max: 30, step: 1, description: 'Breathing amplitude in percentage points.' },
		{ name: 'mouseReact', type: 'boolean', default: 'true', description: 'Ring centre smoothly lerps toward the cursor.' },
		...wrapperProps,
	],
	'shimmer-ring': [
		{ name: 'color', type: 'string', default: "'#a855f7'", description: 'Ring colour at the band luminance peak (6-char hex).' },
		{ name: 'cx', type: 'number', default: '50', min: 0, max: 100, step: 1, description: 'Ring centre X (0–100).' },
		{ name: 'cy', type: 'number', default: '50', min: 0, max: 100, step: 1, description: 'Ring centre Y (0–100).' },
		{ name: 'innerRadius', type: 'number', default: '0.22', min: 0.05, max: 0.45, step: 0.01, description: 'Inner band edge as a fraction of canvas height from the centre.' },
		{ name: 'bandWidth', type: 'number', default: '0.15', min: 0.02, max: 0.35, step: 0.01, description: 'Band thickness as a fraction of canvas height.' },
		{ name: 'shimmer', type: 'number', default: '0.65', min: 0, max: 1, step: 0.05, description: 'Noise deformation amount — 0 = perfect circle, 1 = highly organic.' },
		{ name: 'bandFibers', type: 'number', default: '0.55', min: 0, max: 1, step: 0.05, description: 'Polar GPU-noise micro-detail on the band (0 = off). Separate from shimmer.' },
		{ name: 'drift', type: 'number', default: '0.04', min: 0, max: 0.12, step: 0.005, description: 'Ring centre wander radius as a fraction of canvas height.' },
		{ name: 'speed', type: 'number', default: '0.8', min: 0.1, max: 3, step: 0.05, description: 'Shader time scale — higher = faster shimmer and drift.' },
		{ name: 'mouseReact', type: 'boolean', default: 'true', description: 'Ring centre smoothly lerps toward the cursor.' },
		...wrapperProps,
	],
	'crown-glow': [
		{ name: 'color1', type: 'string', default: "'#a855f7'", description: 'Inner ring colour — tight, bright arc (6-char hex).' },
		{ name: 'color2', type: 'string', default: "'#7c3aed'", description: 'Outer haze colour — wide, soft corona (6-char hex).' },
		{ name: 'centerY', type: 'number', default: '1.25', min: 1.0, max: 1.8, step: 0.05, description: 'UV Y of the ring centre — values > 1 push it above the canvas, raising the crown.' },
		{ name: 'radius1', type: 'number', default: '0.65', min: 0.3, max: 1.2, step: 0.05, description: 'Inner ring radius in aspect-corrected UV units.' },
		{ name: 'radius2', type: 'number', default: '0.9', min: 0.5, max: 1.5, step: 0.05, description: 'Outer haze radius in aspect-corrected UV units.' },
		{ name: 'shimmer', type: 'number', default: '0.55', min: 0, max: 1, step: 0.05, description: 'Noise deformation amplitude — 0 = smooth arc, 1 = turbulent.' },
		{ name: 'arcFibers', type: 'number', default: '0.55', min: 0, max: 1, step: 0.05, description: 'Polar GPU-noise detail on the arcs (0 = off). Separate from shimmer.' },
		{ name: 'speed', type: 'number', default: '0.45', min: 0.05, max: 2, step: 0.05, description: 'Shader time scale.' },
		...wrapperProps,
	],
	'chromatic-field': [
		{ name: 'color', type: 'string', default: "'#b4ccdf'", description: 'Corona / limb accent colour; warm and cool CA fringes are additive on top (6-char hex).' },
		{ name: 'aberration', type: 'number', default: '0.55', min: 0, max: 1, step: 0.05, description: 'Chromatic aberration strength — drives the rainbow fringe at the sphere edge.' },
		{ name: 'speed', type: 'number', default: '0.45', min: 0.05, max: 2, step: 0.05, description: 'Shader time scale — streamer drift and IFS warp speed.' },
		{ name: 'intensity', type: 'number', default: '1.0', min: 0.3, max: 2.0, step: 0.05, description: 'Overall corona brightness.' },
		{ name: 'sphereRadius', type: 'number', default: '0.28', min: 0, max: 0.8, step: 0.02, description: 'Radius of the dark occluder disk in aspect-corrected UV units. 0 = no sphere.' },
		{ name: 'limb', type: 'number', default: '1.0', min: 0, max: 3, step: 0.1, description: 'Limb-ring brightness multiplier — >1 overexposes the inner corona.' },
		{ name: 'coronaFibers', type: 'number', default: '0.65', min: 0, max: 1, step: 0.05, description: 'Polar-sampled noise strength on streamers / IFS / outer glow (0 = smooth). Limb stays unmodulated for clean spectral CA.' },
		{ name: 'mouseReact', type: 'boolean', default: 'true', description: 'CA aberration axis tilts gently toward the cursor.' },
		{ name: 'mouseMoveSphere', type: 'boolean', default: 'false', description: 'Sphere lerps toward the cursor; leave off to keep the eclipse fixed on the canvas centre. Independent of mouseReact.' },
		...wrapperProps,
	],
	'solar-flare': [
		{ name: 'color', type: 'string', default: "'#ff8840'", description: 'Primary solar accent for the chromosphere and corona tongues (6-char hex).' },
		{ name: 'radius', type: 'number', default: '0.24', min: 0.08, max: 0.55, step: 0.01, description: 'Sun disk radius in aspect-corrected UV units.' },
		{ name: 'flareCount', type: 'number', default: '5', min: 0, max: 7, step: 1, description: 'Solar activity level — more plasma tongues, wider corona, stronger edge breakup.' },
		{ name: 'limbDark', type: 'number', default: '0.70', min: 0, max: 1, step: 0.05, description: 'Limb-darkening strength — 0 = uniform brightness disk, 1 = fully darkened edge.' },
		{ name: 'speed', type: 'number', default: '0.50', min: 0.05, max: 2, step: 0.05, description: 'Animation speed — drives corona drift and surface granulation.' },
		{ name: 'intensity', type: 'number', default: '1.0', min: 0.3, max: 2.0, step: 0.05, description: 'Overall brightness scale for disk, chromosphere, and corona.' },
		{ name: 'coronaRadiiX', type: 'number', default: '1', min: 0.5, max: 2, step: 0.05, description: 'Outer corona horizontal reach in UV; 1 with Y = circular. Above 1 widens sideways.' },
		{ name: 'coronaRadiiY', type: 'number', default: '1', min: 0.5, max: 2, step: 0.05, description: 'Outer corona vertical reach in UV; raise above 1 to stretch glow top–bottom.' },
		...wrapperProps,
	],
	'mesh-gradient': [
		{ name: 'color1', type: 'string', default: "'#6366f1'", description: 'First blob colour (hex).' },
		{ name: 'color2', type: 'string', default: "'#ec4899'", description: 'Second blob colour (hex).' },
		{ name: 'color3', type: 'string', default: "'#14b8a6'", description: 'Third blob colour (hex).' },
		{ name: 'color4', type: 'string', default: "'#f59e0b'", description: 'Fourth blob colour (hex).' },
		{ name: 'bgColor', type: 'string', default: "'#030014'", description: 'Background colour behind the transparent blobs.' },
		{ name: 'intensity', type: 'number', default: '1.5', min: 0.5, max: 3, step: 0.1, description: 'Colour intensity / saturation of the blend.' },
		{ name: 'blobScale', type: 'number', default: '0.8', min: 0.3, max: 1.5, step: 0.05, description: 'Blob size multiplier — larger blobs cover more area.' },
		{ name: 'speed', type: 'number', default: '0.4', min: 0.1, max: 2, step: 0.05, description: 'Animation speed.' },
		...wrapperProps,
	],
	'atmospheric-sky': [
		{ name: 'sunZenith', type: 'number', default: '1.2', min: 0, max: 2.5, step: 0.05, description: 'Sun zenith angle in radians. 0 = overhead, π/2 = horizon, >π/2 = below (night).' },
		{ name: 'sunAzimuth', type: 'number', default: '0', min: -3.14, max: 3.14, step: 0.05, description: 'Sun horizontal position in radians.' },
		{ name: 'animateSun', type: 'boolean', default: 'true', description: 'Animate the sun drifting across the sky.' },
		{ name: 'exposure', type: 'number', default: '8', min: 0.5, max: 30, step: 0.5, description: 'Tone-map exposure. Higher = brighter sky.' },
		{ name: 'rayleighScale', type: 'number', default: '1', min: 0.2, max: 3, step: 0.1, description: 'Rayleigh scattering strength — controls blue sky intensity.' },
		{ name: 'mieScale', type: 'number', default: '1', min: 0, max: 5, step: 0.1, description: 'Mie scattering — controls haze/halo around the sun.' },
		{ name: 'mieG', type: 'number', default: '0.76', min: 0, max: 0.99, step: 0.01, description: 'Mie directionality. Higher = tighter sun halo.' },
		{ name: 'sunColor', type: 'string', default: "'#fffaf0'", description: 'Sun light colour (hex).' },
		{ name: 'speed', type: 'number', default: '0.15', min: 0.01, max: 1, step: 0.01, description: 'Sun animation speed.' },
		...wrapperProps,
	],
	'milky-way': [
		{ name: 'brightness', type: 'number', default: '1.5', min: 0.2, max: 5, step: 0.1, description: 'Brightness multiplier for the Milky Way texture.' },
		{ name: 'rotation', type: 'number', default: '0', min: -3.14, max: 3.14, step: 0.05, description: 'Initial rotation offset in radians.' },
		{ name: 'tilt', type: 'number', default: '1.0', min: -1.57, max: 1.57, step: 0.05, description: 'Tilt angle — pitches the galactic plane into view.' },
		{ name: 'speed', type: 'number', default: '0.15', min: 0, max: 1, step: 0.01, description: 'Galaxy rotation speed.' },
		{ name: 'panoramaUrl', type: 'string', default: "'/milky-way/milky-way.jpg'", description: 'Path to equirectangular panorama image.' },
		...wrapperProps,
	],
	'black-hole': [
		{
			name: 'assetBase',
			type: 'string',
			default: '(BASE_URL/black-hole/)',
			description:
				'Optional URL prefix for precomputed `*.dat` + `noise_texture.png`. Copy `public/black-hole/` from kam-ui or rebuild with ebruneton/black_hole_shader `make`.',
		},
		{
			name: 'discDensityIndex',
			type: 'number',
			default: '500',
			min: 0,
			max: 1000,
			step: 5,
			description: 'Accretion disc density (maps to original demo slider 0–1000).',
		},
		{
			name: 'discOpacityIndex',
			type: 'number',
			default: '300',
			min: 0,
			max: 1000,
			step: 5,
			description: 'Disc opacity index (demo-scale 0–1000).',
		},
		{
			name: 'discTemperatureIndex',
			type: 'number',
			default: '430',
			min: 0,
			max: 1000,
			step: 5,
			description: 'Disc temperature index (black-body ramp, demo-scale 0–1000).',
		},
		{
			name: 'exposureIndex',
			type: 'number',
			default: '500',
			min: 0,
			max: 1000,
			step: 5,
			description: 'Tone-map exposure index (demo-scale 0–1000).',
		},
		{
			name: 'bloomIndex',
			type: 'number',
			default: '500',
			min: 0,
			max: 1000,
			step: 5,
			description:
				'Highlight boost before tone map (demo “bloom” slider 0–1000). Scales effective exposure; not full multi-pass bloom.',
		},
		{
			name: 'cameraDistanceIndex',
			type: 'number',
			default: '940',
			min: 100,
			max: 1000,
			step: 10,
			description: 'Camera distance from the black hole (demo-scale 0–1000). Lower values bring the camera closer, making the black hole appear larger.',
		},
		{
			name: 'orbitInclinationIndex',
			type: 'number',
			default: '970',
			min: 0,
			max: 1799,
			step: 10,
			description: 'Orbit inclination / tilt angle (0–1799). Controls the viewing angle of the accretion disc. 900 = edge-on, 0/1799 = top/bottom.',
		},
		{
			name: 'cameraYawIndex',
			type: 'number',
			default: '0',
			min: 0,
			max: 36000,
			step: 100,
			description: 'Camera horizontal rotation (0–36000). Pans the view left/right around the black hole.',
		},
		{
			name: 'cameraPitchIndex',
			type: 'number',
			default: '9000',
			min: 0,
			max: 18000,
			step: 100,
			description: 'Camera vertical tilt (0–18000). 9000 = level, lower = looking up, higher = looking down.',
		},
		{
			name: 'speed',
			type: 'number',
			default: '1',
			min: 0,
			max: 3,
			step: 0.05,
			description: 'Multiplier on proper-time integration (disc / coordinate time evolution).',
		},
		...wrapperProps,
	],
};
