// Render the world pack's clip manifest through fal's MiniMax H3 Max.
// Usage:
//   FAL_KEY=... npx tsx scripts/render-clips.ts [--dry-run] [--turbo] [--only <character|key|establishing>] [--limit N] [--force]
// Writes public/clips/<key>.mp4. The server serves any clip whose file exists, no manifest edits needed.
import fs from "node:fs";
import path from "node:path";
import { fal } from "@fal-ai/client";
import { shadowFell as world } from "../src/worlds/shadow-fell/world.js";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

const dryRun = flag("--dry-run");
const turbo = flag("--turbo");
const force = flag("--force");
const only = opt("--only");
const limit = Number(opt("--limit") ?? Infinity);
const outDir = path.resolve("public/clips");
fs.mkdirSync(outDir, { recursive: true });

const ENDPOINT = turbo ? "minimax/h3-max-turbo/image-to-video" : "minimax/h3-max/image-to-video";
const TEXT_ENDPOINT = "minimax/h3-max/text-to-video";
// Extra parameters (duration, resolution, aspect ratio) vary by endpoint version; pass them through
// from RENDER_EXTRA as JSON, e.g. RENDER_EXTRA='{"duration":"5","resolution":"768p"}'.
const extra: Record<string, unknown> = process.env.RENDER_EXTRA ? JSON.parse(process.env.RENDER_EXTRA) : {};

const clips = world.clips.filter((c) => {
  if (!only) return true;
  if (only === "establishing") return c.kind === "establishing";
  return c.key === only || c.character === only;
}).filter((c) => force || !fs.existsSync(path.join(outDir, `${c.key}.mp4`))).slice(0, limit);

const seconds = clips.reduce((a, c) => a + (c.kind === "establishing" ? 6 : 5), 0);
console.log(`${clips.length} clips to render (${seconds} s of video), endpoint ${ENDPOINT}`);
console.log(`Rough cost at $0.04 to $0.08 per second: $${(seconds * 0.04).toFixed(2)} to $${(seconds * 0.08).toFixed(2)}`);
if (clips.length === 0) process.exit(0);

if (dryRun) {
  for (const c of clips) console.log(`- ${c.key} [${c.kind}${c.character ? `, ${c.character}` : ""}]: ${c.prompt.slice(0, 90)}...`);
  process.exit(0);
}

const key = process.env.FAL_KEY;
if (!key) { console.error("FAL_KEY is not set"); process.exit(1); }
fal.config({ credentials: key });

const uploaded = new Map<string, string>();
async function portraitUrl(characterId: string): Promise<string | null> {
  // A real still under public/portraits/<id>.png|jpg|webp is the identity reference; SVG placeholders are not.
  const candidates = ["png", "jpg", "jpeg", "webp"].map((ext) => path.resolve("public/portraits", `${characterId}.${ext}`));
  const local = candidates.find((f) => fs.existsSync(f));
  if (!local) return null;
  if (uploaded.has(local)) return uploaded.get(local)!;
  const bytes = fs.readFileSync(local);
  const type = local.endsWith(".png") ? "image/png" : "image/jpeg";
  const url = await fal.storage.upload(new Blob([bytes], { type }));
  uploaded.set(local, url);
  return url;
}

function videoUrl(data: unknown): string | null {
  const d = data as { video?: { url?: string }; videos?: Array<{ url?: string }> };
  return d.video?.url ?? d.videos?.[0]?.url ?? null;
}

for (const clip of clips) {
  const target = path.join(outDir, `${clip.key}.mp4`);
  const image = clip.character ? await portraitUrl(clip.character) : null;
  const endpoint = image ? ENDPOINT : TEXT_ENDPOINT;
  const input: Record<string, unknown> = { prompt: clip.prompt, prompt_expansion_mode: "disabled", ...extra };
  if (image) input.image_url = image;
  process.stdout.write(`${clip.key} via ${endpoint}${image ? " (portrait as first frame)" : ""}... `);
  try {
    const result = await fal.subscribe(endpoint, { input, logs: false });
    const url = videoUrl(result.data);
    if (!url) throw new Error(`no video url in result: ${JSON.stringify(result.data).slice(0, 200)}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download failed ${res.status}`);
    fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
    console.log(`saved ${path.relative(process.cwd(), target)}`);
  } catch (error) {
    console.log(`FAILED: ${(error as Error).message}`);
  }
}
