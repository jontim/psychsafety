import { describe, it, expect } from "vitest";
import { defineWorld, validateWorld, nextBeatId, type World } from "../world.js";
import { StorySession } from "../session.js";
import { toneVector } from "../mock-ear.js";
import { DirectorResponseSchema, type DirectorResponse } from "../director-contract.js";
import { affectTagFromAxes, selectClip } from "../clips.js";

const SLATE: DirectorResponse["slate"] = { owner: "none", coverage: "containment", outsiderMode: "mixed", intentions: [{ intention: "hold the line", score: 1, distinct: false, wayOfKnowing: false }, { intention: "narrate the feeling", score: -2, distinct: false, wayOfKnowing: false }] };

function tinyWorld(): World {
  return defineWorld({
    id: "tiny",
    title: "Tiny",
    tagline: "A test world",
    premise: "Two people in a room.",
    palette: { ink: "#111" },
    cast: [
      { id: "player", name: "Player", faction: "us", summary: "", register: "", voice: { description: "plain" } },
      { id: "other", name: "Other", faction: "them", summary: "", register: "", voice: { description: "plain" }, tells: ["looks at the door"] },
    ],
    roles: [{ id: "player", label: "Player", summary: "" }],
    meters: [
      { id: "standing", label: "Standing", description: "", start: 50, axes: [{ axis: "command", weight: 1 }] },
      { id: "rapport", label: "Rapport", description: "", start: 30, axes: [{ axis: "warmth", weight: 1 }] },
    ],
    acts: [
      {
        id: "a1", title: "Act one", summary: "",
        beats: [
          { id: "b1", title: "Beat one", stance: "reading", playerRole: "player", counterpart: "other", location: "room", goal: "", notes: "", opening: "Hello.", succeedWhen: "", failWhen: "", meters: ["standing", "rapport"], maxTurns: 3 },
          { id: "b2", title: "Beat two", stance: "being-read", playerRole: "player", counterpart: "other", location: "hall", goal: "", notes: "", opening: "Again.", succeedWhen: "", failWhen: "", meters: ["standing"] },
        ],
      },
    ],
    clips: [
      { key: "other-warming", kind: "reaction", character: "other", tag: "warming", prompt: "" },
      { key: "other-neutral", kind: "reaction", character: "other", tag: "neutral", prompt: "" },
      { key: "room-wide", kind: "establishing", tag: "neutral", prompt: "" },
    ],
  });
}

describe("world", () => {
  it("validates cross references", () => {
    const w = tinyWorld();
    expect(validateWorld(w)).toEqual([]);
    w.acts[0]!.beats[0]!.counterpart = "ghost";
    expect(validateWorld(w)[0]).toMatch(/unknown counterpart ghost/);
  });

  it("walks beats in order", () => {
    const w = tinyWorld();
    expect(nextBeatId(w, "b1")).toBe("b2");
    expect(nextBeatId(w, "b2")).toBeNull();
  });
});

describe("clips", () => {
  it("maps axes to a reaction tag", () => {
    expect(affectTagFromAxes({ pressure: 0.6, warmth: -0.4 })).toBe("cooling");
    expect(affectTagFromAxes({ warmth: 0.5, composure: 0.3 })).toBe("warming");
    expect(affectTagFromAxes({ composure: -0.5 }, "being-read")).toBe("calculating");
    expect(affectTagFromAxes({})).toBe("neutral");
  });

  it("falls back from exact tag to neutral to establishing", () => {
    const clips = tinyWorld().clips;
    expect(selectClip(clips, { character: "other", tag: "warming" })?.key).toBe("other-warming");
    expect(selectClip(clips, { character: "other", tag: "cooling" })?.key).toBe("other-neutral");
    expect(selectClip(clips, { character: "nobody", tag: "cooling" })?.key).toBe("room-wide");
  });
});

describe("session", () => {
  it("ingests utterances, builds a director request, applies the answer and advances", () => {
    const s = new StorySession(tinyWorld(), "b1");
    s.opening();
    const rec = s.ingest("Sit down.", toneVector("commanding"));
    expect(rec.reading).toMatch(/sounded determination/);
    expect(rec.drift.standing).toBeGreaterThan(0);
    const req = s.directorRequest();
    expect(req.playerLine).toBe("Sit down.");
    expect(req.turn).toBe(1);
    expect(req.transcript).toHaveLength(2);
    expect(req.affect).toMatch(/Command \+/);

    const response = DirectorResponseSchema.parse({
      speaker: "other",
      line: "I would rather stand.",
      acting: "wary, low",
      meterDeltas: { rapport: -5, standing: 4 },
      shot: { kind: "reaction", key: "other-neutral" },
      beat: { status: "continue" },
      debrief: "You led with command.",
      slate: SLATE,
    });
    const before = s.snapshot().meters;
    const { applied, clip } = s.applyDirector(response);
    expect(applied).toEqual({ rapport: -5, standing: 4 });
    expect(clip?.key).toBe("other-neutral");
    const after = s.snapshot();
    expect(after.meters.rapport).toBe(before.rapport! - 5);
    expect(after.status).toBe("playing");

    // hitting maxTurns resolves the beat even if the director says continue
    s.ingest("Now.", toneVector("angry"));
    s.applyDirector(response);
    s.ingest("Now!", toneVector("angry"));
    s.applyDirector(response);
    expect(s.snapshot().status).toBe("advanced");
    expect(s.advance()).toBe(true);
    expect(s.snapshot().beat.id).toBe("b2");
    expect(s.snapshot().transcript).toHaveLength(0);
    expect(s.advance()).toBe(false);
    expect(s.snapshot().status).toBe("complete");
  });

  it("refuses unknown speakers from the director", () => {
    const s = new StorySession(tinyWorld(), "b1");
    s.ingest("Hi", toneVector("calm"));
    expect(() =>
      s.applyDirector({ speaker: "ghost", line: "", acting: "", meterDeltas: {}, shot: { kind: "reaction" }, beat: { status: "continue" }, debrief: "", slate: SLATE }),
    ).toThrow(/Unknown cast member/);
  });
});
