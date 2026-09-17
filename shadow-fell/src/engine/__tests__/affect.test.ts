import { describe, it, expect } from "vitest";
import { createAffectState, updateAffect, scoreAxis, AXIS_BY_ID, describeAffect, CORE_AXES } from "../affect.js";
import { toneVector, blend } from "../mock-ear.js";

describe("affect axes", () => {
  it("reads a calm voice as composed and an anxious voice as not", () => {
    expect(scoreAxis(toneVector("calm"), AXIS_BY_ID.composure!)).toBeGreaterThan(0.3);
    expect(scoreAxis(toneVector("anxious"), AXIS_BY_ID.composure!)).toBeLessThan(-0.3);
  });

  it("reads contempt as cold and sympathy as warm", () => {
    expect(scoreAxis(toneVector("contemptuous"), AXIS_BY_ID.warmth!)).toBeLessThan(-0.3);
    expect(scoreAxis(toneVector("warm"), AXIS_BY_ID.warmth!)).toBeGreaterThan(0.3);
  });

  it("reads a commanding voice as command and a guilty voice as low candour", () => {
    expect(scoreAxis(toneVector("commanding"), AXIS_BY_ID.command!)).toBeGreaterThan(0.4);
    expect(scoreAxis(toneVector("guilty"), AXIS_BY_ID.candour!)).toBeLessThan(-0.3);
  });

  it("keeps every axis inside [-1, 1]", () => {
    for (const spec of CORE_AXES) {
      for (const preset of ["calm", "angry", "showman", "deadpan"] as const) {
        const s = scoreAxis(toneVector(preset), spec);
        expect(s).toBeGreaterThanOrEqual(-1);
        expect(s).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("affect state", () => {
  it("takes the first utterance verbatim and then smooths", () => {
    let s = createAffectState();
    s = updateAffect(s, toneVector("calm"));
    expect(s.utterances).toBe(1);
    expect(s.smoothed.calmness).toBeCloseTo(0.7, 5);
    s = updateAffect(s, toneVector("anxious"));
    expect(s.utterances).toBe(2);
    // halfway between 0.7 and the anxious preset's baseline 0.03
    expect(s.smoothed.calmness).toBeCloseTo((0.7 + 0.03) / 2, 5);
    expect(s.latestAxes.composure).toBeLessThan(0);
    expect(s.axes.composure).toBeGreaterThan(s.latestAxes.composure!);
  });

  it("describes the latest utterance in verifiable words", () => {
    let s = createAffectState();
    s = updateAffect(s, blend([{ preset: "warm", weight: 1 }, { preset: "calm", weight: 1 }]));
    const text = describeAffect(s);
    expect(text).toMatch(/Latest utterance reads: /);
    expect(text).toMatch(/Composure \+/);
    expect(text).toMatch(/Warmth \+/);
  });
});
