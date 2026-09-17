import { describe, it, expect } from "vitest";
import { EMOTION_KEYS, normalizeScores, topDimensions, zeroVector } from "../dimensions.js";

describe("dimensions", () => {
  it("has exactly 48 keys", () => {
    expect(EMOTION_KEYS).toHaveLength(48);
    expect(new Set(EMOTION_KEYS).size).toBe(48);
  });

  it("normalises SDK camelCase keys and Hume display names alike", () => {
    const a = normalizeScores({ aestheticAppreciation: 0.4, surpriseNegative: 0.2, calmness: 0.9 });
    const b = normalizeScores({ "Aesthetic Appreciation": 0.4, "Surprise (negative)": 0.2, Calmness: 0.9 });
    expect(a).toEqual(b);
    expect(a.aestheticAppreciation).toBe(0.4);
    expect(a.surpriseNegative).toBe(0.2);
  });

  it("clamps out-of-range values and ignores unknown keys", () => {
    const v = normalizeScores({ joy: 1.7, anger: -3, nonsense: 0.5, fear: "0.25" });
    expect(v.joy).toBe(1);
    expect(v.anger).toBe(0);
    expect(v.fear).toBe(0.25);
    expect(Object.keys(v)).toHaveLength(48);
  });

  it("ranks the top dimensions", () => {
    const v = zeroVector();
    v.triumph = 0.8;
    v.pride = 0.5;
    v.doubt = 0.1;
    const top = topDimensions(v, 2);
    expect(top.map((d) => d.key)).toEqual(["triumph", "pride"]);
    expect(top[0]!.label).toBe("Triumph");
  });
});
