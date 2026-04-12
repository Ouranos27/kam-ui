import type { ComponentSlug } from './componentRegistry';

export type ComponentCapabilities = {
	canvasBgAffectsPreview: boolean;
};

export const componentCapabilities: Record<ComponentSlug, ComponentCapabilities> = {
	'radiant-veil': { canvasBgAffectsPreview: true },
	'chromatic-leaks': { canvasBgAffectsPreview: true },
	'halo-ring': { canvasBgAffectsPreview: true },
	'shimmer-ring': { canvasBgAffectsPreview: true },
	'crown-glow': { canvasBgAffectsPreview: true },
	'chromatic-field': { canvasBgAffectsPreview: false },
	'solar-flare': { canvasBgAffectsPreview: false },
	'black-hole': { canvasBgAffectsPreview: false },
	'mesh-gradient': { canvasBgAffectsPreview: false },
	'atmospheric-sky': { canvasBgAffectsPreview: false },
	'milky-way': { canvasBgAffectsPreview: false },
};
