/**
 * The steering test (Behavioral Canon v1.4 §20).
 *
 *   npm run eval:steering -- [--wardens serena,thorbin] [--scenarios counsel,visitor] [--stimuli 1]
 *                            [--model claude-opus-5] [--judge claude-sonnet-5] [--out eval/steering] [--dry]
 *
 * For each Warden and stimulus the gated director runs once to fill the slate; the two best distinct
 * moves at +1 or better are then forced one at a time, and a line is rendered from each. A judge says
 * whether the two lines do different things, whether each enacts its move, and whether both still sound
 * like the Warden. Identical lines mean the slate is decorative; distinct lines in the same voice mean
 * the gate is a steering surface.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { shadowFell } from "../src/worlds/shadow-fell/world.js";
import { loadDossiers } from "../src/server/dossiers.js";
import { loadCanonRuntime } from "../src/server/runtime.js";
import { createDirector } from "../src/server/director.js";
import { StorySession } from "../src/engine/session.js";
import { toneVector } from "../src/engine/mock-ear.js";
import { SCENARIOS, WARDENS, evalWorld, evalBeatId, sampleLine, type WardenId } from "../src/eval/attribution.js";
import { chooseMoves, steeringJudgeSystem, steeringJudgeUser, SteeringJudgementSchema, matchSteering, scoreSteering, formatSteeringReport, type SteeringPair, type SteeringSkip, type JudgedPair } from "../src/eval/steering.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name: string, fallback: string): string => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1]! : fallback; };
const has = (name: string) => args.includes(`--${name}`);

const wardens = flag("wardens", WARDENS.join(",")).split(",").map((w) => w.trim()).filter((w): w is WardenId => (WARDENS as readonly string[]).includes(w));
const scenarioIds = flag("scenarios", SCENARIOS.map((s) => s.id).join(",")).split(",").map((s) => s.trim());
const stimuliPer = Number(flag("stimuli", "1"));
const model = flag("model", process.env.DIRECTOR_MODEL ?? "claude-opus-5");
const judgeModel = flag("judge", process.env.JUDGE_MODEL ?? "claude-sonnet-5");
const effort = (process.env.DIRECTOR_EFFORT ?? "medium") as "low" | "medium" | "high" | "xhigh" | "max";
const dry = has("dry") || !process.env.ANTHROPIC_API_KEY;
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.resolve(root, flag("out", path.join("eval", `steering-${stamp}`)));

const scenarios = SCENARIOS.filter((s) => scenarioIds.includes(s.id)).map((s) => ({ ...s, stimuli: s.stimuli.slice(0, stimuliPer) }));
const world = evalWorld(shadowFell, wardens, scenarios);
const brief = fs.readFileSync(path.join(root, "src/canon/brief.md"), "utf8");
const dossiers = loadDossiers(root, shadowFell.id);
const runtime = loadCanonRuntime();
const client = dry ? null : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const direct = createDirector(world, { model, effort, brief, dossiers, runtime, gate: true }, client);

if (dry && !has("dry")) console.log("No ANTHROPIC_API_KEY: running dry with the understudy and a stand-in judge.");
fs.mkdirSync(outDir, { recursive: true });

const pairs: SteeringPair[] = [];
const skips: SteeringSkip[] = [];
for (const s of scenarios) {
  for (const w of wardens) {
    for (const st of s.stimuli) {
      const request = (steer?: string) => {
        const session = new StorySession(world, evalBeatId(s.id, w));
        session.ingest(st.line, toneVector(st.tone));
        return { ...session.directorRequest(), ...(steer ? { steer } : {}) };
      };
      const first = await direct(request());
      if (!dry && first.source !== "claude") { skips.push({ scenario: s.id, warden: w, stimulus: st.id, reason: first.note ?? "the director did not answer" }); continue; }
      const moves = chooseMoves(first.response.slate) ?? (dry ? ["hold the line and ask for the concrete rule", "give a little ground to see what he does with it"] as [string, string] : null);
      if (!moves) { skips.push({ scenario: s.id, warden: w, stimulus: st.id, reason: "fewer than two distinct moves at +1 or better in the slate" }); continue; }
      const one = await direct(request(moves[0]));
      const two = await direct(request(moves[1]));
      if (!dry && (one.source !== "claude" || two.source !== "claude")) { skips.push({ scenario: s.id, warden: w, stimulus: st.id, reason: one.note ?? two.note ?? "a steered turn did not answer" }); continue; }
      const pair: SteeringPair = {
        id: `${s.id}-${w}-${st.id}`, scenario: s.id, warden: w, stimulus: st.id, stimulusLine: st.line, tone: st.tone,
        moves, lines: [sampleLine(one.response.line).line, sampleLine(two.response.line).line], sources: [one.source, two.source],
      };
      pairs.push(pair);
      console.log(`${s.id}/${w}/${st.id}\n  one: ${moves[0]}\n       ${pair.lines[0].slice(0, 100)}\n  two: ${moves[1]}\n       ${pair.lines[1].slice(0, 100)}`);
      fs.writeFileSync(path.join(outDir, "pairs.json"), `${JSON.stringify({ pairs, skips }, null, 2)}\n`);
    }
  }
}

function seeded(seed: number): () => number { let x = seed || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10000) / 10000; }; }
const rand = seeded(20260922);
const judged = new Map<string, JudgedPair>();
for (const s of scenarios) {
  const mine = pairs.filter((p) => p.scenario === s.id);
  if (!mine.length) continue;
  if (!client) {
    for (const [n, p] of mine.entries()) judged.set(p.id, { index: n + 1, distinct: p.lines[0] !== p.lines[1] && rand() < 0.7, enactsFirst: rand() < 0.8, enactsSecond: rand() < 0.8, sameVoice: rand() < 0.9 });
    continue;
  }
  const message = await client.messages.parse({
    model: judgeModel,
    max_tokens: 8000,
    system: [{ type: "text", text: steeringJudgeSystem(runtime), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: steeringJudgeUser(mine) }],
    output_config: { format: zodOutputFormat(SteeringJudgementSchema) },
  });
  if (!message.parsed_output) throw new Error(`Judge returned ${message.stop_reason} for ${s.id}`);
  const { matched, unmatched } = matchSteering(mine, message.parsed_output);
  for (const [id, j] of matched) judged.set(id, j);
  console.log(`judged ${matched.size} of ${mine.length} pairs for ${s.id}${unmatched ? ` (${unmatched} answers matched nothing)` : ""}`);
}
fs.writeFileSync(path.join(outDir, "judgements.json"), `${JSON.stringify([...judged.entries()], null, 2)}\n`);

const score = scoreSteering(pairs, judged, skips);
const report = formatSteeringReport(score, {
  run: stamp, dry, director: dry ? "understudy" : model, judge: dry ? "stand-in (seeded random)" : judgeModel,
  wardens: wardens.join(", "), scenarios: scenarios.map((s) => s.id).join(", "), stimuliPerScenario: stimuliPer,
}, pairs, judged, skips);
fs.writeFileSync(path.join(outDir, "report.md"), `${report}\n`);
console.log(`\n${report}\n\nwritten to ${path.relative(root, outDir)}`);
