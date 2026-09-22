/**
 * The steering test (Behavioral Canon v1.4 §20): for the same Warden and the same stimulus,
 * force two different canon-valid moves and render a line from each. Identical lines mean the
 * slate is decorative; distinct lines that both still sound like the Warden mean the gate is
 * doing causal work, and the director has a steering surface.
 */
import { z } from "zod";
import type { Slate } from "../engine/director-contract.js";
import type { CanonRuntime } from "../engine/runtime.js";
import { wardenCards, type WardenId } from "./attribution.js";

export interface SteeringPair {
  id: string;
  scenario: string;
  warden: WardenId;
  stimulus: string;
  stimulusLine: string;
  tone: string;
  moves: [string, string];
  lines: [string, string];
  sources: [string, string];
  /** The slate offered one move at +1 or better; the second came from asking for a different one. */
  alternativeSourced?: boolean;
}

export interface SteeringSkip { scenario: string; warden: WardenId; stimulus: string; reason: string }

/** Two distinct canon-valid moves from a slate: the highest-scored two with different wording, both at +1 or better. */
export function chooseMoves(slate: Slate | undefined): [string, string] | null {
  if (!slate) return null;
  const ranked = slate.intentions.filter((i) => i.score >= 1).sort((a, b) => b.score - a.score);
  const picked: string[] = [];
  for (const i of ranked) {
    const t = i.intention.trim();
    if (t && !picked.some((p) => p.toLowerCase() === t.toLowerCase())) picked.push(t);
    if (picked.length === 2) return [picked[0]!, picked[1]!];
  }
  return null;
}

export const SteeringJudgementSchema = z.object({
  pairs: z.array(z.object({
    /** The pair's number as listed, 1-based. */
    index: z.number().int(),
    /** The two lines do materially different things, not merely different wording of one action. */
    distinct: z.boolean(),
    /** Line one carries out move one. */
    enactsFirst: z.boolean(),
    /** Line two carries out move two. */
    enactsSecond: z.boolean(),
    /** Both lines could plausibly be spoken by the named Warden. */
    sameVoice: z.boolean(),
    note: z.string().optional(),
  })),
});
export type SteeringJudgement = z.infer<typeof SteeringJudgementSchema>;
export type JudgedPair = SteeringJudgement["pairs"][number];

export function steeringJudgeSystem(runtime: CanonRuntime): string {
  return [
    "You are an independent evaluator. For one character and one stimulus, a director was told to render a line from move one and then, separately, a line from move two. Both moves are meant to be valid for the character. You will see the character's id, the stimulus, the two moves and the two lines.",
    "For each numbered pair answer, giving its number as index: distinct, whether the two lines do materially different things (a different action, stance or tactic), not merely different wording of the same action; enactsFirst and enactsSecond, whether each line actually carries out its stated move rather than gesturing at it; sameVoice, whether both lines could plausibly be spoken by the named character; note, a few words on what differs or fails.",
    "",
    "## The seven",
    wardenCards(runtime),
  ].join("\n");
}

export function steeringJudgeUser(pairs: SteeringPair[]): string {
  return ["## Pairs", ...pairs.map((p, n) => [
    `${n + 1}. ${p.warden}, answering ${p.tone}: "${p.stimulusLine}"`,
    `Move one: ${p.moves[0]}`,
    `Line one: "${p.lines[0]}"`,
    `Move two: ${p.moves[1]}`,
    `Line two: "${p.lines[1]}"`,
  ].join("\n"))].join("\n\n");
}

export function matchSteering(pairs: SteeringPair[], judgement: SteeringJudgement): { matched: Map<string, JudgedPair>; unmatched: number } {
  const matched = new Map<string, JudgedPair>();
  let unmatched = 0;
  for (const j of judgement.pairs) {
    const p = pairs[j.index - 1];
    if (p) matched.set(p.id, j);
    else unmatched++;
  }
  return { matched, unmatched };
}

export interface SteeringScore {
  pairs: number;
  judged: number;
  unjudged: number;
  skipped: number;
  /** Lines that came back word for word the same for both moves. */
  identical: number;
  distinct: number;
  enacted: number;
  sameVoice: number;
  /** Distinct, both enacted, both in voice: the gate steering the line. */
  causal: number;
  /** Pairs whose second move had to be asked for. */
  alternativeSourced: number;
  perWarden: Record<string, { n: number; causal: number }>;
}

export function scoreSteering(pairs: SteeringPair[], judged: Map<string, JudgedPair>, skips: SteeringSkip[]): SteeringScore {
  const perWarden: SteeringScore["perWarden"] = {};
  let judgedN = 0, distinct = 0, enacted = 0, sameVoice = 0, causal = 0, identical = 0;
  for (const p of pairs) {
    if (p.lines[0].trim() === p.lines[1].trim()) identical++;
    const j = judged.get(p.id);
    if (!j) continue;
    judgedN++;
    const pw = (perWarden[p.warden] ??= { n: 0, causal: 0 });
    pw.n++;
    const isDistinct = j.distinct && p.lines[0].trim() !== p.lines[1].trim();
    if (isDistinct) distinct++;
    if (j.enactsFirst && j.enactsSecond) enacted++;
    if (j.sameVoice) sameVoice++;
    if (isDistinct && j.enactsFirst && j.enactsSecond && j.sameVoice) { causal++; pw.causal++; }
  }
  const rate = (k: number, n: number) => (n ? k / n : 0);
  for (const pw of Object.values(perWarden)) pw.causal = rate(pw.causal, pw.n);
  return { pairs: pairs.length, judged: judgedN, unjudged: pairs.length - judgedN, skipped: skips.length, identical, distinct: rate(distinct, judgedN), enacted: rate(enacted, judgedN), sameVoice: rate(sameVoice, judgedN), causal: rate(causal, judgedN), alternativeSourced: pairs.filter((p) => p.alternativeSourced).length, perWarden };
}

/** Jon's rule: identical lines mean decoration; obvious difference in the same voice means causal work. */
export function steeringVerdict(s: SteeringScore): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  if (!s.judged) return `No pairs were judged (${s.pairs} rendered, ${s.skipped} skipped). The gate remains UNVALIDATED.`;
  const small = s.judged < 20 ? " Preliminary: fewer than twenty pairs." : "";
  if (s.causal >= 0.6) return `The gate does causal work: ${pct(s.causal)} of pairs render two distinct moves, each enacted, both in the Warden's voice (distinct ${pct(s.distinct)}, enacted ${pct(s.enacted)}, same voice ${pct(s.sameVoice)}). Keep it: the director has a steering surface.${small}`;
  if (s.distinct < 0.3) return `The slate is decorative: only ${pct(s.distinct)} of pairs render materially different lines for different moves (${s.identical} word-for-word identical). Kill the gate.${small}`;
  return `Mixed: ${pct(s.distinct)} distinct, ${pct(s.enacted)} enacting both moves, ${pct(s.sameVoice)} in voice, ${pct(s.causal)} all three. The gate steers sometimes; read the examples before deciding.${small}`;
}

export function formatSteeringReport(score: SteeringScore, meta: Record<string, string | number | boolean>, pairs: SteeringPair[], judged: Map<string, JudgedPair>, skips: SteeringSkip[]): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const wardenRows = Object.entries(score.perWarden).map(([w, v]) => `| ${w} | ${v.n} | ${pct(v.causal)} |`);
  const examples = pairs.slice(0, 6).map((p) => {
    const j = judged.get(p.id);
    return [`- ${p.warden} to the ${p.scenario} (${p.tone})${p.alternativeSourced ? ", second move asked for" : ""}:`, `  - move one: ${p.moves[0]}`, `    line: "${p.lines[0]}"`, `  - move two: ${p.moves[1]}`, `    line: "${p.lines[1]}"`, j ? `  - judge: ${j.distinct ? "distinct" : "not distinct"}, ${j.enactsFirst && j.enactsSecond ? "both enacted" : "not both enacted"}, ${j.sameVoice ? "same voice" : "voice slips"}${j.note ? `; ${j.note}` : ""}` : "  - unjudged"].join("\n");
  });
  return [
    "# The steering test",
    "",
    ...Object.entries(meta).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "| pairs | judged | unjudged | skipped | second move asked for | identical | distinct | both enacted | same voice | causal |",
    "|---|---|---|---|---|---|---|---|---|---|",
    `| ${score.pairs} | ${score.judged} | ${score.unjudged} | ${score.skipped} | ${score.alternativeSourced} | ${score.identical} | ${pct(score.distinct)} | ${pct(score.enacted)} | ${pct(score.sameVoice)} | ${pct(score.causal)} |`,
    "",
    `Verdict: ${steeringVerdict(score)}`,
    ...(wardenRows.length ? ["", "## Per Warden: pairs judged, causal rate", "", "| Warden | n | causal |", "|---|---|---|", ...wardenRows] : []),
    "",
    "## Examples",
    "",
    ...examples,
    ...(skips.length ? ["", "## Skipped", "", ...skips.map((s) => `- ${s.warden} to the ${s.scenario} (${s.stimulus}): ${s.reason}`)] : []),
  ].join("\n");
}
