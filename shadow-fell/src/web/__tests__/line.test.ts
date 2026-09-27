import { describe, it, expect } from "vitest";
import { FLAP_WINDOW_MS, RECONNECT_TRIES, firstSentence, flapsAfter, givenUp, isFatal, pauseBefore } from "../ear/line.js";

describe("picking a dropped line up again", () => {
  it("pauses half a second after a plain drop and doubles per failure up to eight seconds", () => {
    expect(pauseBefore(0)).toBe(500);
    expect(pauseBefore(1)).toBe(1000);
    expect(pauseBefore(2)).toBe(2000);
    expect(pauseBefore(3)).toBe(4000);
    expect(pauseBefore(4)).toBe(8000);
    expect(pauseBefore(9)).toBe(8000);
  });

  it("counts a close soon after opening as a flap, and a line that held as none", () => {
    const opened = 1_000_000;
    expect(flapsAfter(0, opened, opened + 300)).toBe(1);
    expect(flapsAfter(3, opened, opened + FLAP_WINDOW_MS - 1)).toBe(4);
    expect(flapsAfter(3, opened, opened + FLAP_WINDOW_MS)).toBe(0);
    expect(flapsAfter(5, opened, opened + 60_000)).toBe(0);
  });

  it("lets a line go that flaps as many times as it would be tried, and not before", () => {
    // a far end that closes the line on sight: every open is followed by a close within a second
    let flaps = 0;
    let at = 5_000_000;
    for (let i = 1; i < RECONNECT_TRIES; i++) {
      flaps = flapsAfter(flaps, at, at + 400);
      expect(givenUp(flaps)).toBe(false);
      at += 400 + pauseBefore(flaps);
    }
    flaps = flapsAfter(flaps, at, at + 400);
    expect(flaps).toBe(RECONNECT_TRIES);
    expect(givenUp(flaps)).toBe(true);
    // a line that then holds for a minute starts the count afresh
    expect(givenUp(flapsAfter(flaps, at, at + 60_000))).toBe(false);
  });

  it("knows a refusal no retry can mend, and says it in one short sentence", () => {
    const hume = "Exhausted credit balance. Visit app.hume.ai/billing to manage your account.";
    expect(isFatal(`E0300 ${hume}`)).toBe(true);
    expect(isFatal(`1008, ${hume}`)).toBe(true);
    expect(isFatal("Invalid API key")).toBe(true);
    expect(isFatal("1006")).toBe(false);
    expect(isFatal("1011, internal error")).toBe(false);
    expect(firstSentence(hume)).toBe("Exhausted credit balance");
    expect(firstSentence("the line was refused")).toBe("the line was refused");
  });
});
