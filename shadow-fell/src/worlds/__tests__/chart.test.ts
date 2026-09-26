import { describe, it, expect } from "vitest";
import { shadowFell } from "../shadow-fell/world.js";
import { publicWorld } from "../index.js";

describe("The Shadow Fell chart", () => {
  const chart = shadowFell.chart!;
  const beats = shadowFell.acts.flatMap((a) => a.beats);

  it("charts every scene, with the four palace scenes in the Sky Palace inset", () => {
    expect(chart).toBeDefined();
    const charted = new Set(chart.waypoints.map((w) => w.beat));
    for (const b of beats) expect(charted.has(b.id), b.id).toBe(true);
    const inPalace = chart.waypoints.filter((w) => w.inset === "palace").map((w) => w.beat);
    expect(inPalace).toEqual(["no-windows", "the-dispatch", "the-study", "the-proclamation"]);
    const palace = chart.insets.find((i) => i.id === "palace")!;
    for (const w of chart.waypoints.filter((x) => x.inset === "palace")) {
      expect(Math.hypot(w.at[0] - palace.cx, w.at[1] - palace.cy), w.beat).toBeLessThan(palace.r - 6);
    }
  });

  it("gives the three early endings a place off the road", () => {
    expect(chart.endings.map((e) => e.outcome).sort()).toEqual(["named", "war", "weak"]);
    for (const e of chart.endings) expect(e.label).toBeTruthy();
  });

  it("keeps the sheet inside its own bounds and names no town on the tour", () => {
    for (const w of chart.waypoints) {
      expect(w.at[0]).toBeGreaterThanOrEqual(0); expect(w.at[0]).toBeLessThanOrEqual(chart.width);
      expect(w.at[1]).toBeGreaterThanOrEqual(0); expect(w.at[1]).toBeLessThanOrEqual(chart.height);
    }
    const tour = chart.waypoints.filter((w) => !w.inset);
    for (const w of tour) expect(w.place, w.beat).not.toMatch(/\b(Mhasun|Vesperin|Valerith|Rivenhearth|Avarand)\b/);
  });

  it("rides Jon's plate: a ship for the flight north, a carriage with both facings for the tour, names revealed by the road", () => {
    expect(chart.plate?.clean).toBeTruthy();
    expect(chart.plate?.lettered).toBeTruthy();
    expect(chart.vehicles.sky?.faces).toBe("left");
    expect(chart.vehicles.road?.alt, "the wagon has lettering, so it needs its own left-facing artwork").toBeTruthy();
    expect(chart.waypoints.find((w) => w.beat === "your-deniables")?.by).toBe("sky");
    for (const id of ["make-it-famous", "the-alley", "stay-inconspicuous", "morning", "the-carriage"]) expect(chart.waypoints.find((w) => w.beat === id)?.by, id).toBe("road");
    for (const w of chart.waypoints.filter((x) => x.inset)) expect(w.by).toBeUndefined();
    const revealedBy = new Set(chart.regions.map((r) => r.reveal).filter((x) => x && x !== "never"));
    expect([...revealedBy].sort()).toEqual(["make-it-famous", "the-carriage", "your-deniables"]);
    expect(chart.regions.find((r) => r.id === "halyra")?.reveal).toBeUndefined();
    for (const id of ["tharcia", "mhasun", "finnegans"]) expect(chart.regions.find((r) => r.id === id)?.reveal, `${id} stays under the mask`).toBe("never");
    for (const r of chart.regions) expect(r.box, r.id).toBeDefined();
    expect(chart.plate?.letters).toBeTruthy();
  });

  it("reaches the player: the public world keeps the chart", () => {
    expect(publicWorld(shadowFell).chart?.waypoints.length).toBe(beats.length);
  });
});
