/**
 * Blind Character Attribution (Behavioral Canon v1.4 §20).
 *
 *   npm run eval:attribution -- [--conditions A,B,C] [--wardens tav,serena,...] [--scenarios visitor,captain]
 *                               [--stimuli 3] [--model claude-opus-5] [--judge claude-sonnet-5] [--out eval/attribution]
 *                               [--dry] [--resume eval/attribution-<stamp>] [--rejudge]
 *
 * --resume re-judges the samples.json a previous run saved (every director turn is written as it lands),
 * so a judge failure never costs the generation.
 *
 * Every Warden meets each outsider alone, under each condition; the lines come back, lose their
 * names, and an independent judge says who said it (voice), who would do it (behaviour), whether
 * it could be swapped to another Warden by changing only the name, and whether it breaks a rule.
 * --dry runs the understudy and a seeded stand-in judge to exercise the plumbing without keys.
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
import {
  CONDITIONS, SCENARIOS, WARDENS, evalWorld, evalBeatId, identityTerms, stripIdentity, judgeSystem, judgeUser, JudgementSchema,
  matchJudgements, matchPairJudgements, pairJudgeUser, PairJudgementSchema, JudgementLooseSchema, PairJudgementLooseSchema, type Judgement, type LooseJudgement, type PairJudgement, type LoosePairJudgement, sampleLine, scoreCondition, formatReport, type Condition, type Sample, type WardenId, type JudgedItem, type JudgeItem,
} from "../src/eval/attribution.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name: string, fallback: string): string => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1]! : fallback; };
const has = (name: string) => args.includes(`--${name}`);

const conditions = flag("conditions", "A,B,C").split(",").map((c) => c.trim().toUpperCase()).filter((c): c is Condition => c in CONDITIONS);
const wardens = flag("wardens", WARDENS.join(",")).split(",").map((w) => w.trim()).filter((w): w is WardenId => (WARDENS as readonly string[]).includes(w));
const scenarioIds = flag("scenarios", SCENARIOS.map((s) => s.id).join(",")).split(",").map((s) => s.trim());
const stimuliPer = Number(flag("stimuli", "3"));
const model = flag("model", process.env.DIRECTOR_MODEL ?? "claude-opus-5");
const judgeModel = flag("judge", process.env.JUDGE_MODEL ?? "claude-sonnet-5");
const effort = (process.env.DIRECTOR_EFFORT ?? "medium") as "low" | "medium" | "high" | "xhigh" | "max";
const dry = has("dry") || !process.env.ANTHROPIC_API_KEY;
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const resume = flag("resume", "");
// --rejudge: with --resume, ignore the saved judgements and judge every saved line again (a judge-side change measured on the same lines).
const rejudge = has("rejudge");
const outDir = path.resolve(root, resume || flag("out", path.join("eval", `attribution-${stamp}`)));
const JUDGE_BATCH = 8;

const scenarios = SCENARIOS.filter((s) => scenarioIds.includes(s.id)).map((s) => ({ ...s, stimuli: s.stimuli.slice(0, stimuliPer) }));
const world = evalWorld(shadowFell, wardens, scenarios);
const brief = fs.readFileSync(path.join(root, "src/canon/brief.md"), "utf8");
const dossiers = loadDossiers(root, shadowFell.id);
const runtime = loadCanonRuntime();
const terms = identityTerms(world, wardens);
const client = dry ? null : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** One judge call with the strict format; when the answer does not fit it (a name outside the seven, a stop before the JSON), one retry with the names left open, checked at matching. Null means those items stay unjudged. */
async function askJudge<S, L>(label: string, user: string, strict: S, loose: L): Promise<unknown | null> {
  const call = (format: unknown) => client!.messages.parse({
    model: judgeModel,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: [{ type: "text", text: judgeSystem(runtime), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
    output_config: { format: format as never },
  });
  try {
    const m = await call(strict);
    if (m.parsed_output) return m.parsed_output;
    console.log(`judge returned ${m.stop_reason} for ${label}; retrying once with the names left open`);
  } catch (e) {
    console.log(`judge answer for ${label} did not fit the format (${String((e as Error).message).split("\n")[0].slice(0, 120)}); retrying once with the names left open`);
  }
  try {
    const m = await call(loose);
    if (m.parsed_output) return m.parsed_output;
    console.log(`judge returned ${m.stop_reason} for ${label} on the retry; those items stay unjudged`);
  } catch (e) {
    console.log(`judge retry for ${label} failed (${String((e as Error).message).split("\n")[0].slice(0, 120)}); those items stay unjudged`);
  }
  return null;
}

if (dry && !has("dry")) console.log("No ANTHROPIC_API_KEY: running dry with the understudy and a stand-in judge.");
fs.mkdirSync(outDir, { recursive: true });

const samples: Sample[] = resume ? (JSON.parse(fs.readFileSync(path.join(outDir, "samples.json"), "utf8")) as Sample[]) : [];
if (resume) { const present = [...new Set(samples.map((s) => s.condition))]; conditions.splice(0, conditions.length, ...conditions.filter((c) => present.includes(c))); }
if (resume) console.log(`resuming from ${path.relative(root, outDir)}: ${samples.length} saved samples, judging only`);
for (const condition of resume ? [] : conditions) {
  const spec = CONDITIONS[condition];
  const direct = createDirector(world, { model, effort, brief, dossiers: spec.dossiers ? dossiers : {}, runtime: spec.runtime ? runtime : undefined, gate: spec.gate }, client);
  for (const s of scenarios) {
    for (const w of wardens) {
      for (const st of s.stimuli) {
        const session = new StorySession(world, evalBeatId(s.id, w));
        session.ingest(st.line, toneVector(st.tone));
        const turn = await direct(session.directorRequest());
        const r = turn.response;
        const best = r.slate.intentions.length ? [...r.slate.intentions].sort((a, b) => b.score - a.score)[0] : undefined;
        const sample: Sample = {
          id: `${condition}-${s.id}-${w}-${st.id}`, condition, scenario: s.id, warden: w, stimulus: st.id, stimulusLine: st.line, tone: st.tone,
          speaker: r.speaker, ...sampleLine(r.line), acting: r.acting, source: turn.source, ...(turn.note ? { note: turn.note } : {}),
          ...(best ? { intention: best.intention, intentionScore: best.score } : {}),
        };
        samples.push(sample);
        console.log(`[${condition}] ${s.id}/${w}/${st.id} (${turn.source}${turn.note ? `: ${turn.note}` : ""}) ${r.speaker}: ${r.line.slice(0, 90)}`);
        fs.writeFileSync(path.join(outDir, "samples.json"), `${JSON.stringify(samples, null, 2)}\n`);
      }
    }
  }
}

/** One judge call per condition and scenario, items shuffled so order is no clue. */
function seeded(seed: number): () => number { let x = seed || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10000) / 10000; }; }
const rand = seeded(20260922);
const judgementsFile = path.join(outDir, "judgements.json");
const judged = new Map<string, JudgedItem>(resume && !rejudge && fs.existsSync(judgementsFile) ? (JSON.parse(fs.readFileSync(judgementsFile, "utf8")) as Array<[string, JudgedItem]>) : []);
if (judged.size) console.log(`${judged.size} judgements already saved; judging only what is missing`);
for (const condition of conditions) {
  for (const s of scenarios) {
    const mine = samples.filter((x) => x.condition === condition && x.scenario === s.id && x.speaker === x.warden && (dry || x.source === "claude"));
    const items: JudgeItem[] = mine.filter((x) => !judged.has(`${x.id}:line`)).flatMap((x) => {
      const situation = `${s.title.split(",")[0]} says, ${x.tone}: "${x.stimulusLine}"`;
      const out: JudgeItem[] = [{ id: `${x.id}:line`, kind: "line", text: stripIdentity(x.line, terms), situation }];
      if (x.intention) out.push({ id: `${x.id}:intention`, kind: "intention", text: stripIdentity(x.intention, terms), situation });
      return out;
    });
    for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [items[i], items[j]] = [items[j]!, items[i]!]; }
    if (!items.length) continue;
    if (!client) {
      for (const [n, it] of items.entries()) judged.set(it.id, { index: n + 1, voice: wardens[Math.floor(rand() * wardens.length)]!, action: wardens[Math.floor(rand() * wardens.length)]!, swappable: rand() < 0.5 });
      continue;
    }
    let matchedTotal = 0, unmatchedTotal = 0;
    for (let start = 0; start < items.length; start += JUDGE_BATCH) {
      const batch = items.slice(start, start + JUDGE_BATCH);
      const answer = await askJudge(`${condition}/${s.id} items ${start + 1} to ${start + batch.length}`, judgeUser(batch), zodOutputFormat(JudgementSchema), zodOutputFormat(JudgementLooseSchema));
      if (!answer) continue;
      const { matched, unmatched } = matchJudgements(batch, answer as Judgement | LooseJudgement);
      for (const [id, it] of matched) judged.set(id, it);
      fs.writeFileSync(judgementsFile, `${JSON.stringify([...judged.entries()], null, 2)}\n`);
      matchedTotal += matched.size;
      unmatchedTotal += unmatched;
    }
    console.log(`judged ${matchedTotal} of ${items.length} items for ${condition}/${s.id}${unmatchedTotal ? ` (${unmatchedTotal} answers matched nothing)` : ""}`);
  }
}
fs.writeFileSync(judgementsFile, `${JSON.stringify([...judged.entries()], null, 2)}\n`);


// The forced pair: for each collision scenario, the pair's own lines are judged again as a binary choice between the two.
const pairFile = path.join(outDir, "pair-judgements.json");
const pairJudged = new Map<string, WardenId>(resume && !rejudge && fs.existsSync(pairFile) ? (JSON.parse(fs.readFileSync(pairFile, "utf8")) as Array<[string, WardenId]>) : []);
for (const condition of conditions) {
  for (const s of scenarios) {
    if (!s.pair) continue;
    const own = samples.filter((x) => x.condition === condition && x.scenario === s.id && x.speaker === x.warden && (s.pair as readonly string[]).includes(x.warden) && (dry || x.source === "claude") && !pairJudged.has(`${x.id}:pair`));
    const items: JudgeItem[] = own.map((x) => ({ id: `${x.id}:pair`, kind: "line", text: stripIdentity(x.line, terms), situation: `${s.title.split(",")[0]} says, ${x.tone}: "${x.stimulusLine}"` }));
    for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [items[i], items[j]] = [items[j]!, items[i]!]; }
    if (!items.length) continue;
    if (!client) { for (const it of items) pairJudged.set(it.id, s.pair[Math.floor(rand() * 2)]!); continue; }
    let done = 0;
    for (let start = 0; start < items.length; start += JUDGE_BATCH) {
      const batch = items.slice(start, start + JUDGE_BATCH);
      const answer = await askJudge(`forced pair ${condition}/${s.id} items ${start + 1} to ${start + batch.length}`, pairJudgeUser(batch, s.pair, runtime), zodOutputFormat(PairJudgementSchema), zodOutputFormat(PairJudgementLooseSchema));
      if (!answer) continue;
      const { matched } = matchPairJudgements(batch, s.pair, answer as PairJudgement | LoosePairJudgement);
      for (const [id, w] of matched) pairJudged.set(id, w);
      fs.writeFileSync(pairFile, `${JSON.stringify([...pairJudged.entries()], null, 2)}\n`);
      done += matched.size;
    }
    console.log(`forced pair ${s.pair.join(" or ")}: judged ${done} of ${items.length} lines for ${condition}/${s.id}`);
  }
}
fs.writeFileSync(pairFile, `${JSON.stringify([...pairJudged.entries()], null, 2)}\n`);

const scores = conditions.map((c) => scoreCondition(c, samples, judged, runtime, dry, scenarios, pairJudged));
const report = formatReport(scores, {
  run: stamp, dry, director: dry ? "understudy" : model, judge: dry ? "stand-in (seeded random)" : judgeModel,
  conditions: conditions.map((c) => `${c} (${CONDITIONS[c].label})`).join("; "), wardens: wardens.join(", "), scenarios: scenarios.map((s) => s.id).join(", "), stimuliPerScenario: stimuliPer, resumed: Boolean(resume), rejudged: rejudge,
  identityTermsStripped: terms.length,
}, samples, terms);
fs.writeFileSync(path.join(outDir, "report.md"), `${report}\n`);
console.log(`\n${report}\n\nwritten to ${path.relative(root, outDir)}`);
