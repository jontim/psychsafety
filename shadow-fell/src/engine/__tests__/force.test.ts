import { describe, it, expect } from "vitest";
import { defineWorld, type World } from "../world.js";
import { muster, strategies, matchStrategy, resolveForce } from "../force.js";
import { StorySession } from "../session.js";
import { toneVector } from "../mock-ear.js";

function world(present: string[]): World {
  return defineWorld({
    id: "f", title: "F", tagline: "", premise: "", palette: {},
    narrator: "scribe",
    cast: [
      { id: "scribe", name: "The Scribe", faction: "us", summary: "", register: "", voice: { description: "" } },
      { id: "thorbin", name: "Thorbin", faction: "us", summary: "", register: "", voice: { description: "" }, capabilities: ["bait", "healing"] },
      { id: "brask", name: "Brask", faction: "us", summary: "", register: "", voice: { description: "" }, capabilities: ["muscle", "spectacle"] },
      { id: "lyra", name: "Lyra", faction: "us", summary: "", register: "", voice: { description: "" }, capabilities: ["concurrence"] },
      { id: "serena", name: "Serena", faction: "us", summary: "", register: "", voice: { description: "" }, capabilities: ["legitimacy", "blade"] },
      { id: "wizard", name: "Wizard", faction: "them", summary: "", register: "", voice: { description: "" } },
    ],
    roles: [{ id: "thorbin", label: "Thorbin", summary: "" }],
    meters: [
      { id: "standing", label: "Standing", description: "", start: 50, axes: [] },
      { id: "rapport", label: "Rapport", description: "", start: 50, axes: [] },
      { id: "evidence", label: "Evidence", description: "", start: 20, axes: [] },
    ],
    acts: [{ id: "a", title: "", summary: "", beats: [{
      id: "alley", title: "Alley", stance: "reading", playerRole: "thorbin", counterpart: "wizard", present, location: "alley",
      goal: "", notes: "", opening: "...", succeedWhen: "", failWhen: "", meters: ["standing", "rapport", "evidence"],
      force: { threat: "His hands ignite violet.", requires: ["muscle", "concurrence"] },
    }] }],
  });
}

describe("force", () => {
  it("musters a clean win when every required capability is present", () => {
    const w = world(["brask", "lyra"]);
    const m = muster(w, w.acts[0]!.beats[0]!);
    expect(m.cleanWin).toBe(true);
    expect(m.missing).toEqual([]);
  });

  it("offers strategies from who is present when cover is short", () => {
    const w = world(["brask"]);
    const beat = w.acts[0]!.beats[0]!;
    const m = muster(w, beat);
    expect(m.cleanWin).toBe(false);
    expect(m.missing).toEqual(["concurrence"]);
    const list = strategies(w, beat, m);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]!.label).toBe("Brask takes the door");
    expect(list[0]!.coverage).toBeCloseTo(0.5, 5);
    expect(matchStrategy(list, "Brask, the door, now!")?.id).toBe("brask:muscle");
    expect(matchStrategy(list, "everyone stay calm")).toBeNull();
  });

  it("resolves by coverage and voice, deterministically", () => {
    const w = world(["brask"]);
    const beat = w.acts[0]!.beats[0]!;
    const m = muster(w, beat);
    const list = strategies(w, beat, m);
    const commanding = resolveForce(list[0]!, m, { command: 0.8, composure: 0.6 }, beat);
    const panicked = resolveForce(list[0]!, m, { command: -0.8, composure: -0.9 }, beat);
    expect(commanding.score).toBeGreaterThan(panicked.score);
    expect(commanding.outcome).toBe("won");
    expect(panicked.outcome).toBe("costly");
    expect(resolveForce(null, m, {}, beat).outcome).toBe("lost");
  });

  it("runs the fight inside a session: clean win auto-resolves, short cover waits for a call", () => {
    const clean = new StorySession(world(["brask", "lyra"]), "alley");
    clean.ingest("Talk.", toneVector("commanding"));
    clean.applyDirector({ speaker: "wizard", line: "Begone, halfman!", acting: "", meterDeltas: {}, shot: { kind: "reaction" }, beat: { status: "continue" }, debrief: "", escalate: { threat: "His hands ignite violet." } });
    let snap = clean.snapshot();
    expect(snap.status).toBe("playing");
    expect(snap.transcript.at(-1)!.speaker).toBe("scribe");
    expect(snap.transcript.at(-1)!.text).toMatch(/over before it starts/);

    const short = new StorySession(world(["brask"]), "alley");
    short.ingest("Talk.", toneVector("commanding"));
    short.applyDirector({ speaker: "wizard", line: "Begone!", acting: "", meterDeltas: {}, shot: { kind: "reaction" }, beat: { status: "continue" }, debrief: "", escalate: { threat: "His hands ignite violet." } });
    snap = short.snapshot();
    expect(snap.status).toBe("force");
    expect(snap.force?.strategies.length).toBeGreaterThan(0);
    expect(short.chooseStrategy("everyone stay calm")).toBeNull();
    expect(short.snapshot().status).toBe("force");
    const res = short.chooseStrategy("Brask, take the door")!;
    expect(res.outcome).toBe("won");
    expect(short.snapshot().status).toBe("playing");
    expect(short.snapshot().meters.rapport).toBe(40);
  });

  it("loses the fight when nobody moves", () => {
    const s = new StorySession(world(["brask"]), "alley");
    s.ingest("Talk.", toneVector("angry"));
    s.applyDirector({ speaker: "wizard", line: "Begone!", acting: "", meterDeltas: {}, shot: { kind: "reaction" }, beat: { status: "continue" }, debrief: "", escalate: { threat: "x" } });
    expect(s.abandonFight().outcome).toBe("lost");
    expect(s.snapshot().status).toBe("failed");
  });

  it("ignores escalation on beats without force", () => {
    const w = world(["brask"]);
    delete w.acts[0]!.beats[0]!.force;
    const s = new StorySession(w, "alley");
    s.ingest("Talk.", toneVector("calm"));
    s.applyDirector({ speaker: "wizard", line: "No.", acting: "", meterDeltas: {}, shot: { kind: "reaction" }, beat: { status: "continue" }, debrief: "", escalate: { threat: "x" } });
    expect(s.snapshot().status).toBe("playing");
    expect(s.snapshot().force).toBeNull();
  });
});
