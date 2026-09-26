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
    expect(w.chart?.waypoints[0]?.routes).toEqual([]);
    expect(w.chart?.onward).toEqual([]);
    expect(w.chart?.foreknowledge).toBe(false);
    expect(w.chart?.vehicles).toEqual({});
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
    const badPlace = defineWorld({ ...base(), chart: chart({ places: [{ id: "p", label: "P", at: [1, 1], inset: "nowhere" }] }) });
    expect(validateWorld(badPlace)).toContain("Chart: place p names unknown inset nowhere");
  });

  it("binds a plate of a place into the sheet as a panel inset, with scenes and places inside it", () => {
    const panel = defineWorld({ ...base(), chart: chart({
      insets: [{ id: "hall", title: "Hall", shape: "panel", image: "/hall.webp", box: [0, 60, 40, 20], anchor: [50, 50], exit: [40, 70] }],
      waypoints: [{ beat: "one", at: [10, 70], place: "x", inset: "hall", view: { src: "/hall-view.webp", caption: "The hall" } }, { beat: "two", at: [50, 50], place: "y" }],
      places: [{ id: "table", label: "The table", at: [20, 72], glyph: "site", inset: "hall" }],
    }) });
    expect(validateWorld(panel)).toEqual([]);
    expect(panel.chart?.insets[0]?.shape).toBe("panel");
    expect(panel.chart?.insets[0]?.plan).toEqual([]);
    const circle = defineWorld({ ...base(), chart: chart({ insets: [{ id: "c", title: "C", box: [0, 0, 30, 30], anchor: [50, 50], exit: [30, 15] }] }) });
    expect(circle.chart?.insets[0]?.shape, "a circle unless said otherwise").toBe("circle");
  });

  it("knows its vehicles and the beats that reveal a name", () => {
    const badVehicle = defineWorld({ ...base(), chart: chart({ waypoints: [{ beat: "one", at: [1, 1], place: "x" }, { beat: "two", at: [2, 2], place: "y", by: "balloon" }] }) });
    expect(validateWorld(badVehicle)).toContain("Chart: waypoint two travels by unknown vehicle balloon");
    const badReveal = defineWorld({ ...base(), chart: chart({ regions: [{ id: "r", label: "R", at: [5, 5], reveal: "nine" }] }) });
    expect(validateWorld(badReveal)).toContain("Chart: region r is revealed by unknown beat nine");
    const never = defineWorld({ ...base(), chart: chart({ regions: [{ id: "r", label: "R", at: [5, 5], reveal: "never" }, { id: "n", label: "N", at: [6, 6], reveal: "near", reach: 30 }], places: [{ id: "p", label: "P", at: [7, 7], reveal: "near" }] }) });
    expect(validateWorld(never)).toEqual([]);
    const plated = defineWorld({ ...base(), chart: chart({ land: undefined, plate: { clean: "/p.jpg" }, vehicles: { sky: { src: "/s.png", width: 10, height: 10 } }, waypoints: [{ beat: "one", at: [1, 1], place: "x" }, { beat: "two", at: [2, 2], place: "y", by: "sky" }] }) });
    expect(validateWorld(plated)).toEqual([]);
    expect(plated.chart?.vehicles.sky?.faces).toBe("right");
    const bare = defineWorld({ ...base(), chart: chart({ land: undefined }) });
    expect(validateWorld(bare)).toContain("Chart: no plate and no land to draw");
  });

  it("is optional: a world without one still validates", () => {
    expect(validateWorld(defineWorld(base()))).toEqual([]);
  });
});
