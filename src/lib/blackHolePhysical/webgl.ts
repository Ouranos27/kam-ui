/**
 * WebGL2 runner for Eric Bruneton's black hole shader.
 * HDR scene pass + simple Reinhard-ish tone map (no Eigen bloom pipeline).
 *
 * Derived from Eric Bruneton's black_hole_shader (BSD-3-Clause).
 * Copyright (c) 2020 Eric Bruneton. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holders nor the names of its
 *    contributors may be used to endorse or promote products derived from
 *    this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF
 * THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @see https://github.com/ebruneton/black_hole_shader
 */

import type { BlackHolePhysicalModel } from './model';
import { buildDiscParticleConstants } from './discParticleGlsl';

import coreGlsl from '@/shaders/blackHolePhysicalCore.glsl?raw';
import fragmentTailGlsl from '@/shaders/blackHolePhysicalFragment.glsl?raw';

const MAX_STAR_TEXTURE_LOD = 6;

const VERT_SCENE = `#version 300 es
precision highp float;
uniform vec3 camera_size;
layout(location = 0) in vec4 vertex;
out vec3 view_dir;
void main() {
  view_dir = vec3(vertex.xy * camera_size.xy, -camera_size.z);
  gl_Position = vertex;
}`;

const VERT_BLIT = `#version 300 es
layout(location = 0) in vec4 vertex;
void main() { gl_Position = vertex; }`;

const FRAG_TONEMAP = `#version 300 es
precision highp float;
uniform sampler2D u_hdr;
uniform vec2 u_inv_size;
uniform float u_exposure;
out vec4 frag_color;
void main() {
  vec3 c = texture(u_hdr, gl_FragCoord.xy * u_inv_size).rgb * u_exposure;
  c = min(c, 10.0);
  c = pow(vec3(1.0) - exp(-c), vec3(1.0 / 2.2));
  frag_color = vec4(c, 1.0);
}`;

/** Second pass when scene target is RGBA8 (tonemap already applied in scene shader). */
const FRAG_PRESENT = `#version 300 es
precision highp float;
uniform sampler2D u_hdr;
uniform vec2 u_inv_size;
out vec4 frag_color;
void main() {
  frag_color = vec4(texture(u_hdr, gl_FragCoord.xy * u_inv_size).rgb, 1.0);
}`;

type HdrTexSpec = {
	internal: GLenum;
	format: GLenum;
	type: GLenum;
	/**
	 * When true, the scene pass writes display-ready RGB into an RGBA8 FBO (no float HDR).
	 * The follow-up draw is {@link FRAG_PRESENT} instead of {@link FRAG_TONEMAP}.
	 */
	inlineTonemap: boolean;
};

/**
 * Prefer float/half-float HDR targets; fall back to packed float or RGBA8 + inline tonemap.
 * Extensions EXT_color_buffer_float / EXT_color_buffer_half_float should be enabled first.
 */
function probeHdrRenderTarget(gl: WebGL2RenderingContext): HdrTexSpec {
	function tryCombo(internal: GLenum, format: GLenum, type: GLenum): boolean {
		const tex = gl.createTexture()!;
		const fb = gl.createFramebuffer()!;
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
		gl.texImage2D(gl.TEXTURE_2D, 0, internal, 4, 4, 0, format, type, null);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
		const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
		gl.deleteFramebuffer(fb);
		gl.deleteTexture(tex);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.bindTexture(gl.TEXTURE_2D, null);
		return ok;
	}

	const f = (internal: GLenum, format: GLenum, type: GLenum) =>
		({ internal, format, type, inlineTonemap: false as const }) satisfies HdrTexSpec;

	if (tryCombo(gl.RGBA32F, gl.RGBA, gl.FLOAT)) return f(gl.RGBA32F, gl.RGBA, gl.FLOAT);
	if (tryCombo(gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT)) return f(gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT);
	if (tryCombo(gl.RGBA16F, gl.RGBA, gl.FLOAT)) return f(gl.RGBA16F, gl.RGBA, gl.FLOAT);
	if (tryCombo(gl.R11F_G11F_B10F, gl.RGB, gl.FLOAT)) return f(gl.R11F_G11F_B10F, gl.RGB, gl.FLOAT);
	if (tryCombo(gl.R11F_G11F_B10F, gl.RGB, gl.UNSIGNED_INT_10F_11F_11F_REV)) {
		return f(gl.R11F_G11F_B10F, gl.RGB, gl.UNSIGNED_INT_10F_11F_11F_REV);
	}

	return {
		internal: gl.RGBA8,
		format: gl.RGBA,
		type: gl.UNSIGNED_BYTE,
		inlineTonemap: true,
	};
}

function loadFloatDat(url: string): Promise<Float32Array> {
	return fetch(url)
		.then((r) => {
			if (!r.ok) throw new Error(`Failed to load ${url}`);
			return r.arrayBuffer();
		})
		.then((buf) => {
			const dv = new DataView(buf);
			const n = dv.byteLength / 4;
			const out = new Float32Array(n);
			for (let i = 0; i < n; i += 1) out[i] = dv.getFloat32(i * 4, true);
			return out;
		});
}

function compile(
	gl: WebGL2RenderingContext,
	type: number,
	src: string,
	label: 'vertex' | 'fragment',
): WebGLShader {
	if (gl.isContextLost()) {
		throw new Error(`${label} shader: WebGL context lost before compilation`);
	}
	const glErr = gl.getError();
	const sh = gl.createShader(type);
	if (!sh) {
		const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
		const renderer = debugInfo
			? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
			: 'unknown';
		const vendor = debugInfo
			? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
			: 'unknown';
		throw new Error(
			`${label} shader: createShader returned null ` +
			`(contextLost=${gl.isContextLost()}, priorGlError=${glErr}, ` +
			`renderer=${renderer}, vendor=${vendor})`,
		);
	}
	gl.shaderSource(sh, src);
	gl.compileShader(sh);
	if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(sh)?.trim();
		gl.deleteShader(sh);
		throw new Error(
			log && log.length > 0
				? `${label} shader: ${log}`
				: `${label} shader compile failed (empty driver log; try another GPU/browser)`,
		);
	}
	return sh;
}

function link(
	gl: WebGL2RenderingContext,
	vert: WebGLShader,
	frag: WebGLShader,
): WebGLProgram {
	const p = gl.createProgram()!;
	gl.attachShader(p, vert);
	gl.attachShader(p, frag);
	gl.linkProgram(p);
	gl.deleteShader(vert);
	gl.deleteShader(frag);
	if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
		const log = gl.getProgramInfoLog(p) || 'link failed';
		gl.deleteProgram(p);
		throw new Error(log);
	}
	return p;
}

function cubeTargets(gl: WebGL2RenderingContext): number[] {
	return [
		gl.TEXTURE_CUBE_MAP_POSITIVE_X,
		gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
		gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
		gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
		gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
		gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
	];
}

export type PhysicalBlackHoleOptions = {
	assetBase: string;
	model: BlackHolePhysicalModel;
	exposure: number;
	dprCap: number;
	timeScale?: number;
};

export function createPhysicalBlackHoleRenderer(
	canvas: HTMLCanvasElement,
	{
		assetBase,
		model,
		exposure: initialExposure,
		dprCap,
		timeScale: initialTimeScale = 1,
	}: PhysicalBlackHoleOptions,
) {
	const gl = canvas.getContext('webgl2', {
		alpha: false,
		antialias: false,
		premultipliedAlpha: false,
		powerPreference: 'high-performance',
	}) as WebGL2RenderingContext | null;

	if (!gl) {
		throw new Error('WebGL2 is not available in this browser or context.');
	}

	gl.getExtension('EXT_color_buffer_float');
	gl.getExtension('EXT_float_blend');
	gl.getExtension('EXT_color_buffer_half_float');

	const hdrSpec = probeHdrRenderTarget(gl);

	const extFloatLinear = gl.getExtension('OES_texture_float_linear');
	const floatFilter = extFloatLinear ? gl.LINEAR : gl.NEAREST;

	const extHalfFloatLinear = gl.getExtension('OES_texture_half_float_linear');
	const halfFloatLinearFilter = extHalfFloatLinear ? gl.LINEAR : gl.NEAREST;

	const hdrMinFilter: GLenum = hdrSpec.inlineTonemap
		? gl.LINEAR
		: hdrSpec.internal === gl.RGBA32F
			? floatFilter
			: hdrSpec.internal === gl.RGBA16F
				? halfFloatLinearFilter
				: gl.LINEAR;

	const extAniso = gl.getExtension('EXT_texture_filter_anisotropic');
	const anisoMax = extAniso
		? (gl.getParameter(extAniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number)
		: 0;

	let disposed = false;
	let raf: number | null = null;
	let lastT = performance.now() / 1000;
	let exposure = initialExposure;
	let timeScale = Math.max(0, initialTimeScale);
	let resourcesLoaded = false;
	let wantRun = false;

	const quadBuf = gl.createBuffer()!;
	gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

	let sceneProgram: WebGLProgram | null = null;
	let tonemapProgram: WebGLProgram | null = null;
	let uTonemapHdr: WebGLUniformLocation | null = null;
	let uTonemapInvSize: WebGLUniformLocation | null = null;
	let uTonemapExposure: WebGLUniformLocation | null = null;

	let hdrTex: WebGLTexture | null = null;
	let hdrFbo: WebGLFramebuffer | null = null;
	let w = 0;
	let h = 0;

	const uniforms: Record<string, WebGLUniformLocation | null> = {};

	const textures: {
		rayDeflection: WebGLTexture | null;
		rayInverseRadius: WebGLTexture | null;
		blackbody: WebGLTexture | null;
		doppler: WebGLTexture | null;
		noise: WebGLTexture | null;
		galaxy: WebGLTexture | null;
		star: WebGLTexture | null;
		star2: WebGLTexture | null;
	} = {
		rayDeflection: null,
		rayInverseRadius: null,
		blackbody: null,
		doppler: null,
		noise: null,
		galaxy: null,
		star: null,
		star2: null,
	};

	function syncAnimationLoop() {
		const shouldRun = wantRun && resourcesLoaded && !disposed;
		if (!shouldRun) {
			if (raf !== null) {
				cancelAnimationFrame(raf);
				raf = null;
			}
			return;
		}
		if (raf === null) {
			lastT = performance.now() / 1000;
			raf = requestAnimationFrame(loop);
		}
	}

	function applyAniso(target: GLenum) {
		if (extAniso && anisoMax > 0) {
			gl.texParameterf(target, extAniso.TEXTURE_MAX_ANISOTROPY_EXT, anisoMax);
		}
	}

	function createBlackCubeMap(): WebGLTexture {
		const tex = gl.createTexture()!;
		gl.bindTexture(gl.TEXTURE_CUBE_MAP, tex);
		const zeros = new Uint8Array(4);
		for (const t of cubeTargets(gl)) {
			gl.texImage2D(t, 0, gl.R8, 2, 2, 0, gl.RED, gl.UNSIGNED_BYTE, zeros);
		}
		gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		applyAniso(gl.TEXTURE_CUBE_MAP);
		return tex;
	}

	async function loadAll(): Promise<void> {
		const base = assetBase.endsWith('/') ? assetBase : `${assetBase}/`;
		const [defData, invData, bbData, dopData] = await Promise.all([
			loadFloatDat(`${base}deflection.dat`),
			loadFloatDat(`${base}inverse_radius.dat`),
			loadFloatDat(`${base}black_body.dat`),
			loadFloatDat(`${base}doppler.dat`),
		]);

		const dw = defData[0]!;
		const dh = defData[1]!;
		const defTexels = defData.subarray(2);
		const iw = invData[0]!;
		const ih = invData[1]!;
		const invTexels = invData.subarray(2);

		textures.rayDeflection = gl.createTexture()!;
		gl.bindTexture(gl.TEXTURE_2D, textures.rayDeflection);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, floatFilter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, floatFilter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, dw, dh, 0, gl.RG, gl.FLOAT, defTexels);

		textures.rayInverseRadius = gl.createTexture()!;
		gl.bindTexture(gl.TEXTURE_2D, textures.rayInverseRadius);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, floatFilter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, floatFilter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, iw, ih, 0, gl.RG, gl.FLOAT, invTexels);

		textures.blackbody = gl.createTexture()!;
		gl.bindTexture(gl.TEXTURE_2D, textures.blackbody);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, floatFilter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, floatFilter);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB32F, 128, 1, 0, gl.RGB, gl.FLOAT, bbData);

		textures.doppler = gl.createTexture()!;
		gl.bindTexture(gl.TEXTURE_3D, textures.doppler);
		gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, floatFilter);
		gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, floatFilter);
		gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB32F, 64, 32, 64, 0, gl.RGB, gl.FLOAT, dopData);

		await new Promise<void>((resolve, reject) => {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.onload = () => {
				textures.noise = gl.createTexture()!;
				gl.bindTexture(gl.TEXTURE_2D, textures.noise);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				applyAniso(gl.TEXTURE_2D);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, img);
				gl.generateMipmap(gl.TEXTURE_2D);
				resolve();
			};
			img.onerror = () => reject(new Error(`Failed to load ${base}noise_texture.png`));
			img.src = `${base}noise_texture.png`;
		});

		textures.galaxy = createBlackCubeMap();
		textures.star = createBlackCubeMap();
		textures.star2 = createBlackCubeMap();

		const header = `#version 300 es
precision highp float;
#define LENSING 1
#define DOPPLER 1
#define GRID 0
#define STARS 0
#define IN(x) const in x
#define OUT(x) out x
const float pi = ${Math.PI};
const float rad = 1.0;
const int RAY_DEFLECTION_TEXTURE_WIDTH = ${dw};
const int RAY_DEFLECTION_TEXTURE_HEIGHT = ${dh};
const int RAY_INVERSE_RADIUS_TEXTURE_WIDTH = ${iw};
const int RAY_INVERSE_RADIUS_TEXTURE_HEIGHT = ${ih};
const float STARS_CUBE_MAP_SIZE = 2048.0;
const float MAX_FOOTPRINT_SIZE = 4.0;
const float MAX_FOOTPRINT_LOD = ${MAX_STAR_TEXTURE_LOD}.0;
`;

		const fragSrc = `${header}\n${buildDiscParticleConstants()}\n${coreGlsl}\n${fragmentTailGlsl}`;

		sceneProgram = link(
			gl,
			compile(gl, gl.VERTEX_SHADER, VERT_SCENE, 'vertex'),
			compile(gl, gl.FRAGMENT_SHADER, fragSrc, 'fragment'),
		);

		tonemapProgram = link(
			gl,
			compile(gl, gl.VERTEX_SHADER, VERT_BLIT, 'vertex'),
			compile(
				gl,
				gl.FRAGMENT_SHADER,
				hdrSpec.inlineTonemap ? FRAG_PRESENT : FRAG_TONEMAP,
				'fragment',
			),
		);

		const p = sceneProgram;
		uniforms.cameraSize = gl.getUniformLocation(p, 'camera_size');
		uniforms.cameraPosition = gl.getUniformLocation(p, 'camera_position');
		uniforms.p = gl.getUniformLocation(p, 'p');
		uniforms.kS = gl.getUniformLocation(p, 'k_s');
		uniforms.eTau = gl.getUniformLocation(p, 'e_tau');
		uniforms.eW = gl.getUniformLocation(p, 'e_w');
		uniforms.eH = gl.getUniformLocation(p, 'e_h');
		uniforms.eD = gl.getUniformLocation(p, 'e_d');
		uniforms.rayDeflectionTexture = gl.getUniformLocation(p, 'ray_deflection_texture');
		uniforms.rayInverseRadiusTexture = gl.getUniformLocation(p, 'ray_inverse_radius_texture');
		uniforms.galaxyCubeTexture = gl.getUniformLocation(p, 'galaxy_cube_texture');
		uniforms.starCubeTexture = gl.getUniformLocation(p, 'star_cube_texture');
		uniforms.starCubeTexture2 = gl.getUniformLocation(p, 'star_cube_texture2');
		uniforms.starsOrientation = gl.getUniformLocation(p, 'stars_orientation');
		uniforms.minStarsLod = gl.getUniformLocation(p, 'min_stars_lod');
		uniforms.blackBodyTexture = gl.getUniformLocation(p, 'black_body_texture');
		uniforms.dopplerTexture = gl.getUniformLocation(p, 'doppler_texture');
		uniforms.noiseTexture = gl.getUniformLocation(p, 'noise_texture');
		uniforms.discParams = gl.getUniformLocation(p, 'disc_params');
		uniforms.kamToneInline = gl.getUniformLocation(p, 'kam_tone_inline');
		uniforms.kamEffectiveExposure = gl.getUniformLocation(p, 'kam_effective_exposure');

		gl.useProgram(tonemapProgram);
		uTonemapHdr = gl.getUniformLocation(tonemapProgram, 'u_hdr');
		uTonemapInvSize = gl.getUniformLocation(tonemapProgram, 'u_inv_size');
		uTonemapExposure = hdrSpec.inlineTonemap
			? null
			: gl.getUniformLocation(tonemapProgram, 'u_exposure');
		gl.uniform1i(uTonemapHdr, 0);

		resourcesLoaded = true;
		if (w > 0 && h > 0) allocateHdr(w, h);
		syncAnimationLoop();
	}

	function allocateHdr(nw: number, nh: number) {
		if (nw < 2 || nh < 2) return;
		if (hdrTex) {
			gl.deleteTexture(hdrTex);
			gl.deleteFramebuffer(hdrFbo!);
		}
		hdrTex = gl.createTexture()!;
		gl.bindTexture(gl.TEXTURE_2D, hdrTex);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, hdrMinFilter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, hdrMinFilter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			hdrSpec.internal,
			nw,
			nh,
			0,
			hdrSpec.format,
			hdrSpec.type,
			null,
		);

		hdrFbo = gl.createFramebuffer()!;
		gl.bindFramebuffer(gl.FRAMEBUFFER, hdrFbo);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, hdrTex, 0);
		const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		if (st !== gl.FRAMEBUFFER_COMPLETE) {
			throw new Error('HDR framebuffer incomplete after resize');
		}
	}

	function setSize(cw: number, ch: number, dpr: number) {
		const scale = Math.min(dpr, dprCap);
		const nw = Math.max(2, Math.floor(cw * scale));
		const nh = Math.max(2, Math.floor(ch * scale));
		if (nw === w && nh === h) return;
		w = nw;
		h = nh;
		canvas.width = w;
		canvas.height = h;
		gl.viewport(0, 0, w, h);
		if (resourcesLoaded) allocateHdr(w, h);
	}

	function bindSceneTextures() {
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, textures.rayDeflection);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, textures.rayInverseRadius);
		gl.activeTexture(gl.TEXTURE2);
		gl.bindTexture(gl.TEXTURE_CUBE_MAP, textures.galaxy);
		gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_LOD, 0);
		gl.activeTexture(gl.TEXTURE3);
		gl.bindTexture(gl.TEXTURE_CUBE_MAP, textures.star);
		gl.activeTexture(gl.TEXTURE4);
		gl.bindTexture(gl.TEXTURE_CUBE_MAP, textures.star2);
		gl.activeTexture(gl.TEXTURE5);
		gl.bindTexture(gl.TEXTURE_2D, textures.blackbody);
		gl.activeTexture(gl.TEXTURE6);
		gl.bindTexture(gl.TEXTURE_3D, textures.doppler);
		gl.activeTexture(gl.TEXTURE7);
		gl.bindTexture(gl.TEXTURE_2D, textures.noise);
	}

	function drawScene() {
		if (!sceneProgram || !hdrFbo || !textures.rayDeflection) return;
		const tanFovY = Math.tan(model.fovY / 2);
		const focalLength = h / (2 * tanFovY);

		gl.bindFramebuffer(gl.FRAMEBUFFER, hdrFbo);
		gl.viewport(0, 0, w, h);
		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.useProgram(sceneProgram);
		bindSceneTextures();

		gl.uniform3f(uniforms.cameraSize!, w / 2, h / 2, focalLength);
		gl.uniform4f(
			uniforms.cameraPosition!,
			model.t,
			model.r,
			model.worldTheta,
			model.worldPhi,
		);
		gl.uniform3f(uniforms.p!, model.p[0], model.p[1], model.p[2]);
		gl.uniform4f(uniforms.kS!, model.kS[0], model.kS[1], model.kS[2], model.kS[3]);
		gl.uniform3f(uniforms.eTau!, model.eTau[1], model.eTau[2], model.eTau[3]);
		gl.uniform3f(uniforms.eW!, model.eW[1], model.eW[2], model.eW[3]);
		gl.uniform3f(uniforms.eH!, model.eH[1], model.eH[2], model.eH[3]);
		gl.uniform3f(uniforms.eD!, model.eD[1], model.eD[2], model.eD[3]);

		gl.uniform1i(uniforms.rayDeflectionTexture!, 0);
		gl.uniform1i(uniforms.rayInverseRadiusTexture!, 1);
		gl.uniform1i(uniforms.galaxyCubeTexture!, 2);
		gl.uniform1i(uniforms.starCubeTexture!, 3);
		gl.uniform1i(uniforms.starCubeTexture2!, 4);
		gl.uniformMatrix3fv(uniforms.starsOrientation!, false, model.starsMatrix);
		gl.uniform1f(uniforms.minStarsLod!, 0);
		gl.uniform1i(uniforms.blackBodyTexture!, 5);
		gl.uniform1i(uniforms.dopplerTexture!, 6);
		gl.uniform1i(uniforms.noiseTexture!, 7);
		gl.uniform3f(
			uniforms.discParams!,
			model.discDensity.getValue(),
			model.discOpacity.getValue(),
			model.discTemperature.getValue(),
		);

		if (uniforms.kamToneInline) {
			gl.uniform1i(uniforms.kamToneInline, hdrSpec.inlineTonemap ? 1 : 0);
		}
		if (uniforms.kamEffectiveExposure) {
			const bloom = model.bloom.getValue();
			gl.uniform1f(
				uniforms.kamEffectiveExposure,
				hdrSpec.inlineTonemap ? exposure * (0.25 + 0.75 * bloom) : 1.0,
			);
		}

		gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		gl.disableVertexAttribArray(0);
	}

	function drawTonemap() {
		if (!tonemapProgram || !hdrTex) return;

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, w, h);
		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.useProgram(tonemapProgram);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, hdrTex);
		gl.uniform2f(uTonemapInvSize!, 1 / w, 1 / h);
		if (uTonemapExposure) {
			const bloom = model.bloom.getValue();
			gl.uniform1f(uTonemapExposure, exposure * (0.25 + 0.75 * bloom));
		}

		gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		gl.disableVertexAttribArray(0);
	}

	function frame(ts: number) {
		if (disposed) return;
		const t = ts * 0.001;
		const dTau = t - lastT;
		lastT = t;
		model.updateOrbit(dTau * timeScale);
		drawScene();
		drawTonemap();
	}

	function loop(ts: number) {
		frame(ts);
		if (!disposed && wantRun && resourcesLoaded) {
			raf = requestAnimationFrame(loop);
		} else {
			raf = null;
		}
	}

	return {
		loadAll,
		setSize,
		setExposure(e: number) {
			exposure = e;
		},
		setTimeScale(s: number) {
			timeScale = Math.max(0, s);
		},
		setRunning(run: boolean) {
			wantRun = run;
			syncAnimationLoop();
		},
		syncAnimationLoop,
		dispose() {
			disposed = true;
			wantRun = false;
			resourcesLoaded = false;
			if (raf !== null) cancelAnimationFrame(raf);
			raf = null;
			for (const k of Object.keys(textures) as (keyof typeof textures)[]) {
				const t = textures[k];
				if (t) gl.deleteTexture(t);
				textures[k] = null;
			}
			if (hdrTex) gl.deleteTexture(hdrTex);
			if (hdrFbo) gl.deleteFramebuffer(hdrFbo);
			if (sceneProgram) gl.deleteProgram(sceneProgram);
			if (tonemapProgram) gl.deleteProgram(tonemapProgram);
			gl.deleteBuffer(quadBuf);
		},
	};
}
