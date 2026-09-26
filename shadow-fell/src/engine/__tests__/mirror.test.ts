import { describe, it, expect } from "vitest";
import { MIRROR_ASKS, ASK_BY_ID, readAsk, scoreAsk, baselineFrom, calibrateAxes, deviationFrom, heardAs, describeBaseline, HIGH_BAND, MIDDLE_BAND, LEAK_HELD, LEAK_HALF, CALIBRATION_STRENGTH } from "../mirror.js";
import { computeAxes } from "../affect.js";
import { zeroVector } from "../dimensions.js";
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

  it("reads each exemplar tone high on its reached ask and low on its foil", () => {
    const cases: Array<[keyof typeof ASK_BY_ID, TonePreset, TonePreset]> = [
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

  it("believes a lie told in your own plain voice, hears a flinch as half a lie, and guilt as a confession", () => {
    const lie = ASK_BY_ID.lie;
    expect(lie.judge).toBe("hold");
    const plain = baselineFrom(toneVector("calm"));
    const perfect = readAsk(lie, deviationFrom(axesOf("calm"), plain));
    expect(perfect.leak).toBe(0);
    expect(perfect.score).toBe(1);
    expect(perfect.band).toBe("high");
    expect(perfect.verdict).toContain("A stranger would believe you");
    expect(perfect.detail.at(-1)).toContain("Leaked 0.00");
    // steadier and slower than at rest is not a leak either
    expect(readAsk(lie, { composure: 0.2, pressure: 0.3, candour: 0.1, edge: -0.1 }).band).toBe("high");
    const flinch = readAsk(lie, { composure: -0.08, edge: 0.06, candour: 0 });
    expect(flinch.leak).toBeCloseTo(0.11, 5);
    expect(flinch.band).toBe("middle");
    expect(flinch.verdict).toContain("Half a lie");
    expect(flinch.detail.some((l) => l.includes("Composure -0.08"))).toBe(true);
    const guilty = readAsk(lie, deviationFrom(axesOf("guilty"), plain));
    expect(guilty.leak!).toBeGreaterThan(LEAK_HALF);
    expect(guilty.band).toBe("low");
    expect(guilty.verdict).toContain("confession");
    expect(LEAK_HELD).toBeLessThan(LEAK_HALF);
  });

  it("speaks to what it heard, names what held and what fell short, and keeps the numbers out of its mouth", () => {
    const v = zeroVector(); v.sadness = 0.3; v.doubt = 0.25; v.distress = 0.2; v.sympathy = 0.1;
    const r = readAsk(ASK_BY_ID.support, { care: 0.02, edge: 0.09 }, v);
    expect(r.band).toBe("low");
    expect(r.said[0]).toBe(r.verdict);
    expect(r.said[1]).toBe("I heard sadness, doubt and strain.");
    expect(r.said).toContain("There was little care in it.");
    expect(r.said).toContain("The edge took it over.");
    expect(r.said.at(-1)).toMatch(/^Slower, lower/);
    for (const l of r.said) expect(l).not.toMatch(/\d/);
    const held = readAsk(ASK_BY_ID.lie, { composure: 0.01, candour: 0, edge: -0.02 }, toneVector("calm"));
    expect(held.said[1]).toMatch(/^I heard calm/);
    expect(held.said).toContain("Your composure held.");
    expect(held.said.at(-1)).toBe("That is the voice. Keep it.");
    const flinch = readAsk(ASK_BY_ID.lie, { composure: -0.08, edge: 0.06, candour: 0 });
    expect(flinch.said.some((l) => l.startsWith("Your composure dropped"))).toBe(true);
    expect(flinch.said.at(-1)).toMatch(/^Say it the way you told me your breakfast/);
    const plain = readAsk(ASK_BY_ID.plain, {}, toneVector("calm"));
    expect(plain.said).toHaveLength(2);
    expect(MIRROR_ASKS[0]!.line).toContain("A rehearsal, not an examination.");
  });

  it("shows its working on a reached ask, and takes only a little of the plain voice away", () => {
    const r = readAsk(ASK_BY_ID.support, axesOf("warm"));
    expect(r.detail.length).toBe(ASK_BY_ID.support.targets.length + 1);
    expect(r.detail.at(-1)).toMatch(/^Score \+\d\.\d\d\. Held at 0\.25; half at 0\.05\.$/);
    expect(r.detail[0]).toMatch(/^Care \+0\.\d\d, weight 1\.0; earns/);
    expect(ASK_BY_ID.support.targets.map((t) => t.axis)).toEqual(["care", "edge"]);
    expect(CALIBRATION_STRENGTH).toBeLessThan(0.5);
    expect(readAsk(ASK_BY_ID.plain, {}).detail[0]).toContain("plain line");
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
    expect(scoreAsk(ASK_BY_ID.support, { care: 1, edge: -1 })).toBeCloseTo(1, 5);
    expect(scoreAsk(ASK_BY_ID.support, { care: -1, edge: 1 })).toBeCloseTo(-1, 5);
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
