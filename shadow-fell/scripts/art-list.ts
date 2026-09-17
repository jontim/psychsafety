// Prints the art the world pack expects: portraits, reaction clips, establishing shots.
// Usage: npx tsx scripts/art-list.ts [--json]
import { shadowFell as world } from "../src/worlds/shadow-fell/world.js";
import fs from "node:fs";

const json = process.argv.includes("--json");
const counterparts = new Set(world.acts.flatMap((a) => a.beats.map((b) => b.counterpart)));
const portraits = world.cast.filter((c) => c.id !== world.narrator).map((c) => ({ id: c.id, name: c.name, file: c.portrait ?? null, counterpart: counterparts.has(c.id) }));
const reactions = world.clips.filter((c) => c.kind === "reaction");
const establishing = world.clips.filter((c) => c.kind === "establishing");
const rendered = world.clips.filter((c) => c.file).length;

if (json) {
  fs.mkdirSync("art", { recursive: true });
  fs.writeFileSync("art/manifest.json", JSON.stringify({ portraits, clips: world.clips }, null, 2));
  console.log("Wrote art/manifest.json");
} else {
  console.log(`# Art list for ${world.title}\n`);
  console.log(`Portraits: ${portraits.length} (one canonical still each; counterparts also drive live faces later)`);
  for (const p of portraits) console.log(`- ${p.name}${p.counterpart ? " (counterpart)" : ""}: ${p.file ?? "no portrait"}`);
  console.log(`\nReaction clips: ${reactions.length} (${counterparts.size} counterparts x 7 affect tags, about 5 s each), rendered: ${rendered}`);
  for (const id of counterparts) console.log(`- ${world.cast.find((c) => c.id === id)?.name}: ${reactions.filter((c) => c.character === id).map((c) => c.tag).join(", ")}`);
  console.log(`\nEstablishing shots: ${establishing.length} (about 6 s each)`);
  for (const c of establishing) console.log(`- ${c.key}: ${c.prompt.slice(0, 110)}...`);
  console.log(`\nExample reaction prompt:\n  ${reactions[0]?.prompt}`);
}
