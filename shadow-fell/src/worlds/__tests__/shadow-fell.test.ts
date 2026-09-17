import { describe, it, expect } from "vitest";
import { shadowFell } from "../shadow-fell/world.js";
import { publicWorld } from "../index.js";
import { validateWorld, findBeat } from "../../engine/world.js";
import { muster } from "../../engine/force.js";

describe("The Shadow Fell world pack", () => {
  it("validates all cross references", () => {
    expect(validateWorld(shadowFell)).toEqual([]);
  });

  it("has two acts and seven beats with the palace beats unarmed", () => {
    expect(shadowFell.acts.map((a) => a.beats.length)).toEqual([2, 5]);
    for (const b of shadowFell.acts[0]!.beats) expect(b.force).toBeUndefined();
    for (const b of shadowFell.acts[1]!.beats) expect(b.force).toBeDefined();
  });

  it("makes the alley short-handed and the tavern fully covered, as designed", () => {
    expect(muster(shadowFell, findBeat(shadowFell, "the-alley").beat).missing).toEqual(["concurrence"]);
    expect(muster(shadowFell, findBeat(shadowFell, "make-it-famous").beat).cleanWin).toBe(true);
    expect(muster(shadowFell, findBeat(shadowFell, "morning").beat).cleanWin).toBe(true);
  });

  it("strips director-only material from the public copy", () => {
    const pub = publicWorld(shadowFell);
    expect(pub.cast.every((c) => c.knows.length === 0)).toBe(true);
    expect(pub.acts.flatMap((a) => a.beats).every((b) => b.notes === "" && b.succeedWhen === "")).toBe(true);
    expect(shadowFell.cast.find((c) => c.id === "indigo")!.knows.length).toBeGreaterThan(0);
  });

  it("carries the three seals as prohibitions", () => {
    const sealed = shadowFell.prohibitions.filter((p) => p.startsWith("SEALED"));
    expect(sealed).toHaveLength(3);
  });
});
