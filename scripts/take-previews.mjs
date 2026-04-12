/**
 * Capture preview screenshots for each component using Puppeteer (bundled with Node 22+).
 * Falls back to manual screenshots if puppeteer is not available.
 *
 * Run: node scripts/take-previews.mjs
 * Requires the dev server running on localhost:4321
 */
import puppeteer from 'puppeteer';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'previews');
mkdirSync(outDir, { recursive: true });

const components = [
  'radiant-veil',
  'chromatic-leaks',
  'halo-ring',
  'shimmer-ring',
  'crown-glow',
  'chromatic-field',
  'solar-flare',
  'black-hole',
  'mesh-gradient',
  'atmospheric-sky',
  'milky-way',
];

const BASE = process.env.BASE_URL || 'http://localhost:4321';
const VP_W = 1280;
const VP_H = 800;
// Crop area: skip sidebar (272px) and header (41px), capture just the component preview
const CROP = { x: 272, y: 41, width: 960, height: 600 };

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: VP_W, height: VP_H });

  for (const slug of components) {
    const url = `${BASE}/components/${slug}`;
    console.log(`Capturing ${slug}...`);

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      // Wait for WebGL/animations to render
      await new Promise(r => setTimeout(r, 3500));

      await page.screenshot({
        path: join(outDir, `${slug}.jpg`),
        type: 'jpeg',
        quality: 85,
        clip: CROP,
      });

      console.log(`  -> ${slug}.jpg (${CROP.width}x${CROP.height})`);
    } catch (err) {
      console.error(`  FAILED: ${slug} — ${err.message}`);
    }
  }

  await browser.close();
  console.log(`\nDone! Screenshots saved to ${outDir}`);
}

main().catch(console.error);
