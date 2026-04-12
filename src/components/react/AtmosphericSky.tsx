import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { useDeferredValue, useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';
import { mergeRefs, resolvePerformanceQuality, useAutoPerformanceQuality, useInView, usePrefersReducedMotion, type PerformanceQuality } from '@/lib/containment';

// ─── GLSL ────────────────────────────────────────────────────────────────────

const VERT = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

/**
 * Procedural atmospheric sky — approximates Rayleigh/Mie scattering with
 * analytic functions. No precomputed textures needed.
 *
 * The sky colour is derived from:
 *  1. Rayleigh-like exponential scattering (blue overhead → orange at horizon)
 *  2. Mie-like forward scattering halo around the sun
 *  3. Sun disc with limb darkening
 *  4. Horizon glow band
 *  5. Night sky with stars transition
 */
const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uSpeed;
uniform vec2  uResolution;
uniform float uSunZenith;
uniform float uSunAzimuth;
uniform float uExposure;
uniform float uRayleighScale;
uniform float uMieScale;
uniform float uMieG;
uniform vec3  uSunColor;

in vec2 vUv;
out vec4 fragColor;

const float PI = 3.14159265359;

// ── Hash functions ──────────────────────────────────────────────────
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453);
}

// ── Value noise (smooth) ────────────────────────────────────────────
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f); // hermite
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// ── FBM (fractal Brownian motion) ───────────────────────────────────
float fbm(vec2 p, int octaves) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8); // domain rotation to reduce axis-aligned artifacts
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    v += a * vnoise(p);
    p = rot * p * 2.0;
    a *= 0.5;
  }
  return v;
}

// ── Rayleigh phase function ─────────────────────────────────────────
float rayleighPhase(float cosTheta) {
  return 0.75 * (1.0 + cosTheta * cosTheta);
}

// ── Henyey-Greenstein phase function (Mie approximation) ────────────
float miePhase(float cosTheta, float g) {
  float g2 = g * g;
  float denom = 1.0 + g2 - 2.0 * g * cosTheta;
  return (1.0 - g2) / (4.0 * PI * pow(denom, 1.5));
}

void main() {
  float aspect = uResolution.x / uResolution.y;

  // ── View ray from screen UV ───────────────────────────────────────
  vec2 uv = vUv;
  float elevation = uv.y * PI * 0.5;
  float azimuth = (uv.x - 0.5) * PI * aspect;

  vec3 viewDir = normalize(vec3(
    cos(elevation) * sin(azimuth),
    sin(elevation),
    cos(elevation) * cos(azimuth)
  ));

  // ── Sun direction from zenith/azimuth angles ──────────────────────
  float sunElev = PI * 0.5 - uSunZenith;
  vec3 sunDir = normalize(vec3(
    cos(sunElev) * sin(uSunAzimuth),
    sin(sunElev),
    cos(sunElev) * cos(uSunAzimuth)
  ));

  float cosTheta = dot(viewDir, sunDir);
  float sunHeight = sunDir.y;

  // ── Optical depth approximation ───────────────────────────────────
  float viewHeight = max(viewDir.y, 0.0);
  float opticalDepth = 1.0 / (viewHeight + 0.15);

  // ── Rayleigh scattering (blue sky) ────────────────────────────────
  vec3 rayleighCoeff = vec3(5.8e-3, 13.5e-3, 33.1e-3) * uRayleighScale;
  vec3 rayleighScatter = rayleighCoeff * rayleighPhase(cosTheta) * opticalDepth;
  vec3 rayleighExtinction = exp(-rayleighCoeff * opticalDepth * 2.0);

  // ── Mie scattering (sun halo / haze) ──────────────────────────────
  float mieCoeff = 21e-3 * uMieScale;
  float mieScatter = mieCoeff * miePhase(cosTheta, uMieG) * opticalDepth;
  float mieExtinction = exp(-mieCoeff * opticalDepth * 1.1);

  // ── Sun influence based on height ─────────────────────────────────
  float sunInfluence = smoothstep(-0.15, 0.15, sunHeight);
  float sunsetInfluence = smoothstep(-0.05, 0.0, sunHeight) * smoothstep(0.3, 0.0, sunHeight);

  // ── Sky colour composition ────────────────────────────────────────
  vec3 sunLight = uSunColor * sunInfluence;

  // Rayleigh: blue sky, reddened at sunset
  vec3 rayleigh = sunLight * rayleighScatter * rayleighExtinction;

  // Mie: warm halo around sun, stronger at sunset
  vec3 mie = sunLight * mieScatter * mieExtinction * mix(vec3(1.0), vec3(1.0, 0.5, 0.15), sunsetInfluence);

  // ── Aerial perspective haze ───────────────────────────────────────
  // Thickens near horizon — adds depth and blue-purple scatter layer
  float hazeDensity = exp(-viewDir.y * 6.0) * 0.35;
  vec3 hazeColor = mix(
    vec3(0.4, 0.5, 0.7),                         // day: blue haze
    vec3(0.7, 0.3, 0.15),                         // sunset: warm haze
    sunsetInfluence
  ) * sunInfluence;

  // Horizon glow — warm band at the horizon during sunrise/sunset
  float horizonBand = exp(-abs(viewDir.y) * 8.0) * sunsetInfluence;
  vec3 horizonGlow = vec3(1.0, 0.4, 0.1) * horizonBand * sunInfluence * 0.6;

  // ── Sun disc with limb darkening ──────────────────────────────────
  float sunAngle = acos(clamp(cosTheta, -1.0, 1.0));
  float sunRadius = 0.018;  // smaller, tighter disc
  float sunDisc = smoothstep(sunRadius * 1.15, sunRadius * 0.85, sunAngle);
  // Limb darkening: edges dimmer, centre hot
  float limbRatio = clamp(sunAngle / sunRadius, 0.0, 1.0);
  float limbDark = 1.0 - limbRatio * limbRatio * 0.4;
  vec3 sun = uSunColor * sunDisc * limbDark * sunInfluence * 35.0;

  // ── Sun bloom — soft radial glow beyond the disc ──────────────────
  float bloomFalloff1 = exp(-sunAngle * 16.0) * 2.0;   // tight corona
  float bloomFalloff2 = exp(-sunAngle * 5.0) * 0.5;    // wide atmospheric glow
  float bloom = (bloomFalloff1 + bloomFalloff2) * sunInfluence;
  // Warmer at sunset
  vec3 bloomColor = mix(uSunColor, vec3(1.0, 0.6, 0.2), sunsetInfluence * 0.7);
  vec3 sunBloom = bloomColor * bloom;

  // ── Crepuscular rays — radial streaks from sun position ───────────
  vec3 crepuscular = vec3(0.0);
  if (sunsetInfluence > 0.01) {
    // Project view and sun into screen space for radial pattern
    vec2 sunScreen = vec2(
      atan(sunDir.x, sunDir.z) / (PI * aspect) + 0.5,
      sunDir.y * 0.5 + 0.5
    );
    vec2 viewScreen = vec2(
      atan(viewDir.x, viewDir.z) / (PI * aspect) + 0.5,
      viewDir.y * 0.5 + 0.5
    );
    vec2 delta = viewScreen - sunScreen;
    float radialDist = length(delta);
    float radialAngle = atan(delta.y, delta.x);

    // Noise-based ray pattern using radial angle — fewer, broader beams
    float rays = fbm(vec2(radialAngle * 5.0, uTime * 0.02), 3);
    rays = smoothstep(0.4, 0.7, rays);
    // Fade with distance from sun and altitude
    float rayMask = exp(-radialDist * 3.0) * sunsetInfluence;
    rayMask *= smoothstep(-0.05, 0.2, viewDir.y); // only above horizon
    crepuscular = vec3(1.0, 0.5, 0.15) * rays * rayMask * 0.3 * sunInfluence;
  }

  // ── Cirrus clouds — FBM noise in sky dome coordinates ─────────────
  vec3 cirrus = vec3(0.0);
  {
    // Project onto a dome — use xz / y as UV for a natural sky mapping
    // Clamp divisor to prevent excessive stretch near horizon
    float cloudAlt = max(viewDir.y, 0.15);
    vec2 cloudUv = viewDir.xz / cloudAlt * 1.8;
    // Wind shear: stretch horizontally for wispy cirrus look
    cloudUv.x *= 2.5;
    // Slow drift — wind pushes clouds along x
    cloudUv += vec2(uTime * 0.012, uTime * 0.002);

    // Two FBM layers: broad coverage + fine wisp detail
    float cloudBroad = fbm(cloudUv * 2.0, 4);
    float cloudFine  = fbm(cloudUv * 6.0 + 3.7, 3);
    // Combine: broad shapes with fine streaky detail
    float cloudNoise = cloudBroad * 0.7 + cloudFine * 0.3;

    // High threshold — only thin wisps break through
    float cloudMask = smoothstep(0.55, 0.78, cloudNoise);
    // Thin at zenith, most visible at mid-altitude band
    float altMask = smoothstep(0.08, 0.25, viewDir.y) * smoothstep(0.8, 0.35, viewDir.y);
    cloudMask *= altMask;

    // Lit by sunlight — bright on day side, warm at sunset, dark at night
    vec3 cloudLit = mix(vec3(1.0), vec3(1.0, 0.55, 0.2), sunsetInfluence) * sunInfluence;
    vec3 cloudShaded = vec3(0.15, 0.15, 0.2) * sunInfluence + vec3(0.01);
    // Simple self-shadow: upper noise value = more lit
    float litFactor = smoothstep(0.55, 0.75, cloudNoise);
    cirrus = mix(cloudShaded, cloudLit, litFactor) * cloudMask * 0.22;
  }

  // ── Night sky ─────────────────────────────────────────────────────
  float nightFactor = smoothstep(0.1, -0.2, sunHeight);

  // Deep blue-indigo night gradient
  vec3 nightColor = mix(
    vec3(0.004, 0.006, 0.022),  // horizon — slightly brighter
    vec3(0.0, 0.001, 0.008),    // zenith — deep
    pow(max(viewDir.y, 0.0), 0.5)
  );

  // ── Stars — two layers with magnitude and colour ───────────────────
  vec3 starTotal = vec3(0.0);
  if (nightFactor > 0.01) {
    float altMask = smoothstep(0.0, 0.3, viewDir.y);

    // Screen-space stars — use fragment position for uniform pixel-scale dots
    vec2 res = uResolution;

    // Layer 1: Bright stars (sparse, coloured, soft twinkle)
    vec2 starUv1 = floor(gl_FragCoord.xy / 8.0);  // 8px grid
    float h1 = hash(starUv1 + 0.31);
    float bright1 = step(0.985, h1);
    float twinkle1 = 0.7 + 0.3 * sin(uTime * (1.0 + h1 * 2.0) + h1 * 60.0);
    float temp1 = hash2(starUv1 + 0.17);
    vec3 starColor1 = mix(
      vec3(1.0, 0.85, 0.6),   // warm
      vec3(0.75, 0.85, 1.0),  // cool blue
      temp1
    );
    // Round dot: distance from jittered cell centre in pixels
    vec2 starCenter1 = (starUv1 + vec2(hash(starUv1), hash2(starUv1)) * 0.8 + 0.1) * 8.0;
    float px1 = length(gl_FragCoord.xy - starCenter1);
    float starShape1 = smoothstep(2.5, 0.5, px1);  // ~2.5px radius
    starTotal += starColor1 * bright1 * twinkle1 * starShape1 * altMask * 1.2;

    // Layer 2: Dim stars (many, tiny point-like)
    vec2 starUv2 = floor(gl_FragCoord.xy / 4.0);  // 4px grid
    float h2 = hash(starUv2 + 0.73);
    float bright2 = step(0.99, h2);
    float twinkle2 = 0.5 + 0.5 * sin(uTime * (1.8 + h2 * 3.0) + h2 * 90.0);
    vec2 starCenter2 = (starUv2 + vec2(hash(starUv2 + 5.3), hash2(starUv2 + 5.3)) * 0.7 + 0.15) * 4.0;
    float px2 = length(gl_FragCoord.xy - starCenter2);
    float starShape2 = smoothstep(1.2, 0.2, px2);  // ~1px radius
    starTotal += vec3(0.6, 0.63, 0.72) * bright2 * twinkle2 * starShape2 * altMask * 0.4;
  }
  vec3 stars = starTotal * nightFactor;

  // ── Composite ─────────────────────────────────────────────────────
  vec3 dayColor = rayleigh + mie + horizonGlow + sun + sunBloom + crepuscular;
  // Blend in haze and cirrus
  dayColor = dayColor + hazeColor * hazeDensity + cirrus;
  vec3 color = mix(dayColor, nightColor, nightFactor) + stars;
  // Clouds at night: faint silhouettes against star field
  color += cirrus * (1.0 - nightFactor) * 0.0 + cirrus * nightFactor * 0.08;

  // ── Below horizon: ground with ambient bounce ─────────────────────
  float groundMask = smoothstep(0.0, -0.08, viewDir.y);
  // Ground reflects sky colour — warm at sunset, cool at day, dark at night
  vec3 groundDay = vec3(0.025, 0.02, 0.015) * sunInfluence;
  vec3 groundSunset = vec3(0.04, 0.02, 0.01) * sunsetInfluence;
  vec3 groundNight = vec3(0.002, 0.002, 0.005);
  vec3 groundColor = groundDay + groundSunset;
  groundColor = mix(groundColor, groundNight, nightFactor);
  // Slight gradient from horizon down
  float groundDepth = smoothstep(0.0, -0.3, viewDir.y);
  groundColor *= mix(1.0, 0.4, groundDepth);
  color = mix(color, groundColor, groundMask);

  // ── Tone mapping ──────────────────────────────────────────────────
  color *= uExposure;
  color = vec3(1.0) - exp(-color);  // Reinhard-ish
  color = pow(color, vec3(1.0 / 2.2));  // Gamma

  fragColor = vec4(color, 1.0);
}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
	const h = hex.replace('#', '');
	return [
		parseInt(h.slice(0, 2), 16) / 255,
		parseInt(h.slice(2, 4), 16) / 255,
		parseInt(h.slice(4, 6), 16) / 255,
	];
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type AtmosphericSkyProps = {
	/** Sun zenith angle in radians (0 = overhead, π/2 = horizon, >π/2 = below). @default 1.2 */
	sunZenith?: number;
	/** Sun azimuth angle in radians. @default 0 */
	sunAzimuth?: number;
	/** Animate the sun across the sky. @default true */
	animateSun?: boolean;
	/** Tone-map exposure (0.5–30). Higher = brighter sky. @default 8 */
	exposure?: number;
	/** Rayleigh scattering strength — controls blue intensity. @default 1 */
	rayleighScale?: number;
	/** Mie scattering strength — controls haze/halo around sun. @default 1 */
	mieScale?: number;
	/** Mie scattering directionality (0 = isotropic, 0.99 = tight sun halo). @default 0.76 */
	mieG?: number;
	/** Sun light colour (hex). @default '#fffaf0' */
	sunColor?: string;
	/** Animation speed multiplier. @default 0.15 */
	speed?: number;
	quality?: PerformanceQuality;
	className?: string;
	ref?: React.Ref<HTMLDivElement>;
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Procedural atmospheric sky background.
 *
 * Approximates Rayleigh and Mie scattering with analytic functions — no
 * precomputed textures, no external data. The sun drifts across the sky,
 * transitioning through dawn → day → sunset → night with stars.
 *
 * The shader runs entirely in the fragment stage: a full-screen quad generates
 * view rays, and the sky colour is computed from scattering phase functions,
 * optical depth approximation, and a procedural star field.
 */
export function AtmosphericSky({
	ref,
	className,
	sunZenith = 1.2,
	sunAzimuth = 0,
	animateSun = true,
	exposure = 8,
	rayleighScale = 1,
	mieScale = 1,
	mieG = 0.76,
	sunColor = '#fffaf0',
	speed = 0.15,
	quality = 'auto',
}: AtmosphericSkyProps) {
	const reducedMotion = usePrefersReducedMotion();
	const autoQuality = useAutoPerformanceQuality();
	const resolvedQuality = resolvePerformanceQuality(quality, autoQuality);
	const { ref: inViewRef, inView } = useInView();
	const rootRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLDivElement>(null);
	const loopControlsRef = useRef<{ start: () => void; stop: () => void } | null>(null);

	const inViewMut = useRef(inView);
	useEffect(() => { inViewMut.current = inView; }, [inView]);

	const dSunColor = useDeferredValue(sunColor);
	const qualityScale = resolvedQuality === 'low' ? 0.7 : resolvedQuality === 'medium' ? 0.85 : 1;
	const dprCap = resolvedQuality === 'low' ? 1 : resolvedQuality === 'medium' ? 1.5 : 2;
	const depsKey = `${dSunColor}-${sunZenith}-${sunAzimuth}-${animateSun}-${exposure}-${rayleighScale}-${mieScale}-${mieG}-${speed}-${resolvedQuality}`;

	useEffect(() => {
		if (reducedMotion) return;
		const container = canvasRef.current;
		if (!container) return;

		let renderer: Renderer;
		let rafId: number | null = null;

		try {
			renderer = new Renderer({
				alpha: false,
				antialias: false,
				dpr: Math.min(window.devicePixelRatio || 1, dprCap),
			});
		} catch {
			return;
		}

		const gl = renderer.gl;
		gl.clearColor(0, 0, 0, 1);

		const geometry = new Triangle(gl);
		if (geometry.attributes.uv) delete geometry.attributes.uv;

		const w = container.offsetWidth || 800;
		const h = container.offsetHeight || 600;

		const program = new Program(gl, {
			vertex: VERT,
			fragment: FRAG,
			uniforms: {
				uTime:          { value: 0 },
				uSpeed:         { value: speed * qualityScale },
				uResolution:    { value: [w, h] },
				uSunZenith:     { value: sunZenith },
				uSunAzimuth:    { value: sunAzimuth },
				uExposure:      { value: exposure },
				uRayleighScale: { value: rayleighScale },
				uMieScale:      { value: mieScale },
				uMieG:          { value: mieG },
				uSunColor:      { value: hexToRgb(dSunColor) },
			},
		});

		const mesh = new Mesh(gl, { geometry, program });
		container.appendChild(gl.canvas);
		gl.canvas.className = 'absolute inset-0 block h-full w-full';

		function syncResolutionUniform() {
			const bw = gl.drawingBufferWidth;
			const bh = gl.drawingBufferHeight;
			if (bh < 1) return;
			program.uniforms.uResolution.value = [bw, bh];
		}

		const ro = new ResizeObserver(() => {
			renderer.setSize(container.offsetWidth, container.offsetHeight);
			syncResolutionUniform();
		});
		ro.observe(container);
		renderer.setSize(w, h);
		syncResolutionUniform();

		function update(ts: number) {
			rafId = null;
			if (!inViewMut.current) return;

			const time = ts * 0.001;
			program.uniforms.uTime.value = time;

			if (animateSun) {
				// Sun drifts across the sky — full cycle over ~40 seconds at speed=1
				const cycle = time * speed * qualityScale * 0.15;
				const z = sunZenith + Math.sin(cycle) * 1.2;
				const a = sunAzimuth + cycle * 0.3;
				program.uniforms.uSunZenith.value = z;
				program.uniforms.uSunAzimuth.value = a;
			}

			renderer.render({ scene: mesh });
			startLoop();
		}

		function stopLoop() {
			if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
		}

		function startLoop() {
			if (rafId === null) { rafId = requestAnimationFrame(update); }
		}

		loopControlsRef.current = { start: startLoop, stop: stopLoop };
		if (inViewMut.current) startLoop();

		return () => {
			stopLoop();
			loopControlsRef.current = null;
			ro.disconnect();
			if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
		};
	}, [depsKey, reducedMotion, dprCap, qualityScale]);

	useEffect(() => {
		const controls = loopControlsRef.current;
		if (!controls) return;
		if (inView) controls.start();
		else controls.stop();
	}, [inView]);

	// Reduced-motion: static sky gradient
	const isSunset = sunZenith > 1.3;
	const isNight = sunZenith > 1.6;

	return (
		<div
			ref={mergeRefs(ref, inViewRef, rootRef)}
			className={cn('relative h-full w-full overflow-hidden', className)}
		>
			<div ref={canvasRef} className="absolute inset-0" aria-hidden />

			{reducedMotion && (
				<div
					className="pointer-events-none absolute inset-0"
					style={{
						background: isNight
							? 'linear-gradient(to bottom, #000510 0%, #020824 50%, #0a0a14 100%)'
							: isSunset
								? 'linear-gradient(to bottom, #1a0a2e 0%, #c44e20 50%, #e8a040 85%, #2a1520 100%)'
								: 'linear-gradient(to bottom, #0a1628 0%, #1e4a8a 30%, #6ba3d6 60%, #b8d4e8 100%)',
					}}
					aria-hidden
				/>
			)}
		</div>
	);
}
