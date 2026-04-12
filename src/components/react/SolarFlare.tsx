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

const VERT = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

// Repeatable noise texture + polar-space sampling keeps the corona fibrous
// instead of blobby, while the disk, chromosphere, and tongues remain
// fully procedural and self-contained.
const FRAG = `
precision highp float;

uniform float uTime;
uniform vec3 uResolution;
uniform sampler2D uNoiseTexture;
uniform vec3 uSolarColor;
uniform vec3 uBgColor;
uniform float uIntensity;
uniform float uScale;
uniform float uNoiseScale;
uniform float uFlameSpeed;
uniform float uCoronaGlow;
uniform float uChromosphereWidth;
uniform float uLimbDark;
uniform float uActivity;
uniform vec2 uCoronaRadii;

varying vec2 vUv;

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / uResolution.y;
  uv /= uScale;

  float ft = uTime * uFlameSpeed;
  float radius = length(uv);
  float distanceMask = clamp(1.0 - radius, 0.0, 1.0);
  float coronaFalloff = exp(-max(radius - 1.0, 0.0) * mix(5.5, 3.2, uActivity));
  float tongueFalloff = exp(-max(radius - 1.0, 0.0) * mix(8.0, 4.5, uActivity));

  float polarRadius = radius * 2.0;
  float polarAngle = (2.0 * atan(uv.x, uv.y)) / 6.28318530718 * 0.3;
  vec2 polarUv = vec2(polarRadius, polarAngle);

  vec4 noiseA = texture2D(uNoiseTexture, polarUv * vec2(0.22, 7.4) * uNoiseScale + vec2(-ft * 0.09, 0.0));
  vec4 noiseB = texture2D(uNoiseTexture, polarUv * vec2(0.34, 4.4) * uNoiseScale + vec2(-ft * 0.18, 0.0));
  vec4 noiseC = texture2D(uNoiseTexture, polarUv * vec2(0.16, 5.5) * uNoiseScale + vec2(-ft * 0.12, 0.0));

  float diskMask = smoothstep(0.0, 0.34, distanceMask);
  float rimMask = 1.0 - smoothstep(0.14, 0.78, distanceMask);

  float surfaceCells = noiseB.r * 0.68 + noiseC.r * 0.32;
  float surfaceDetail = noiseA.r * 0.45 + noiseB.r * 0.55;
  float limbShade = mix(1.0 - uLimbDark, 1.0, pow(distanceMask, 0.55));

  vec3 coreColor = vec3(1.0, 0.97, 0.74);
  vec3 rimColor = mix(uSolarColor * 1.15, vec3(1.0, 0.63, 0.14), 0.58);
  vec3 diskColor = mix(rimColor, coreColor, pow(distanceMask, 0.52));
  diskColor *= (0.72 + surfaceCells * 0.18 + surfaceDetail * 0.14) * limbShade;

  float chromosphere = clamp(-1.0 * ((distanceMask - 0.72) / uChromosphereWidth), 0.0, 1.0);
  chromosphere = (chromosphere * max(distanceMask, 0.06) - 0.18) / 0.24;
  chromosphere += (noiseA.r - 0.5) * 0.95;
  chromosphere *= 1.35;
  chromosphere = clamp(chromosphere, 0.0, 1.0);
  chromosphere *= rimMask;

  float tongues = clamp(-1.0 * ((distanceMask - 0.54) / (uChromosphereWidth * 1.35)), 0.0, 1.0);
  tongues = (tongues * max(distanceMask, 0.04) - 0.08) / 0.34;
  tongues += (noiseC.r - 0.5) * 1.08;
  tongues *= 1.24;
  tongues = clamp(tongues, 0.0, 1.0);
  tongues *= 0.55 + uActivity * 0.75;
  tongues *= rimMask * tongueFalloff;

  // Corona halo: isotropic in UV so the disk reads circular on screen (no wide “eye” squash).
  // uCoronaRadii scales each axis inside length(); (1,1) = sphere, (1, >1) = taller oval, (>1, 1) = wider.
  vec2 coronaUv = uv / max(uCoronaRadii, vec2(0.06));
  float coronaDist = length(coronaUv);
  float outerCorona = 1.0 - coronaDist * 0.88;
  outerCorona = clamp(outerCorona + 0.42, 0.0, 1.0);
  outerCorona += (noiseC.r - 0.5) * 0.72;
  float softCorona = outerCorona;
  outerCorona = pow(max(outerCorona, 0.0), 2.2);
  outerCorona += distanceMask;
  outerCorona *= uCoronaGlow;
  outerCorona = clamp(outerCorona, 0.0, 1.0);
  outerCorona *= pow(1.0 - distanceMask, 2.2) * 3.2;
  outerCorona *= coronaFalloff;

  softCorona += distanceMask;
  softCorona = pow(max(softCorona, 0.0), 0.65) * 0.22;
  softCorona *= coronaFalloff;

  float sparkMask = pow(max(noiseA.r * 0.65 + noiseB.r * 0.35, 0.0), 8.0);
  sparkMask *= rimMask * coronaFalloff * (0.18 + uActivity * 0.32);

  vec3 color = uBgColor;
  color += mix(uSolarColor * 1.35, vec3(1.0, 0.53, 0.10), 0.34) * (outerCorona + softCorona) * uIntensity;
  color += mix(uSolarColor * 1.55, vec3(1.0, 0.77, 0.18), 0.48) * (chromosphere + tongues) * uIntensity;
  color += vec3(1.0, 0.88, 0.42) * sparkMask * uIntensity * 0.7;
  color += diskColor * diskMask * uIntensity;

  color = max(color, uBgColor);
  gl_FragColor = vec4(color, 1.0);
}`;

function hexToVec3(hex: string): [number, number, number] {
	const value = hex.replace('#', '');
	return [
		parseInt(value.slice(0, 2), 16) / 255,
		parseInt(value.slice(2, 4), 16) / 255,
		parseInt(value.slice(4, 6), 16) / 255,
	];
}

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

function radiusToScale(radius: number) {
	return 0.44 + radius * 1.0;
}

export type SolarFlareProps = {
	ref?: Ref<HTMLDivElement>;
	color?: string;
	radius?: number;
	flareCount?: number;
	limbDark?: number;
	speed?: number;
	intensity?: number;
	/**
	 * Outer corona ellipse radii in shader UV (after aspect correction). (1, 1) = circular
	 * on screen. Raise Y to extend the glow top–bottom; raise X to widen sideways.
	 */
	coronaRadiiX?: number;
	coronaRadiiY?: number;
	quality?: PerformanceQuality;
	className?: string;
};

/**
 * Full-viewport procedural sun (ogl). GPU noise texture + radial UV sampling
 * for fibrous corona; photosphere and chromosphere are masked and composited in
 * the fragment shader. Pauses off-screen; static gradient when reduced motion.
 */
export function SolarFlare({
	ref,
	className,
	color = '#ff8840',
	radius = 0.24,
	flareCount = 5,
	limbDark = 0.7,
	speed = 0.5,
	intensity = 1,
	coronaRadiiX = 1,
	coronaRadiiY = 1,
	quality = 'auto',
}: SolarFlareProps) {
	const reducedMotion = usePrefersReducedMotion();
	const autoQuality = useAutoPerformanceQuality();
	const resolvedQuality = resolvePerformanceQuality(quality, autoQuality);
	const { ref: inViewRef, inView } = useInView();
	const canvasRef = useRef<HTMLDivElement>(null);
	const inViewRefValue = useRef(inView);
	const loopControlsRef = useRef<{ start: () => void; stop: () => void } | null>(null);
	const deferredColor = useDeferredValue(color);

	useEffect(() => {
		inViewRefValue.current = inView;
	}, [inView]);

	useEffect(() => {
		if (reducedMotion) return;
		if (import.meta.env.DEV) performance.mark('solarflare:init:start');

		const container = canvasRef.current;
		if (!container) return;

		const qualityScale = resolvedQuality === 'low' ? 0.72 : resolvedQuality === 'medium' ? 0.88 : 1;
		const textureSize = resolvedQuality === 'low' ? 128 : resolvedQuality === 'medium' ? 192 : 256;
		const dprCap = resolvedQuality === 'low' ? 1 : resolvedQuality === 'medium' ? 1.5 : 2;
		const activity = Math.max(0, Math.min(1, flareCount / 7));
		const bgColor: [number, number, number] = [0.04, 0.02, 0.01];
		const crx = Math.min(2, Math.max(0.5, coronaRadiiX));
		const cry = Math.min(2, Math.max(0.5, coronaRadiiY));

		let renderer: Renderer;
		let frameId: number | null = null;

		try {
			renderer = new Renderer({
				alpha: false,
				antialias: false,
				dpr: Math.min(window.devicePixelRatio || 1, dprCap),
				premultipliedAlpha: false,
			});
		} catch {
			return;
		}

		const gl = renderer.gl;
		gl.clearColor(bgColor[0], bgColor[1], bgColor[2], 1);

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

		const geometry = new Triangle(gl);
		const width = container.offsetWidth || 800;
		const height = container.offsetHeight || 600;

		const program = new Program(gl, {
			vertex: VERT,
			fragment: FRAG,
			uniforms: {
				uTime: { value: 0 },
				uResolution: { value: [width, height, width / height] },
				uNoiseTexture: { value: noiseTexture },
				uSolarColor: { value: hexToVec3(deferredColor) },
				uBgColor: { value: bgColor },
				uIntensity: { value: intensity * qualityScale },
				uScale: { value: radiusToScale(radius) },
				uNoiseScale: { value: 0.92 + activity * 0.85 },
				uFlameSpeed: { value: speed * (0.9 + activity * 0.15) },
				uCoronaGlow: { value: 0.34 + activity * 0.26 },
				uChromosphereWidth: { value: 0.22 - activity * 0.04 },
				uLimbDark: { value: limbDark },
				uActivity: { value: activity },
				uCoronaRadii: { value: [crx, cry] },
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

		const resizeObserver = new ResizeObserver(() => {
			const nextWidth = container.offsetWidth;
			const nextHeight = container.offsetHeight;
			renderer.setSize(nextWidth, nextHeight);
			syncResolutionUniform();
		});

		resizeObserver.observe(container);
		renderer.setSize(width, height);
		syncResolutionUniform();

		const render = (timestamp: number) => {
			frameId = null;
			if (!inViewRefValue.current) return;

			const nextActivity = Math.max(0, Math.min(1, flareCount / 7));
			program.uniforms.uTime.value = timestamp * 0.001;
			program.uniforms.uSolarColor.value = hexToVec3(deferredColor);
			program.uniforms.uIntensity.value = intensity * qualityScale;
			program.uniforms.uScale.value = radiusToScale(radius);
			program.uniforms.uNoiseScale.value = 0.92 + nextActivity * 0.85;
			program.uniforms.uFlameSpeed.value = speed * (0.9 + nextActivity * 0.15);
			program.uniforms.uCoronaGlow.value = 0.34 + nextActivity * 0.26;
			program.uniforms.uChromosphereWidth.value = 0.22 - nextActivity * 0.04;
			program.uniforms.uLimbDark.value = limbDark;
			program.uniforms.uActivity.value = nextActivity;
			program.uniforms.uCoronaRadii.value = [
				Math.min(2, Math.max(0.5, coronaRadiiX)),
				Math.min(2, Math.max(0.5, coronaRadiiY)),
			];
			renderer.render({ scene: mesh });
			startLoop();
		};

		function stopLoop() {
			if (frameId !== null) {
				cancelAnimationFrame(frameId);
				frameId = null;
				if (import.meta.env.DEV) performance.mark('solarflare:loop:stop');
			}
		}

		function startLoop() {
			if (frameId === null) {
				frameId = requestAnimationFrame(render);
				if (import.meta.env.DEV) performance.mark('solarflare:loop:start');
			}
		}

		loopControlsRef.current = { start: startLoop, stop: stopLoop };
		if (inViewRefValue.current) startLoop();
		if (import.meta.env.DEV) performance.mark('solarflare:init:end');

		return () => {
			stopLoop();
			loopControlsRef.current = null;
			resizeObserver.disconnect();
			if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
		};
	}, [coronaRadiiX, coronaRadiiY, deferredColor, flareCount, intensity, limbDark, radius, reducedMotion, resolvedQuality, speed]);

	useEffect(() => {
		const controls = loopControlsRef.current;
		if (!controls) return;
		if (inView) controls.start();
		else controls.stop();
	}, [inView]);

	const diskStop = Math.round(18 + radius * 38);
	const coronaStop = Math.round(diskStop + 22 + flareCount * 2);
	const hazeStop = Math.round(coronaStop + 24);

	return (
		<div ref={mergeRefs(ref, inViewRef)} className={cn('relative h-full w-full overflow-hidden', className)}>
			<div ref={canvasRef} className="absolute inset-0" aria-hidden />

			{reducedMotion && (
				<div
					className="pointer-events-none absolute inset-0"
					aria-hidden
					style={{
						background: [
							`radial-gradient(circle ${diskStop}% at 50% 50%, #fff7d6 0%, #ffd089 ${Math.max(diskStop - 6, 8)}%, ${color}ee ${diskStop}%, ${color}77 ${coronaStop}%, ${color}22 ${hazeStop}%, transparent ${hazeStop + 18}%)`,
							'#0a0502',
						].join(', '),
					}}
				/>
			)}
		</div>
	);
}
