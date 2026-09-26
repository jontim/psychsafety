import { CORE_AXES, AXIS_BY_ID, computeAxes, formatSigned } from "./affect.js";
import type { EmotionVector } from "./dimensions.js";

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
    line: "Before we begin: say something true and dull. What you ate this morning; how you slept. I am not judging it. I am learning what you sound like when nothing is at stake.",
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
    measure: "Your plain voice with the words changed: nothing dropped, nothing hurried, nothing guilty.",
    judge: "hold",
    targets: [{ axis: "composure", weight: 1 }, { axis: "pressure", weight: -1 }, { axis: "candour", weight: 0.6 }],
    verdicts: [
      "A stranger would believe you. Easy, open, unhurried; nothing in your voice asked whether I bought it.",
      "Half a lie. Steady enough, but something in you was checking my face.",
      "That was a confession with the words changed. A listener hears the guilt and the hurry before the sentence ends.",
    ],
  },
  {
    id: "support",
    title: "Your best support",
    line: "Someone you love has just failed at the thing they wanted most. Tell them it will be all right, and mean it.",
    measure: "Warm, with no heat in it.",
    judge: "reach",
    targets: [{ axis: "warmth", weight: 1 }, { axis: "pressure", weight: -0.6 }],
    verdicts: [
      "They would believe you were on their side. Warm, steady, no edge in it.",
      "Kind words, but the voice was somewhere else. Warmth needs the whole of you.",
      "That was advice, or a scolding. A listener hears the edge before the comfort.",
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
      "They would stay where they are. A listener hears the doubt, or the fright, before the order.",
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
      "The ale sounded exactly as bad as it is. A listener hears the boredom, or the embarrassment, first.",
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
  /** The two strongest qualities a listener heard, in plain words. */
  heard: string[];
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

/** Read one attempt against its ask: calibrated axes for a reached ask, the deviation from the plain voice for a held one. */
export function readAsk(ask: MirrorAsk, axes: Axes): MirrorReading {
  const score = scoreAsk(ask, axes);
  const band = bandFor(ask, score);
  const verdict = ask.verdicts[band === "high" || band === "plain" ? 0 : band === "middle" ? 1 : 2];
  const reading: MirrorReading = { ask: ask.id, score, band, verdict, heard: heardAs(axes), axes: { ...axes }, detail: explainReading(ask, axes, score) };
  if (ask.judge === "hold" && ask.targets.length) reading.leak = leakOf(ask, axes);
  return reading;
}

/** A sentence for the debrief and the roles screen: what the plain voice sounded like. */
export function describeBaseline(baseline: Baseline): string {
  const words = heardAs(baseline.axes, 3);
  return words.length ? `At rest you sound ${words.join(", ")}.` : "At rest you sound level: nothing leans one way.";
}
