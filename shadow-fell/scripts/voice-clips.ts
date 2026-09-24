// Bake the Scribe's narration into the rendered story clips, so the files stand alone.
// Usage: npx tsx scripts/voice-clips.ts [--dry-run] [--only <key>] [--force]
// Needs HUME_API_KEY in .env and ffmpeg/ffprobe on PATH. For each story clip with a rendered
// public/clips/<key>.mp4: synthesise the narration with Octave in the Scribe's voice, loop the
// footage to the narration's length, replace the audio track, keep the silent original as
// <key>.raw.mp4 and write a <key>.voiced marker. The server reports voiced clips and the
// interlude plays them with sound instead of speaking over them.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { HumeClient } from "hume";
import { shadowFell as world } from "../src/worlds/shadow-fell/world.js";
import { findCast } from "../src/engine/world.js";
import { speak } from "../src/server/tts.js";
import { createVoiceDirectory } from "../src/server/voices.js";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const dryRun = flag("--dry-run");
const force = flag("--force");
const only = opt("--only");
const dir = path.resolve("public/clips");

function have(bin: string): boolean {
  try { execFileSync(bin, ["-version"], { stdio: "ignore" }); return true; } catch { return false; }
}
function seconds(file: string): number {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim();
  return Number(out) || 0;
}

/** The words for a clip: its narration, or the ending text of the outcome it plays for. */
function wordsFor(clip: (typeof world.clips)[number]): string | null {
  if (clip.narration) return clip.narration;
  const outcome = clip.moment?.outcome;
  if (!outcome) return null;
  for (const act of world.acts) for (const beat of act.beats) {
    const o = beat.outcomes?.[outcome];
    if (o && o.next === null && o.ending && (!clip.moment?.beat || clip.moment.beat === beat.id)) return o.ending;
  }
  return null;
}

const jobs = world.clips
  .filter((c) => c.kind === "story" && (!only || c.key === only))
  .map((c) => ({ clip: c, text: wordsFor(c), mp4: path.join(dir, `${c.key}.mp4`), marker: path.join(dir, `${c.key}.voiced`) }))
  .filter((j) => j.text && fs.existsSync(j.mp4) && (force || !fs.existsSync(j.marker)));

console.log(`${jobs.length} story clip(s) to voice${only ? ` (only ${only})` : ""}.`);
if (dryRun) { for (const j of jobs) console.log(`- ${j.clip.key}: "${j.text!.slice(0, 80)}..."`); process.exit(0); }
if (jobs.length === 0) process.exit(0);
if (!have("ffmpeg") || !have("ffprobe")) { console.error("ffmpeg and ffprobe are needed (brew install ffmpeg)."); process.exit(1); }
const key = process.env.HUME_API_KEY;
if (!key) { console.error("HUME_API_KEY is not set in .env"); process.exit(1); }

const hume = new HumeClient({ apiKey: key });
const voices = createVoiceDirectory(hume);
await voices.refresh();
const scribe = findCast(world, world.narrator ?? "scribe");
const voice = voices.voiceFor(scribe);
console.log(`Narrator: ${scribe.name}, voice "${voice.name ?? "(designed from description)"}".`);

for (const j of jobs) {
  process.stdout.write(`${j.clip.key}... `);
  try {
    const raw = path.join(dir, `${j.clip.key}.raw.mp4`);
    if (!fs.existsSync(raw)) fs.copyFileSync(j.mp4, raw);
    const audio = await speak(hume, { text: j.text!, acting: "unhurried, warm, spare; a scribe reading his own fair copy", voice }, process.env.HUME_DEFAULT_VOICE);
    const mp3 = path.join(dir, `${j.clip.key}.narration.mp3`);
    fs.writeFileSync(mp3, audio);
    const speech = seconds(mp3) + 0.8;
    const footage = seconds(raw) || 6;
    const loops = Math.max(0, Math.ceil(speech / footage) - 1);
    const out = path.join(dir, `${j.clip.key}.tmp.mp4`);
    execFileSync("ffmpeg", ["-y", "-v", "error", "-stream_loop", String(loops), "-i", raw, "-i", mp3, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-t", speech.toFixed(2), "-movflags", "+faststart", out]);
    fs.renameSync(out, j.mp4);
    fs.writeFileSync(j.marker, JSON.stringify({ text: j.text, voice: voice.name ?? null, seconds: speech, at: new Date().toISOString() }, null, 2));
    console.log(`voiced (${speech.toFixed(1)} s, footage looped ${loops + 1}x)`);
  } catch (error) {
    console.log(`FAILED: ${(error as Error).message}`);
  }
}
