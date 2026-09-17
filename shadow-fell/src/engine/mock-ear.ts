import { EMOTION_KEYS, type EmotionKey, type EmotionVector, zeroVector } from "./dimensions.js";

/**
 * Tone presets for playing without a microphone or a Hume session. Each is a
 * sparse expression profile; blend() mixes them. Deterministic on purpose so
 * tests and offline demos behave the same every time.
 */
export const TONE_PRESETS = {
  calm: { calmness: 0.7, concentration: 0.4, contentment: 0.3, determination: 0.3, interest: 0.3 },
  anxious: { anxiety: 0.7, fear: 0.4, distress: 0.4, doubt: 0.3, embarrassment: 0.3 },
  contemptuous: { contempt: 0.7, disgust: 0.4, anger: 0.3, boredom: 0.3, pride: 0.3 },
  warm: { sympathy: 0.6, admiration: 0.4, love: 0.3, contentment: 0.4, amusement: 0.3, joy: 0.3 },
  commanding: { determination: 0.8, pride: 0.5, calmness: 0.4, concentration: 0.4, triumph: 0.3 },
  deadpan: { boredom: 0.5, calmness: 0.4, tiredness: 0.3, contemplation: 0.3 },
  showman: { amusement: 0.7, excitement: 0.6, triumph: 0.5, aestheticAppreciation: 0.4, joy: 0.4, pride: 0.3 },
  guilty: { guilt: 0.6, shame: 0.5, awkwardness: 0.4, anxiety: 0.4, sadness: 0.3 },
  curious: { interest: 0.7, realization: 0.4, contemplation: 0.4, surprisePositive: 0.3 },
  angry: { anger: 0.8, contempt: 0.4, distress: 0.3, determination: 0.4 },
} satisfies Record<string, Partial<Record<EmotionKey, number>>>;

export type TonePreset = keyof typeof TONE_PRESETS;
export const TONE_NAMES = Object.keys(TONE_PRESETS) as TonePreset[];

const BASELINE = 0.03;

export function toneVector(preset: TonePreset): EmotionVector {
  const v = zeroVector();
  for (const k of EMOTION_KEYS) v[k] = BASELINE;
  for (const [k, value] of Object.entries(TONE_PRESETS[preset])) v[k as EmotionKey] = value as number;
  return v;
}

/** Weighted blend of presets; weights are normalised so they need not sum to one. */
export function blend(parts: Array<{ preset: TonePreset; weight: number }>): EmotionVector {
  const total = parts.reduce((a, p) => a + Math.max(0, p.weight), 0) || 1;
  const out = zeroVector();
  for (const { preset, weight } of parts) {
    if (weight <= 0) continue;
    const v = toneVector(preset);
    for (const k of EMOTION_KEYS) out[k] += (v[k] * weight) / total;
  }
  return out;
}
