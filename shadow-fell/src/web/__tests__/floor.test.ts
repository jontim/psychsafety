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

  it("keeps a short grace after Done so the ear's last sentence lands, and joins it to the turn", () => {
    vi.useFakeTimers();
    const commits: string[] = [];
    const floor = new Floor({ mode: "manual", silenceMs: 5000, onChange: () => {}, onCommit: (m) => commits.push(m.text) });
    floor.add({ text: "Are you serious? It did not work.", scores: toneVector("calm") });
    floor.done(1500);
    expect(floor.finishing).toBe(true);
    vi.advanceTimersByTime(800);
    floor.add({ text: "Oh no, I do not accept that at all.", scores: toneVector("warm") });
    expect(commits).toEqual([]);
    vi.advanceTimersByTime(800);
    expect(commits).toEqual(["Are you serious? It did not work. Oh no, I do not accept that at all."]);
    expect(floor.finishing).toBe(false);
    // an interim during the grace holds it open a moment longer
    floor.add({ text: "One more thing.", scores: toneVector("calm") });
    floor.done(1000);
    vi.advanceTimersByTime(600);
    floor.touch();
    vi.advanceTimersByTime(600);
    expect(commits).toHaveLength(1);
    vi.advanceTimersByTime(500);
    expect(commits).toHaveLength(2);
    // Done with nothing said reads nothing
    floor.done(500);
    vi.advanceTimersByTime(600);
    expect(commits).toHaveLength(2);
    expect(floor.finishing).toBe(false);
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
