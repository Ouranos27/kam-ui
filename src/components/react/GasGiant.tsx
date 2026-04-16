'use client';

import { Mesh, Program, Renderer, Texture, Triangle } from 'ogl';
import { useDeferredValue, useEffect, useRef, type Ref } from 'react';

import {
	mergeRefs,
	resolvePerformanceQuality,
	useAutoPerformanceQuality,
	useInView,
	usePrefersReducedMotion,
	type PerformanceQuality,
} from '@/lib/containment';
import { cn } from '@/lib/utils';

// ─── GLSL ────────────────────────────────────────────────────────────────────

const VERT = `#version 300 es
in vec2 position;
out vec2 vUv;

void main() {
	vUv = position * 0.5 + 0.5;
	gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform vec3 uResolution;
uniform sampler2D uTexture;
uniform float uRotationSpeed;
uniform float uTilt;
uniform vec3 uAtmosphereColor;
uniform float uAtmosphereIntensity;
uniform vec3 uLightDirection;
uniform float uRadius;
uniform float uOblateness;

// Feature Uniforms
uniform float uHasRings;
uniform vec3 uRingColor;
uniform float uTurbulence;
uniform float uStarfield;
uniform vec2 uMouse;
// Procedural mode
uniform float uProcedural;
uniform vec3 uBandColor1;
uniform vec3 uBandColor2;

in vec2 vUv;
out vec4 FragColor;

const float PI = 3.14159265359;

// --- Noise Functions ---
float hash(vec2 p) {
	return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
}

// 2D Noise
float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
			   mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
}

// fBm (Fractional Brownian Motion)
float fbm(vec2 x) {
	float v = 0.0;
	float a = 0.5;
	vec2 shift = vec2(100.0);
	// Rotate to reduce axial bias
	mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
	for (int i = 0; i < 4; ++i) {
		v += a * noise(x);
		x = rot * x * 2.0 + shift;
		a *= 0.5;
	}
	return v;
}

// Ring Density Function
float ringDensity(float r, float inner, float outer) {
	if (r < inner || r > outer) return 0.0;
	// Normalize r to 0..1
	float n = (r - inner) / (outer - inner);
	// Procedural gaps
	float w1 = smoothstep(0.0, 0.05, n) * smoothstep(1.0, 0.95, n);
	float gap1 = smoothstep(0.5, 0.51, n) * smoothstep(0.57, 0.56, n); // Cassini division
	float gap2 = smoothstep(0.75, 0.76, n) * smoothstep(0.8, 0.79, n);
	float val = noise(vec2(n * 200.0, 0.0)) * 0.5 + 0.5;
	val = mix(val, 0.0, gap1 * 0.8);
	val = mix(val, 0.0, gap2 * 0.6);
	return w1 * val * 0.8; 
}

mat3 rotX(float angle) {
	float c = cos(angle);
	float s = sin(angle);
	return mat3(
		1.0, 0.0, 0.0,
		0.0, c, -s,
		0.0, s, c
	);
}

mat3 rotY(float angle) {
	float c = cos(angle);
	float s = sin(angle);
	return mat3(
		c, 0.0, s,
		0.0, 1.0, 0.0,
		-s, 0.0, c
	);
}

void main() {
	vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / uResolution.y;
	
	// Setup interactive mouse rotation if mouse is moving (subtle, 0.15 nudge)
	float mouseTilt = uTilt + uMouse.y * 0.15;
	vec3 lightDir = normalize(uLightDirection + vec3(uMouse.x * 0.6, -uMouse.y * 0.3, 0.0));
	
	// Apply oblateness
	vec2 sphereUv = vec2(uv.x, uv.y * uOblateness);
	float dist = length(sphereUv);

	vec3 finalColor = vec3(0.0);
	float finalAlpha = 0.0;

	// Pre-compute planet hit so starfield can be properly occluded
	bool hitPlanet = dist < uRadius;

	// ─── BACKGROUND STARFIELD ───
	if (uStarfield > 0.5 && !hitPlanet) {
		// Fine grid of stars with sub-cell SDF for round points (fixed, no mouse parallax)
		vec2 starUv = uv * 300.0;
		vec2 starCell = floor(starUv);
		vec2 starOff  = fract(starUv) - 0.5;
		float h = hash(starCell);
		if (h > 0.985) {
			float starRadius = 0.08 + h * 0.1;
			float d = length(starOff);
			float starMask = 1.0 - smoothstep(starRadius - 0.02, starRadius + 0.02, d);
			// Subtle dual-harmonic scintillation: two very slow, per-star sine waves
			// so no two stars pulse in unison. Amplitude is ±4%, not ±30%.
			float f1 = 0.3 + h * 0.5;          // 0.3–0.8 Hz
			float f2 = 0.11 + hash(starCell + 7.3) * 0.2; // 0.11–0.31 Hz
			float twinkle = 0.96
				+ 0.02 * sin(uTime * f1 + h * 100.0)
				+ 0.02 * sin(uTime * f2 + h * 37.4);
			vec3 starColor = mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.85, 0.7), hash(starCell + 0.5));
			finalColor += starColor * starMask * twinkle * h;
			finalAlpha = max(finalAlpha, starMask * 0.9);
		}
	}

	// ─── RAYCAST RINGS ───
	float innerRing = uRadius * 1.3;
	float outerRing = uRadius * 2.4;
	bool hitRing = false;
	vec3 ringIntersectLocal = vec3(0.0);
	float ringAlpha = 0.0;
	float ringDepth = 0.0;
	
	if (uHasRings > 0.5) {
		// Orthographic ray targeting the rings
		// In Local Space (Planet un-tilted), the rings are on XZ plane.
		// Camera is tilted by -mouseTilt
		mat3 invRot = rotX(-mouseTilt);
		vec3 rayOrigin = invRot * vec3(sphereUv, 2.0); // start ray at +z in orthographic space
		vec3 rayDir = invRot * vec3(0.0, 0.0, -1.0);
		
		float t = -rayOrigin.y / rayDir.y;
		if (t > 0.0 && t < 4.0) { // arbitrary clip planes
			vec3 hitPlane = rayOrigin + t * rayDir;
			float rDist = length(hitPlane.xz);
			
			if (rDist >= innerRing && rDist <= outerRing) {
				float rDen = ringDensity(rDist, innerRing, outerRing);
				if (rDen > 0.01) {
					hitRing = true;
					ringIntersectLocal = hitPlane;
					ringAlpha = rDen;
					ringDepth = (rotX(mouseTilt) * hitPlane).z; // Bring back to camera space to compare with planet Z
				}
			}
		}
	}

	// ─── SPHERE GEOMETRY ───
	float planetDepth = -999.0;
	vec3 planetColor = vec3(0.0);
	float planetAlpha = 0.0;
	
	if (hitPlanet) {
		float z = sqrt(uRadius * uRadius - dist * dist);
		planetDepth = z;
		vec3 normal = normalize(vec3(sphereUv, z));
		
		vec3 tiltedNormal = rotX(mouseTilt) * normal;
		
		// Lighting
		float diffuse = dot(normal, lightDir);
		float terminator = smoothstep(-0.2, 0.25, diffuse);
		float ambient = 0.015;
		
		// Planet shadow from Rings
		float ringShadow = 1.0;
		if (uHasRings > 0.5) {
			// Ray from planet surface towards light
			mat3 invRot = rotX(-mouseTilt);
			vec3 pLocal = invRot * vec3(sphereUv, z);
			vec3 lLocal = invRot * lightDir;
			// Intersect XZ plane
			float sl_t = -pLocal.y / lLocal.y;
			if (sl_t > 0.0) {
				vec3 pShadowHit = pLocal + sl_t * lLocal;
				float sDist = length(pShadowHit.xz);
				float sDen = ringDensity(sDist, innerRing, outerRing);
				ringShadow = 1.0 - (sDen * smoothstep(-0.1, 0.1, dot(vec3(0.0, sign(lLocal.y), 0.0), lLocal))); 
			}
		}

		// Texture Mapping
		float longitude = atan(tiltedNormal.x, tiltedNormal.z);
		float latitude = asin(tiltedNormal.y);
		
		// Differential rotation: Equator spins slightly faster
		float diffRot = (cos(latitude * 2.0) * 0.15);
		longitude -= uTime * uRotationSpeed * (1.0 + diffRot);
		
		vec2 mapUv = vec2(
			fract((longitude / (2.0 * PI)) + 0.5),
			(latitude / PI) + 0.5
		);
		
		// Turbulence (fBm)
		float tNoise1 = 0.0;
		if (uTurbulence > 0.0) {
			tNoise1 = fbm(mapUv * 8.0 + uTime * uRotationSpeed);
			float tNoise2 = fbm(mapUv * 16.0 - uTime * uRotationSpeed * 1.5);
			mapUv.x += (tNoise1 - 0.5) * uTurbulence * 0.5;
			mapUv.y += (tNoise2 - 0.5) * uTurbulence * 0.25;
		}

		vec2 dx = dFdx(mapUv);
		vec2 dy = dFdy(mapUv);
		if (abs(dx.x) > 0.5) dx.x -= sign(dx.x);
		if (abs(dy.x) > 0.5) dy.x -= sign(dy.x);

		vec3 texColor;
		if (uProcedural > 0.5) {
			// Procedural gas giant: fBm-warped horizontal band pattern
			float warp1 = fbm(mapUv * 4.0 + vec2(uTime * uRotationSpeed * 0.5, 0.0));
			float warp2 = fbm(mapUv * 8.0 - vec2(uTime * uRotationSpeed * 0.8, 0.3) + warp1);
			float band = sin((mapUv.y + warp2 * 0.18) * PI * 10.0) * 0.5 + 0.5;
			float fine = sin((mapUv.y + warp2 * 0.08) * PI * 28.0) * 0.5 + 0.5;
			band = mix(band, fine, 0.3);
			texColor = mix(uBandColor1, uBandColor2, band);
			float stormMask = smoothstep(0.06, 0.0, abs(mapUv.y - 0.44)) 
				* smoothstep(0.05, 0.0, abs(fract(mapUv.x - 0.35) - 0.5));
			texColor = mix(texColor, uBandColor2 * 1.3, stormMask * 0.6);
		} else {
			texColor = textureGrad(uTexture, mapUv, dx, dy).rgb;
			texColor = pow(texColor, vec3(2.2)); // sRGB to linear
		}

		// Night-side Phenomena (Auroras / Lightning) - REMOVED


		vec3 viewDir = vec3(0.0, 0.0, 1.0);
		float nv = max(0.0, dot(normal, viewDir));
		float fresnel = 1.0 - nv;
		vec3 atmosGlow = uAtmosphereColor * pow(fresnel, 3.0) * uAtmosphereIntensity;

		vec3 sunsetColor = uAtmosphereColor * 1.5; 
		float sunsetFactor = smoothstep(-0.15, 0.2, diffuse) * smoothstep(0.4, -0.1, diffuse);
		
		vec3 baseSurface = texColor * (diffuse * ringShadow * 0.95 + ambient) * terminator;
		baseSurface += sunsetColor * texColor * sunsetFactor * 0.5 * nv;
		
		planetColor = baseSurface + atmosGlow * mix(0.1, 1.0, terminator);
		planetAlpha = 1.0;
	} else {
		// Outer Atmospheric Glow
		float glowRadius = uRadius * 1.35;
		if (dist < glowRadius) {
			float glowFactor = (glowRadius - dist) / (glowRadius - uRadius);
			glowFactor = pow(glowFactor, 3.5);
			
			// Tilt normal for outer glow to match planet tilt visually
			vec3 atmosNormal = normalize(vec3(sphereUv, 0.0));
			atmosNormal = rotX(mouseTilt) * atmosNormal;
			
			float atmosDiffuse = max(0.0, dot(atmosNormal, lightDir));
			float lightFactor = smoothstep(-0.3, 0.6, atmosDiffuse);

			planetColor = uAtmosphereColor * glowFactor * uAtmosphereIntensity * 1.5 * lightFactor;
			planetAlpha = glowFactor * uAtmosphereIntensity * lightFactor;
		}
	}

	// ─── COMPOSITE RINGS AND PLANET ───
	if (hitRing) {
		// Shade the ring
		vec3 rDirLocal = rotX(-mouseTilt) * lightDir;
		float rDiffuse = abs(rDirLocal.y); // Light incident angle on plane
		
		// Ring shadow from planet
		float planetShadow = 1.0;
		// Ray from ring intersection back to light
		vec3 p_cr = cross(ringIntersectLocal, rDirLocal);
		float d_to_ray = length(p_cr); 
		if (d_to_ray < uRadius && dot(ringIntersectLocal, rDirLocal) < 0.0) {
			planetShadow = smoothstep(uRadius * 0.9, uRadius * 1.0, d_to_ray);
		}
		
		vec3 frontScatter = uRingColor * (rDiffuse * planetShadow * 0.9 + 0.1);
		vec3 ringFinal = frontScatter;
		
		// Alpha blending depth order
		if (hitPlanet && ringDepth < planetDepth) {
			// Ring is BEHIND planet. Planet occludes ring.
			if (planetDepth > -990.0) { 
				finalColor += planetColor;
				finalAlpha = 1.0;
			}
		} else {
			// Ring is IN FRONT. Blend ring OVER background/planet
			vec3 blended = mix(planetColor, ringFinal, ringAlpha);
			float a = planetAlpha + ringAlpha - planetAlpha * ringAlpha;
			finalColor = blended;
			finalAlpha = max(finalAlpha, a);
		}
	} else {
		if (planetAlpha > 0.0) {
			finalColor = mix(finalColor, planetColor, planetAlpha);
			finalAlpha = max(finalAlpha, planetAlpha);
		}
	}

	finalColor = finalColor / (1.0 + finalColor); 
	if (finalAlpha > 0.01) {
		finalColor = pow(max(finalColor, 0.0), vec3(1.0 / 2.2));
	}

	FragColor = vec4(finalColor, finalAlpha);
}`;


// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToVec3(hex: string): [number, number, number] {
	const value = hex.replace('#', '');
	return [
		parseInt(value.slice(0, 2), 16) / 255,
		parseInt(value.slice(2, 4), 16) / 255,
		parseInt(value.slice(4, 6), 16) / 255,
	];
}

// ─── Component ───────────────────────────────────────────────────────────────

export type GasGiantProps = {
	className?: string;
	/** Path to an equirectangular planet texture (e.g. a NASA 8K Jupiter JPG).
	 * Unused if procedural is true. */
	textureUrl?: string;
	/** Enable procedural gas giant generation (fBm banding), ignoring textureUrl. @default false */
	procedural?: boolean;
	/** Fallback CSS colors if WebGL is disabled */
	fallbackColor1?: string;
	fallbackColor2?: string;
	/** Tint color for the atmospheric edge glow. @default '#b8a088' (Jupiter warm tones) */
	atmosphereColor?: string;
	/** Intensity multiplier for the atmospheric glow. @default 1.2 */
	atmosphereIntensity?: number;
	/** Rotation speed of the planet. @default 0.03 */
	speed?: number;
	/** Axial tilt in radians. @default 0.1 */
	tilt?: number;
	/** Direction of the primary light source [x, y, z]. @default [1.0, 0.2, 0.8] */
	lightDirection?: [number, number, number];
	/** Planet base radius (fraction of viewport height). @default 0.55 */
	radius?: number;
	/** Scale factor to squash the planet at poles (oblateness). Jupiter is ~1.06. @default 1.06 */
	oblateness?: number;
	/** Enable the accretion disk / rings. @default false */
	hasRings?: boolean;
	/** Hex color for the rings. @default '#e0d0b0' */
	ringColor?: string;
	/** Multiplier for the fluid turbulence noise logic. @default 0.05 */
	turbulence?: number;
	/** Enable procedural starry background. @default true */
	starfield?: boolean;
	/** Enable slightly shifting the lighting and pivot via mouse movement. @default true */
	mouseReact?: boolean;
	/** Primary band color used in procedural mode (no textureUrl). @default '#c4884a' */
	bandColor1?: string;
	/** Secondary band color used in procedural mode (no textureUrl). @default '#e8c89a' */
	bandColor2?: string;
	/** Runtime performance tier. @default 'auto' */
	quality?: PerformanceQuality;
	ref?: Ref<HTMLDivElement>;
};

/**
 * Photorealistic Gas Giant planet renderer via OGL WebGL.
 * Features procedural raycast geometry, PBR lighting, an oblate spheroid projection,
 * and volumetric-style atmospheric scattering at the terminator.
 */
export function GasGiant({
	ref,
	className,
	textureUrl,
	procedural = false,
	fallbackColor1 = '#8c7661',
	fallbackColor2 = '#4a3f36',
	atmosphereColor = '#e9d8a6',
	atmosphereIntensity = 1.2,
	speed = 0.015,
	tilt = 0.15,
	lightDirection = [1.0, 0.0, 0.6],
	radius = 0.55,
	oblateness = 1.06,
	hasRings = false,
	ringColor = '#dbc8a0',
	turbulence = 0.05,
	starfield = true,
	mouseReact = true,
	bandColor1 = '#3d2b1f',
	bandColor2 = '#d4c3a1',
	quality = 'auto',
}: GasGiantProps) {
	const reducedMotion = usePrefersReducedMotion();
	const autoQuality = useAutoPerformanceQuality();
	const resolvedQuality = resolvePerformanceQuality(quality, autoQuality);
	const { ref: inViewRef, inView } = useInView();
	
	const rootRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLDivElement>(null);
	const loopControlsRef = useRef<{ start: () => void; stop: () => void } | null>(null);
	
	const inViewMut = useRef(inView);
	useEffect(() => {
		inViewMut.current = inView;
	}, [inView]);

	const deferredAtmosColor = useDeferredValue(atmosphereColor);
	const deferredRingColor = useDeferredValue(ringColor);
	const deferredBandColor1 = useDeferredValue(bandColor1);
	const deferredBandColor2 = useDeferredValue(bandColor2);
	const lightDirKey = lightDirection.join(',');
	const isProcedural = procedural || !textureUrl;

	const propsRef = useRef({
		deferredAtmosColor, deferredRingColor, deferredBandColor1, deferredBandColor2,
		lightDirection, oblateness, radius, hasRings, turbulence,
		starfield, mouseReact, isProcedural, speed, tilt, atmosphereIntensity
	});
	
	// Keep ref sync'd so the requestAnimationFrame loop can read the latest values
	// without tearing down and recreating the WebGL context 60 times a second.
	Object.assign(propsRef.current, {
		deferredAtmosColor, deferredRingColor, deferredBandColor1, deferredBandColor2,
		lightDirection, oblateness, radius, hasRings, turbulence,
		starfield, mouseReact, isProcedural, speed, tilt, atmosphereIntensity
	});

	const mouse = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

	useEffect(() => {
		if (!propsRef.current.mouseReact) return;
		const handleMouseMove = (e: MouseEvent) => {
			mouse.current.targetX = (e.clientX / window.innerWidth) * 2 - 1;
			mouse.current.targetY = -(e.clientY / window.innerHeight) * 2 + 1;
		};
		window.addEventListener('mousemove', handleMouseMove);
		return () => window.removeEventListener('mousemove', handleMouseMove);
	}, [mouseReact]);

	useEffect(() => {
		if (reducedMotion) return;
		if (import.meta.env.DEV) performance.mark('gasgiant:init:start');

		const container = canvasRef.current;
		if (!container) return;

		// Performance scaling
		const dprCap = resolvedQuality === 'low' ? 1.0 : resolvedQuality === 'medium' ? 1.5 : 2.0;

		let renderer: Renderer;
		let rafId: number | null = null;

		try {
			renderer = new Renderer({
				alpha: true,
				antialias: false,
				dpr: Math.min(window.devicePixelRatio || 1, dprCap),
				premultipliedAlpha: false,
			});
		} catch (e) {
			console.error('Failed to create GasGiant OGL Renderer:', e);
			return;
		}

		const gl = renderer.gl;
		// Transparent background to layer over MilkyWay/CosmicDrift
		gl.clearColor(0, 0, 0, 0);

		const geometry = new Triangle(gl);
		if (geometry.attributes.uv) delete geometry.attributes.uv;
		
		const width = container.offsetWidth || 800;
		const height = container.offsetHeight || 600;

		// Progressive texture loading:
		// 1. Immediately seed with a warm-colored 4×2 placeholder (renders at frame 0)
		// 2. Swap in the full image when it arrives (if textureUrl is provided)
		const panoTexture = new Texture(gl, { generateMipmaps: true });
		if (resolvedQuality === 'low') {
			panoTexture.minFilter = gl.LINEAR;
			panoTexture.generateMipmaps = false;
		} else {
			panoTexture.minFilter = gl.LINEAR_MIPMAP_LINEAR;
		}
		panoTexture.magFilter = gl.LINEAR;
		panoTexture.flipY = true;

		if (!isProcedural) {
			// Warm Jupiter-palette placeholder: 4×2 pixels, renders instantly
			const placeholder = new Uint8Array([
				180, 130,  80, 255,  200, 155, 100, 255,  160, 110,  65, 255,  210, 170, 120, 255,
				210, 170, 120, 255,  175, 125,  75, 255,  220, 185, 140, 255,  155, 105,  60, 255,
			]);
			panoTexture.image = { data: placeholder, width: 4, height: 2 } as unknown as HTMLImageElement;
			// Then load the real texture on top
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = () => { panoTexture.image = img; };
			img.src = textureUrl!;
		}

		const program = new Program(gl, {
			vertex: VERT,
			fragment: FRAG,
			transparent: true,
			uniforms: {
				uTime: { value: 0 },
				uResolution: { value: [width, height, width / height] },
				uTexture: { value: panoTexture },
				uRotationSpeed: { value: speed },
				uTilt: { value: tilt },
				uAtmosphereColor: { value: hexToVec3(propsRef.current.deferredAtmosColor) },
				uAtmosphereIntensity: { value: propsRef.current.atmosphereIntensity },
				uLightDirection: { value: propsRef.current.lightDirection },
				uRadius: { value: propsRef.current.radius },
				uOblateness: { value: propsRef.current.oblateness },
				uHasRings: { value: propsRef.current.hasRings ? 1.0 : 0.0 },
				uRingColor: { value: hexToVec3(propsRef.current.deferredRingColor) },
				uTurbulence: { value: propsRef.current.turbulence },
				uStarfield: { value: propsRef.current.starfield ? 1.0 : 0.0 },
				uMouse: { value: [0, 0] },
				uProcedural: { value: propsRef.current.isProcedural ? 1.0 : 0.0 },
				uBandColor1: { value: hexToVec3(propsRef.current.deferredBandColor1) },
				uBandColor2: { value: hexToVec3(propsRef.current.deferredBandColor2) },
			},
		});

		const mesh = new Mesh(gl, { geometry, program });
		container.appendChild(gl.canvas);
		gl.canvas.className = 'absolute inset-0 block h-full w-full';

		function syncResolutionUniform() {
			const bw = gl.drawingBufferWidth;
			const bh = gl.drawingBufferHeight;
			if (bh < 1) return;
			program.uniforms.uResolution.value = [bw, bh, bw / bh];
		}

		const ro = new ResizeObserver(() => {
			renderer.setSize(container.offsetWidth, container.offsetHeight);
			syncResolutionUniform();
		});
		ro.observe(container);
		
		renderer.setSize(width, height);
		syncResolutionUniform();

		let elapsed = 0;
		let lastTime = performance.now();

		function update(t: number) {
			rafId = null;
			if (!inViewMut.current) return;

			const delta = t - lastTime;
			lastTime = t;
			// Use an internal elapsed tracker that only moves forward when visible
			elapsed += delta * 0.001;
			
			if (propsRef.current.mouseReact) {
				mouse.current.x += (mouse.current.targetX - mouse.current.x) * 0.05;
				mouse.current.y += (mouse.current.targetY - mouse.current.y) * 0.05;
			} else {
				mouse.current.x *= 0.95;
				mouse.current.y *= 0.95;
			}

			const p = propsRef.current;
			program.uniforms.uTime.value = elapsed;
			program.uniforms.uAtmosphereColor.value = hexToVec3(p.deferredAtmosColor);
			program.uniforms.uRotationSpeed.value = p.speed;
			program.uniforms.uTilt.value = p.tilt;
			program.uniforms.uLightDirection.value = p.lightDirection;
			program.uniforms.uRadius.value = p.radius;
			program.uniforms.uOblateness.value = p.oblateness;
			program.uniforms.uAtmosphereIntensity.value = p.atmosphereIntensity;
			
			program.uniforms.uHasRings.value = p.hasRings ? 1.0 : 0.0;
			program.uniforms.uRingColor.value = hexToVec3(p.deferredRingColor);
			program.uniforms.uTurbulence.value = p.turbulence;
			program.uniforms.uStarfield.value = p.starfield ? 1.0 : 0.0;
			program.uniforms.uMouse.value = [mouse.current.x, mouse.current.y];
			program.uniforms.uBandColor1.value = hexToVec3(p.deferredBandColor1);
			program.uniforms.uBandColor2.value = hexToVec3(p.deferredBandColor2);

			renderer.render({ scene: mesh });
			startLoop();
		}

		function stopLoop() {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
				if (import.meta.env.DEV) performance.mark('gasgiant:loop:stop');
			}
		}

		function startLoop() {
			if (rafId === null) {
				lastTime = performance.now();
				rafId = requestAnimationFrame(update);
				if (import.meta.env.DEV) performance.mark('gasgiant:loop:start');
			}
		}

		loopControlsRef.current = { start: startLoop, stop: stopLoop };
		if (inViewMut.current) startLoop();
		if (import.meta.env.DEV) performance.mark('gasgiant:init:end');

		return () => {
			stopLoop();
			loopControlsRef.current = null;
			ro.disconnect();
			// Explicitly release the WebGL context before dropping the canvas
			const ext = gl.getExtension('WEBGL_lose_context');
			if (ext) ext.loseContext();
			if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
		};
	}, [
		reducedMotion,
		resolvedQuality,
		textureUrl,
	]);

	useEffect(() => {
		const controls = loopControlsRef.current;
		if (!controls) return;
		if (inView) controls.start();
		else controls.stop();
	}, [inView]);

	return (
		<div
			ref={mergeRefs(ref, inViewRef, rootRef)}
			className={cn('relative h-full w-full overflow-hidden', className)}
		>
			<div ref={canvasRef} className="absolute inset-0" aria-hidden />

			{reducedMotion && (
				<div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
					<div
						className="rounded-full blur-xl"
						style={{
							width: `${radius * 200}%`,
							height: `${(radius / oblateness) * 200}%`,
							background: `radial-gradient(circle at 65% 35%, ${fallbackColor1} 0%, ${fallbackColor2} 55%, #050505 100%)`,
							boxShadow: `0 0 60px ${atmosphereColor}40`,
						}}
					/>
				</div>
			)}
		</div>
	);
}
