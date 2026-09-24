import { describe, it, expect } from "vitest";
import { selectStoryClip } from "../clips.js";
import type { Clip } from "../world.js";
import { shadowFell } from "../../worlds/shadow-fell/world.js";

const clips: Clip[] = [
  { key: "b-plain", kind: "story", tag: "neutral", prompt: "", moment: { role: "bridge", beat: "one" }, narration: "plain" },
  { key: "b-flag", kind: "story", tag: "neutral", prompt: "", moment: { role: "bridge", beat: "one", flag: "left" }, narration: "left" },
  { key: "e-war", kind: "story", tag: "neutral", prompt: "", moment: { role: "ending", outcome: "war" } },
  { key: "i-mirror", kind: "story", tag: "neutral", prompt: "", moment: { role: "instruction", beat: "mirror" }, narration: "hello" },
  { key: "other-neutral", kind: "reaction", tag: "neutral", character: "other", prompt: "" },
];

describe("story footage", () => {
  it("narrows a bridge to the branch when a flag matches, else plays the plain bridge", () => {
    expect(selectStoryClip(clips, { role: "bridge", beat: "one", flags: ["left"] })?.key).toBe("b-flag");
    expect(selectStoryClip(clips, { role: "bridge", beat: "one", flags: ["right"] })?.key).toBe("b-plain");
    expect(selectStoryClip(clips, { role: "bridge", beat: "one" })?.key).toBe("b-plain");
    expect(selectStoryClip(clips, { role: "bridge", beat: "two" })).toBeNull();
  });

  it("finds endings by outcome and instructions by screen", () => {
    expect(selectStoryClip(clips, { role: "ending", beat: "one", outcome: "war" })?.key).toBe("e-war");
    expect(selectStoryClip(clips, { role: "ending", outcome: "peace" })).toBeNull();
    expect(selectStoryClip(clips, { role: "instruction", beat: "mirror" })?.narration).toBe("hello");
  });

  it("gives every Shadow Fell beat a bridge, every ending its footage, and the Mirror its instruction", () => {
    const beats = shadowFell.acts.flatMap((a) => a.beats);
    for (const b of beats) expect(selectStoryClip(shadowFell.clips, { role: "bridge", beat: b.id })?.narration, b.id).toBeTruthy();
    for (const b of beats) for (const [key, o] of Object.entries(b.outcomes ?? {})) if (o.next === null) expect(selectStoryClip(shadowFell.clips, { role: "ending", beat: b.id, outcome: key }), `${b.id}/${key}`).not.toBeNull();
    expect(selectStoryClip(shadowFell.clips, { role: "bridge", beat: "the-dispatch", flags: ["cover-held"] })?.key).toBe("bridge-the-dispatch-cover-held");
    expect(selectStoryClip(shadowFell.clips, { role: "bridge", beat: "your-deniables", flags: ["doubt-omahnd", "statement", "omahnd-denied-quick"] })?.key).toBe("bridge-your-deniables-quick");
    expect(selectStoryClip(shadowFell.clips, { role: "instruction", beat: "mirror" })?.key).toBe("story-mirror");
    for (const c of shadowFell.clips.filter((c) => c.kind === "story")) {
      expect(c.prompt, c.key).toContain("6 seconds");
      expect(c.prompt, c.key).toContain("no one speaks");
      expect(c.prompt, c.key).not.toMatch(/talking|poster on a tavern wall at night, a crowd|one word visible/);
    }
  });
});
