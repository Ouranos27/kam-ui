/**
 * Generates the OG image for kam-ui (1200 × 630 px PNG).
 *
 * Aesthetic: "Stellar Cartography" — dark field with luminous phenomena,
 * clinical monospace labels, orbital arcs, and dense star-point fields.
 *
 * Run:  node scripts/generate-og-image.mjs
 * Output: public/og.png
 */

import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = 'C:/Users/phili/.claude/plugins/cache/anthropic-agent-skills/document-skills/f23222824449/skills/canvas-design/canvas-fonts';

// Register fonts
GlobalFonts.registerFromPath(resolve(FONTS_DIR, 'GeistMono-Regular.ttf'), 'GeistMono');
GlobalFonts.registerFromPath(resolve(FONTS_DIR, 'GeistMono-Bold.ttf'), 'GeistMono-Bold');
GlobalFonts.registerFromPath(resolve(FONTS_DIR, 'PoiretOne-Regular.ttf'), 'PoiretOne');

const W = 1200;
const H = 630;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// ── Seeded PRNG ──────────────────────────────────────────────────────
let seed = 42;
function rand() {
  seed = (seed * 16807 + 0) % 2147483647;
  return (seed - 1) / 2147483646;
}

// ── Background: deep space gradient ──────────────────────────────────
const bg = ctx.createLinearGradient(0, 0, W, H);
bg.addColorStop(0, '#050508');
bg.addColorStop(0.5, '#08090f');
bg.addColorStop(1, '#050508');
ctx.fillStyle = bg;
ctx.fillRect(0, 0, W, H);

// ── Subtle noise texture ─────────────────────────────────────────────
for (let i = 0; i < 12000; i++) {
  const x = rand() * W;
  const y = rand() * H;
  const a = rand() * 0.04;
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.fillRect(x, y, 1, 1);
}

// ── Star field: distant points ───────────────────────────────────────
for (let i = 0; i < 280; i++) {
  const x = rand() * W;
  const y = rand() * H;
  const r = rand() * 1.2 + 0.3;
  const brightness = rand() * 0.5 + 0.15;

  // Slight color variation: cool white to faint blue
  const hue = 210 + rand() * 30;
  const sat = rand() * 20;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = `hsla(${hue}, ${sat}%, 90%, ${brightness})`;
  ctx.fill();

  // Tiny glow on brighter stars
  if (brightness > 0.4) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    glow.addColorStop(0, `hsla(${hue}, ${sat}%, 85%, ${brightness * 0.3})`);
    glow.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(x, y, r * 4, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();
  }
}

// ── Orbital arcs: fine elliptical paths ──────────────────────────────
const cx = W * 0.52;
const cy = H * 0.48;

ctx.save();
ctx.translate(cx, cy);

// Multiple concentric orbital rings
const orbits = [
  { rx: 180, ry: 90, rotation: -0.12, dashLen: 4, gap: 12, alpha: 0.08 },
  { rx: 260, ry: 120, rotation: 0.05, dashLen: 2, gap: 18, alpha: 0.06 },
  { rx: 340, ry: 155, rotation: -0.08, dashLen: 6, gap: 10, alpha: 0.05 },
  { rx: 440, ry: 195, rotation: 0.15, dashLen: 3, gap: 20, alpha: 0.04 },
  { rx: 520, ry: 240, rotation: -0.03, dashLen: 2, gap: 24, alpha: 0.03 },
];

for (const orb of orbits) {
  ctx.save();
  ctx.rotate(orb.rotation);
  ctx.setLineDash([orb.dashLen, orb.gap]);
  ctx.strokeStyle = `rgba(180, 200, 255, ${orb.alpha})`;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(0, 0, orb.rx, orb.ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Central glow — the primary phenomenon
const centralGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 160);
centralGlow.addColorStop(0, 'rgba(200, 210, 255, 0.08)');
centralGlow.addColorStop(0.3, 'rgba(160, 180, 240, 0.03)');
centralGlow.addColorStop(1, 'transparent');
ctx.beginPath();
ctx.arc(0, 0, 160, 0, Math.PI * 2);
ctx.fillStyle = centralGlow;
ctx.fill();

// Core bright point
const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 6);
core.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
core.addColorStop(0.5, 'rgba(200, 215, 255, 0.4)');
core.addColorStop(1, 'transparent');
ctx.beginPath();
ctx.arc(0, 0, 6, 0, Math.PI * 2);
ctx.fillStyle = core;
ctx.fill();

ctx.restore();

// ── Coordinate grid lines (faint) ────────────────────────────────────
ctx.setLineDash([1, 8]);
ctx.strokeStyle = 'rgba(120, 140, 180, 0.04)';
ctx.lineWidth = 0.5;

// Horizontal
for (let y = 0; y <= H; y += 63) {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.stroke();
}
// Vertical
for (let x = 0; x <= W; x += 80) {
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, H);
  ctx.stroke();
}
ctx.setLineDash([]);

// ── Small cluster: dense point cloud (lower right) ───────────────────
for (let i = 0; i < 60; i++) {
  const angle = rand() * Math.PI * 2;
  const dist = rand() * 45 + 5;
  const px = 920 + Math.cos(angle) * dist;
  const py = 420 + Math.sin(angle) * dist;
  const pr = rand() * 0.8 + 0.2;
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(200, 210, 240, ${rand() * 0.4 + 0.1})`;
  ctx.fill();
}

// ── Typography: title ────────────────────────────────────────────────

// "kam—ui" — main identity mark
ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
ctx.font = '42px PoiretOne';
ctx.textAlign = 'left';
ctx.textBaseline = 'alphabetic';
ctx.fillText('kam\u2014ui', 72, 100);

// Subtitle line
ctx.fillStyle = 'rgba(180, 190, 210, 0.45)';
ctx.font = '11px GeistMono';
ctx.letterSpacing = '3px';
ctx.fillText('MOTION REGISTRY', 74, 122);
ctx.letterSpacing = '0px';

// ── Bottom annotation band ───────────────────────────────────────────

// Thin rule
ctx.strokeStyle = 'rgba(180, 200, 255, 0.08)';
ctx.lineWidth = 0.5;
ctx.beginPath();
ctx.moveTo(72, 548);
ctx.lineTo(W - 72, 548);
ctx.stroke();

// Labels
ctx.fillStyle = 'rgba(160, 170, 190, 0.4)';
ctx.font = '10px GeistMono';
ctx.textAlign = 'left';
ctx.fillText('ANIMATED BACKGROUNDS FOR REACT', 72, 572);

ctx.textAlign = 'center';
ctx.fillText('WEBGL \u00B7 CSS \u00B7 SHADCN CLI', W / 2, 572);

ctx.textAlign = 'right';
ctx.fillText('ui.philippekam.dev', W - 72, 572);

// Small install hint — monospace, clinical
ctx.textAlign = 'left';
ctx.fillStyle = 'rgba(160, 170, 190, 0.25)';
ctx.font = '9px GeistMono';
ctx.fillText('npx shadcn@latest add https://ui.philippekam.dev/r/<component>.json', 72, 594);

// ── Corner reference markers ─────────────────────────────────────────
const markerLen = 12;
const markerInset = 48;
ctx.strokeStyle = 'rgba(180, 200, 255, 0.12)';
ctx.lineWidth = 0.8;

// Top-left
ctx.beginPath();
ctx.moveTo(markerInset, markerInset + markerLen);
ctx.lineTo(markerInset, markerInset);
ctx.lineTo(markerInset + markerLen, markerInset);
ctx.stroke();

// Top-right
ctx.beginPath();
ctx.moveTo(W - markerInset - markerLen, markerInset);
ctx.lineTo(W - markerInset, markerInset);
ctx.lineTo(W - markerInset, markerInset + markerLen);
ctx.stroke();

// Bottom-left
ctx.beginPath();
ctx.moveTo(markerInset, H - markerInset - markerLen);
ctx.lineTo(markerInset, H - markerInset);
ctx.lineTo(markerInset + markerLen, H - markerInset);
ctx.stroke();

// Bottom-right
ctx.beginPath();
ctx.moveTo(W - markerInset - markerLen, H - markerInset);
ctx.lineTo(W - markerInset, H - markerInset);
ctx.lineTo(W - markerInset, H - markerInset - markerLen);
ctx.stroke();

// ── Small coordinate labels at corners ───────────────────────────────
ctx.fillStyle = 'rgba(140, 155, 180, 0.2)';
ctx.font = '8px GeistMono';
ctx.textAlign = 'left';
ctx.fillText('0,0', markerInset + 16, markerInset + 10);
ctx.textAlign = 'right';
ctx.fillText(`${W},${H}`, W - markerInset - 16, H - markerInset - 4);

// ── Export ────────────────────────────────────────────────────────────
const buffer = canvas.toBuffer('image/png');
const outPath = resolve(__dirname, '..', 'public', 'og.png');
writeFileSync(outPath, buffer);
console.log(`OG image written → ${outPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
