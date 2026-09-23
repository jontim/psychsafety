import { describe, it, expect } from "vitest";
import { MIRROR_ASKS, ASK_BY_ID, readAsk, scoreAsk, baselineFrom, calibrateAxes, heardAs, describeBaseline, HIGH_BAND, MIDDLE_BAND } from "../mirror.js";
import { computeAxes } from "../affect.js";
import { toneVector, type TonePreset } from "../mock-ear.js";
import { StorySession } from "../session.js";
import { shadowFell } from "../../worlds/shadow-fell/world.js";

const axesOf = (preset: TonePreset) => computeAxes(toneVector(preset));

describe("the Mirror", () => {
  it("asks five things, the plain voice first", () => {
    expect(MIRROR_ASKS.map((a) => a.id)).toEqual(["plain", "lie", "support", "command", "showman"]);
    expect(MIRROR_ASKS[0]!.targets).toEqual([]);
    for (const ask of MIRROR_ASKS) expect(ask.verdicts).toHaveLength(3);
  });

  it("reads each exemplar tone high on its own ask and low on its foil", () => {
    const cases: Array<[keyof typeof ASK_BY_ID, TonePreset, TonePreset]> = [
      ["lie", "calm", "guilty"],
      ["support", "warm", "contemptuous"],
      ["command", "commanding", "anxious"],
      ["showman", "showman", "deadpan"],
    ];
    for (const [id, good, foil] of cases) {
      const ask = ASK_BY_ID[id];
      const hit = readAsk(ask, axesOf(good));
      const miss = readAsk(ask, axesOf(foil));
      expect(hit.band, `${id} with ${good}`).toBe("high");
      expect(hit.score).toBeGreaterThanOrEqual(HIGH_BAND);
      expect(miss.band, `${id} with ${foil}`).toBe("low");
      expect(miss.score).toBeLessThan(MIDDLE_BAND);
      expect(hit.verdict).toBe(ask.verdicts[0]);
      expect(miss.verdict).toBe(ask.verdicts[2]);
    }
  });

  it("calls a deadpan lie half a lie", () => {
    const r = readAsk(ASK_BY_ID.lie, axesOf("deadpan"));
    expect(r.band).toBe("middle");
    expect(r.verdict).toContain("Half a lie");
  });

  it("scores the plain ask at zero and names what was heard", () => {
    const r = readAsk(ASK_BY_ID.plain, axesOf("warm"));
    expect(r.band).toBe("plain");
    expect(r.score).toBe(0);
    expect(r.heard[0]).toBe("warm");
    expect(heardAs(axesOf("commanding"))[0]).toBe("certain");
    expect(heardAs({ composure: 0.01, warmth: 0.02 })).toEqual([]);
  });

  it("takes a baseline from the plain line and shrinks the same habit next time", () => {
    const baseline = baselineFrom(toneVector("deadpan"), "2026-09-23T00:00:00.000Z");
    expect(baseline.takenAt).toBe("2026-09-23T00:00:00.000Z");
    const raw = axesOf("deadpan");
    const calibrated = calibrateAxes(raw, baseline);
    for (const k of Object.keys(raw)) expect(Math.abs(calibrated[k]!)).toBeLessThanOrEqual(Math.abs(raw[k]!) + 1e-9);
    expect(Math.abs(calibrated.showmanship!)).toBeLessThan(Math.abs(raw.showmanship!));
    // a flat speaker who then performs reads higher for it, not lower
    const showman = calibrateAxes(axesOf("showman"), baseline);
    expect(showman.showmanship!).toBeGreaterThan(axesOf("showman").showmanship!);
    expect(calibrateAxes(raw, null)).toEqual(raw);
    expect(describeBaseline(baseline)).toMatch(/^At rest you sound/);
  });

  it("scores against targets with signed weights and clamps", () => {
    expect(scoreAsk(ASK_BY_ID.support, { warmth: 1, pressure: -1, composure: 1 })).toBeCloseTo(1, 5);
    expect(scoreAsk(ASK_BY_ID.support, { warmth: -1, pressure: 1, composure: -1 })).toBeCloseTo(-1, 5);
  });

  it("calibrates a story session's readings against the baseline", () => {
    const baseline = baselineFrom(toneVector("deadpan"));
    const plain = new StorySession(shadowFell, "no-windows");
    const tuned = new StorySession(shadowFell, "no-windows", { baseline });
    plain.ingest("Sit.", toneVector("deadpan"));
    tuned.ingest("Sit.", toneVector("deadpan"));
    expect(plain.snapshot().calibrated).toBe(false);
    expect(tuned.snapshot().calibrated).toBe(true);
    const a = plain.snapshot().affect.latestAxes;
    const b = tuned.snapshot().affect.latestAxes;
    expect(Math.abs(b.showmanship!)).toBeLessThan(Math.abs(a.showmanship!));
    expect(Math.abs(b.pressure!)).toBeLessThan(Math.abs(a.pressure!));
  });
});
