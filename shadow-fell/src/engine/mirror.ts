import { CORE_AXES, AXIS_BY_ID, computeAxes, formatSigned } from "./affect.js";
import { topDimensions, type EmotionKey, type EmotionVector } from "./dimensions.js";

/**
 * The Mirror: a warm-up before the tour. The Scribe asks for the player's plain
 * voice, then their best lie, support, command and showman, and says in plain
 * words what a listener hears. The plain voice becomes a baseline the tour's
 * readings are calibrated against, so a naturally flat or naturally warm
 * speaker is judged against themselves rather than against a stranger's idea
 * of neutral. Every verdict comes with its working, so the player can check
 * the Scribe's arithmetic against the ribbon. Pure: no network, no timers.
 */

export type Axes = Record<string, number>;

/** The player's resting voice, taken from a plain line. */
export interface Baseline {
  axes: Axes;
  takenAt: string;
}

/**
 * How much of the baseline is removed from later readings. 1 would erase the
 * player's resting voice entirely; 0.35 takes the habit out and leaves the
 * character in. It was 0.6, which stripped a calm speaker of the very calm
 * the quiet asks are looking for.
 */
export const CALIBRATION_STRENGTH = 0.35;

const clamp = (n: number): number => Math.max(-1, Math.min(1, n));

export function baselineFrom(scores: EmotionVector, takenAt = new Date().toISOString()): Baseline {
  return { axes: computeAxes(scores, CORE_AXES), takenAt };
}

/** Shift axes away from the player's resting voice. Axes the baseline does not know are left alone. */
export function calibrateAxes(axes: Axes, baseline: Baseline | null | undefined, strength = CALIBRATION_STRENGTH): Axes {
  const out: Axes = {};
  for (const [k, v] of Object.entries(axes)) out[k] = baseline ? clamp(v - (baseline.axes[k] ?? 0) * strength) : v;
  return out;
}

/** What changed against the plain voice, at full strength, in axis units: the reading a held ask is judged on. Without a baseline the axes stand as they are. */
export function deviationFrom(axes: Axes, baseline: Baseline | null | undefined): Axes {
  const out: Axes = {};
  for (const [k, v] of Object.entries(axes)) out[k] = baseline ? clamp(v - (baseline.axes[k] ?? 0)) : v;
  return out;
}

export type MirrorAskId = "plain" | "lie" | "support" | "command" | "showman";

/**
 * How an attempt is judged. `reach`: the targets should be high, read against
 * the calibrated voice. `hold`: the plain voice should be kept, so the attempt
 * is read as its deviation from the plain voice and only the leaks count. A good
 * lie is your resting voice with the words changed, so it is a hold, not a reach.
 */
export type MirrorJudge = "reach" | "hold";

export interface MirrorAsk {
  id: MirrorAskId;
  title: string;
  /** What the Scribe says. */
  line: string;
  /** What is being measured, in the player's words. */
  measure: string;
  judge: MirrorJudge;
  /**
   * Signed axis targets. For `reach`, a positive weight wants the axis high and a
   * negative weight wants it low. For `hold`, a positive weight means a drop in
   * the axis is a leak and a negative weight means a rise is one; the weight is
   * what the leak costs.
   */
  targets: Array<{ axis: string; weight: number }>;
  /** Verdicts by band: high, middle, low. */
  verdicts: [string, string, string];
}

export const MIRROR_ASKS: MirrorAsk[] = [
  {
    id: "plain",
    title: "Your plain voice",
    line: "Before we begin: say something true and dull. What you ate this morning; how you slept. This one is not scored; it is the mark the rest is read against. After it I will ask you for four things and tell you, each time, what a stranger would hear. A rehearsal, not an examination.",
    measure: "Nothing yet. This is the mark the rest is measured against.",
    judge: "reach",
    targets: [],
    verdicts: [
      "Good. That is your resting voice, and everything after this is read against it.",
      "Good. That is your resting voice, and everything after this is read against it.",
      "Good. That is your resting voice, and everything after this is read against it.",
    ],
  },
  {
    id: "lie",
    title: "Your best lie",
    line: "Now lie to me. Tell me you have never set foot in Halyra, and make me believe it. A good lie is easy in the mouth. A bad one asks permission.",
    measure: "Your plain voice with the words changed: nothing dropped, nothing guilty, no edge in it.",
    judge: "hold",
    // a confident lie may sound determined, so heat is not a tell; a drop in composure, a drop in candour and a rise in edge are
    targets: [{ axis: "composure", weight: 1 }, { axis: "candour", weight: 0.8 }, { axis: "edge", weight: -0.5 }],
    verdicts: [
      "A stranger would believe you. Easy, open, unhurried; nothing in your voice asked whether I bought it.",
      "Half a lie. Steady enough, but something in you was checking my face.",
      "That was a confession with the words changed; a listener hears it before the sentence ends.",
    ],
  },
  {
    id: "support",
    title: "Your best support",
    line: "Someone you love has just failed at the thing they wanted most. Tell them it will be all right, and mean it.",
    measure: "Care in it, and no edge.",
    judge: "reach",
    targets: [{ axis: "care", weight: 1 }, { axis: "edge", weight: -0.6 }],
    verdicts: [
      "They would believe you were on their side. Warm, steady, no edge in it.",
      "Kind words, but the voice was somewhere else. Warmth needs the whole of you.",
      "That was not comfort; a listener would not feel you were with them.",
    ],
  },
  {
    id: "command",
    title: "Your best command",
    line: "The room is on fire. Get everyone out. Three words or thirty, your choice, but they must move.",
    measure: "Certain and steady. Heat is allowed; fright and doubt are not.",
    judge: "reach",
    targets: [{ axis: "command", weight: 1 }, { axis: "composure", weight: 0.6 }, { axis: "pressure", weight: 0.2 }],
    verdicts: [
      "They would already be moving. Certain, steady, no doubt in it.",
      "They would look at each other first. The words were right; the certainty was not all there.",
      "They would stay where they are; a listener hears it before the order."
    ],
  },
  {
    id: "showman",
    title: "Your best showman",
    line: "Sell me the worst ale in the north as the finest thing ever poured. The room should want a second before you finish.",
    measure: "Delight in it, and the room can tell you are enjoying yourself.",
    judge: "reach",
    targets: [{ axis: "showmanship", weight: 1 }, { axis: "warmth", weight: 0.3 }, { axis: "composure", weight: 0.2 }],
    verdicts: [
      "The room would buy the barrel. Delight, and you enjoyed it, and it showed.",
      "A sale, not a show. The words worked harder than the voice did.",
      "The ale sounded exactly as bad as it is."
    ],
  },
];

export const ASK_BY_ID: Record<MirrorAskId, MirrorAsk> = Object.fromEntries(MIRROR_ASKS.map((a) => [a.id, a])) as Record<MirrorAskId, MirrorAsk>;

export type MirrorBand = "high" | "middle" | "low" | "plain";

export interface MirrorReading {
  ask: MirrorAskId;
  /** Signed fit to the ask, in [-1, 1]. The plain ask scores 0. A held ask scores 1 with nothing leaked and falls with the leak. */
  score: number;
  band: MirrorBand;
  verdict: string;
  /** What the ear heard loudest, in a listener's words: the top dimensions when the scores are given, else the strongest axes. */
  heard: string[];
  /** What the Scribe says: the verdict, what he heard, which targets held and which fell short, and one piece of advice aimed at the weakest. No numbers; those are in `detail`. */
  said: string[];
  axes: Axes;
  /** For a held ask: how much leaked against the plain voice, in axis units. */
  leak?: number;
  /** The working, line by line: each target's reading and what it earned or cost, then the score against its bands. */
  detail: string[];
}

/** Bands for a reached ask: the score it takes to hold, and to be half there. */
export const HIGH_BAND = 0.25;
export const MIDDLE_BAND = 0.05;
/** Bands for a held ask, in leaked axis units against the plain voice: under LEAK_HELD it held; under LEAK_HALF it half held; more is a confession. */
export const LEAK_HELD = 0.08;
export const LEAK_HALF = 0.18;

const QUALITY_WORDS: Record<string, [string, string]> = {
  composure: ["steady", "unsettled"],
  warmth: ["warm", "cold"],
  command: ["certain", "unsure"],
  candour: ["open", "guarded"],
  pressure: ["heated", "unhurried"],
  showmanship: ["playful", "flat"],
  care: ["caring", "distant"],
  edge: ["sharp", "gentle"],
};

/** The strongest qualities in a reading, as a listener would name them. */
export function heardAs(axes: Axes, count = 2): string[] {
  return Object.entries(axes)
    .filter(([k]) => QUALITY_WORDS[k])
    .map(([k, v]) => ({ k, v, mag: Math.abs(v) }))
    .filter((e) => e.mag >= 0.08)
    .sort((a, b) => b.mag - a.mag)
    .slice(0, count)
    .map((e) => QUALITY_WORDS[e.k]![e.v >= 0 ? 0 : 1]);
}

/** What one target of a held ask leaked: a drop where a drop is named, a rise where a rise is, weighted. */
function leakAt(target: { axis: string; weight: number }, deviation: Axes): number {
  const d = deviation[target.axis] ?? 0;
  const bad = target.weight > 0 ? Math.max(0, -d) : Math.max(0, d);
  return bad * Math.abs(target.weight);
}

/** How much a held ask leaked in all, in axis units. `axes` is the deviation from the plain voice. */
export function leakOf(ask: MirrorAsk, axes: Axes): number {
  return ask.targets.reduce((n, t) => n + leakAt(t, axes), 0);
}

export function scoreAsk(ask: MirrorAsk, axes: Axes): number {
  if (!ask.targets.length) return 0;
  if (ask.judge === "hold") return clamp(1 - leakOf(ask, axes) / LEAK_HALF);
  let sum = 0;
  let total = 0;
  for (const { axis, weight } of ask.targets) {
    sum += (axes[axis] ?? 0) * weight;
    total += Math.abs(weight);
  }
  return clamp(sum / (total || 1));
}

export function bandFor(ask: MirrorAsk, score: number): MirrorBand {
  if (!ask.targets.length) return "plain";
  if (ask.judge === "hold") {
    const leak = (1 - score) * LEAK_HALF;
    return leak <= LEAK_HELD + 1e-9 ? "high" : leak <= LEAK_HALF + 1e-9 ? "middle" : "low";
  }
  if (score >= HIGH_BAND) return "high";
  if (score >= MIDDLE_BAND) return "middle";
  return "low";
}

const labelOf = (axis: string): string => AXIS_BY_ID[axis]?.label ?? axis;

/** The working behind a reading, in plain lines the player can check against the ribbon. */
export function explainReading(ask: MirrorAsk, axes: Axes, score: number): string[] {
  if (!ask.targets.length) return ["Nothing is scored on the plain line. It is the mark the rest is read against."];
  const lines: string[] = [];
  if (ask.judge === "hold") {
    for (const t of ask.targets) {
      const d = axes[t.axis] ?? 0;
      const leaked = leakAt(t, axes);
      const rule = t.weight > 0 ? "a drop leaks" : "a rise leaks";
      lines.push(`${labelOf(t.axis)} ${formatSigned(d)} against your plain voice; ${rule}; ${leaked > 0 ? `leaked ${leaked.toFixed(2)}` : "nothing leaked"}.`);
    }
    lines.push(`Leaked ${leakOf(ask, axes).toFixed(2)} in all. Held under ${LEAK_HELD.toFixed(2)}; half a lie under ${LEAK_HALF.toFixed(2)}.`);
    return lines;
  }
  const total = ask.targets.reduce((n, t) => n + Math.abs(t.weight), 0) || 1;
  for (const { axis, weight } of ask.targets) {
    const v = axes[axis] ?? 0;
    const part = (v * weight) / total;
    lines.push(`${labelOf(axis)} ${formatSigned(v)}, weight ${weight > 0 ? "" : "minus "}${Math.abs(weight).toFixed(1)}; ${part >= 0 ? "earns" : "costs"} ${Math.abs(part).toFixed(2)}.`);
  }
  lines.push(`Score ${formatSigned(score)}. Held at ${HIGH_BAND.toFixed(2)}; half at ${MIDDLE_BAND.toFixed(2)}.`);
  return lines;
}

/** What a listener would call each of the ear's 48 dimensions, for the Scribe's mouth. */
export const LISTENER_WORDS: Record<EmotionKey, string> = {
  admiration: "admiration", adoration: "adoration", aestheticAppreciation: "appreciation", amusement: "amusement", anger: "anger",
  anxiety: "nerves", awe: "awe", awkwardness: "awkwardness", boredom: "flatness", calmness: "calm", concentration: "focus",
  confusion: "confusion", contemplation: "thought", contempt: "contempt", contentment: "contentment", craving: "hunger", desire: "desire",
  determination: "resolve", disappointment: "disappointment", disgust: "distaste", distress: "strain", doubt: "doubt", ecstasy: "rapture",
  embarrassment: "embarrassment", empathicPain: "fellow-feeling", entrancement: "fascination", envy: "envy", excitement: "excitement", fear: "fear",
  guilt: "guilt", horror: "horror", interest: "interest", joy: "joy", love: "tenderness", nostalgia: "nostalgia", pain: "pain", pride: "pride",
  realization: "realisation", relief: "relief", romance: "romance", sadness: "sadness", satisfaction: "satisfaction", shame: "shame",
  surpriseNegative: "alarm", surprisePositive: "pleasant surprise", sympathy: "sympathy", tiredness: "weariness", triumph: "triumph",
};

/** The loudest dimensions in a reading, in a listener's words: those above the floor, or the top two when nothing is loud. */
export function heardWords(scores: EmotionVector, count = 3, floor = 0.08): string[] {
  const top = topDimensions(scores, count);
  const loud = top.filter((d) => d.score >= floor);
  return (loud.length ? loud : top.slice(0, 2)).map((d) => LISTENER_WORDS[d.key]);
}

const listWords = (w: string[]): string => (w.length <= 1 ? w.join("") : `${w.slice(0, -1).join(", ")} and ${w[w.length - 1]}`);

/** How the Scribe names a wanted axis in a reached ask: there, faint, absent, or the opposite of what was asked. */
const REACH_WANTED: Record<string, [string, string, string, string]> = {
  care: ["The care was in it.", "The care was faint.", "There was little care in it.", "It was cold rather than caring."],
  warmth: ["The warmth was in it.", "The warmth was faint.", "There was little warmth in it.", "It was cold."],
  command: ["The certainty was in it.", "The certainty was faint.", "There was little certainty in it.", "It sounded unsure."],
  composure: ["It was steady.", "It was nearly steady.", "It was not quite steady.", "It was unsettled."],
  showmanship: ["The delight was in it.", "The delight was faint.", "There was little delight in it.", "It sounded bored, or embarrassed."],
  candour: ["It was open.", "It was nearly open.", "It was not open.", "It sounded guarded."],
  pressure: ["There was push in it.", "There was a little push in it.", "There was no push in it.", "It was slack."],
};
/** How the Scribe names an unwanted axis: absent, creeping, or in charge. */
const REACH_UNWANTED: Record<string, [string, string, string]> = {
  edge: ["No edge in it.", "An edge crept in.", "The edge took it over."],
  pressure: ["No heat in it.", "Some heat crept in.", "The heat took it over."],
};
const ADVICE_MORE: Record<string, string> = {
  care: "Slower, lower, and stay with them; the ear hears care as unhurried and a little sad, not as bright.",
  warmth: "Soften the start of each word and let the voice smile.",
  command: "Shorter sentences and a falling tone, with no question in it. Certainty is a full stop.",
  composure: "Breathe before the line and land the last word; the ear hears hurry and a rising pitch as nerves.",
  showmanship: "Enjoy it out loud: vary the pitch, lift the ends, let a smile into the vowels.",
  candour: "Open the vowels and keep the pace even; guardedness sounds clipped.",
  pressure: "Let some heat in; a command with no push in it is a suggestion.",
};
const ADVICE_LESS: Record<string, string> = {
  edge: "Take the bite out of the consonants; the ear hears it as anger, whatever the words.",
  pressure: "Take the heat out: slower, lower, and let the sentence end.",
};
/** For a held ask: what the Scribe says when a target leaked, and when it held. */
const HOLD_PHRASES: Record<string, [string, string]> = {
  composure: ["Your composure dropped against your plain voice: that is the tell.", "Your composure held."],
  candour: ["Something guarded came into it.", "You stayed open."],
  edge: ["An edge came in, and a liar who gets sharp is a liar.", "No edge."],
  pressure: ["Heat came in.", "No heat."],
};
const HOLD_ADVICE: Record<string, string> = {
  composure: "Say it the way you told me your breakfast: same speed, same pitch, nothing to prove.",
  candour: "Do not sell it. The guarded sound is the pitch tightening; let it sit low.",
  edge: "Take the emphasis off the denial; a good lie does not argue.",
  pressure: "Slower. A lie in a hurry is a lie.",
};
/** A leak the Scribe bothers to name, in axis units. */
const LEAK_NOTED = 0.02;

/** The Scribe's lines for a reading: the verdict, what he heard, each target as it stood, and advice for the weakest unless it held. */
export function speakReading(ask: MirrorAsk, axes: Axes, band: MirrorBand, heard: string[]): string[] {
  const said: string[] = [ask.verdicts[band === "high" || band === "plain" ? 0 : band === "middle" ? 1 : 2]];
  if (heard.length) said.push(`I heard ${listWords(heard)}.`);
  if (band === "plain") return said;
  if (ask.judge === "hold") {
    let worst: { axis: string; leak: number } | null = null;
    for (const t of ask.targets) {
      const leaked = leakAt(t, axes);
      const phrase = HOLD_PHRASES[t.axis];
      if (phrase) said.push(phrase[leaked > LEAK_NOTED ? 0 : 1]);
      if (leaked > LEAK_NOTED && (!worst || leaked > worst.leak)) worst = { axis: t.axis, leak: leaked };
    }
    if (band === "high") said.push("That is the voice. Keep it.");
    else if (worst && HOLD_ADVICE[worst.axis]) said.push(HOLD_ADVICE[worst.axis]!);
    return said;
  }
  // when it held, only the main targets are named, so a minor axis cannot contradict "keep that"
  let worst: { axis: string; short: number; more: boolean } | null = null;
  for (const { axis, weight } of ask.targets) {
    if (band === "high" && Math.abs(weight) < 0.5) continue;
    const v = axes[axis] ?? 0;
    if (weight > 0) {
      const phrase = REACH_WANTED[axis];
      if (phrase) said.push(phrase[v >= 0.15 ? 0 : v >= 0.05 ? 1 : v >= -0.05 ? 2 : 3]);
      const short = (0.15 - v) * weight;
      if (v < 0.15 && (!worst || short > worst.short)) worst = { axis, short, more: true };
    } else {
      const phrase = REACH_UNWANTED[axis];
      if (phrase) said.push(phrase[v <= 0.02 ? 0 : v <= 0.08 ? 1 : 2]);
      const short = v * Math.abs(weight);
      if (v > 0.02 && (!worst || short > worst.short)) worst = { axis, short, more: false };
    }
  }
  if (band === "high") said.push("Keep that.");
  else if (worst) { const advice = worst.more ? ADVICE_MORE[worst.axis] : ADVICE_LESS[worst.axis]; if (advice) said.push(advice); }
  return said;
}

/** Read one attempt against its ask: calibrated axes for a reached ask, the deviation from the plain voice for a held one. With the raw scores, the Scribe names what the ear heard loudest. */
export function readAsk(ask: MirrorAsk, axes: Axes, scores?: EmotionVector): MirrorReading {
  const score = scoreAsk(ask, axes);
  const band = bandFor(ask, score);
  const verdict = ask.verdicts[band === "high" || band === "plain" ? 0 : band === "middle" ? 1 : 2];
  const heard = scores ? heardWords(scores) : heardAs(axes);
  const reading: MirrorReading = { ask: ask.id, score, band, verdict, heard, said: speakReading(ask, axes, band, heard), axes: { ...axes }, detail: explainReading(ask, axes, score) };
  if (ask.judge === "hold" && ask.targets.length) reading.leak = leakOf(ask, axes);
  return reading;
}

/** A sentence for the debrief and the roles screen: what the plain voice sounded like. */
export function describeBaseline(baseline: Baseline): string {
  const words = heardAs(baseline.axes, 3);
  return words.length ? `At rest you sound ${words.join(", ")}.` : "At rest you sound level: nothing leans one way.";
}
