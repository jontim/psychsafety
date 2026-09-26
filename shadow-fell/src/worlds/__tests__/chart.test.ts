import { describe, it, expect } from "vitest";
import { shadowFell } from "../shadow-fell/world.js";
import { publicWorld } from "../index.js";

describe("The Shadow Fell chart", () => {
  const chart = shadowFell.chart!;
  const beats = shadowFell.acts.flatMap((a) => a.beats);

  it("charts every scene: the three palace scenes on the palace plate, the Congress on the land below, the sheet blank ahead", () => {
    expect(chart).toBeDefined();
    const charted = new Set(chart.waypoints.map((w) => w.beat));
    for (const b of beats) expect(charted.has(b.id), b.id).toBe(true);
    expect(chart.foreknowledge, "no road ahead of the player is on the sheet").toBe(false);
    const palace = chart.insets.find((i) => i.id === "palace")!;
    expect(palace.shape, "Jon's overview plate, bound into the sheet as a panel").toBe("panel");
    expect(palace.image).toMatch(/^\/chart\//);
    const [px, py, pw, ph] = palace.box;
    for (const id of ["no-windows", "the-dispatch", "the-study"]) {
      const w = chart.waypoints.find((x) => x.beat === id)!;
      expect(w.inset, `${id} is in the palace`).toBe("palace");
      expect(w.by, `${id} is reached on foot, no vehicle over the plate`).toBeUndefined();
      expect(w.at[0], `${id} on the panel`).toBeGreaterThan(px); expect(w.at[0], `${id} on the panel`).toBeLessThan(px + pw);
      expect(w.at[1], `${id} on the panel`).toBeGreaterThan(py); expect(w.at[1], `${id} on the panel`).toBeLessThan(py + ph);
      expect(w.view?.src, `${id} shows a plate of the place when boarded`).toMatch(/^\/chart\/palace/);
    }
    const halyra = chart.regions.find((r) => r.id === "halyra")!.box!;
    const congress = chart.waypoints.find((x) => x.beat === "the-proclamation")!;
    expect(congress.inset, "the Congress is not in the palace").toBeUndefined();
    expect(congress.by, "the Humā takes the Caliph down to it").toBe("sky");
    expect(Math.abs(congress.at[0] - (halyra[0] + halyra[2] / 2)), "within the enclave").toBeLessThan(halyra[2]);
    expect(congress.at[1], "on the land below, not over the palace").toBeGreaterThan(halyra[1] + halyra[3]);
    expect(Math.abs(palace.anchor[0] - (halyra[0] + halyra[2] / 2)), "the palace hangs over the enclave").toBeLessThan(halyra[2]);
    const ship = chart.vehicles.sky!;
    expect(Math.hypot(congress.at[0] - palace.anchor[0], congress.at[1] - palace.anchor[1]), "the palace hangs half a mile above the hall: a hop down").toBeLessThan(ship.width);
    expect(congress.view?.src, "Jon's sheet of the Eightfold Hall is the scene's view").toBe("/chart/congress.webp");
    const dinner = chart.places.find((p) => p.id === "dinner")!;
    expect(dinner.inset).toBe("palace");
    expect(dinner.reveal, "where it happened is marked from the start").toBeUndefined();
    expect(dinner.at[0]).toBeGreaterThan(px); expect(dinner.at[0]).toBeLessThan(px + pw);
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
    for (const w of chart.waypoints) if (!w.inset) expect(w.by, `${w.beat} is carried by something`).toBeTruthy();
    expect(chart.vehicles.sky?.small).toBeLessThan(1);
    for (const r of chart.regions) if (r.id !== "halyra" && r.id !== "mhasun") expect(r.reveal, `${r.id} is discovered by crossing`).toBe("near");
    expect(chart.regions.find((r) => r.id === "halyra")?.reveal, "home is lettered from the start").toBeUndefined();
    expect(chart.regions.find((r) => r.id === "mhasun")?.reveal, "Mhasun stays under the mask").toBe("never");
    expect(chart.regions.find((r) => r.id === "covalis")?.reach, "Covalis is wide: its name is far from its western towns").toBeGreaterThan(150);
    for (const r of chart.regions) expect(r.box, r.id).toBeDefined();
    expect(chart.plate?.letters).toBeTruthy();
  });

  it("flies straight to the Reach, or by way of Omahnd when the dispatch said so, and goes on to Eronyr", () => {
    const hire = chart.waypoints.find((w) => w.beat === "your-deniables")!;
    expect(hire.routes.map((r) => r.flag)).toEqual(["omahnd-recommended"]);
    expect(hire.routes[0]!.via.length).toBeGreaterThan(hire.via.length);
    expect(chart.onward.length).toBeGreaterThan(0);
    const eronyr = chart.places.find((p) => p.id === "eronyr")!;
    expect(eronyr.label).toBe("Eronyr");
    expect(eronyr.reveal).toBe("near");
    const last = chart.waypoints.find((w) => w.beat === "the-carriage")!;
    expect(Math.hypot(last.at[0] - eronyr.at[0], last.at[1] - eronyr.at[1]), "Eronyr is in sight from the last staged town").toBeLessThan(eronyr.reach ?? 90);
    expect(eronyr.at).toEqual(chart.onward[chart.onward.length - 1]);
    const tour = ["make-it-famous", "stay-inconspicuous", "morning", "the-carriage"].map((id) => chart.waypoints.find((w) => w.beat === id)!.at);
    for (let i = 1; i < tour.length; i++) expect(tour[i]![0], "the tour works east").toBeGreaterThan(tour[i - 1]![0]);
  });

  it("reaches the player: the public world keeps the chart", () => {
    expect(publicWorld(shadowFell).chart?.waypoints.length).toBe(beats.length);
  });
});
