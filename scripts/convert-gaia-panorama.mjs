/**
 * Convert ESA Gaia Milky Way panorama from Hammer projection to equirectangular.
 *
 * The source image (Gaia_s_sky_in_colour.png) uses a Hammer equal-area
 * projection in galactic coordinates. This script reprojects it to a standard
 * equirectangular panorama suitable for sky-dome texture mapping.
 *
 * Projection math follows Bruneton's gaia_sky_map_generator.cc:
 *   ga = sqrt(1 + cos(phi) * cos(lambda/2))
 *   gx = cos(phi) * sin(lambda/2) / ga
 *   gy = sin(phi) / ga
 *   pixel_x = width/2 + gx * width/2
 *   pixel_y = height/2 - gy * height/2
 *
 * Where phi = latitude (galactic), lambda = longitude (galactic).
 */

import sharp from 'sharp';
import { readFileSync } from 'fs';

// To re-run this script, first download the source panorama:
//   curl -L -o public/milky-way/gaia-color.png \
//     "https://www.esa.int/var/esa/storage/images/esa_multimedia/images/2018/04/gaia_s_sky_in_colour2/17475369-5-eng-GB/Gaia_s_sky_in_colour.png"
//
// Credit: ESA/Gaia/DPAC — CC BY-SA 3.0 IGO

const INPUT = 'public/milky-way/gaia-color.png';
const OUTPUT = 'public/milky-way/milky-way.jpg';
const OUT_W = 2048;
const OUT_H = 1024;

async function main() {
  console.log('Reading source Hammer image...');
  const src = sharp(INPUT);
  const { width: srcW, height: srcH } = await src.metadata();
  const raw = await src.removeAlpha().raw().toBuffer();

  console.log(`Source: ${srcW}x${srcH}, converting to equirect ${OUT_W}x${OUT_H}...`);

  const out = Buffer.alloc(OUT_W * OUT_H * 3);

  for (let j = 0; j < OUT_H; j++) {
    // Equirectangular: y maps to latitude phi in [-pi/2, pi/2]
    const phi = (0.5 - (j + 0.5) / OUT_H) * Math.PI; // +pi/2 at top, -pi/2 at bottom

    for (let i = 0; i < OUT_W; i++) {
      // Equirectangular: x maps to longitude lambda in [-pi, pi]
      const lambda = ((i + 0.5) / OUT_W - 0.5) * 2 * Math.PI;

      // Hammer projection: map (phi, lambda) to normalised image coordinates
      const cosPhi = Math.cos(phi);
      const halfLam = lambda / 2;
      const ga = Math.sqrt(1 + cosPhi * Math.cos(halfLam));
      const gx = cosPhi * Math.sin(halfLam) / ga; // range [-1, 1]
      const gy = Math.sin(phi) / ga;               // range [-1, 1]

      // Map to source pixel coordinates
      const sx = srcW / 2 + gx * srcW / 2;
      const sy = srcH / 2 - gy * srcH / 2;

      // Bilinear sample from source
      const sx0 = Math.floor(sx);
      const sy0 = Math.floor(sy);
      const fx = sx - sx0;
      const fy = sy - sy0;

      const sample = (x, y) => {
        const cx = Math.max(0, Math.min(srcW - 1, x));
        const cy = Math.max(0, Math.min(srcH - 1, y));
        const idx = (cy * srcW + cx) * 3;
        return [raw[idx], raw[idx + 1], raw[idx + 2]];
      };

      const [r00, g00, b00] = sample(sx0, sy0);
      const [r10, g10, b10] = sample(sx0 + 1, sy0);
      const [r01, g01, b01] = sample(sx0, sy0 + 1);
      const [r11, g11, b11] = sample(sx0 + 1, sy0 + 1);

      const lerp = (a, b, t) => a + (b - a) * t;
      const r = lerp(lerp(r00, r10, fx), lerp(r01, r11, fx), fy);
      const g = lerp(lerp(g00, g10, fx), lerp(g01, g11, fx), fy);
      const b = lerp(lerp(b00, b10, fx), lerp(b01, b11, fx), fy);

      const outIdx = (j * OUT_W + i) * 3;
      out[outIdx] = Math.round(r);
      out[outIdx + 1] = Math.round(g);
      out[outIdx + 2] = Math.round(b);
    }
  }

  await sharp(out, { raw: { width: OUT_W, height: OUT_H, channels: 3 } })
    .jpeg({ quality: 88 })
    .toFile(OUTPUT);

  console.log(`Done → ${OUTPUT}`);
}

main().catch(console.error);
