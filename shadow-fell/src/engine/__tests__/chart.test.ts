import { describe, it, expect } from "vitest";
import { defineWorld, validateWorld, type WorldInput } from "../world.js";

const voice = { provider: "browser" as const, description: "plain" };
const cast = [
  { id: "a", name: "A", faction: "x", summary: "a", register: "plain", voice },
  { id: "b", name: "B", faction: "x", summary: "b", register: "plain", voice },
];
const beat = (id: string, extra: Record<string, unknown> = {}) => ({
  id, title: id, stance: "reading" as const, playerRole: "a", counterpart: "b", location: "here", goal: "g", notes: "n", opening: "o", succeedWhen: "s", failWhen: "f", meters: [], maxTurns: 3, ...extra,
});
const base = (): WorldInput => ({
  id: "w", title: "W", tagline: "t", premise: "p", palette: {}, cast,
  roles: [{ id: "a", label: "A", summary: "a" }],
  meters: [{ id: "m", label: "M", description: "d", start: 50, axes: [] }],
  acts: [{ id: "act", title: "Act", summary: "s", beats: [
    beat("one", { outcomes: { on: { label: "On", when: "w", next: "two" }, off: { label: "Off", when: "w", status: "fail", next: null, ending: "It ends." } } }),
    beat("two"),
  ] }],
});
const chart = (over: Record<string, unknown> = {}) => ({
  width: 100, height: 100, title: "Chart", land: "M 0 0 L 100 0 L 100 100 L 0 100 Z",
  waypoints: [{ beat: "one", at: [10, 10] as [number, number], place: "here" }, { beat: "two", at: [50, 50] as [number, number], place: "there" }],
  endings: [{ outcome: "off", at: [80, 80] as [number, number], label: "Off the edge" }],
  ...over,
});

describe("the chart", () => {
  it("accepts a chart that places every beat and every ending", () => {
    const w = defineWorld({ ...base(), chart: chart() });
    expect(validateWorld(w)).toEqual([]);
    expect(w.chart?.waypoints[0]?.via).toEqual([]);
    expect(w.chart?.endings[0]?.glyph).toBe("storm");
  });

  it("wants a waypoint for every beat, and no waypoint for a beat that is not there", () => {
    const missing = defineWorld({ ...base(), chart: chart({ waypoints: [{ beat: "one", at: [1, 1], place: "x" }] }) });
    expect(validateWorld(missing)).toContain("Chart: beat two has no waypoint");
    const stray = defineWorld({ ...base(), chart: chart({ waypoints: [...chart().waypoints, { beat: "nine", at: [1, 1], place: "x" }] }) });
    expect(validateWorld(stray)).toContain("Chart: waypoint for unknown beat nine");
  });

  it("wants every ending on the chart, and knows an inset by name", () => {
    const unplaced = defineWorld({ ...base(), chart: chart({ endings: [] }) });
    expect(validateWorld(unplaced)).toContain("Chart: ending off has no place on the chart");
    const badInset = defineWorld({ ...base(), chart: chart({ waypoints: [{ beat: "one", at: [1, 1], place: "x", inset: "nowhere" }, { beat: "two", at: [2, 2], place: "y" }] }) });
    expect(validateWorld(badInset)).toContain("Chart: waypoint one names unknown inset nowhere");
  });

  it("is optional: a world without one still validates", () => {
    expect(validateWorld(defineWorld(base()))).toEqual([]);
  });
});
