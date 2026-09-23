/**
 * Blind Character Attribution: the eval that decides whether the company's runtime
 * and the scored intention gate produce behavioural discriminability (Behavioral
 * Canon v1.4 §20). Pure parts live here; scripts/eval-attribution.ts runs them.
 *
 * Without the name, can you tell who just did that?
 */
import { z } from "zod";
import { defineWorld, findCast, type World, type Beat, type CastMember } from "../engine/world.js";
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
  /** How the judge is told who is speaking to the Warden. */
  outsiderLabel: string;
  playerRole: string;
  location: string;
  goal: string;
  notes: string;
  outsider: NonNullable<Beat["outsider"]>;
  /** The two Wardens this scenario is built to collide; the report scores the pair separately. */
  pair?: [WardenId, WardenId];
  stimuli: Stimulus[];
}

/** Outsiders that exist only for the eval; never shipped in the game. */
export const EVAL_CAST: Array<Pick<CastMember, "id" | "name" | "title" | "faction" | "summary" | "register" | "voice">> = [
  {
    id: "eval-penitent", name: "The Penitent", title: "A farrier with a hidden runaway", faction: "Tharcia",
    summary: "A frightened farrier who hid a runaway from the Magisterium's men and now believes he has doomed his family; he asks the Warden what a decent man does next.",
    register: "Halting, apologetic, quick to agree with whoever spoke last.", voice: { description: "A frightened man in his forties, thin voice" },
  },
  {
    id: "eval-liar", name: "The Factor", title: "A smooth talker with a plausible story", faction: "unknown",
    summary: "A well-dressed factor with a story about a lost consignment and a reward; every detail plausible and one of them false, and he does not know which one the Warden will test.",
    register: "Fluent, warm, unhurried; answers a question with a better question.", voice: { description: "A confident, cultured man, easy laugh" },
  },
  {
    id: "eval-farmer", name: "The Hill Farmer", title: "A farmer with an anomaly on his land", faction: "Tharcia",
    summary: "A hill farmer who has walked since dawn because the beck below his fields has run uphill for three nights and the alders along it have turned to face the same way.",
    register: "Plain, worried, precise about what he saw and vague about what it means.", voice: { description: "A weathered man, slow, careful" },
  },
  {
    id: "eval-regular", name: "The Regular", title: "A tavern regular with a wager and a plan", faction: "Tharcia",
    summary: "A tavern regular with a coin on the barrel-walk, a card game upstairs he says nobody can join, an alias nobody believes and a plan involving the mayor's goose; harmless, delighted with himself, and one person short.",
    register: "Quick, conspiratorial, over-familiar; every sentence an invitation or a dare.", voice: { description: "A cheerful man, fast, a little drunk" },
  },
  {
    id: "eval-runaway", name: "The Runaway", title: "A frightened runaway from a Magisterium holding", faction: "unknown",
    summary: "A young runaway from a Magisterium holding, hurt, hungry and expecting to be sent back; every kindness is a trap until proven otherwise.",
    register: "Short, flinching, braced for the blow; braver than they sound.", voice: { description: "A young voice, hoarse, guarded" },
  },
];

/** Outsiders meeting every Warden alone: the §19 poles first, then the collisions Jon named. */
export const SCENARIOS: Scenario[] = [
  {
    id: "visitor",
    title: "The visitor, alone with one Warden",
    outsiderLabel: "a charming visitor with an unnamed employer",
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
    outsiderLabel: "a competent, brusque watch captain",
    playerRole: "watch-captain",
    location: "The watch house of a Tharcian market town, the morning after the mob; one Warden across the desk; the carriage impounded in the yard.",
    goal: "Get a name written down, or a reason to release the carriage that a magistrate will accept.",
    notes: "The player is a competent, brusque Tharcian captain doing real work; he wants the paperwork closed and the Magisterium out of his town. He is authority, never a predator. The Warden is alone and answers in their own grammar: cooperate, assess jurisdiction, manage face, ask for the concrete rule, and give nothing that reads as a name.",
    outsider: { mode: "authority", confidence: "high", note: "A competent, brusque captain doing real work; never a predator." },
    pair: ["serena", "varya"],
    stimuli: [
      { id: "name", tone: "commanding", line: "A wizard of the Magisterium goes missing the night your troupe plays, and you'd like your carriage back. Start with your name." },
      { id: "witnesses", tone: "deadpan", line: "Twelve witnesses say the big one carried something out of the alley. Explain that to me." },
      { id: "deal", tone: "warm", line: "Look. I want the Magisterium out of my town more than I want you in my cells. Give me something I can write down that isn't a name." },
    ],
  },
  {
    id: "counsel",
    title: "The penitent, asking one Warden what to do",
    outsiderLabel: "a frightened farrier asking for moral counsel",
    playerRole: "eval-penitent",
    location: "A farrier's yard at dusk, the forge banked; one Warden waiting for a shoe; the farrier turning his cap in his hands.",
    goal: "Get the Warden to tell you what to do about the boy in the hayloft, and to carry the choosing for you.",
    notes: "The player hid a runaway from the Magisterium's men and now believes he has doomed his family. He wants to be told what to do. The Warden is alone and answers in their own grammar; the collision to watch is Serena's justice against Thorbin's counsel. Neither may make the choice for him without cost.",
    outsider: { mode: "vulnerable", confidence: "high", note: "Frightened, decent, asking to be commanded: vulnerable at high confidence. Care must not become authorship." },
    pair: ["serena", "thorbin"],
    stimuli: [
      { id: "hayloft", tone: "anxious", line: "I hid the boy in the hayloft when the red-robes came through. If they come back and find him, my daughters hang for it. Tell me what a decent man does now." },
      { id: "priest", tone: "guilty", line: "The priest says I should give him up and pray. You've seen more of the world than the priest. Is he right?" },
      { id: "word", tone: "anxious", line: "Just say the word and I'll do it. Either word. I can't carry the choosing." },
    ],
  },
  {
    id: "liar",
    title: "The factor, spinning a story to one Warden",
    outsiderLabel: "a smooth factor with a plausible, partly false story",
    playerRole: "eval-liar",
    location: "The common room of a coaching inn, mid-afternoon; one Warden at a corner table; the factor arriving with two cups he did not ask whether to bring.",
    goal: "Get the Warden to confirm or deny that the troupe saw the wagons, without letting them test the false detail.",
    notes: "The player is a smooth liar: every detail plausible and one of them false. The Warden is alone and answers in their own grammar; the collision to watch is Tavian's social play against Varya's engineered reveal. Neither may accuse without evidence.",
    outsider: { mode: "mixed", confidence: "low", note: "Fluent, warm, credentialed by his own account: mixed at low confidence until a detail fails." },
    pair: ["tav", "varya"],
    stimuli: [
      { id: "consignment", tone: "warm", line: "A consignment of mine went missing on the north road the week your troupe came through. No accusation, of course. But there's a reward for anyone who saw the wagons, and I'm told you see everything." },
      { id: "warrant", tone: "showman", line: "Your name's on a poster in every town from here to the coast. Mine's on a warrant in one of them, and it's a mistake I'd pay handsomely to have corrected." },
      { id: "pretender", tone: "deadpan", line: "I could tell you who I work for, but then you'd have to pretend you didn't know, and you don't strike me as a good pretender." },
    ],
  },
  {
    id: "anomaly",
    title: "The hill farmer, reporting an anomaly to one Warden",
    outsiderLabel: "a hill farmer reporting something wrong on his land",
    playerRole: "eval-farmer",
    location: "The troupe's camp at first light; one Warden at the fire; a farmer who has walked since dawn, hat in hand.",
    goal: "Get the Warden to come and look, or to tell you what it is from here.",
    notes: "The player reports a physical anomaly with no visible cause. The Warden is alone and answers in their own grammar; the collision to watch is Lyra's arcane systems against Kael's living systems, and the director must not let either explain the anomaly away. Money is not the point.",
    outsider: { mode: "vulnerable", confidence: "medium", note: "A worried, decent man with a true report: vulnerable at medium confidence, and a witness to be believed before he is interpreted." },
    pair: ["lyra", "kael"],
    stimuli: [
      { id: "beck", tone: "anxious", line: "The beck's been running uphill three nights now, and the alders along it have all turned to face the same way. My wife says it's the Magisterium. My boy says it's a god. I'd like it to be neither." },
      { id: "quiet", tone: "curious", line: "It goes quiet near the old marker stone. Not the water, the birds. Everything. Like the field is holding its breath." },
      { id: "wool", tone: "calm", line: "I can pay in wool and not much else. Will you come and look, or will you tell me what it is from here?" },
    ],
  },
  {
    id: "victim",
    title: "The runaway, found by one Warden",
    outsiderLabel: "a frightened runaway from a Magisterium holding",
    playerRole: "eval-runaway",
    location: "A barn the troupe has borrowed for the night; one Warden with a lantern; the runaway in the straw with a stolen loaf.",
    goal: "Find out whether you are safe, and get fed without being sent back.",
    notes: "The player is a frightened victim who expects to be hurt or returned. The Warden is alone and answers in their own grammar; the collision to watch is Thorbin's aftercare against Brask's literal, room-making protection. No gratitude or narration is demanded of the runaway.",
    outsider: { mode: "vulnerable", confidence: "high", note: "Hurt, hungry, braced for the blow: vulnerable at high confidence. Safety first; no disclosure demanded." },
    pair: ["thorbin", "brask"],
    stimuli: [
      { id: "back", tone: "anxious", line: "Don't send me back. I'll work. I can work. Just don't put me on the road where they can see me." },
      { id: "others", tone: "guilty", line: "They said if I ran they'd take it out of the others. I ran anyway. So that's what I am." },
      { id: "plain", tone: "deadpan", line: "Are you going to hurt me? Say it plain if you are. I'm tired of finding out." },
    ],
  },
  {
    id: "board",
    title: "The regular, with a wager, an alias and a plan, to one Warden",
    outsiderLabel: "a tavern regular with a wager, an alias and a plan",
    playerRole: "eval-regular",
    location: "A tavern common room after the show, the quest board by the door; one Warden with a drink; a regular with a coin, an alias and a plan.",
    goal: "Get the Warden to join: the wager, the card game or the goose plan, on your terms.",
    notes: "The scene is ordinary by design: nothing magical, traumatic or morally consequential is available, so a Warden's everyday self is the only signal. The collision to watch is Lyra's participation against Tavian's authorship: whether she enters the bit, escalates it and takes a part in the plan, or stands one level outside it, framing. Nobody is in danger and nobody is lying about anything that matters.",
    outsider: { mode: "nuisance", confidence: "medium", note: "A harmless regular with a dare and a bad alias: nuisance at medium confidence; play, reframe or recruit, never a combat encounter." },
    pair: ["lyra", "tav"],
    stimuli: [
      { id: "wager", tone: "showman", line: "There's a wager on tonight. The regulars say nobody from your troupe could last one round of the barrel-walk without going in the trough. My coin says otherwise. You in, or are you just here for the ale?" },
      { id: "alias", tone: "deadpan", line: "The name's... Corvin. Corvin of the Bay. There's a card game upstairs after the bell, invitation only, and I'm the one who invites. You absolutely cannot come." },
      { id: "goose", tone: "curious", line: "Here's the thing. The mayor's prize goose is judged at noon, the miller's cousin swears the judge is bribed, and we've a plan involving a wig, a wheelbarrow and someone who can keep a straight face. We're one short." },
    ],
  },
];

export function evalBeatId(scenario: string, warden: string): string {
  return `eval-${scenario}-${warden}`;
}

/** The game's world plus the eval outsiders and one act of eval beats: each scenario with each Warden alone. Never shipped. */
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
  const cast = [...base.cast, ...EVAL_CAST.filter((c) => !base.cast.some((b) => b.id === c.id))];
  return defineWorld({ ...base, cast, acts: [...base.acts, { id: "eval", title: "Attribution eval", summary: "Eval-only beats; never shipped in the game.", beats }] });
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
    /** A break of the speaker's language rail, in a few words; a style fault, never a violation. Absent when the line keeps its rail. */
    slip: z.string().optional(),
    /** The tell in the wording that decided voice, in at most a dozen words. */
    why: z.string().optional(),
  })),
});
export type Judgement = z.infer<typeof JudgementSchema>;
export type JudgedItem = Judgement["items"][number];

/** The same answer with the names left open: the retry format when the judge's answer did not fit the enum. Values are checked when matched. */
export const JudgementLooseSchema = z.object({
  items: z.array(z.object({ index: z.number().int(), voice: z.string(), action: z.string(), swappable: z.boolean(), swapTo: z.string().optional(), violation: z.string().optional(), slip: z.string().optional(), why: z.string().optional() })),
});
export type LooseJudgement = z.infer<typeof JudgementLooseSchema>;
export const isWarden = (x: string): x is WardenId => (WARDENS as readonly string[]).includes(x);

export interface JudgeItem { id: string; kind: "line" | "intention"; text: string; situation: string }

/** The forced pair: every item came from one of two named Wardens, and the judge must say which. */
export const PairJudgementSchema = z.object({
  items: z.array(z.object({
    /** The item's number as listed, 1-based. */
    index: z.number().int(),
    /** Which of the two named Wardens produced it, as a cast id. */
    choice: z.enum(WARDENS),
  })),
});
export type PairJudgement = z.infer<typeof PairJudgementSchema>;
/** One forced-pair answer as saved: which two Wardens the line was judged between, and the choice. Keys are `${sampleId}:pair:${a}:${b}`. */
export interface PairChoice { pair: [WardenId, WardenId]; choice: WardenId }
export const pairKey = (sampleId: string, pair: readonly [WardenId, WardenId]) => `${sampleId}:pair:${pair[0]}:${pair[1]}`;

/** The forced pair with the name left open: the retry format; answers outside the pair are dropped when matched. */
export const PairJudgementLooseSchema = z.object({ items: z.array(z.object({ index: z.number().int(), choice: z.string() })) });
export type LoosePairJudgement = z.infer<typeof PairJudgementLooseSchema>;

export function pairJudgeUser(items: JudgeItem[], pair: readonly [WardenId, WardenId], runtime: CanonRuntime): string {
  const [a, b] = pair;
  return [
    `## Forced pair: each item below was produced by either ${runtime.wardens[a]!.name} (id: ${a}) or ${runtime.wardens[b]!.name} (id: ${b}). No other Warden is possible.`,
    "For each numbered item give its number as index and, as choice, which of the two produced it, judging the line as a whole, what it notices and does as much as how it sounds. Do not assume an even split and do not use the order of the items as a clue.",
    "",
    "## Items",
    ...items.map((i, n) => `${n + 1}. (situation: ${i.situation})\n"${i.text}"`),
  ].join("\n\n");
}

/** Map the forced-pair answers back to item ids; answers outside the pair or matching no item are dropped and counted. */
export function matchPairJudgements(items: JudgeItem[], pair: readonly [WardenId, WardenId], judgement: PairJudgement | LoosePairJudgement): { matched: Map<string, WardenId>; unmatched: number } {
  const matched = new Map<string, WardenId>();
  let unmatched = 0;
  for (const j of judgement.items) {
    const item = items[j.index - 1];
    if (item && (pair as readonly string[]).includes(j.choice)) matched.set(item.id, j.choice as WardenId);
    else unmatched++;
  }
  return { matched, unmatched };
}

/** Map the judge's numbered answers back to item ids; unmatched numbers and names outside the seven are dropped and counted. */
export function matchJudgements(items: JudgeItem[], judgement: Judgement | LooseJudgement): { matched: Map<string, JudgedItem>; unmatched: number } {
  const matched = new Map<string, JudgedItem>();
  let unmatched = 0;
  for (const j of judgement.items) {
    const item = items[j.index - 1];
    if (item && isWarden(j.voice) && isWarden(j.action)) matched.set(item.id, { ...j, voice: j.voice, action: j.action });
    else unmatched++;
  }
  return { matched, unmatched };
}

/** The seven cards as the judge sees them: what the runtime says a Warden is, nothing about the scene. */
export function wardenCards(runtime: CanonRuntime): string {
  return WARDENS.map((id) => {
    const w = runtime.wardens[id]!;
    return [
      `### ${w.name} (id: ${id})`,
      `${w.role}. ${w.thesis}`,
      ...w.card.map((c) => `- ${c}`),
      `Runtime rule: ${w.runtimeRule}`,
      `Attention: ${w.runtime.attention ?? ""}`,
      `Speech: ${w.runtime.speech ?? ""}`,
      `Will not do: ${w.runtime.will_not_do ?? ""}`,
      ...(w.languageRail.length ? ["Language rail (binding on every line):", ...w.languageRail.map((l) => `- ${l}`)] : []),
    ].join("\n");
  }).join("\n\n");
}

export function judgeSystem(runtime: CanonRuntime): string {
  return [
    "You are an independent evaluator of character discriminability. Seven characters, the Stormwardens, each have an execution card below. You will be shown lines and moves generated for them with every name, dialogue tag and character-specific noun replaced by [name].",
    "For each numbered item answer, giving its number as index: voice, the Warden whose wording and sentence construction this could plausibly be, judging by language, cadence and register alone and ignoring what is done; action, the Warden whose attention, action and decision this is, ignoring prose style entirely and judging by what the item chooses to notice and to do; swappable, whether the item could be reassigned to a different Warden by changing only the name, and if so to whom; violation, if the item breaks a card's rule or will-not-do in a way worth a −2, named in a few words, otherwise omitted; slip, if the item breaks its speaker's language rail (a conjugated TO BE for Brask, a minimiser for Lyra, slang for Kael), named in a few words, otherwise omitted; why, the tell in the wording that decided voice, in at most a dozen words. A slip is a style fault and never a violation: never list a rail break under violation.",
    "Voice and action are two separate questions with separate evidence, and they often have different answers: a line can sound like one Warden and choose like another. Answer each on its own evidence and never copy one into the other.",
    "A Warden's domain or leadership claim is not evidence of who spoke. Every one of the seven gives counsel and cares for a frightened person, each through the door their attention line names; attribute a counselling or caring line by how it notices and what it chooses, never by who owns counsel or care on paper. A line's grammar is evidence: a Warden with a language rail sounds like that rail, and a rail is never stupidity. A rail is also a fence, and the fence is the stronger evidence: a line that freely does what a rail forbids is not that Warden's. Brask never conjugates TO BE or TO DO and never contracts them, and the other six do both without noticing, so a fluent 'is', 'are', 'was', 'that's', 'I'm' or 'don't' rules Brask out however short the sentences. Never attribute a fluent line to Brask and then report its fluency as his slip: the fluency is the tell that someone else spoke. Name a slip only on a line that is otherwise unmistakably that Warden's. [name] stands for any stripped name, the speaker's own, a companion's, a place's or a nickname, and carries no register: Brask names himself in the third person and the others do not, but a stripped line cannot show the difference, so never attribute on [name] alone.",
    "Judge each item on its own. Do not assume the items are evenly distributed across the seven, and do not use the order of the items as a clue.",
    "",
    "## Telling the seven apart",
    (runtime.guardrails.find((g) => g.startsWith("Shared-care de-duplication")) ?? "").replace(/^Shared-care de-duplication:\s*/, ""),
    "",
    "## The seven",
    wardenCards(runtime),
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
  /** Brask's line before the rail guard, when the guard changed it; style slips are counted on this. */
  railRaw?: string;
  acting: string;
  /** The highest-scored move, when the gate was on. */
  intention?: string;
  intentionScore?: number;
  source: string;
  /** The director's note when the turn fell back to the understudy. */
  note?: string;
}

/** Build a sample's line fields from a director's answer, repairing prose into speech and recording the leak. */
export function sampleLine(line: string): { line: string; rawLine?: string; proseLeak?: string } {
  const split = speechOnly(line);
  return split.leaked ? { line: split.text, rawLine: line, ...(split.narration ? { proseLeak: split.narration } : {}) } : { line };
}

export interface ConditionScore {
  condition: Condition;
  label: string;
  n: number;
  /** Lines the judge actually answered; every rate below is over these. */
  judged: number;
  /** Turns where the director spoke as someone other than the Warden; excluded from attribution. */
  offSpeaker: number;
  /** Turns the live director did not take (refusals and errors); excluded from attribution. */
  fallbacks: number;
  /** Lines the director rendered as prose with quotation marks or stage directions. */
  proseLeaks: number;
  /** Lines sent to the judge that came back unjudged. */
  unjudged: number;
  /** Lines that break their Warden's grammar rules (Brask conjugating). */
  styleSlips: number;
  /** Lines that open on the shared care reflex (sit, eat, you have walked): the family resemblance becoming one voice. */
  careOpeners: number;
  voice: number;
  action: number;
  /** Judged lines where the judge named different Wardens for voice and for behaviour; zero across a run means the behaviour column is not independent. */
  voiceActionSplit: number;
  intention?: number;
  swapResistance: number;
  violations: number;
  /** The judge's named violations, with the line they were named on. */
  violationsNamed: Array<{ warden: WardenId; scenario: string; violation: string; line: string }>;
  /** Lines the rail guard repaired after the director rendered them; style slips are counted before the guard. */
  guardRepairs: number;
  /** Rail breaks the judge named, counted apart from the regex style slips. */
  judgeSlips: number;
  slipsNamed: Array<{ warden: WardenId; scenario: string; slip: string; line: string }>;
  /** The lint's style slips with what each rule matched, on the line as the director rendered it; counted in styleSlips. */
  styleSlipsNamed: Array<{ warden: WardenId; scenario: string; reasons: string[]; line: string }>;
  /** Judged lines the judge gave to another Warden by voice, with the tell it named when it did. */
  misattributions: Array<{ warden: WardenId; scenario: string; guess: WardenId; why?: string; line: string }>;
  wrongLineHits: number;
  /** Accuracy within each Warden's own judged lines. */
  perWarden: Record<string, { n: number; voice: number; action: number }>;
  /** Forced pairs driven by the observed confusions: the misattributed Warden's own lines in that scenario, judged as a choice between them and the Warden they were taken for. */
  confusionPairs: Array<{ scenario: string; pair: [WardenId, WardenId]; n: number; right: number }>;
  /** For scenarios built to collide a pair: voice accuracy on the pair's own lines, and how often each was taken for the other. */
  pairs: Array<{ scenario: string; pair: [WardenId, WardenId]; n: number; voice: number; crossed: number; /** The forced binary choice on the pair's own lines, when it ran. */ forced?: { n: number; right: number } }>;
  /** Judge's wrong voice guesses, counted: who was taken for whom. */
  confusions: Array<{ scenario: string; truth: WardenId; guess: WardenId; count: number }>;
}

const tokens = (s: string) => new Set(s.toLowerCase().replace(/[^a-z' ]/g, " ").split(/\s+/).filter((t) => t.length > 2));
function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

/** Voice rules a line can break by grammar alone; today only Brask's broken Common, by canon. */
export const STYLE_SLIPS: Partial<Record<WardenId, RegExp[]>> = {
  lyra: [
    // minimisers she never uses; "I think" is allowed for genuine uncertainty about a fact, never as a softener on a verdict
    /\b(in my opinion|if you ask me|I'd say|I suppose|I guess|sort of|kind of|a bit|a little|I feel like|it seems|seems like|to be honest)\b/i,
    /\bI think\b[^.?!]*\b(may|might|could|perhaps|maybe|probably|sort of|a bit)\b/i,
    /\b(may|might) have been\b/i,
    // her magic is never method
    /\b(incantation|cast(s|ing)? (a|the) spell|spellcraft)\b/i,
  ],
  kael: [
    // surfer and modern slang he never uses
    /\b(gnarly|rad|dude|bro|awesome|epic|vibes?|chill|totally|stoked|legit)\b/i,
    // smugness
    /\b(obviously|of course|as I said|I told you|told you so|clearly|naturally)\b/i,
    // a prescription of someone else's moral decision; agency, not sentence mood, so an instruction for a living need is his
    /\b(you should|you ought to|do as I say|the (right|decent) thing (to do )?is)\b/i,
    // an investigator's question
    /\b(who sent you|what's your name|papers|prove it|evidence|where were you|state your)\b/i,
    // certainty about what he only perceived
    /\b(definitely|certainly|without (a )?doubt|I'm certain|no doubt)\b/i,
    // a lawyer, a strategist or a moral philosopher
    /\b(jurisdiction|legal|lawful|liab(le|ility)|statute|leverage|incentives?|strateg(y|ic|ically)|tactic(s|al)?|moral(ly|ity)?|ethic(s|al)|philosoph(y|ical))\b/i,
  ],
  brask: [
    // do-support and auxiliary negatives
    /\b(did not|does not|do not|didn't|doesn't|don't|isn't|wasn't|weren't|aren't|won't|will not|would not|wouldn't|couldn't|shouldn't)\b/i,
    // native question frames
    /\b(why|what|where|when|how|who)\s+(is|are|was|were|do|does|did)\b/i,
    // connectors and abstraction he does not produce
    /\b(nevertheless|whereas|even though|given that|insofar|in order to|the fact that|which means|sufficient|necessarily|assum(e|es|ing)|incentives?|presumably|essentially)\b/i,
    // native idioms
    /\b(hill (I|to|I'd) (want to )?die on|read between the lines|ball('s| is) in your court|benefit of the doubt)\b/i,
    // auxiliary contractions
    /\b(I'm|I've|I'll|you're|we're|they're|it's|that's|there's|he's|she's)\b/,
    // common past forms where the rail wants an adverb and the present
    /\b(said|was|were|did|came|went|saw|told|took|brought|knew|thought|got|made)\b/i,
    // the copula is a conjugation of "to be", and he drops it
    /\b(is|are|am)\b/i,
    // an auxiliary opening a question is TO DO or TO BE doing native work
    /(^|[.!?]\s+)(do|does|did|is|are|was|were)\s+(you|he|she|they|we|it|i|that|this|there)\b/i,
    // regular past forms are native; "You make promise. Promise fail."
    /\b(?!need|needs|bed|red|feed|seed|weed|speed|bleed|breed|deed|reed|greed|indeed|shed|hundred|wicked|naked|sacred|tired|hatred|blessed|wretched|beloved|ragged|crooked|rugged)\w{3,}ed\b/i,
  ],
};

/** The vocabulary of domestic tending; three or more distinct words in one of Kael's lines is a drift toward Thorbin. */
const DOMESTIC_TENDING = /\b(soup|stew|broth|porridge|barley|blanket|bread|loaf|cheese|pears?|apples?|milk|eat|chair|sit down|by the door|watch the door)\b/gi;

/** True when a line opens on the shared practical-care reflex: sit, eat, you have walked, you are shaking. */
export function opensOnCare(line: string): boolean {
  const opening = line.split(/\s+/).slice(0, 14).join(" ");
  return /\b(sit|eat|walked since|you're shaking|you are shaking|shaking)\b/i.test(opening);
}

/**
 * What in a line breaks its Warden's language rail: the words a rule matched, or the length of a sentence, one entry per
 * rule broken; empty when the line keeps its rail. The rails are keyed by speaker, so Kael's and Lyra's fluent Common is
 * never measured against Brask's.
 */
export function styleSlipReasons(warden: WardenId, line: string): string[] {
  const reasons: string[] = [];
  for (const re of STYLE_SLIPS[warden] ?? []) {
    const m = line.match(re);
    if (m) reasons.push(m[0].replace(/^[.!?\s]+/, "").trim() || re.source);
  }
  // Kael can feed or water someone; a line that has become mainly domestic tending has drifted into Thorbin.
  if (warden === "kael") {
    const found = new Set((line.match(DOMESTIC_TENDING) ?? []).map((m) => m.toLowerCase()));
    if (found.size >= 3) reasons.push(`domestic tending: ${[...found].join(", ")}`);
  }
  // Lyra's economy: a sentence over thirty words is a lecture.
  if (warden === "lyra") {
    for (const s of line.split(/(?<=[.!?])\s+/)) {
      const words = s.trim().split(/\s+/).length;
      if (words > 30) reasons.push(`a sentence of ${words} words`);
    }
  }
  return reasons;
}

/** True when a line breaks its Warden's grammar rules (Brask conjugating, for instance). */
export function slipsStyle(warden: WardenId, line: string): boolean {
  return styleSlipReasons(warden, line).length > 0;
}

/** True when a rendered line is, near enough, one of the document's wrong lines. */
export function hitsWrongLine(line: string, runtime: CanonRuntime, threshold = 0.5): boolean {
  const t = tokens(line);
  return Object.values(runtime.wardens).some((w) => w.wrongLines.some((wl) => jaccard(t, tokens(wl.line)) >= threshold));
}

export function scoreCondition(condition: Condition, samples: Sample[], judged: Map<string, JudgedItem>, runtime: CanonRuntime, dry = false, scenarios: readonly Scenario[] = SCENARIOS, pairJudged?: Map<string, PairChoice>): ConditionScore {
  const mine = samples.filter((s) => s.condition === condition);
  const live = dry ? mine : mine.filter((s) => s.source === "claude");
  const onSpeaker = live.filter((s) => s.speaker === s.warden);
  const perWarden: ConditionScore["perWarden"] = {};
  const confusionCounts = new Map<string, { scenario: string; truth: WardenId; guess: WardenId; count: number }>();
  let voice = 0, action = 0, swapResistant = 0, violations = 0, wrongLineHits = 0, judgedLines = 0, unjudged = 0, styleSlips = 0, voiceActionSplit = 0;
  let intentionRight = 0, intentionJudged = 0;
  const violationsNamed: ConditionScore["violationsNamed"] = [];
  const slipsNamed: ConditionScore["slipsNamed"] = [];
  const styleSlipsNamed: ConditionScore["styleSlipsNamed"] = [];
  const misattributions: ConditionScore["misattributions"] = [];
  for (const s of onSpeaker) {
    if (hitsWrongLine(s.line, runtime)) wrongLineHits++;
    const slipReasons = styleSlipReasons(s.warden, s.railRaw ?? s.line);
    if (slipReasons.length) { styleSlips++; styleSlipsNamed.push({ warden: s.warden, scenario: s.scenario, reasons: slipReasons, line: s.railRaw ?? s.line }); }
    const j = judged.get(`${s.id}:line`);
    if (!j) { unjudged++; }
    else {
      const pw = (perWarden[s.warden] ??= { n: 0, voice: 0, action: 0 });
      pw.n++;
      judgedLines++;
      if (j.voice === s.warden) { voice++; pw.voice++; }
      else {
        const key = `${s.scenario}|${s.warden}|${j.voice}`;
        const c = confusionCounts.get(key) ?? { scenario: s.scenario, truth: s.warden, guess: j.voice, count: 0 };
        c.count++;
        confusionCounts.set(key, c);
        misattributions.push({ warden: s.warden, scenario: s.scenario, guess: j.voice, ...(j.why ? { why: j.why } : {}), line: s.line });
      }
      if (j.action === s.warden) { action++; pw.action++; }
      if (j.action !== j.voice) voiceActionSplit++;
      if (!j.swappable) swapResistant++;
      // A violation or a slip is named against the card of whoever the judge thinks spoke; it means something only when that is the speaker.
      if (j.violation && j.voice === s.warden) { violations++; violationsNamed.push({ warden: s.warden, scenario: s.scenario, violation: j.violation, line: s.line }); }
      if (j.slip && j.voice === s.warden) slipsNamed.push({ warden: s.warden, scenario: s.scenario, slip: j.slip, line: s.line });
    }
    const ji = judged.get(`${s.id}:intention`);
    if (ji) { intentionJudged++; if (ji.action === s.warden) intentionRight++; }
  }
  const rate = (k: number, n: number) => (n ? k / n : 0);
  for (const pw of Object.values(perWarden)) { pw.voice = rate(pw.voice, pw.n); pw.action = rate(pw.action, pw.n); }
  // Forced pairs the confusions asked for: any saved pair that is not the scenario's designed pair.
  const confusionTally = new Map<string, { scenario: string; pair: [WardenId, WardenId]; n: number; right: number }>();
  if (pairJudged) {
    for (const s of onSpeaker) {
      const designed = scenarios.find((x) => x.id === s.scenario)?.pair;
      for (const [key, pc] of pairJudged) {
        if (!key.startsWith(`${s.id}:pair:`)) continue;
        if (designed && pc.pair[0] === designed[0] && pc.pair[1] === designed[1]) continue;
        const k = `${s.scenario}|${pc.pair[0]}|${pc.pair[1]}`;
        const t = confusionTally.get(k) ?? { scenario: s.scenario, pair: pc.pair, n: 0, right: 0 };
        t.n++;
        if (pc.choice === s.warden) t.right++;
        confusionTally.set(k, t);
      }
    }
  }
  const confusionPairs = [...confusionTally.values()].map((t) => ({ ...t, right: rate(t.right, t.n) }));
  const pairs: ConditionScore["pairs"] = [];
  for (const sc of scenarios) {
    if (!sc.pair) continue;
    const own = onSpeaker.filter((s) => s.scenario === sc.id && (sc.pair as readonly string[]).includes(s.warden) && judged.has(`${s.id}:line`));
    const forcedOwn = pairJudged ? onSpeaker.filter((s) => s.scenario === sc.id && (sc.pair as readonly string[]).includes(s.warden) && pairJudged.has(pairKey(s.id, sc.pair!))) : [];
    if (!own.length && !forcedOwn.length) continue;
    const right = own.filter((s) => judged.get(`${s.id}:line`)!.voice === s.warden).length;
    const crossed = own.filter((s) => { const g = judged.get(`${s.id}:line`)!.voice; return g !== s.warden && (sc.pair as readonly string[]).includes(g); }).length;
    const forced = forcedOwn.length ? { n: forcedOwn.length, right: rate(forcedOwn.filter((s) => pairJudged!.get(pairKey(s.id, sc.pair!))!.choice === s.warden).length, forcedOwn.length) } : undefined;
    pairs.push({ scenario: sc.id, pair: sc.pair, n: own.length, voice: rate(right, own.length), crossed, ...(forced ? { forced } : {}) });
  }
  return {
    condition,
    label: CONDITIONS[condition].label,
    n: mine.length,
    judged: judgedLines,
    offSpeaker: live.length - onSpeaker.length,
    fallbacks: mine.length - live.length,
    proseLeaks: live.filter((s) => s.rawLine).length,
    unjudged,
    styleSlips,
    careOpeners: onSpeaker.filter((s) => opensOnCare(s.line)).length,
    voice: rate(voice, judgedLines),
    action: rate(action, judgedLines),
    voiceActionSplit,
    ...(intentionJudged ? { intention: rate(intentionRight, intentionJudged) } : {}),
    swapResistance: rate(swapResistant, judgedLines),
    violations,
    violationsNamed,
    guardRepairs: onSpeaker.filter((s) => s.railRaw).length,
    judgeSlips: slipsNamed.length,
    slipsNamed,
    styleSlipsNamed,
    misattributions,
    wrongLineHits,
    perWarden,
    pairs,
    confusionPairs,
    confusions: [...confusionCounts.values()].sort((a, b) => b.count - a.count),
  };
}

const CEILING = 0.95;
const SMALL = 20;

/**
 * What the data says, no more. A condition that did not run gets no verdict; a small sample is
 * called preliminary; dimensions at ceiling in both conditions are not counted as ties.
 */
export function verdict(scores: Partial<Record<Condition, ConditionScore>>): string {
  const { A, B, C } = scores;
  const lines: string[] = [];
  const ran = (s: ConditionScore) => s.judged > 0;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  for (const s of [A, B, C]) {
    if (s && !ran(s)) lines.push(`${s.condition}: invalid, ${s.fallbacks} of ${s.n} turns fell back to the understudy after the director did not answer, ${s.offSpeaker} were off-speaker and ${s.unjudged} came back unjudged. ${s.condition === "C" ? "The gate remains UNVALIDATED, not disproven. Action: debug the refusal path before deciding whether to keep intention scoring." : "No conclusion rests on it."}`);
  }
  const small = [A, B, C].some((s) => s && ran(s) && s.judged < SMALL);
  if (A && B && ran(A) && ran(B)) {
    const ceiling = A.voice >= CEILING && B.voice >= CEILING && A.action >= CEILING && B.action >= CEILING;
    const parts: string[] = [];
    if (ceiling) parts.push(`voice and behaviour attribution are at ceiling in both (A ${pct(A.voice)}/${pct(A.action)}, B ${pct(B.voice)}/${pct(B.action)}), so the runtime cannot show on those dimensions here`);
    else parts.push(`voice ${pct(A.voice)} to ${pct(B.voice)}, behaviour ${pct(A.action)} to ${pct(B.action)}`);
    if (B.swapResistance > A.swapResistance) parts.push(`swap resistance rises from ${pct(A.swapResistance)} to ${pct(B.swapResistance)}, ${small ? "preliminary" : "real"} evidence that the runtime makes the choices less interchangeable`);
    else if (B.swapResistance < A.swapResistance) parts.push(`swap resistance falls from ${pct(A.swapResistance)} to ${pct(B.swapResistance)}`);
    else parts.push(`swap resistance is unchanged at ${pct(B.swapResistance)}`);
    if (B.violations > A.violations || B.wrongLineHits > A.wrongLineHits) parts.push(`violations rise with the runtime (${A.violations + A.wrongLineHits} to ${B.violations + B.wrongLineHits})`);
    lines.push(`A vs B: ${parts.join("; ")}.${small ? " More samples and closer pairs are required before anything is settled." : ""}`);
  }
  if (B && C && ran(B) && ran(C)) {
    const better = C.voice >= B.voice && C.action >= B.action && C.swapResistance >= B.swapResistance && C.violations + C.wrongLineHits <= B.violations + B.wrongLineHits && (C.voice > B.voice || C.action > B.action || C.swapResistance > B.swapResistance);
    if (better) lines.push(`B vs C: the gate helps on this sample (voice ${pct(B.voice)} to ${pct(C.voice)}, behaviour ${pct(B.action)} to ${pct(C.action)}, swap resistance ${pct(B.swapResistance)} to ${pct(C.swapResistance)}). ${small ? "Preliminary; " : ""}the steering test decides whether the gate is causal.`);
    else if (C.intention !== undefined && C.intention > C.voice) lines.push(`B vs C: the gate labels moves better than it renders them (moves ${pct(C.intention)}, voice ${pct(C.voice)}): the problem is between move selection and surface realisation. Give the chosen move stronger rendering constraints rather than more character lore.`);
    else lines.push(`B vs C: no gain from the gate on this sample (voice ${pct(B.voice)} to ${pct(C.voice)}, behaviour ${pct(B.action)} to ${pct(C.action)}, swap resistance ${pct(B.swapResistance)} to ${pct(C.swapResistance)}). ${small ? "Too small to kill it on; run the steering test." : "The gate's case rests on the steering test, not on attribution: if two forced moves render the same line, kill it; if they render distinct lines in the same voice, keep it and read the C lines of the Wardens that dropped, since a gate that picks a canon-valid but generic move makes them appropriate rather than wrong."}`);
  }
  if (!lines.length) lines.push("Incomplete: run at least two conditions to compare.");
  return lines.join(" ");
}

export function formatReport(scores: ConditionScore[], meta: Record<string, string | number | boolean>, samples: Sample[], terms: string[]): string {
  const pct = (x: number | undefined) => (x === undefined ? "" : `${Math.round(x * 100)}%`);
  const rows = scores.map((s) => `| ${s.condition} | ${s.n} | ${s.judged} | ${pct(s.voice)} | ${pct(s.action)} | ${pct(s.intention)} | ${pct(s.swapResistance)} | ${s.violations} | ${s.wrongLineHits} | ${s.proseLeaks} | ${s.styleSlips} | ${s.guardRepairs} | ${s.judgeSlips} | ${s.careOpeners} | ${s.fallbacks} | ${s.unjudged} | ${s.offSpeaker} |`);
  const byWarden = WARDENS.map((w) => `| ${w} | ${scores.map((s) => (s.perWarden[w] ? `${pct(s.perWarden[w]!.voice)} / ${pct(s.perWarden[w]!.action)} (${s.perWarden[w]!.n})` : "")).join(" | ")} |`);
  const pairRows = scores.flatMap((s) => s.pairs.map((p) => `| ${s.condition} | ${p.scenario} | ${p.pair.join(" and ")} | ${p.n} | ${pct(p.voice)} | ${p.crossed} | ${p.forced ? `${pct(p.forced.right)} (${p.forced.n})` : ""} |`));
  const confusionRows = scores.flatMap((s) => s.confusions.map((c) => `- ${s.condition}, ${c.scenario}: ${c.truth} taken for ${c.guess} ×${c.count}`));
  const confusionPairRows = scores.flatMap((s) => s.confusionPairs.map((p) => `| ${s.condition} | ${p.scenario} | ${p.pair[0]} | ${p.pair[1]} | ${p.n} | ${pct(p.right)} |`));
  const notes = samples.filter((x) => x.note).map((x) => `- ${x.condition}, ${x.warden} to the ${x.scenario}: ${x.note}`);
  const violationRows = scores.flatMap((s) => s.violationsNamed.map((v) => `- ${s.condition}, ${v.warden} to the ${v.scenario}: ${v.violation}. "${stripIdentity(v.line, terms)}"`));
  const slipRows = scores.flatMap((s) => s.slipsNamed.map((v) => `- ${s.condition}, ${v.warden} to the ${v.scenario}: ${v.slip}. "${stripIdentity(v.line, terms)}"`));
  const lintRows = scores.flatMap((s) => s.styleSlipsNamed.map((v) => `- ${s.condition}, ${v.warden} to the ${v.scenario}: ${v.reasons.map((r) => `"${r}"`).join(", ")}. "${stripIdentity(v.line, terms)}"`));
  const misRows = scores.flatMap((s) => s.misattributions.map((m) => `- ${s.condition}, ${m.warden} to the ${m.scenario}, taken for ${m.guess}${m.why ? ` (the tell: ${m.why})` : ""}: "${stripIdentity(m.line, terms)}"`));
  const examples = scores.flatMap((s) => samples.filter((x) => x.condition === s.condition && x.source === "claude").slice(0, 2).map((x) => `- ${s.condition}, ${x.warden} to the ${x.scenario} (${x.tone}): "${stripIdentity(x.line, terms)}"${x.proseLeak ? ` [narration moved to the tell: ${stripIdentity(x.proseLeak, terms)}]` : ""}${x.intention ? ` [move: ${stripIdentity(x.intention, terms)}]` : ""}`));
  return [
    "# Blind Character Attribution",
    "",
    ...Object.entries(meta).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "| Condition | n | judged | voice | behaviour | move | swap resistance | violations | wrong-line hits | prose leaks | style slips | rail guard | judge slips | care openers | understudy | unjudged | off-speaker |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...rows,
    "",
    "Columns: voice and behaviour are the judge's attribution of the line by register and by choice; move is whether the chosen move, read on its own with names stripped, is attributed to the right Warden, not whether the line enacted it; swap resistance is the share of lines the judge could not reassign by changing only the name; style slips are the regex lint on the line as the director rendered it, each rail keyed to its own speaker and listed below with what it matched, rail guard is how many of those lines the guard then repaired before anyone heard them, and judge slips are rail breaks the judge named on the final line, none of them violations; understudy counts turns the live director did not take, not the runtime's fallback coverage, which this eval does not yet test.",
    ...(scores.reduce((k, s) => k + s.judged, 0) >= 20 && scores.every((s) => s.voiceActionSplit === 0) ? ["", "The judge named the same Warden for voice and for behaviour on every judged line, so the behaviour column is not an independent measurement in this run."] : []),
    ...scores.filter((s) => s.judged > 0 && s.unjudged > 0).map((s) => `\n${s.condition}: ${s.unjudged} of ${s.judged + s.unjudged} lines came back unjudged; every rate is over the ${s.judged} judged lines, and no conclusion should rest on a cell they thin.`),
    "",
    `Verdict: ${verdict(Object.fromEntries(scores.map((s) => [s.condition, s])))}`,
    "",
    "## Per Warden: voice / behaviour, within that Warden's own judged lines (n)",
    "",
    `| Warden | ${scores.map((s) => s.condition).join(" | ")} |`,
    `|---|${scores.map(() => "---").join("|")}|`,
    ...byWarden,
    ...(pairRows.length ? ["", "## Collision pairs: open-set voice accuracy on the pair's own lines, how often one was taken for the other, and the forced binary choice between the two", "", "| Condition | scenario | pair | n | open-set voice | crossed | forced pair (n) |", "|---|---|---|---|---|---|---|", ...pairRows] : []),
    ...(confusionRows.length ? ["", "## Confusions: who was taken for whom", "", ...confusionRows] : []),
    ...(misRows.length ? ["", "## Misattributions, with the line and the tell the judge named", "", ...misRows] : []),
    ...(confusionPairRows.length ? ["", "## Confusion pairs, forced: the misattributed Warden's own lines, judged as a choice between them and the Warden they were taken for", "", "| Condition | scenario | speaker | taken for | n | forced accuracy |", "|---|---|---|---|---|---|", ...confusionPairRows] : []),
    ...(violationRows.length ? ["", "## Violations the judge named, with the line", "", ...violationRows] : []),
    ...(slipRows.length ? ["", "## Rail breaks the judge named, with the line", "", ...slipRows] : []),
    ...(lintRows.length ? ["", "## Style slips the lint flagged, with what it matched, on the line as the director rendered it", "", ...lintRows] : []),
    "",
    "## Examples, as the judge saw them",
    "",
    ...examples,
    ...(notes.length ? ["", "## Turns the live director did not take", "", ...notes] : []),
  ].join("\n");
}
