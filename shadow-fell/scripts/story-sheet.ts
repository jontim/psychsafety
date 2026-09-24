// Write art/story-clips.md: every story clip's key, moment, narration and prompt, for generating in Showrunner
// (or anywhere else) by hand. Drop each result at public/clips/<key>.mp4 and the interlude plays it.
// Usage: npx tsx scripts/story-sheet.ts
import fs from "node:fs";
import path from "node:path";
import { shadowFell } from "../src/worlds/shadow-fell/world.js";

const clips = shadowFell.clips.filter((c) => c.kind === "story");
const lines: string[] = [
  "# Story footage sheet",
  "",
  "One row per clip. Generate each as a six-second, 16:9, photoreal, silent shot in the film's palette (family white and gold, state blue, enemy violet, Omahnd brass and sand), then save it as `public/clips/<key>.mp4`. The interlude plays the file under the Scribe's narration; until then it shows a title card.",
  "",
];
for (const c of clips) {
  const m = c.moment!;
  const where = [m.role, m.beat ? `beat ${m.beat}` : null, m.flag ? `branch ${m.flag}` : null, m.outcome ? `outcome ${m.outcome}` : null].filter(Boolean).join(", ");
  lines.push(`## ${c.key}`, "", `- Plays: ${where}`, `- File: \`public/clips/${c.key}.mp4\``);
  if (c.narration) lines.push(`- The Scribe reads: "${c.narration}"`);
  else lines.push("- The Scribe reads the ending text of that outcome.");
  lines.push("", "```", c.prompt, "```", "");
}
const out = path.resolve("art/story-clips.md");
fs.writeFileSync(out, lines.join("\n"));
console.log(`${clips.length} story clips written to ${path.relative(process.cwd(), out)}`);
