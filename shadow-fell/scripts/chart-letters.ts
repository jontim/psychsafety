#!/usr/bin/env -S npx tsx
/**
 * Lift the lettering off a chart's lettered plate into a transparent layer.
 *
 * Jon's clean plate and lettered plate are two renders of the same map, so they differ in more than the names:
 * coastlines, hatching and the dashed region borders all shift a little. Unmasking the lettered plate over the
 * clean one would show those differences as patches. This script keeps only the letters: inside each region's
 * `box` it takes the pixels where the two plates differ strongly, drops the thin hatch and coast fragments by
 * component size, and writes them, in the lettered plate's own ink, to a transparent image the app draws over
 * the clean plate and unmasks name by name.
 *
 *   npx tsx scripts/chart-letters.ts [--out public/chart/letters.webp] [--ink 150] [--dark 115] [--margin 1] [--min-area 18]
 *
 * Needs ffmpeg. Reads the plates and the boxes from the world's chart data.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { shadowFell } from "../src/worlds/shadow-fell/world.js";

const args = process.argv.slice(2);
const opt = (name: string, dflt: string): string => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] ?? dflt : dflt; };
const minArea = Number(opt("min-area", "18"));
const out = opt("out", "public/chart/letters.webp");
const chart = shadowFell.chart;
if (!chart?.plate?.lettered) { console.error("This world has no lettered plate"); process.exit(2); }
const publicFile = (p: string): string => path.join("public", p.replace(/^\//, ""));
const clean = publicFile(chart.plate.clean), lettered = publicFile(chart.plate.lettered);
const W = chart.width, H = chart.height;

function raw(file: string): Buffer {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-vf", `scale=${W}:${H}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1 << 29 });
  if (r.status !== 0) { console.error(r.stderr.toString()); process.exit(1); }
  return r.stdout;
}
const a = raw(clean), b = raw(lettered);
if (a.length !== W * H * 3 || b.length !== W * H * 3) { console.error("plate size mismatch"); process.exit(1); }

// Letters are the lettered plate's own ink inside a region's box, less the ink both plates share. The plates are
// two renders, so the shared coastlines sit a few pixels apart: the clean plate's ink is widened before it is
// subtracted, and what that leaves of a coast or a hatch line (thin, sprawling, sparse) is told from a letter
// (compact) by shape. A letter that crosses a coastline loses a sliver where they cross, and keeps the rest.
const inBox = new Uint8Array(W * H);
const liftAll = new Uint8Array(W * H);
const boxes = chart.regions.filter((r) => r.box).map((r) => r.box!);
for (const r of chart.regions) {
  if (!r.box) continue;
  const [bx, by, bw, bh] = r.box;
  for (let y = Math.max(0, by); y < Math.min(H, by + bh); y++) for (let x = Math.max(0, bx); x < Math.min(W, bx + bw); x++) { inBox[y * W + x] = 1; if (r.lift === "all") liftAll[y * W + x] = 1; }
}
const lum = (buf: Buffer, i: number): number => (buf[i * 3]! * 299 + buf[i * 3 + 1]! * 587 + buf[i * 3 + 2]! * 114) / 1000;
const inkLevel = Number(opt("ink", "150"));
const margin = Number(opt("margin", "1"));
// The clean plate's outline ink, widened a little, is subtracted; its hatching is lighter and handled below.
const darkLevel = Number(opt("dark", "115"));
const cleanInk = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) if (inBox[i] && lum(a, i) < darkLevel) cleanInk[i] = 1;
const dilate = (src: Uint8Array, r: number): Uint8Array => {
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!src[y * W + x]) continue;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && xx < W && yy >= 0 && yy < H) out[yy * W + xx] = 1; }
  }
  return out;
};
const shared = dilate(cleanInk, margin);
const nearCoast = dilate(cleanInk, 6);
const letteredInk = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) if (inBox[i] && lum(b, i) < inkLevel + 15) letteredInk[i] = 1;
// Hatching: a run of ink no more than two pixels tall that carries on sideways for a while. A letter's crossbar is short.
const vrun = new Uint8Array(W * H);
for (let x = 0; x < W; x++) {
  let y = 0;
  while (y < H) {
    if (!letteredInk[y * W + x]) { y++; continue; }
    let y2 = y; while (y2 < H && letteredInk[y2 * W + x]) y2++;
    const run = Math.min(255, y2 - y);
    for (let yy = y; yy < y2; yy++) vrun[yy * W + x] = run;
    y = y2;
  }
}
const hatch = new Uint8Array(W * H);
for (let y = 0; y < H; y++) {
  let x = 0;
  while (x < W) {
    const i = y * W + x;
    if (!letteredInk[i] || vrun[i]! > 2) { x++; continue; }
    let x2 = x; while (x2 < W && letteredInk[y * W + x2] && vrun[y * W + x2]! <= 2) x2++;
    if (x2 - x >= 18) for (let xx = x; xx < x2; xx++) hatch[y * W + xx] = 1;
    x = x2;
  }
}
const inkNoHatch = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) if (inBox[i] && !hatch[i] && lum(b, i) < inkLevel) inkNoHatch[i] = 1;

/** Connected components of a mask, 8-connected, with their box and how many pixels lie near the clean plate's ink. */
interface Comp { members: number[]; w: number; h: number; fill: number; coastal: number; sharedCount: number }
function components(mask: Uint8Array): Comp[] {
  const seen = new Uint8Array(W * H);
  const stack = new Int32Array(W * H);
  const out: Comp[] = [];
  for (let s0 = 0; s0 < W * H; s0++) {
    if (!mask[s0] || seen[s0]) continue;
    let sp = 0; stack[sp++] = s0; seen[s0] = 1;
    const members: number[] = [];
    let minx = W, maxx = 0, miny = H, maxy = 0, coastal = 0, sharedCount = 0;
    while (sp) {
      const i = stack[--sp]!;
      members.push(i);
      if (nearCoast[i]) coastal++;
      if (shared[i]) sharedCount++;
      const x = i % W, y = (i - x) / W;
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
      const n = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W, x > 0 ? i - W - 1 : -1, x < W - 1 ? i - W + 1 : -1, x > 0 ? i + W - 1 : -1, x < W - 1 ? i + W + 1 : -1];
      for (const k of n) if (k >= 0 && k < W * H && mask[k] && !seen[k]) { seen[k] = 1; stack[sp++] = k; }
    }
    const w = maxx - minx + 1, h = maxy - miny + 1;
    out.push({ members, w, h, fill: members.length / (w * h), coastal, sharedCount });
  }
  return out;
}
const letterShaped = (c: Comp): boolean => c.members.length >= minArea && c.h > 2 && !((c.h <= 3 && c.w >= 12) || (c.w <= 3 && c.h >= 12)) && c.w <= 120 && c.h <= 70 && c.fill >= 0.2;

const keep = new Uint8Array(W * H);
let kept = 0, dropped = 0;
// First the whole letters: a component of the lettered plate's ink that is letter-shaped and mostly new ink is kept
// entire, less the clean plate's own ink where a mark of the clean plate crosses it.
for (const c of components(inkNoHatch)) {
  if (!letterShaped(c)) continue;
  const all = liftAll[c.members[0]!] === 1; // a box lifted whole: the clean plate has its own mark under this name
  if (all) { for (const i of c.members) keep[i] = 1; kept++; }
  else if (c.sharedCount < c.members.length * 0.65) { for (const i of c.members) if (!cleanInk[i]) keep[i] = 1; kept++; }
}
// Then what a coastline or a border merged with: subtract the clean plate's ink and judge the pieces.
const cand = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) if (inkNoHatch[i] && !shared[i] && !keep[i]) cand[i] = 1;
for (const c of components(cand)) {
  const coastPiece = c.coastal >= c.members.length * 0.7 && c.fill < 0.3;
  if (letterShaped(c) && !coastPiece) { for (const i of c.members) keep[i] = 1; kept++; } else dropped++;
}
// A stroke cut where a coastline crossed it grows back through the subtracted margin, up to three pixels, but
// never onto the clean plate's own ink; then one pixel into the lettered plate's softer ink for the anti-aliased edges.
for (let pass = 0; pass < 3; pass++) {
  const add: number[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (keep[i] || !shared[i] || (cleanInk[i] && !liftAll[i]) || hatch[i] || !letteredInk[i]) continue;
    let near = 0;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && xx < W && yy >= 0 && yy < H && keep[yy * W + xx]) near = 1; }
    if (near) add.push(i);
  }
  for (const i of add) keep[i] = 1;
}
const grown = new Uint8Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x;
  if (keep[i]) { grown[i] = 1; continue; }
  if (!inBox[i] || (cleanInk[i] && !liftAll[i]) || hatch[i] || lum(b, i) >= inkLevel + 50) continue;
  let near = 0;
  for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && xx < W && yy >= 0 && yy < H && keep[yy * W + xx]) near = 1; }
  grown[i] = near;
}

// Ink from the lettered plate, alpha from the difference with a soft edge, grown one pixel for the anti-aliasing.
const rgba = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) {
  if (!grown[i]) continue;
  // ink from the lettered plate; alpha from how dark it is, so the anti-aliased edges stay soft
  const alpha = Math.max(0, Math.min(255, Math.round(((inkLevel + 50 - lum(b, i)) / 80) * 255)));
  if (alpha <= 0) continue;
  rgba[i * 4] = b[i * 3]!; rgba[i * 4 + 1] = b[i * 3 + 1]!; rgba[i * 4 + 2] = b[i * 3 + 2]!; rgba[i * 4 + 3] = alpha;
}
const enc = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-i", "-", "-frames:v", "1", "-c:v", "libwebp", "-lossless", "1", "-pix_fmt", "yuva420p", out], { input: rgba, maxBuffer: 1 << 29 });
if (enc.status !== 0) { console.error(enc.stderr.toString()); process.exit(1); }
console.log(`${out}: ${boxes.length} box(es), ${kept} letter component(s) kept, ${dropped} fragment(s) dropped`);
