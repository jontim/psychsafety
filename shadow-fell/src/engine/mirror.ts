import { CORE_AXES, computeAxes } from "./affect.js";
import type { EmotionVector } from "./dimensions.js";

/**
 * The Mirror: a warm-up before the tour. The Scribe asks for the player's plain
 * voice, then their best lie, support, command and showman, and says in plain
 * words what a listener hears. The plain voice becomes a baseline the tour's
 * readings are calibrated against, so a naturally flat or naturally warm
 * speaker is judged against themselves rather than against a stranger's idea
 * of neutral. Pure: no network, no timers.
 */

export type Axes = Record<string, number>;

/** The player's resting voice, taken from a plain line. */
export interface Baseline {
  axes: Axes;
  takenAt: string;
}

/** How much of the baseline is removed from later readings. 1 would erase the player's resting voice entirely; 0.6 leaves their character in and takes their habit out. */
export const CALIBRATION_STRENGTH = 0.6;

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

export type MirrorAskId = "plain" | "lie" | "support" | "command" | "showman";

export interface MirrorAsk {
  id: MirrorAskId;
  title: string;
  /** What the Scribe says. */
  line: string;
  /** What is being measured, in the player's words. */
  measure: string;
  /** Signed axis targets: a positive weight wants the axis high, a negative weight wants it low. */
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
    measure: "Steady and open, with no guilt and no hurry in it.",
    targets: [{ axis: "composure", weight: 1 }, { axis: "candour", weight: 0.8 }, { axis: "pressure", weight: -0.5 }],
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
    measure: "Warm and steady, with no heat in it.",
    targets: [{ axis: "warmth", weight: 1 }, { axis: "pressure", weight: -0.7 }, { axis: "composure", weight: 0.4 }],
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
  /** Signed fit to the ask's targets, in [-1, 1]. The plain ask scores 0. */
  score: number;
  band: MirrorBand;
  verdict: string;
  /** The two strongest qualities a listener heard, in plain words. */
  heard: string[];
  axes: Axes;
}

export const HIGH_BAND = 0.25;
export const MIDDLE_BAND = 0.05;

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

export function scoreAsk(ask: MirrorAsk, axes: Axes): number {
  if (!ask.targets.length) return 0;
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
  if (score >= HIGH_BAND) return "high";
  if (score >= MIDDLE_BAND) return "middle";
  return "low";
}

/** Read one attempt against its ask. Pass calibrated axes for every ask after the plain one. */
export function readAsk(ask: MirrorAsk, axes: Axes): MirrorReading {
  const score = scoreAsk(ask, axes);
  const band = bandFor(ask, score);
  const verdict = ask.verdicts[band === "high" || band === "plain" ? 0 : band === "middle" ? 1 : 2];
  return { ask: ask.id, score, band, verdict, heard: heardAs(axes), axes: { ...axes } };
}

/** A sentence for the debrief and the roles screen: what the plain voice sounded like. */
export function describeBaseline(baseline: Baseline): string {
  const words = heardAs(baseline.axes, 3);
  return words.length ? `At rest you sound ${words.join(", ")}.` : "At rest you sound level: nothing leans one way.";
}
