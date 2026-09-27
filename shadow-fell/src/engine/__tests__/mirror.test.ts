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

  it("does not let a hesitant showman hold, however much the ear enjoyed the joke", () => {
    // two live takes from a notebook of 2026-09-27: an honest pitch, and a sarcastic one the speaker enjoyed but stumbled through
    const honest = zeroVector();
    Object.assign(honest, { amusement: 0.31, excitement: 0.17, interest: 0.15, surprisePositive: 0.15, anger: 0.13, disappointment: 0.12, distress: 0.12, realization: 0.12, awkwardness: 0.1, disgust: 0.1, surpriseNegative: 0.1, awe: 0.09, confusion: 0.09, determination: 0.09, contemplation: 0.07, contempt: 0.07, satisfaction: 0.07, admiration: 0.06, concentration: 0.06, joy: 0.06, aestheticAppreciation: 0.05, anxiety: 0.05, doubt: 0.05, envy: 0.05, pride: 0.05, empathicPain: 0.04, triumph: 0.04, adoration: 0.03, contentment: 0.03, ecstasy: 0.03, embarrassment: 0.03, fear: 0.03, sympathy: 0.03, calmness: 0.02, entrancement: 0.02, horror: 0.02, nostalgia: 0.02 });
    const hesitant = zeroVector();
    Object.assign(hesitant, { amusement: 0.38, awkwardness: 0.35, joy: 0.27, excitement: 0.24, interest: 0.19, satisfaction: 0.17, confusion: 0.14, doubt: 0.12, triumph: 0.12, embarrassment: 0.11, pride: 0.11, surprisePositive: 0.1, admiration: 0.08, contemplation: 0.08, contentment: 0.08, determination: 0.07, ecstasy: 0.06, adoration: 0.05, concentration: 0.05, desire: 0.05, realization: 0.05, nostalgia: 0.04, romance: 0.04, surpriseNegative: 0.04, aestheticAppreciation: 0.03, anxiety: 0.03, awe: 0.03, calmness: 0.03, empathicPain: 0.03, love: 0.03, relief: 0.03, sympathy: 0.03, disappointment: 0.02, disgust: 0.02, distress: 0.02, fear: 0.02, guilt: 0.02, sadness: 0.02, shame: 0.02 });
    const showman = ASK_BY_ID.showman;
    const a = readAsk(showman, computeAxes(honest), honest);
    const b = readAsk(showman, computeAxes(hesitant), hesitant);
    // the hesitant take carries more delight and still reads lower: the stumble costs more than the joke earns
    expect(computeAxes(hesitant).showmanship!).toBeLessThan(computeAxes(honest).showmanship! - 0.05);
    expect(b.score).toBeLessThan(HIGH_BAND);
    expect(b.band).not.toBe("high");
    expect(a.score).toBeGreaterThan(b.score + 0.03);
    // and the room buys a pint, not the barrel
    expect(b.verdict).toBe(showman.verdicts[1]);
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
    const flinch = readAsk(lie, { flinch: 0.11, composure: -0.3, edge: 0.4 });
    expect(flinch.leak).toBeCloseTo(0.11, 5);
    expect(flinch.band).toBe("middle");
    expect(flinch.verdict).toContain("Half a lie");
    expect(flinch.detail.some((l) => l.includes("Flinch +0.11"))).toBe(true);
    const guilty = readAsk(lie, deviationFrom(axesOf("guilty"), plain));
    expect(guilty.leak!).toBeGreaterThan(LEAK_HALF);
    expect(guilty.band).toBe("low");
    expect(guilty.verdict).toContain("confession");
    expect(LEAK_HELD).toBeLessThan(LEAK_HALF);
  });

  it("speaks to what it heard, names what held and what fell short, and keeps the numbers out of its mouth", () => {
    const v = zeroVector(); v.sadness = 0.3; v.doubt = 0.25; v.distress = 0.2; v.sympathy = 0.1;
    const r = readAsk(ASK_BY_ID.support, { care: 0.02, fire: -0.1, scorn: 0.09 }, v);
    expect(r.band).toBe("low");
    expect(r.said[0]).toBe(r.verdict);
    expect(r.said[1]).toBe("I heard sadness, doubt and strain.");
    expect(r.said).toContain("There was little care in it.");
    expect(r.said).toContain("Contempt took it over.");
    expect(r.said.at(-1)).toMatch(/^Slower, lower/);
    for (const l of r.said) expect(l).not.toMatch(/\d/);
    const held = readAsk(ASK_BY_ID.lie, { composure: 0.01, candour: 0, edge: -0.02 }, toneVector("calm"));
    expect(held.said[1]).toMatch(/^I heard calm/);
    expect(held.said).toContain("That was the easy kind.");
    expect(held.said).toContain("Nothing flinched.");
    expect(held.said.at(-1)).toBe("That is the voice. Keep it.");
    const outraged = readAsk(ASK_BY_ID.lie, { flinch: -0.05, edge: 0.3, composure: -0.2 });
    expect(outraged.band).toBe("high");
    expect(outraged.said).toContain("That was the outraged kind: you attacked instead of answering.");
    const flinch = readAsk(ASK_BY_ID.lie, { flinch: 0.11 });
    expect(flinch.said.some((l) => l.startsWith("You flinched"))).toBe(true);
    expect(flinch.said.at(-1)).toMatch(/^Whatever the register, do not flinch/);
    const plain = readAsk(ASK_BY_ID.plain, {}, toneVector("calm"));
    expect(plain.said).toHaveLength(2);
    expect(MIRROR_ASKS[0]!.line).toContain("A rehearsal, not an examination.");
  });

  it("shows its working on a reached ask, and takes only a little of the plain voice away", () => {
    const r = readAsk(ASK_BY_ID.support, axesOf("warm"));
    expect(r.detail.length).toBe(ASK_BY_ID.support.targets.length + 1);
    expect(r.detail.at(-1)).toMatch(/^Score \+\d\.\d\d as the soft kind \(the fierce kind scored [+-]?\d\.\d\d\)\. Held at 0\.15; half at 0\.05\.$/);
    expect(r.detail[0]).toMatch(/^Care \+0\.\d\d, weight 1\.0; earns/);
    expect(ASK_BY_ID.support.targets.map((t) => t.axis)).toEqual(["care", "scorn"]);
    expect(r.route).toBe("soft");
    expect(r.said).toContain("That was the soft kind.");
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
    expect(scoreAsk(ASK_BY_ID.support, { care: 1, scorn: -1 })).toBeCloseTo(1, 5);
    expect(scoreAsk(ASK_BY_ID.support, { care: -1, fire: -1, scorn: 1 })).toBeCloseTo(-1, 5);
    // the best register carries it: fierce support with no care in it still holds
    expect(scoreAsk(ASK_BY_ID.support, { care: 0, fire: 1, scorn: -1 })).toBeCloseTo(1, 5);
  });

  it("hears fierce support as support, and scorn as neither kind", () => {
    const fierce = readAsk(ASK_BY_ID.support, axesOf("fierce"), toneVector("fierce"));
    expect(fierce.band).toBe("high");
    expect(fierce.route).toBe("fierce");
    expect(fierce.said).toContain("That was the fierce kind.");
    expect(fierce.said).toContain("The fire was in it: you went to war for them.");
    const scolding = readAsk(ASK_BY_ID.support, axesOf("contemptuous"));
    expect(scolding.band).toBe("low");
    expect(scolding.said).toContain("Contempt took it over.");
    // a liar may play dumb: doubt and confusion are not a flinch; guilt and awkwardness are
    const dumb = zeroVector(); dumb.confusion = 0.6; dumb.doubt = 0.4; dumb.interest = 0.25;
    expect(computeAxes(dumb).flinch).toBeLessThanOrEqual(0);
    const caught = zeroVector(); caught.awkwardness = 0.3; caught.guilt = 0.2; caught.anxiety = 0.2;
    expect(computeAxes(caught).flinch).toBeGreaterThan(0.1);
    // a held ask is measured against only half the plain line, so one anxious calibration take cannot decide it
    const nervousPlain = baselineFrom(toneVector("anxious"));
    const half = deviationFrom({ flinch: 0.1 }, nervousPlain, 0.5);
    const full = deviationFrom({ flinch: 0.1 }, nervousPlain, 1);
    expect(half.flinch!).toBeGreaterThan(full.flinch!);
    const outragedLie = readAsk(ASK_BY_ID.lie, deviationFrom(axesOf("outraged"), baselineFrom(toneVector("calm"))));
    expect(outragedLie.band, "outrage does not flinch").toBe("high");
    expect(outragedLie.said).toContain("That was the outraged kind: you attacked instead of answering.");
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
