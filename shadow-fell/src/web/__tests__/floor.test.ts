import { describe, it, expect, vi } from "vitest";
import { Floor, mergeFragments } from "../floor.js";
import { toneVector } from "../../engine/mock-ear.js";

describe("the floor", () => {
  it("merges fragments into one speech with word-weighted scores", () => {
    const merged = mergeFragments([
      { text: "You will find I am patient.", scores: toneVector("calm"), words: 6 },
      { text: "My father is not.", scores: toneVector("angry"), words: 4 },
    ]);
    expect(merged.text).toBe("You will find I am patient. My father is not.");
    expect(merged.scores.calmness).toBeCloseTo(0.7 * 0.6 + 0.03 * 0.4, 5);
    expect(merged.scores.anger).toBeCloseTo(0.03 * 0.6 + 0.8 * 0.4, 5);
  });

  it("waits for silence before committing, and a manual commit ends the turn at once", () => {
    vi.useFakeTimers();
    const commits: string[] = [];
    const floor = new Floor({ mode: "silence", silenceMs: 3000, onChange: () => {}, onCommit: (m) => commits.push(m.text) });
    floor.add({ text: "Tell me about the blue.", scores: toneVector("calm") });
    vi.advanceTimersByTime(2000);
    floor.add({ text: "All of it.", scores: toneVector("commanding") });
    vi.advanceTimersByTime(2500);
    expect(commits).toEqual([]);
    vi.advanceTimersByTime(600);
    expect(commits).toEqual(["Tell me about the blue. All of it."]);

    floor.mode = "manual";
    floor.add({ text: "Now.", scores: toneVector("angry") });
    vi.advanceTimersByTime(10000);
    expect(commits).toHaveLength(1);
    floor.commit();
    expect(commits).toEqual(["Tell me about the blue. All of it.", "Now."]);
    vi.useRealTimers();
  });

  it("ignores an empty commit and can be cleared", () => {
    const commits: string[] = [];
    const floor = new Floor({ mode: "manual", silenceMs: 1000, onChange: () => {}, onCommit: (m) => commits.push(m.text) });
    floor.commit();
    floor.add({ text: "Wait.", scores: toneVector("calm") });
    floor.clear();
    floor.commit();
    expect(commits).toEqual([]);
    expect(floor.hasSpeech).toBe(false);
  });
});
