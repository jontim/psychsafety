import { EMOTION_KEYS, type EmotionKey, type EmotionVector, zeroVector, topDimensions, type RankedDimension } from "./dimensions.js";

/**
 * An axis is a signed composite of expression dimensions. Worlds declare which
 * axes move which meters; the engine keeps the axis vocabulary small and shared
 * so every world plays with the same verbs.
 */
export interface AffectAxisSpec {
  id: string;
  label: string;
  /** What the axis measures, in words the player can verify against the ribbon. */
  description: string;
  positive: Partial<Record<EmotionKey, number>>;
  negative: Partial<Record<EmotionKey, number>>;
}

export const CORE_AXES: AffectAxisSpec[] = [
  {
    id: "composure",
    label: "Composure",
    description: "Steady and unhurried against anxious, flustered or afraid.",
    positive: { calmness: 1, concentration: 0.6, contentment: 0.4, determination: 0.5 },
    negative: { anxiety: 1, fear: 0.8, distress: 0.8, embarrassment: 0.6, awkwardness: 0.6, confusion: 0.4, doubt: 0.4 },
  },
  {
    id: "warmth",
    label: "Warmth",
    description: "Sympathy and regard against contempt, disgust or anger.",
    positive: { sympathy: 1, admiration: 0.7, love: 0.6, adoration: 0.5, contentment: 0.4, amusement: 0.4, joy: 0.4, relief: 0.3 },
    negative: { contempt: 1, disgust: 0.8, anger: 0.8, boredom: 0.4, envy: 0.4 },
  },
  {
    id: "command",
    label: "Command",
    description: "Determination and pride against doubt, confusion or fatigue.",
    positive: { determination: 1, pride: 0.7, triumph: 0.6, concentration: 0.4, calmness: 0.3 },
    negative: { doubt: 0.8, confusion: 0.7, tiredness: 0.6, embarrassment: 0.5, shame: 0.5, anxiety: 0.4 },
  },
  {
    id: "candour",
    label: "Candour",
    description: "Open interest and realisation against guilt, shame or evasion.",
    positive: { realization: 0.8, interest: 0.7, joy: 0.4, surprisePositive: 0.4, contemplation: 0.3, relief: 0.4 },
    negative: { guilt: 0.8, shame: 0.8, awkwardness: 0.5, contempt: 0.4, doubt: 0.3, anxiety: 0.3 },
  },
  {
    id: "pressure",
    label: "Pressure",
    description: "Heat in the voice: anger, contempt and urgency against calm or boredom.",
    positive: { anger: 1, contempt: 0.7, distress: 0.7, determination: 0.5, excitement: 0.5, disgust: 0.4 },
    negative: { calmness: 0.8, boredom: 0.6, tiredness: 0.5, contentment: 0.4 },
  },
  {
    id: "showmanship",
    label: "Showmanship",
    description: "Delight, excitement and triumph against boredom or embarrassment.",
    positive: { amusement: 1, excitement: 0.8, triumph: 0.7, aestheticAppreciation: 0.6, joy: 0.5, entrancement: 0.5, pride: 0.4, awe: 0.4 },
    negative: { boredom: 1, tiredness: 0.8, awkwardness: 0.6, embarrassment: 0.5, doubt: 0.4 },
  },
];

export const AXIS_BY_ID: Record<string, AffectAxisSpec> = Object.fromEntries(CORE_AXES.map((a) => [a.id, a]));

function weightedSum(v: EmotionVector, weights: Partial<Record<EmotionKey, number>>): number {
  let sum = 0;
  for (const [k, w] of Object.entries(weights)) sum += (v[k as EmotionKey] ?? 0) * (w ?? 0);
  return sum;
}

/**
 * Signed score in [-1, 1]. Hume scores rarely exceed ~0.7 on any dimension, so
 * the denominator is half the larger weight total: a strong, clean expression
 * saturates the axis without needing every dimension to fire at once.
 */
export function scoreAxis(v: EmotionVector, spec: AffectAxisSpec): number {
  const pos = weightedSum(v, spec.positive);
  const neg = weightedSum(v, spec.negative);
  const posTotal = Object.values(spec.positive).reduce((a, b) => a + (b ?? 0), 0);
  const negTotal = Object.values(spec.negative).reduce((a, b) => a + (b ?? 0), 0);
  const denom = Math.max(posTotal, negTotal) * 0.5 || 1;
  const raw = (pos - neg) / denom;
  return Math.max(-1, Math.min(1, raw));
}

export interface AffectState {
  /** Exponential moving average across the session's utterances. */
  smoothed: EmotionVector;
  /** The most recent utterance's raw scores, or null before the first. */
  latest: EmotionVector | null;
  utterances: number;
  /** Axis scores computed from the smoothed vector. */
  axes: Record<string, number>;
  /** Axis scores computed from the latest utterance alone. */
  latestAxes: Record<string, number>;
  top: RankedDimension[];
}

export function computeAxes(v: EmotionVector, specs: AffectAxisSpec[] = CORE_AXES): Record<string, number> {
  const out: Record<string, number> = {};
  for (const spec of specs) out[spec.id] = scoreAxis(v, spec);
  return out;
}

export function createAffectState(specs: AffectAxisSpec[] = CORE_AXES): AffectState {
  const zero = zeroVector();
  return { smoothed: zero, latest: null, utterances: 0, axes: computeAxes(zero, specs), latestAxes: computeAxes(zero, specs), top: [] };
}

/**
 * Fold a new utterance into the state. alpha is the weight of the newest
 * utterance; 0.5 means the last three utterances carry most of the signal,
 * which matches how a listener judges a speaker: recent, not cumulative.
 */
export function updateAffect(state: AffectState, scores: EmotionVector, alpha = 0.5, specs: AffectAxisSpec[] = CORE_AXES): AffectState {
  const smoothed = zeroVector();
  const first = state.utterances === 0;
  for (const k of EMOTION_KEYS) {
    smoothed[k] = first ? scores[k] : state.smoothed[k] * (1 - alpha) + scores[k] * alpha;
  }
  return {
    smoothed,
    latest: scores,
    utterances: state.utterances + 1,
    axes: computeAxes(smoothed, specs),
    latestAxes: computeAxes(scores, specs),
    top: topDimensions(smoothed, 5),
  };
}

/** A short, verifiable summary for the director prompt and the debrief. */
export function describeAffect(state: AffectState, specs: AffectAxisSpec[] = CORE_AXES): string {
  if (state.utterances === 0) return "No utterance yet.";
  const latest = state.latest ? topDimensions(state.latest, 4) : [];
  const latestText = latest.map((d) => `${d.label} ${d.score.toFixed(2)}`).join(", ");
  const axesText = specs
    .map((s) => `${s.label} ${formatSigned(state.latestAxes[s.id] ?? 0)} (session ${formatSigned(state.axes[s.id] ?? 0)})`)
    .join("; ");
  return `Latest utterance reads: ${latestText}. Axes: ${axesText}.`;
}

export function formatSigned(n: number): string {
  const s = n.toFixed(2);
  return n > 0 ? `+${s}` : s;
}
