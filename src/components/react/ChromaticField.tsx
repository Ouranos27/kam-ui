import { Mesh, Program, Renderer, Texture, Triangle } from 'ogl';
import { useDeferredValue, useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';
import { mergeRefs, resolvePerformanceQuality, useAutoPerformanceQuality, useInView, usePrefersReducedMotion, type PerformanceQuality } from '@/lib/containment';

// ─── GLSL ────────────────────────────────────────────────────────────────────

const VERT = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

/**
 * Eclipse fragment shader — three refinements applied:
 *
 * 1. SPECTRAL CA  — 5 samples spanning [-ab … +ab] mapped to a visible-
 *    spectrum ramp (red → orange → green-cyan → blue → violet).  The steep
 *    brightness drop at the sphere boundary makes every wavelength diverge
 *    by a different amount, printing a ROYGBIV fringe around the limb.
 *
 * 2. VISUAL REALISM  — angle-modulated limb (two active-region hot-spots
 *    slowly rotating), streamer-tip ripple, IFS diffuse, polar-sampled GPU noise
 *    on streamers / outer glow only (fibrous corona), atmospheric rim inside limb.
 *
 * 3. SPHERE POSITION  — the eclipse is offset by uSphereCenter in normalised
 *    canvas space (0–1). Default is dead centre; optional cursor parallax
 *    when mouseMoveSphere is enabled.  The outer vignette stays canvas-centred.
 */
const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform vec2  uResolution;
uniform vec3  uColor;
uniform float uAberration;
uniform float uSpeed;
uniform float uIntensity;
uniform vec2  uMouse;
uniform float uSphereRadius;
uniform float uLimb;
uniform vec2  uSphereCenter;   // normalised 0–1 canvas position (centre = 0.5,0.5)
uniform sampler2D uNoiseTexture;
uniform float uCoronaFibers;     // 0 = off, 1 = full polar noise modulation of corona layers

out vec4 fragColor;

// ── Helpers ───────────────────────────────────────────────────────────────────

mat2 rot2(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

// Approximate visible-light spectrum: t=0 red end, t=1 violet end.
// Produces: red → orange → yellow-green → cyan → blue → violet
vec3 wavelengthToRgb(float t) {
  float r = max(0.0, 1.0 - t / 0.5)                      // red fades out by t=0.5
          + max(0.0, (t - 0.85) / 0.15) * 0.55;          // violet bleeds into red
  float g = max(0.0, 1.0 - abs(t - 0.38) / 0.35);        // green peaks near t=0.38
  float b = max(0.0, (t - 0.38) / 0.48);                 // blue rises from t=0.38
  return clamp(vec3(r, g, b), 0.0, 1.0);
}

// ── IFS organic corona texture ─────────────────────────────────────────────

float ifs(vec2 p, float t) {
  float v = 0.0;
  float w = 1.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float a  = 0.46 + fi * 0.34 + t * 0.028;
    float c  = cos(a), s = sin(a);
    p  = mat2(c, -s, s, c) * p;
    p  = abs(p);
    p -= vec2(
      0.40 + 0.06 * sin(t * 0.10 + fi * 1.37),
      0.36 + 0.07 * cos(t * 0.08 + fi * 0.97)
    );
    p *= 1.6;
    w *= 1.6;
    v += exp(-length(p) * 2.8) / w;
  }
  return v;
}

// ── Radial corona streamers ─────────────────────────────────────────────────
// 14 rays with organic tip ripple: a sinusoidal amplitude variation in each
// ray's mid-zone mimics the wispy branching of real helmet streamers.

float coronaStreamers(vec2 uv, float t, float sr) {
  float r           = length(uv);
  float a           = atan(uv.y, uv.x);
  float s           = 0.0;
  float distFromLimb = max(r - sr, 0.0);

  for (int i = 0; i < 14; i++) {
    float fi     = float(i);
    float base   = fi * 0.4488;
    float drift  = 0.14 * sin(t * 0.14 + fi * 1.23);
    float target = base + drift;
    float da     = a - target;
    da -= 6.2832 * floor((da + 3.1416) / 6.2832);

    float sharpness  = 38.0 + 28.0 * fract(sin(fi * 127.1) * 4375.55);
    float angFalloff = exp(-da * da * sharpness);
    float decayRate  = 1.6 + 0.9 * fract(sin(fi * 311.7) * 5831.3);

    // Organic tip: sinusoidal ripple active only in the mid-range of each ray
    float tipHash   = fract(sin(fi * 73.1) * 9371.3);
    float wispRipple = 0.28 * sin(distFromLimb * (9.0 + 6.0 * tipHash) - t * 0.65 + fi * 1.7);
    float wispMask  = smoothstep(0.05, 0.35, distFromLimb)
                    * (1.0 - smoothstep(0.55, 0.95, distFromLimb));
    float radFalloff = exp(-distFromLimb * decayRate)
                     * (1.0 + wispRipple * wispMask);

    float pulse = 0.5 + 0.5 * sin(t * 0.32 + fi * 2.09);
    s += angFalloff * max(0.0, radFalloff) * pulse;
  }
  return s * step(sr, r);
}

// Polar-space noise: long angular correlation + radial
// scroll → fibrous corona without touching the limb ring used for spectral CA.
float fibrousCoronaMod(vec2 uv, float t) {
  float polarR = length(uv) * 2.0;
  float polarA = (2.0 * atan(uv.x, uv.y)) / 6.28318530718 * 0.3;
  vec2 puv     = vec2(polarR, polarA);
  float ft     = t * 0.52;
  vec4 n1 = texture(uNoiseTexture, puv * vec2(0.2, 6.8) + vec2(-ft * 0.075, 0.0));
  vec4 n2 = texture(uNoiseTexture, puv * vec2(0.3, 4.3) + vec2(-ft * 0.145, 0.0));
  float blend     = n1.r * 0.58 + n2.r * 0.42;
  float modulated = 0.86 + 0.3 * blend;
  return mix(1.0, modulated, uCoronaFibers);
}

// ── Full corona scene ──────────────────────────────────────────────────────
// uv is SPHERE-CENTRED (pre-shifted by uSphereCenter in main).
// Sphere occlusion is baked in so each CA channel sees its own boundary,
// naturally printing a spectral fringe around the limb.

float scene(vec2 uv, float t) {
  float r   = length(uv);
  float sr  = uSphereRadius;
  float occ = smoothstep(sr - 0.007, sr + 0.007, r);

  float fiberMod = fibrousCoronaMod(uv, t);

  // Angle-modulated limb — two slowly-rotating active-region hot-spots
  float limbAngle = atan(uv.y, uv.x);
  float limbMod   = 0.75 + 0.25 * cos(limbAngle * 2.0 + t * 0.04);
  float limb      = exp(-pow(abs(r - sr) * 30.0, 1.6)) * uLimb * 2.5 * limbMod;

  float streamers  = coronaStreamers(uv, t, sr) * 1.6 * fiberMod;

  float organic    = ifs(uv * 0.55, t) * 0.28 * fiberMod;
  float coronaFade = exp(-(r - sr) * 2.2) * step(sr, r);
  organic *= coronaFade;

  float outerGlow = exp(-(r - sr) * 1.0) * 0.6 * step(sr, r) * fiberMod;

  return (limb + streamers + organic + outerGlow) * occ;
}

// ── Main ──────────────────────────────────────────────────────────────────────

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2  uv     = (gl_FragCoord.xy / uResolution - 0.5) * 2.0;
  uv.x        *= aspect;

  float t = uTime * uSpeed;
  float r = length(uv);   // canvas-centred distance (vignette only)

  // Barrel distortion
  vec2 uvD = uv * (1.0 + r * r * 0.018);

  // ── Sphere-relative UV (parallax) ─────────────────────────────────────────
  // Clamp offset so the eclipse never exits the frame.
  vec2 sphereOff = (uSphereCenter - 0.5) * 2.0;
  sphereOff.x   *= aspect;
  sphereOff      = clamp(sphereOff, vec2(-0.30), vec2(0.30));
  vec2  uvSphere = uvD - sphereOff;
  float rSphere  = length(uvSphere);

  // ── CA axis ───────────────────────────────────────────────────────────────
  // Stays canvas-anchored (not sphere-anchored), tilts gently with mouse.
  vec2  mouse  = (uMouse - 0.5) * 2.0;
  vec2  abAxis = normalize(vec2(1.0, 0.3) + mouse * 0.4);
  float ab     = uAberration * 0.085;
  float k      = uIntensity * 0.78;

  // ── 5-band spectral CA ────────────────────────────────────────────────────
  // Scene is sampled at 5 lateral offsets.  i=0 → red end (−ab),
  // i=2 → centre (no offset, used as reference brightness),
  // i=4 → violet end (+ab).  Where channels diverge, each contributes
  // its spectral hue as an additive fringe — ROYGBIV at every edge.
  float samples[5];
  for (int i = 0; i < 5; i++) {
    float fi     = float(i) / 4.0;              // 0 → 1
    float off    = (fi - 0.5) * 2.0 * ab;       // −ab … +ab
    samples[i]   = clamp(scene(uvSphere + abAxis * off, t) * k, 0.0, 1.0);
  }
  float bCenter = samples[2];

  // Base colour: deep black → accent → cold-white at bright limb
  vec3  bg  = vec3(0.007, 0.005, 0.010);
  float hi  = smoothstep(0.5, 1.0, bCenter);
  vec3  col = mix(mix(bg, uColor, bCenter), vec3(0.85, 0.92, 1.0), hi);

  // Additive spectral fringes — only where a band's brightness diverges from centre
  float caStr = uAberration * uIntensity * 4.5;
  for (int i = 0; i < 5; i++) {
    float fi   = float(i) / 4.0;
    float diff = clamp((samples[i] - bCenter) * caStr, 0.0, 1.0);
    col       += wavelengthToRgb(fi) * diff;
  }

  // ── Hard sphere occlusion ─────────────────────────────────────────────────
  float hardOcc = smoothstep(uSphereRadius - 0.012, uSphereRadius + 0.002, rSphere);
  col *= hardOcc;

  // ── Atmospheric rim ───────────────────────────────────────────────────────
  // Pale blue-grey arc just inside the sphere boundary (bypasses hardOcc
  // intentionally — it sits in the occluded zone, like a thin atmosphere).
  float atmoDist = clamp(uSphereRadius - rSphere, 0.0, 0.05);
  float atmoRim  = exp(-pow(atmoDist / 0.016, 2.0)) * 0.30;
  col           += vec3(0.28, 0.52, 0.92) * atmoRim;

  // ── Outer vignette — canvas-centred deep-space fade ───────────────────────
  float vig = 1.0 - smoothstep(0.55, 1.3, r * 0.65);
  col *= vig;
  col  = max(col, bg * vig);

  fragColor = vec4(col, 1.0);
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

/** Multi-octave value noise in RGBA — shared approach with the solar corona component. */
function generateNoiseTexture(size: number): Uint8Array {
	const data = new Uint8Array(size * size * 4);

	function hash(x: number, y: number, seed: number): number {
		let n = x * 374761393 + y * 668265263 + seed * 1274126177;
		n = Math.imul(n ^ (n >>> 13), 1274126177);
		return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
	}

	function noise(px: number, py: number, frequency: number, seed: number): number {
		const fx = (px / size) * frequency;
		const fy = (py / size) * frequency;
		const ix = Math.floor(fx);
		const iy = Math.floor(fy);
		const tx = fx - ix;
		const ty = fy - iy;
		const wrap = frequency | 0;
		const v00 = hash(((ix % wrap) + wrap) % wrap, ((iy % wrap) + wrap) % wrap, seed);
		const v10 = hash((((ix + 1) % wrap) + wrap) % wrap, ((iy % wrap) + wrap) % wrap, seed);
		const v01 = hash(((ix % wrap) + wrap) % wrap, (((iy + 1) % wrap) + wrap) % wrap, seed);
		const v11 = hash((((ix + 1) % wrap) + wrap) % wrap, (((iy + 1) % wrap) + wrap) % wrap, seed);
		return v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
	}

	for (let y = 0; y < size; y += 1) {
		for (let x = 0; x < size; x += 1) {
			let sample = 0;
			let amplitude = 0.4;
			let totalAmplitude = 0;
			for (let octave = 0; octave < 8; octave += 1) {
				const frequency = 32 * (1 << octave);
				sample += amplitude * noise(x, y, frequency, octave * 31);
				totalAmplitude += amplitude;
				amplitude *= 0.65;
			}
			sample /= totalAmplitude;
			sample = (sample - 0.5) * 2.2 + 0.5;
			sample = Math.max(0, Math.min(1, sample));
			const value = Math.round(sample * 255);
			const index = (y * size + x) * 4;
			data[index] = value;
			data[index + 1] = value;
			data[index + 2] = value;
			data[index + 3] = 255;
		}
	}

	return data;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type ChromaticFieldProps = {
	ref?: React.Ref<HTMLDivElement>;
	/** Corona / limb accent colour (6-char hex). */
	color?: string;
	/** Chromatic aberration strength — drives the spectral rainbow fringe. */
	aberration?: number;
	/** Animation speed multiplier. */
	speed?: number;
	/** Overall corona brightness (0.5 = subtle, 1.5 = vivid). */
	intensity?: number;
	/**
	 * Dark occluder disk radius in aspect-corrected UV units.
	 * 0 = no sphere (open corona field). Default 0.28.
	 */
	sphereRadius?: number;
	/** Limb-ring brightness multiplier. >1 overexposes the inner corona. */
	limb?: number;
	/**
	 * Fibrous corona detail from polar-sampled GPU noise (0 = off). Modulates
	 * streamers / IFS / outer glow only — limb ring stays clean for spectral CA.
	 */
	coronaFibers?: number;
	/** CA aberration axis tilts toward the cursor. */
	mouseReact?: boolean;
	/**
	 * When true, sphere centre lerps toward the cursor; when false, stays fixed
	 * on the canvas centre. Independent of `mouseReact`.
	 */
	mouseMoveSphere?: boolean;
	quality?: PerformanceQuality;
	className?: string;
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Full-screen WebGL eclipse background.
 *
 * A dark occluder disk is surrounded by a procedural solar corona —
 * angle-modulated limb ring, 14 radial streamers with organic tip wisps,
 * IFS diffuse, and polar-sampled noise that adds the same fibrous micro-structure
 * as the solar corona (streamers / glow only; limb unchanged for clean CA).  RGB is sampled across 5 spectral bands
 * (wavelengthToRgb: red → orange → green-cyan → blue → violet) so the
 * sharp sphere boundary prints a ROYGBIV prismatic fringe.  A thin
 * atmospheric rim glow sits just inside the sphere edge.
 *
 * The sphere is centred on the canvas by default; enable `mouseMoveSphere`
 * for cursor parallax. The outer vignette stays canvas-centred. No Three.js —
 * the sphere is a GLSL distance field.
 *
 * React 19: ref as a regular prop.  Pauses off-screen.
 * Static radial-gradient fallback for prefers-reduced-motion.
 */
export function ChromaticField({
	ref,
	className,
	color = '#b4ccdf',
	aberration = 0.55,
	speed = 0.45,
	intensity = 1.0,
	sphereRadius = 0.28,
	limb = 1.0,
	coronaFibers = 0.65,
	mouseReact = true,
	mouseMoveSphere = false,
	quality = 'auto',
}: ChromaticFieldProps) {
	const reducedMotion = usePrefersReducedMotion();
	const autoQuality = useAutoPerformanceQuality();
	const resolvedQuality = resolvePerformanceQuality(quality, autoQuality);
	const { ref: inViewRef, inView } = useInView();
	const rootRef  = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLDivElement>(null);
	const loopControlsRef = useRef<{ start: () => void; stop: () => void } | null>(null);

	const inViewMut = useRef(inView);
	useEffect(() => { inViewMut.current = inView; }, [inView]);

	const dColor  = useDeferredValue(color);
	const qualityScale = resolvedQuality === 'low' ? 0.68 : resolvedQuality === 'medium' ? 0.85 : 1;
	const dprCap = resolvedQuality === 'low' ? 1 : resolvedQuality === 'medium' ? 1.5 : 2;
	const depsKey = [dColor, aberration, speed, intensity, sphereRadius, limb, coronaFibers, mouseReact, mouseMoveSphere, resolvedQuality].join('-');

	useEffect(() => {
		if (reducedMotion) return;
		if (import.meta.env.DEV) performance.mark('chromaticfield:init:start');
		const container = canvasRef.current;
		if (!container) return;

		let renderer: Renderer;
		let rafId: number | null = null;

		try {
			renderer = new Renderer({ alpha: false, antialias: false, dpr: Math.min(window.devicePixelRatio || 1, dprCap) });
		} catch {
			return;
		}

		const gl = renderer.gl;
		gl.clearColor(0.007, 0.005, 0.010, 1);

		const geometry = new Triangle(gl);
		if (geometry.attributes.uv) delete geometry.attributes.uv;

		const w = container.offsetWidth  || 800;
		const h = container.offsetHeight || 600;

		const textureSize = resolvedQuality === 'low' ? 128 : resolvedQuality === 'medium' ? 192 : 256;
		const noiseTexture = new Texture(gl, {
			image: generateNoiseTexture(textureSize),
			width: textureSize,
			height: textureSize,
			generateMipmaps: false,
			flipY: false,
		});
		noiseTexture.minFilter = gl.LINEAR;
		noiseTexture.magFilter = gl.LINEAR;
		noiseTexture.wrapS = gl.REPEAT;
		noiseTexture.wrapT = gl.REPEAT;

		const program = new Program(gl, {
			vertex:   VERT,
			fragment: FRAG,
			uniforms: {
				uTime:         { value: 0 },
				uResolution:   { value: [w, h] },
				uColor:        { value: hexToRgb(dColor) },
				uAberration:   { value: aberration * qualityScale },
				uSpeed:        { value: speed * qualityScale },
				uIntensity:    { value: intensity * qualityScale },
				uMouse:        { value: [0.5, 0.5] },
				uSphereRadius: { value: sphereRadius },
				uLimb:         { value: limb },
				uSphereCenter: { value: [0.5, 0.5] },
				uNoiseTexture: { value: noiseTexture },
				uCoronaFibers: { value: Math.min(1, Math.max(0, coronaFibers)) },
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
			const cw = container.offsetWidth;
			const ch = container.offsetHeight;
			renderer.setSize(cw, ch);
			syncResolutionUniform();
		});
		ro.observe(container);
		renderer.setSize(w, h);
		syncResolutionUniform();

		// Separate targets: mouse → CA axis tilt + sphere parallax
		const mouse        = { x: 0.5, y: 0.5 };  // CA axis
		const lerped       = { x: 0.5, y: 0.5 };
		const sphereTarget = { x: 0.5, y: 0.5 };  // sphere centre
		const lerpedSphere = { x: 0.5, y: 0.5 };

		const needsMouse = mouseReact || mouseMoveSphere;

		function onMouseMove(e: MouseEvent) {
			const rect = container!.getBoundingClientRect();
			const mx   = (e.clientX - rect.left) / rect.width;
			const my   = 1.0 - (e.clientY - rect.top) / rect.height;
			if (mouseReact)      { mouse.x = mx; mouse.y = my; }
			if (mouseMoveSphere) { sphereTarget.x = mx; sphereTarget.y = my; }
		}
		if (needsMouse) window.addEventListener('mousemove', onMouseMove, { passive: true });

		function update(ts: number) {
			rafId = null;
			if (!inViewMut.current) return;

			const time = ts * 0.001;

			// CA axis lerp
			if (mouseReact) {
				lerped.x += 0.035 * (mouse.x - lerped.x);
				lerped.y += 0.035 * (mouse.y - lerped.y);
				program.uniforms.uMouse.value = [lerped.x, lerped.y];
			}

			if (mouseMoveSphere) {
				lerpedSphere.x += 0.028 * (sphereTarget.x - lerpedSphere.x);
				lerpedSphere.y += 0.028 * (sphereTarget.y - lerpedSphere.y);
				program.uniforms.uSphereCenter.value = [lerpedSphere.x, lerpedSphere.y];
			} else {
				program.uniforms.uSphereCenter.value = [0.5, 0.5];
			}

			program.uniforms.uTime.value         = time;
			program.uniforms.uColor.value        = hexToRgb(dColor);
			program.uniforms.uAberration.value   = aberration * qualityScale;
			program.uniforms.uSphereRadius.value = sphereRadius;
			program.uniforms.uLimb.value         = limb;
			program.uniforms.uCoronaFibers.value = Math.min(1, Math.max(0, coronaFibers));
			renderer.render({ scene: mesh });
			startLoop();
		}

		function stopLoop() {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
				if (import.meta.env.DEV) performance.mark('chromaticfield:loop:stop');
			}
		}

		function startLoop() {
			if (rafId === null) {
				rafId = requestAnimationFrame(update);
				if (import.meta.env.DEV) performance.mark('chromaticfield:loop:start');
			}
		}

		loopControlsRef.current = { start: startLoop, stop: stopLoop };
		if (inViewMut.current) startLoop();
		if (import.meta.env.DEV) performance.mark('chromaticfield:init:end');

		return () => {
			stopLoop();
			loopControlsRef.current = null;
			ro.disconnect();
			if (needsMouse) window.removeEventListener('mousemove', onMouseMove);
			if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
		};
	}, [depsKey, reducedMotion, dprCap, qualityScale]);

	useEffect(() => {
		const controls = loopControlsRef.current;
		if (!controls) return;
		if (inView) controls.start();
		else controls.stop();
	}, [inView]);

	// ── Reduced-motion: static eclipse approximation ──────────────────────────
	const spPct   = Math.round(sphereRadius * 100);
	const limbPct = Math.round((sphereRadius + 0.06) * 100);
	return (
		<div
			ref={mergeRefs(ref, inViewRef, rootRef)}
			className={cn('relative h-full w-full overflow-hidden', className)}
		>
			<div ref={canvasRef} className="absolute inset-0" aria-hidden />

			{reducedMotion && (
				<div
					className="pointer-events-none absolute inset-0"
					aria-hidden
					style={{
						background: [
							`radial-gradient(circle ${spPct}% at 50% 50%, #000 ${spPct - 2}%, ${color}cc ${spPct}%, ${color}55 ${limbPct}%, transparent ${limbPct + 20}%)`,
							'#050508',
						].join(', '),
					}}
				/>
			)}
		</div>
	);
}
