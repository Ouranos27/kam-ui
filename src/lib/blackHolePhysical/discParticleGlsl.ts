/**
 * Deterministic replacement for demo `generateDiscParticleParams` (seeded).
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

const PI = Math.PI;

function computeDthetaDphi(u1: number, u2: number, u3: number): number {
	const k2 = (u2 - u1) / (u3 - u1);
	const N = 100000;
	let K = 0.0;
	for (let i = 0; i < N; i += 1) {
		const dy = 1.0 / N;
		const y = (i + 0.5) / N;
		K += dy / Math.sqrt((1 - y * y) * (1 - k2 * y * y));
	}
	return (PI * Math.sqrt(u3 - u1)) / (4 * K);
}

function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		let t = (a += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** GLSL snippet: INNER_DISC_R, OUTER_DISC_R, NUM_DISC_PARTICLES, DISC_PARTICLE_PARAMS. */
export function buildDiscParticleConstants(seed = 548936251): string {
	const rand = mulberry32(seed);
	const rMin = 3.0;
	const rMax = 12.0;
	const lines: string[] = [];
	let numRings = 0;
	for (let r1 = rMin; r1 < rMax; r1 += 0.75) {
		const e = 0.1 * rand();
		const r2 = (r1 * (1.0 + e)) / (1.0 - e);
		const u1 = 1 / r2;
		const u2 = 1 / r1;
		const u3 = 1 - u1 - u2;
		const phi0 = 2 * PI * rand();
		const dThetaDphi = computeDthetaDphi(u1, u2, u3);
		lines.push(
			`vec4(${u1.toPrecision(3)}, ${u2.toPrecision(3)}, ${phi0.toPrecision(3)}, ${dThetaDphi.toPrecision(3)})`,
		);
		numRings += 1;
	}
	return `
      const float INNER_DISC_R = ${rMin.toPrecision(3)};
      const float OUTER_DISC_R = ${rMax.toPrecision(3)};
      const int NUM_DISC_PARTICLES = ${numRings};
      const vec4 DISC_PARTICLE_PARAMS[${numRings}] = vec4[${numRings}] (
        ${lines.join(',\n        ')}
      );`;
}
