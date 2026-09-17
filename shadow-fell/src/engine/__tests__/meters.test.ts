import { describe, it, expect } from "vitest";
import { initMeters, applyDrift, applyDeltas, type MeterSpec } from "../meters.js";

const specs: MeterSpec[] = [
  { id: "standing", label: "Standing", description: "", start: 50, axes: [{ axis: "command", weight: 1 }, { axis: "composure", weight: 0.5 }] },
  { id: "rapport", label: "Rapport", description: "", start: 20, axes: [{ axis: "warmth", weight: 1 }, { axis: "pressure", weight: -0.5 }] },
];

describe("meters", () => {
  it("initialises from the spec", () => {
    expect(initMeters(specs)).toEqual({ standing: 50, rapport: 20 });
  });

  it("drifts with the axes and reports the deltas", () => {
    const values = initMeters(specs);
    const deltas = applyDrift(values, specs, { command: 1, composure: 1, warmth: -1, pressure: 1 });
    expect(deltas.standing).toBeCloseTo(9, 5); // (1 + 0.5) * 6
    expect(deltas.rapport).toBeCloseTo(-9, 5); // (-1 - 0.5) * 6
    expect(values.standing).toBe(59);
    expect(values.rapport).toBe(11);
  });

  it("clamps to 0..100 and bounds director deltas to 25", () => {
    const values = initMeters(specs);
    applyDeltas(values, specs, { standing: 80, rapport: -80, unknown: 50 });
    expect(values.standing).toBe(75);
    expect(values.rapport).toBe(0);
    expect(values).not.toHaveProperty("unknown");
  });
});
