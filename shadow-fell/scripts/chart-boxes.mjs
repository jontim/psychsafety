#!/usr/bin/env node
// Find the lettering on a chart plate: diff the lettered plate against the clean one and print the box of each
// label block, ready to paste into a world's chart.regions (`box`) with the label's centre (`at`).
//
//   node scripts/chart-boxes.mjs public/chart/plate.jpg public/chart/plate-lettered.jpg [--threshold 40] [--min-area 140] [--pad 8]
//
// Needs ffmpeg and ffprobe. Both plates must be the same size. Letters are merged into words and lines by a
// short dilation; blocks that sit within a few pixels of each other are merged, so a two-line name is one box.
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const files = args.filter((a) => !a.startsWith("--"));
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? Number(args[i + 1]) : dflt; };
const [clean, lettered] = files;
if (!clean || !lettered) { console.error("usage: chart-boxes.mjs <clean> <lettered> [--threshold N] [--min-area N] [--pad N]"); process.exit(2); }
const threshold = opt("threshold", 60), minArea = opt("min-area", 140), pad = opt("pad", 8);
const maxW = opt("max-width", 460), maxH = opt("max-height", 150);

const probe = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", clean], { encoding: "utf8" });
if (probe.status !== 0) { console.error(probe.stderr); process.exit(1); }
const [W, H] = probe.stdout.trim().split(",").map(Number);
const diff = spawnSync("ffmpeg", ["-v", "error", "-i", lettered, "-i", clean, "-filter_complex", "[0:v][1:v]blend=all_mode=difference,format=gray", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"], { maxBuffer: 1 << 28 });
if (diff.status !== 0) { console.error(diff.stderr.toString()); process.exit(1); }
const gray = diff.stdout;
if (gray.length !== W * H) { console.error(`unexpected frame size ${gray.length} for ${W}x${H}`); process.exit(1); }

// Threshold, then dilate (wide sideways, a little down) so letters join into words and lines.
const bin = new Uint8Array(W * H);
for (let i = 0; i < gray.length; i++) bin[i] = gray[i] > threshold ? 1 : 0;
const dil = new Uint8Array(W * H);
const DX = 7, DY = 3;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!bin[y * W + x]) continue;
    for (let yy = Math.max(0, y - DY); yy <= Math.min(H - 1, y + DY); yy++) {
      const row = yy * W;
      for (let xx = Math.max(0, x - DX); xx <= Math.min(W - 1, x + DX); xx++) dil[row + xx] = 1;
    }
  }
}

// Connected components by flood fill.
const seen = new Uint8Array(W * H);
const boxes = [];
const stack = new Int32Array(W * H);
for (let start = 0; start < W * H; start++) {
  if (!dil[start] || seen[start]) continue;
  let sp = 0; stack[sp++] = start; seen[start] = 1;
  let minx = W, miny = H, maxx = 0, maxy = 0, area = 0;
  while (sp) {
    const i = stack[--sp];
    const x = i % W, y = (i - x) / W;
    area++;
    if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
    const n = [i - 1, i + 1, i - W, i + W];
    if (x === 0) n[0] = -1; if (x === W - 1) n[1] = -1;
    for (const j of n) if (j >= 0 && j < W * H && dil[j] && !seen[j]) { seen[j] = 1; stack[sp++] = j; }
  }
  if (area >= minArea) boxes.push({ x: minx, y: miny, w: maxx - minx + 1, h: maxy - miny + 1, area });
}

// Merge blocks that nearly touch (a name's second line, a broken word).
const near = (a, b) => a.x < b.x + b.w + 18 && b.x < a.x + a.w + 18 && a.y < b.y + b.h + 12 && b.y < a.y + a.h + 12;
let merged = true;
while (merged) {
  merged = false;
  for (let i = 0; i < boxes.length && !merged; i++) for (let j = i + 1; j < boxes.length; j++) {
    if (!near(boxes[i], boxes[j])) continue;
    const a = boxes[i], b = boxes[j];
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    const w = Math.max(a.x + a.w, b.x + b.w) - x, h = Math.max(a.y + a.h, b.y + b.h) - y;
    if (w > maxW || h > maxH) continue; // a road or a coastline, not a name
    boxes[i] = { x, y, w, h, area: a.area + b.area };
    boxes.splice(j, 1); merged = true; break;
  }
}
// Names are wider than tall and not hair-thin; drop what is left of roads and edges.
const kept = boxes.filter((b) => b.w <= maxW && b.h <= maxH && b.h >= 10 && b.w >= 24 && b.area / (b.w * b.h) > 0.12);
kept.sort((a, b) => a.y - b.y || a.x - b.x);
boxes.length = 0; boxes.push(...kept);
console.log(`// ${boxes.length} label block(s) on a ${W}x${H} plate (threshold ${threshold}, min area ${minArea}, pad ${pad})`);
boxes.forEach((b, i) => {
  const box = [Math.max(0, b.x - pad), Math.max(0, b.y - pad), Math.min(W, b.x + b.w + pad) - Math.max(0, b.x - pad), Math.min(H, b.y + b.h + pad) - Math.max(0, b.y - pad)];
  const at = [Math.round(b.x + b.w / 2), Math.round(b.y + b.h / 2)];
  console.log(`{ id: "label-${i + 1}", label: "?", at: [${at[0]}, ${at[1]}], box: [${box.join(", ")}] },`);
});
