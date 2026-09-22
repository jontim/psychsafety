/**
 * Blind Character Attribution: the eval that decides whether the company's runtime
 * and the scored intention gate produce behavioural discriminability (Behavioral
 * Canon v1.4 §20). Pure parts live here; scripts/eval-attribution.ts runs them.
 *
 * Without the name, can you tell who just did that?
 */
import { z } from "zod";
import { defineWorld, findCast, type World, type Beat } from "../engine/world.js";
import type { CanonRuntime } from "../engine/runtime.js";
import type { TonePreset } from "../engine/mock-ear.js";
import { speechOnly } from "../engine/speech.js";

export const WARDENS = ["tav", "serena", "thorbin", "varya", "brask", "lyra", "kael"] as const;
export type WardenId = (typeof WARDENS)[number];

export type Condition = "A" | "B" | "C";
export interface ConditionSpec { label: string; dossiers: boolean; runtime: boolean; gate: boolean }
/** The three conditions of §20. A is the game as it ran before the runtime: card and dossier. */
export const CONDITIONS: Record<Condition, ConditionSpec> = {
  A: { label: "cast card and dossier, as the game ran before the runtime", dossiers: true, runtime: false, gate: false },
  B: { label: "A plus the relationship, outsider and fallback runtime", dossiers: true, runtime: true, gate: false },
  C: { label: "B plus the scored intention gate", dossiers: true, runtime: true, gate: true },
};

export interface Stimulus { id: string; tone: TonePreset; line: string }
export interface Scenario {
  id: string;
  title: string;
  playerRole: string;
  location: string;
  goal: string;
  notes: string;
  outsider: NonNullable<Beat["outsider"]>;
  stimuli: Stimulus[];
}

/** Two outsiders, each meeting every Warden alone: the interesting classification case and the easy pole. */
export const SCENARIOS: Scenario[] = [
  {
    id: "visitor",
    title: "The visitor, alone with one Warden",
    playerRole: "visitor",
    location: "The poster-covered carriage in a wet town square; one Warden inside it; the visitor at the step with a letter.",
    goal: "Get the Warden to take the letter on your terms without naming your employer.",
    notes: "The player is the charming visitor with polished manners, plausible credentials and an unnamed employer. The Warden is alone; nobody else is in earshot. The Warden answers in their own grammar and must not promote charm to trust or ambiguity to guilt. The employer stays unnamed and the director never names it either.",
    outsider: { mode: "mixed", confidence: "low", note: "Charming, credentialed, employer unnamed: mixed at low confidence. Reclassify only when behaviour supplies evidence; the unnamed employer is an unresolved fact, not villain coding." },
    stimuli: [
      { id: "letter", tone: "warm", line: "You're difficult people to catch. I've come a long way with a letter, and I'd rather hand it to someone who'll read it properly." },
      { id: "terms", tone: "commanding", line: "My principal doesn't care to be named. The terms are generous. I'd take them, if I were you." },
      { id: "posters", tone: "curious", line: "Tell me, what is it you actually do for this troupe? The posters say a great deal and nothing." },
    ],
  },
  {
    id: "captain",
    title: "The watch captain, one Warden in the chair",
    playerRole: "watch-captain",
    location: "The watch house of a Tharcian market town, the morning after the mob; one Warden across the desk; the carriage impounded in the yard.",
    goal: "Get a name written down, or a reason to release the carriage that a magistrate will accept.",
    notes: "The player is a competent, brusque Tharcian captain doing real work; he wants the paperwork closed and the Magisterium out of his town. He is authority, never a predator. The Warden is alone and answers in their own grammar: cooperate, assess jurisdiction, manage face, ask for the concrete rule, and give nothing that reads as a name.",
    outsider: { mode: "authority", confidence: "high", note: "A competent, brusque captain doing real work; never a predator." },
    stimuli: [
      { id: "name", tone: "commanding", line: "A wizard of the Magisterium goes missing the night your troupe plays, and you'd like your carriage back. Start with your name." },
      { id: "witnesses", tone: "deadpan", line: "Twelve witnesses say the big one carried something out of the alley. Explain that to me." },
      { id: "deal", tone: "warm", line: "Look. I want the Magisterium out of my town more than I want you in my cells. Give me something I can write down that isn't a name." },
    ],
  },
];

export function evalBeatId(scenario: string, warden: string): string {
  return `eval-${scenario}-${warden}`;
}

/** The game's world plus one act of eval beats: each scenario with each Warden alone as the counterpart. Never shipped. */
export function evalWorld(base: World, wardens: readonly string[] = WARDENS, scenarios: readonly Scenario[] = SCENARIOS): World {
  const beats: Beat[] = [];
  for (const s of scenarios) {
    for (const w of wardens) {
      const member = findCast(base, w);
      beats.push({
        id: evalBeatId(s.id, w),
        title: `${s.title}: ${member.name.split(" ")[0]}`,
        stance: "being-read",
        playerRole: s.playerRole,
        counterpart: w,
        present: [],
        location: s.location,
        goal: s.goal,
        notes: s.notes,
        opening: "...",
        succeedWhen: "Not judged in this evaluation.",
        failWhen: "Not judged in this evaluation.",
        meters: ["cover", "suspicion", "rapport"],
        maxTurns: 3,
        outsider: s.outsider,
      });
    }
  }
  return defineWorld({ ...base, acts: [...base.acts, { id: "eval", title: "Attribution eval", summary: "Eval-only beats; never shipped in the game.", beats }] });
}

/** Names, tags and character-specific nouns to remove before the judge sees a line. Longest first so full names go before parts. */
export function identityTerms(world: World, wardens: readonly string[] = WARDENS): string[] {
  const terms = new Set<string>(["Souldrinker", "Piss and Moan", "Dawnseeker", "Morrighad", "Tyr", "the Cadence", "Cadence", "Tav", "Tavian", "Tor-Morrighad"]);
  for (const id of wardens) {
    const c = findCast(world, id);
    terms.add(c.name);
    for (const part of c.name.split(/\s+/)) terms.add(part);
  }
  return [...terms].sort((a, b) => b.length - a.length);
}

export function stripIdentity(text: string, terms: string[]): string {
  let t = text;
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(new RegExp(`\\b${escaped}(?:'s)?\\b`, "g"), "[name]");
  }
  return t.replace(/\[name\](?:\s+\[name\])+/g, "[name]");
}

export const JudgementSchema = z.object({
  items: z.array(z.object({
    /** The item's number as listed, 1-based. */
    index: z.number().int(),
    /** Who said it, judging by language, cadence and register alone. */
    voice: z.enum(WARDENS),
    /** Who would choose to do what the item does, judging by behaviour alone. */
    action: z.enum(WARDENS),
    /** Could it be reassigned to another Warden by changing only the name? */
    swappable: z.boolean(),
    swapTo: z.string().optional(),
    /** A rule broken in a way worth a −2, in a few words; absent when the item is clean. */
    violation: z.string().optional(),
  })),
});
export type Judgement = z.infer<typeof JudgementSchema>;
export type JudgedItem = Judgement["items"][number];

export interface JudgeItem { id: string; kind: "line" | "intention"; text: string; situation: string }

/** Map the judge's numbered answers back to item ids; unmatched numbers are dropped and counted. */
export function matchJudgements(items: JudgeItem[], judgement: Judgement): { matched: Map<string, JudgedItem>; unmatched: number } {
  const matched = new Map<string, JudgedItem>();
  let unmatched = 0;
  for (const j of judgement.items) {
    const item = items[j.index - 1];
    if (item) matched.set(item.id, j);
    else unmatched++;
  }
  return { matched, unmatched };
}

export function judgeSystem(runtime: CanonRuntime): string {
  const cards = WARDENS.map((id) => {
    const w = runtime.wardens[id]!;
    return [
      `### ${w.name} (id: ${id})`,
      `${w.role}. ${w.thesis}`,
      ...w.card.map((c) => `- ${c}`),
      `Runtime rule: ${w.runtimeRule}`,
      `Speech: ${w.runtime.speech ?? ""}`,
      `Will not do: ${w.runtime.will_not_do ?? ""}`,
    ].join("\n");
  }).join("\n\n");
  return [
    "You are an independent evaluator of character discriminability. Seven characters, the Stormwardens, each have an execution card below. You will be shown lines and intentions generated for them with every name, dialogue tag and character-specific noun replaced by [name].",
    "For each numbered item answer, giving its number as index: voice, who said it judging by language, cadence and register alone; action, who would choose to do what the item does, judging by behaviour alone; swappable, whether the item could be reassigned to a different Warden by changing only the name, and if so to whom; violation, if the item breaks a card's rule or will-not-do in a way worth a −2, named in a few words, otherwise omitted.",
    "Judge each item on its own. Do not assume the items are evenly distributed across the seven, and do not use the order of the items as a clue.",
    "",
    "## The seven",
    cards,
  ].join("\n");
}

export function judgeUser(items: JudgeItem[]): string {
  return ["## Items", ...items.map((i, n) => `${n + 1}. (${i.kind}; situation: ${i.situation})\n"${i.text}"`)].join("\n\n");
}

export interface Sample {
  id: string;
  condition: Condition;
  scenario: string;
  warden: WardenId;
  stimulus: string;
  stimulusLine: string;
  tone: string;
  speaker: string;
  /** The spoken words, after the speech-only repair. */
  line: string;
  /** What the director rendered before repair, when it differed. */
  rawLine?: string;
  /** Narration the director put in the line instead of the tell. */
  proseLeak?: string;
  acting: string;
  /** The highest-scored intention, when the gate was on. */
  intention?: string;
  intentionScore?: number;
  source: string;
  /** The director's note when the turn fell back to the understudy. */
  note?: string;
}

/** Build a sample from a director's answer, repairing prose into speech and recording the leak. */
export function sampleLine(line: string): { line: string; rawLine?: string; proseLeak?: string } {
  const split = speechOnly(line);
  return split.leaked ? { line: split.text, rawLine: line, ...(split.narration ? { proseLeak: split.narration } : {}) } : { line };
}

export interface ConditionScore {
  condition: Condition;
  label: string;
  n: number;
  /** Turns where the director spoke as someone other than the Warden; excluded from attribution. */
  offSpeaker: number;
  /** Turns the live director did not take (refusals and errors); excluded from attribution. */
  fallbacks: number;
  /** Lines the director rendered as prose with quotation marks or stage directions. */
  proseLeaks: number;
  /** Lines sent to the judge that came back unjudged. */
  unjudged: number;
  voice: number;
  action: number;
  intention?: number;
  swapResistance: number;
  violations: number;
  wrongLineHits: number;
  perWarden: Record<string, { n: number; voice: number; action: number }>;
}

const tokens = (s: string) => new Set(s.toLowerCase().replace(/[^a-z' ]/g, " ").split(/\s+/).filter((t) => t.length > 2));
function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

/** True when a rendered line is, near enough, one of the document's wrong lines. */
export function hitsWrongLine(line: string, runtime: CanonRuntime, threshold = 0.5): boolean {
  const t = tokens(line);
  return Object.values(runtime.wardens).some((w) => w.wrongLines.some((wl) => jaccard(t, tokens(wl.line)) >= threshold));
}

export function scoreCondition(condition: Condition, samples: Sample[], judged: Map<string, JudgedItem>, runtime: CanonRuntime, dry = false): ConditionScore {
  const mine = samples.filter((s) => s.condition === condition);
  const live = dry ? mine : mine.filter((s) => s.source === "claude");
  const onSpeaker = live.filter((s) => s.speaker === s.warden);
  const perWarden: ConditionScore["perWarden"] = {};
  let voice = 0, action = 0, swapResistant = 0, violations = 0, wrongLineHits = 0, judgedLines = 0, unjudged = 0;
  let intentionRight = 0, intentionJudged = 0;
  for (const s of onSpeaker) {
    if (hitsWrongLine(s.line, runtime)) wrongLineHits++;
    const j = judged.get(`${s.id}:line`);
    if (!j) { unjudged++; }
    else {
      const pw = (perWarden[s.warden] ??= { n: 0, voice: 0, action: 0 });
      pw.n++;
      judgedLines++;
      if (j.voice === s.warden) { voice++; pw.voice++; }
      if (j.action === s.warden) { action++; pw.action++; }
      if (!j.swappable) swapResistant++;
      if (j.violation) violations++;
    }
    const ji = judged.get(`${s.id}:intention`);
    if (ji) { intentionJudged++; if (ji.action === s.warden) intentionRight++; }
  }
  const rate = (k: number, n: number) => (n ? k / n : 0);
  for (const pw of Object.values(perWarden)) { pw.voice = rate(pw.voice, pw.n); pw.action = rate(pw.action, pw.n); }
  return {
    condition,
    label: CONDITIONS[condition].label,
    n: mine.length,
    offSpeaker: live.length - onSpeaker.length,
    fallbacks: mine.length - live.length,
    proseLeaks: live.filter((s) => s.rawLine).length,
    unjudged,
    voice: rate(voice, judgedLines),
    action: rate(action, judgedLines),
    ...(intentionJudged ? { intention: rate(intentionRight, intentionJudged) } : {}),
    swapResistance: rate(swapResistant, judgedLines),
    violations,
    wrongLineHits,
    perWarden,
  };
}

/** Jon's rule, §20: C must beat B on attribution, violations and swap resistance, or the gate is ornament. */
export function verdict(scores: Partial<Record<Condition, ConditionScore>>): string {
  const { A, B, C } = scores;
  const lines: string[] = [];
  const ran = (s: ConditionScore | undefined) => s && s.n - s.fallbacks - s.offSpeaker - s.unjudged > 0;
  for (const s of [A, B, C]) if (s && !ran(s)) lines.push(`Condition ${s.condition} did not run: ${s.fallbacks} of ${s.n} turns fell back to the understudy and ${s.unjudged} came back unjudged, so no verdict rests on it.`);
  if ((A && !ran(A)) || (B && !ran(B)) || (C && !ran(C))) return lines.join(" ");
  if (A && B) {
    lines.push(B.voice > A.voice && B.action > A.action
      ? "The runtime earns its tokens: B beats A on both voice and behaviour."
      : "The runtime does not clearly beat the bare card: B fails to beat A on voice and behaviour together.");
  }
  if (B && C) {
    const better = C.voice > B.voice && C.action > B.action && C.swapResistance >= B.swapResistance && C.violations <= B.violations;
    if (better) lines.push("Keep the gate for now: C beats B on voice, behaviour, swap resistance and violations.");
    else if (C.intention !== undefined && C.intention > C.voice) lines.push("The gate picks intentions better than it renders them: the problem is between intention selection and surface realisation. Give the chosen intention stronger rendering constraints rather than more character lore.");
    else lines.push("Kill the gate: C does not beat B on attribution, violations and swap resistance. It is architectural ornament.");
  }
  if (!lines.length) lines.push("Incomplete: run at least two conditions to compare.");
  return lines.join(" ");
}

export function formatReport(scores: ConditionScore[], meta: Record<string, string | number | boolean>, samples: Sample[], terms: string[]): string {
  const pct = (x: number | undefined) => (x === undefined ? "" : `${Math.round(x * 100)}%`);
  const rows = scores.map((s) => `| ${s.condition} | ${s.n} | ${pct(s.voice)} | ${pct(s.action)} | ${pct(s.intention)} | ${pct(s.swapResistance)} | ${s.violations} | ${s.wrongLineHits} | ${s.proseLeaks} | ${s.fallbacks} | ${s.unjudged} | ${s.offSpeaker} |`);
  const notes = samples.filter((x) => x.note).map((x) => `- ${x.condition}, ${x.warden} to the ${x.scenario}: ${x.note}`);
  const byWarden = WARDENS.map((w) => `| ${w} | ${scores.map((s) => `${pct(s.perWarden[w]?.voice)} / ${pct(s.perWarden[w]?.action)}`).join(" | ")} |`);
  const examples = scores.flatMap((s) => samples.filter((x) => x.condition === s.condition && x.source === "claude").slice(0, 2).map((x) => `- ${s.condition}, ${x.warden} to the ${x.scenario} (${x.tone}): "${stripIdentity(x.line, terms)}"${x.proseLeak ? ` [narration moved to the tell: ${stripIdentity(x.proseLeak, terms)}]` : ""}${x.intention ? ` [move: ${stripIdentity(x.intention, terms)}]` : ""}`));
  return [
    "# Blind Character Attribution",
    "",
    ...Object.entries(meta).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "| Condition | n | voice | behaviour | intention | swap resistance | violations | wrong-line hits | prose leaks | fallbacks | unjudged | off-speaker |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...rows,
    "",
    `Verdict: ${verdict(Object.fromEntries(scores.map((s) => [s.condition, s])))}`,
    "",
    "## Per Warden (voice / behaviour)",
    "",
    `| Warden | ${scores.map((s) => s.condition).join(" | ")} |`,
    `|---|${scores.map(() => "---").join("|")}|`,
    ...byWarden,
    "",
    "## Examples, as the judge saw them",
    "",
    ...examples,
    ...(notes.length ? ["", "## Turns the live director did not take", "", ...notes] : []),
  ].join("\n");
}
