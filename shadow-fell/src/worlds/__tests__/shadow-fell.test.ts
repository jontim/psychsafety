import { describe, it, expect } from "vitest";
import { shadowFell } from "../shadow-fell/world.js";
import { publicWorld } from "../index.js";
import { validateWorld, findBeat } from "../../engine/world.js";
import { muster } from "../../engine/force.js";

describe("The Shadow Fell world pack", () => {
  it("validates all cross references", () => {
    expect(validateWorld(shadowFell)).toEqual([]);
  });

  it("has two acts and ten beats with the palace beats unarmed", () => {
    expect(shadowFell.acts.map((a) => a.beats.length)).toEqual([5, 5]);
    for (const b of shadowFell.acts[0]!.beats) expect(b.force).toBeUndefined();
    for (const b of shadowFell.acts[1]!.beats) expect(b.force).toBeDefined();
  });

  it("makes the alley short-handed and the tavern fully covered, as designed", () => {
    expect(muster(shadowFell, findBeat(shadowFell, "the-alley").beat).missing).toEqual(["concurrence"]);
    expect(muster(shadowFell, findBeat(shadowFell, "make-it-famous").beat).cleanWin).toBe(true);
    expect(muster(shadowFell, findBeat(shadowFell, "morning").beat).cleanWin).toBe(true);
  });

  it("tells the player when each scene sits and gives every role a brief", () => {
    const beats = shadowFell.acts.flatMap((a) => a.beats);
    for (const b of beats) expect(b.when, b.id).toBeTruthy();
    for (const role of shadowFell.roles) {
      const beat = beats.find((b) => b.playerRole === role.id)!;
      expect(beat.brief, role.id).toBeDefined();
      for (const k of ["you", "win", "room", "lean", "never"] as const) expect(beat.brief![k], `${role.id} ${k}`).toBeTruthy();
    }
    const pub = publicWorld(shadowFell);
    const room = pub.acts[0]!.beats[0]!;
    expect(room.brief?.win).toContain("Magisterium");
    expect(room.notes).toBe("");
  });

  it("runs the windowless room on Soraya's restraint, not the Congress", () => {
    const { beat } = findBeat(shadowFell, "no-windows");
    expect(beat.meters).toEqual(["standing", "restraint", "evidence"]);
    expect(beat.brief?.room).toContain("yours to the bone");
    expect(beat.brief?.lean).toContain("wants you to waste him");
    expect(beat.notes).toContain("never the prisoner's shield");
    expect(beat.notes).not.toContain("warmth, oddly");
    const indigo = shadowFell.cast.find((c) => c.id === "indigo")!;
    expect(indigo.knows.join(" ")).not.toContain("Congress would hear");
    expect(indigo.summary).toContain("purple eyes first");
    const soraya = shadowFell.cast.find((c) => c.id === "soraya")!;
    expect(soraya.summary).toContain("nobody's shield");
    const restraint = shadowFell.meters.find((m) => m.id === "restraint")!;
    expect(restraint.axes.find((a) => a.axis === "pressure")?.weight).toBeLessThan(0);
    expect(beat.goal).toContain("Omahnd");
    expect(indigo.knows.join(" ")).toContain("skyship-grounding");
  });

  it("runs Act I as four branching beats from the night of the attack", () => {
    const ids = shadowFell.acts[0]!.beats.map((b) => b.id);
    expect(ids).toEqual(["no-windows", "the-dispatch", "the-study", "the-proclamation", "your-deniables"]);
    const room = findBeat(shadowFell, "no-windows").beat;
    expect(Object.keys(room.outcomes!)).toEqual(["bureau-named", "cover-broken", "cover-held", "spent"]);
    expect(room.goal).toContain("Omahndi cover");
    const study = findBeat(shadowFell, "the-study").beat;
    expect(study.outcomes!.war!.next).toBeNull();
    expect(study.outcomes!.war!.ending).toContain("never get played");
    const proclamation = findBeat(shadowFell, "the-proclamation").beat;
    expect(proclamation.playerRole).toBe("rashan");
    expect(proclamation.counterpart).toBe("ambassador");
    expect(proclamation.outcomes!.strong!.next).toBe("your-deniables");
    expect(proclamation.outcomes!.weak!.next).toBeNull();
    expect(shadowFell.roles.map((r) => r.id)).toContain("rashan");
    expect(findBeat(shadowFell, "your-deniables").beat.notes).toContain("If flag omahnd-denied-quick");
    const ledger = findBeat(shadowFell, "the-dispatch").beat.documents?.[0];
    expect(ledger?.title).toBe("The accounting of the attempt");
    expect(ledger?.body.join(" ")).toContain("eighteenth level");
    expect(findBeat(shadowFell, "the-study").beat.documents?.[0]?.title).toBe("The accounting of the attempt");
    expect(findBeat(shadowFell, "your-deniables").beat.documents?.[0]?.body.at(-1)).toContain("too complete");
    expect(validateWorld(shadowFell)).toEqual([]);
  });

  it("plays Navid's hire as the deleted briefing shot it", () => {
    const { beat } = findBeat(shadowFell, "your-deniables");
    expect(beat.brief?.you).toContain("in uniform");
    expect(beat.brief?.never).toContain("Hegemony");
    expect(beat.notes).toContain("This conversation never happened");
    expect(beat.failWhen).toContain("names the Hegemony");
    expect(beat.when).toContain("Omahnd");
    const navid = shadowFell.cast.find((c) => c.id === "navid")!;
    expect(navid.lines.join(" ")).toContain("keep it at arm's length");
    expect(navid.summary).not.toContain("out of uniform");
    expect(beat.brief?.room).toContain("extradition");
    expect(findBeat(shadowFell, "the-alley").beat.brief?.room).toContain("extradition");
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
