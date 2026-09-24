import { describe, it, expect } from "vitest";
import { StorySession } from "../session.js";
import { validateWorld, WorldSchema, type World } from "../world.js";
import { toneVector } from "../mock-ear.js";
import type { DirectorResponse } from "../director-contract.js";

const world: World = WorldSchema.parse({
  id: "branch-test",
  title: "Branches",
  tagline: "",
  premise: "",
  narrator: "scribe",
  prohibitions: [],
  palette: {},
  cast: [
    { id: "scribe", name: "Scribe", faction: "x", summary: "", register: "", voice: { name: "s", description: "" } },
    { id: "player", name: "Player", faction: "x", summary: "", register: "", voice: { name: "p", description: "" } },
    { id: "other", name: "Other", faction: "y", summary: "", register: "", voice: { name: "o", description: "" } },
  ],
  roles: [{ id: "player", label: "Player", summary: "" }],
  meters: [{ id: "standing", label: "Standing", description: "", start: 50, axes: [] }],
  acts: [{
    id: "a", title: "A", summary: "",
    beats: [
      { id: "one", title: "One", stance: "reading", playerRole: "player", counterpart: "other", location: "", goal: "", notes: "", opening: "Hi.", succeedWhen: "", failWhen: "", meters: ["standing"], maxTurns: 3,
        outcomes: {
          skip: { label: "Skipped ahead", when: "", status: "advance", flags: ["skipped"], next: "three" },
          plain: { label: "Went on", when: "", status: "advance", flags: ["plain"] },
          end: { label: "It ended", when: "", status: "fail", flags: ["ended"], next: null, ending: "The story ends here." },
        } },
      { id: "two", title: "Two", stance: "reading", playerRole: "player", counterpart: "other", location: "", goal: "", notes: "", opening: "Hi.", succeedWhen: "", failWhen: "", meters: ["standing"], maxTurns: 3 },
      { id: "three", title: "Three", stance: "reading", playerRole: "player", counterpart: "other", location: "", goal: "", notes: "", opening: "Hi.", succeedWhen: "", failWhen: "", meters: ["standing"], maxTurns: 3 },
    ],
  }],
  clips: [],
});

const response = (beat: DirectorResponse["beat"]): DirectorResponse => ({
  speaker: "other", line: "Mm.", acting: "flat", meterDeltas: {}, shot: { kind: "reaction", key: "x" }, beat, debrief: "level",
  slate: { owner: "none", coverage: "containment", outsiderMode: "mixed", intentions: [] },
});

describe("branching outcomes", () => {
  it("validates outcome targets and endings", () => {
    expect(validateWorld(world)).toEqual([]);
    const broken = WorldSchema.parse({ ...world, acts: [{ ...world.acts[0]!, beats: [{ ...world.acts[0]!.beats[0]!, outcomes: { x: { label: "x", when: "", next: "nowhere" }, y: { label: "y", when: "", next: null } } }] }] });
    const problems = validateWorld(broken);
    expect(problems.some((p) => p.includes("unknown beat nowhere"))).toBe(true);
    expect(problems.some((p) => p.includes("without an ending"))).toBe(true);
  });

  it("jumps to the outcome's beat, sets its flags and records history", () => {
    const s = new StorySession(world, "one");
    s.ingest("hello", toneVector("calm"));
    s.applyDirector(response({ status: "advance", outcome: "skip", resolution: "Off we go." }));
    let snap = s.snapshot();
    expect(snap.status).toBe("advanced");
    expect(snap.outcome).toBe("skip");
    expect(snap.flags).toEqual(["skipped"]);
    expect(snap.history).toEqual([{ beatId: "one", title: "One", outcome: "skip", label: "Skipped ahead", resolution: "Off we go." }]);
    expect(s.advance()).toBe(true);
    snap = s.snapshot();
    expect(snap.beat.id).toBe("three");
    expect(snap.flags).toEqual(["skipped"]);
    expect(snap.outcome).toBeNull();
    s.ingest("again", toneVector("calm"));
    const req = s.directorRequest();
    expect(req.flags).toEqual(["skipped"]);
    expect(req.history?.[0]?.label).toBe("Skipped ahead");
  });

  it("goes on in order when the outcome names no next beat", () => {
    const s = new StorySession(world, "one");
    s.ingest("hello", toneVector("calm"));
    s.applyDirector(response({ status: "advance", outcome: "plain" }));
    expect(s.advance()).toBe(true);
    expect(s.snapshot().beat.id).toBe("two");
  });

  it("ends the story on a null next, and the outcome's status wins", () => {
    const s = new StorySession(world, "one");
    s.ingest("hello", toneVector("calm"));
    s.applyDirector(response({ status: "advance", outcome: "end" }));
    const snap = s.snapshot();
    expect(snap.status).toBe("failed");
    expect(snap.ending).toBe("The story ends here.");
    expect(s.advance()).toBe(false);
    expect(s.snapshot().status).toBe("complete");
  });

  it("picks the first outcome matching the status when the director names none", () => {
    const s = new StorySession(world, "one");
    s.ingest("hello", toneVector("calm"));
    s.applyDirector(response({ status: "fail" }));
    expect(s.snapshot().outcome).toBe("end");
    const t = new StorySession(world, "one");
    t.ingest("hello", toneVector("calm"));
    t.applyDirector(response({ status: "advance" }));
    expect(t.snapshot().outcome).toBe("skip");
  });

  it("leaves beats without outcomes as they were", () => {
    const s = new StorySession(world, "two");
    s.ingest("hello", toneVector("calm"));
    s.applyDirector(response({ status: "advance", resolution: "Done." }));
    const snap = s.snapshot();
    expect(snap.outcome).toBeNull();
    expect(snap.history[0]).toEqual({ beatId: "two", title: "Two", outcome: null, label: "Resolved", resolution: "Done." });
    expect(s.advance()).toBe(true);
    expect(s.snapshot().beat.id).toBe("three");
  });
});
