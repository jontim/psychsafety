// Audition and save Octave voices for every speaking character.
// Usage:
//   HUME_API_KEY=... npx tsx scripts/design-voices.ts --check                  -> which library voice each character resolves to
//   HUME_API_KEY=... npx tsx scripts/design-voices.ts --list
//   HUME_API_KEY=... npx tsx scripts/design-voices.ts --audition [id ...]     -> art/voices/<id>-<n>.mp3 + candidates.json
//   HUME_API_KEY=... npx tsx scripts/design-voices.ts --save soraya=2 tav=1  -> saves candidate n under the pack's voice name
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { HumeClient } from "hume";
import { shadowFell as world } from "../src/worlds/shadow-fell/world.js";
import { formatResolutions, loadVoiceLibrary, resolveVoices } from "../src/server/voices.js";

const SAMPLE: Record<string, string> = {
  scribe: "The Stormwardens present: what the ballad did not sing.",
  soraya: "Alive, silent, and mine. Kaveh, bind them.",
  navid: "These are our guests, do not be so rude. They have come to help us, no?",
  indigo: "Your father's cutlery has opinions, Caliphina. I have none left.",
  rashan: "Guests, then. The worst kind.",
  sahir: "And alive to reach trial.",
  tav: "Talk, or die. It's your choice. We get paid either way.",
  serena: "You've just confessed in front of a paladin of Tyr.",
  thorbin: "So who did do the planning, lad?",
  varya: "Close the door.",
  brask: "We practise.",
  lyra: "The Concurrence only cuts people off when I ask it really nicely.",
  kael: "Morning. Then you haven't missed anything.",
  heckler: "Do I know you, half-man?",
  "watch-captain": "A wizard goes missing the night your troupe plays, and you would like your carriage back.",
  sleeper: "But it's the middle of the night.",
  visitor: "You're difficult people to catch.",
};

const args = process.argv.slice(2);
const outDir = path.resolve("art/voices");
const candidatesPath = path.join(outDir, "candidates.json");
fs.mkdirSync(outDir, { recursive: true });
const key = process.env.HUME_API_KEY;
if (!key) { console.error("HUME_API_KEY is not set"); process.exit(1); }
const client = new HumeClient({ apiKey: key });

type Candidates = Record<string, { name: string; generationIds: string[] }>;
const loadCandidates = (): Candidates => (fs.existsSync(candidatesPath) ? JSON.parse(fs.readFileSync(candidatesPath, "utf8")) : {});

if (args.includes("--check")) {
  const library = await loadVoiceLibrary(client);
  console.log(`${library.length} custom voices in the library.`);
  console.log(formatResolutions(resolveVoices(world.cast, library)));
  process.exit(0);
}

if (args.includes("--list")) {
  const page = await client.tts.voices.list({ provider: "CUSTOM_VOICE" });
  for await (const v of page) console.log(`${v.name}  (${v.id})`);
  process.exit(0);
}

if (args.includes("--audition")) {
  const ids = args.filter((a) => !a.startsWith("--"));
  const members = world.cast.filter((c) => c.voice.name && (ids.length === 0 || ids.includes(c.id)));
  const candidates = loadCandidates();
  for (const member of members) {
    const text = SAMPLE[member.id] ?? member.lines[0] ?? "Say your line.";
    process.stdout.write(`${member.name}: designing 3 candidates... `);
    const result = await client.tts.synthesizeJson({
      utterances: [{ text, description: member.voice.description }],
      numGenerations: 3,
      format: { type: "mp3" },
    });
    const generationIds: string[] = [];
    result.generations.forEach((g, i) => {
      fs.writeFileSync(path.join(outDir, `${member.id}-${i + 1}.mp3`), Buffer.from(g.audio, "base64"));
      generationIds.push(g.generationId);
    });
    candidates[member.id] = { name: member.voice.name!, generationIds };
    fs.writeFileSync(candidatesPath, JSON.stringify(candidates, null, 2));
    console.log(`saved ${generationIds.length} to art/voices/${member.id}-{1..${generationIds.length}}.mp3`);
  }
  console.log("Listen, then save the ones you like: npx tsx scripts/design-voices.ts --save soraya=2 tav=1");
  process.exit(0);
}

if (args.includes("--save")) {
  const candidates = loadCandidates();
  const picks = args.filter((a) => /^[a-z-]+=\d+$/.test(a));
  if (!picks.length) { console.error("Give picks like soraya=2"); process.exit(1); }
  for (const pick of picks) {
    const [id, n] = pick.split("=") as [string, string];
    const entry = candidates[id];
    const generationId = entry?.generationIds[Number(n) - 1];
    if (!entry || !generationId) { console.error(`${id}: no candidate ${n}; run --audition ${id} first`); continue; }
    const voice = await client.tts.voices.create({ generationId, name: entry.name });
    console.log(`${id}: saved "${voice.name}" (${voice.id})`);
  }
  process.exit(0);
}

console.log("Usage: --check | --list | --audition [ids] | --save id=n ...");
