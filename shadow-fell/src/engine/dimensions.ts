/**
 * The 48 expression dimensions Hume's prosody model returns on every user
 * utterance inside an EVI session. Keys match the Hume SDK's EmotionScores
 * (camelCase); labels are the human-readable names Hume uses in its docs.
 */
export const EMOTION_KEYS = [
  "admiration", "adoration", "aestheticAppreciation", "amusement", "anger",
  "anxiety", "awe", "awkwardness", "boredom", "calmness", "concentration",
  "confusion", "contemplation", "contempt", "contentment", "craving", "desire",
  "determination", "disappointment", "disgust", "distress", "doubt", "ecstasy",
  "embarrassment", "empathicPain", "entrancement", "envy", "excitement", "fear",
  "guilt", "horror", "interest", "joy", "love", "nostalgia", "pain", "pride",
  "realization", "relief", "romance", "sadness", "satisfaction", "shame",
  "surpriseNegative", "surprisePositive", "sympathy", "tiredness", "triumph",
] as const;

export type EmotionKey = (typeof EMOTION_KEYS)[number];
export type EmotionVector = Record<EmotionKey, number>;

export const EMOTION_LABELS: Record<EmotionKey, string> = {
  admiration: "Admiration", adoration: "Adoration",
  aestheticAppreciation: "Aesthetic appreciation", amusement: "Amusement",
  anger: "Anger", anxiety: "Anxiety", awe: "Awe", awkwardness: "Awkwardness",
  boredom: "Boredom", calmness: "Calmness", concentration: "Concentration",
  confusion: "Confusion", contemplation: "Contemplation", contempt: "Contempt",
  contentment: "Contentment", craving: "Craving", desire: "Desire",
  determination: "Determination", disappointment: "Disappointment",
  disgust: "Disgust", distress: "Distress", doubt: "Doubt", ecstasy: "Ecstasy",
  embarrassment: "Embarrassment", empathicPain: "Empathic pain",
  entrancement: "Entrancement", envy: "Envy", excitement: "Excitement",
  fear: "Fear", guilt: "Guilt", horror: "Horror", interest: "Interest",
  joy: "Joy", love: "Love", nostalgia: "Nostalgia", pain: "Pain", pride: "Pride",
  realization: "Realization", relief: "Relief", romance: "Romance",
  sadness: "Sadness", satisfaction: "Satisfaction", shame: "Shame",
  surpriseNegative: "Surprise (negative)", surprisePositive: "Surprise (positive)",
  sympathy: "Sympathy", tiredness: "Tiredness", triumph: "Triumph",
};

export function zeroVector(): EmotionVector {
  const out = {} as EmotionVector;
  for (const k of EMOTION_KEYS) out[k] = 0;
  return out;
}

const KEY_BY_FOLDED = new Map<string, EmotionKey>();
for (const k of EMOTION_KEYS) {
  KEY_BY_FOLDED.set(fold(k), k);
  KEY_BY_FOLDED.set(fold(EMOTION_LABELS[k]), k);
}

/** Lower-case and strip everything that is not a letter or digit. */
function fold(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Accepts scores keyed either by the SDK's camelCase keys or by Hume's display
 * names ("Aesthetic Appreciation", "Surprise (negative)") and returns a full,
 * clamped 48-dimension vector. Unknown keys are ignored; missing keys are 0.
 */
export function normalizeScores(input: Record<string, unknown> | null | undefined): EmotionVector {
  const out = zeroVector();
  if (!input) return out;
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = KEY_BY_FOLDED.get(fold(rawKey));
    if (!key) continue;
    const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
    if (!Number.isFinite(value)) continue;
    out[key] = Math.min(1, Math.max(0, value));
  }
  return out;
}

export interface RankedDimension {
  key: EmotionKey;
  label: string;
  score: number;
}

export function topDimensions(v: EmotionVector, n = 5): RankedDimension[] {
  return EMOTION_KEYS
    .map((key) => ({ key, label: EMOTION_LABELS[key], score: v[key] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}
