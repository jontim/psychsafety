import { describe, it, expect } from "vitest";
import { speechOnly } from "../speech.js";

describe("speechOnly", () => {
  it("leaves plain speech alone", () => {
    expect(speechOnly("Sit where I can see your hands.")).toEqual({ text: "Sit where I can see your hands.", leaked: false });
  });
  it("keeps quoted speech inside a line and does not count it as prose", () => {
    const r = speechOnly("He said 'Bureau' twice, and the second time he meant it.");
    expect(r.leaked).toBe(false);
  });
  it("strips a rendered line down to the words and hands the narration over", () => {
    const r = speechOnly('"Brask reads. Slow, but reads." A hand out, flat, palm up. "You came a long way. Who sent you the long way?"');
    expect(r.text).toBe("Brask reads. Slow, but reads. You came a long way. Who sent you the long way?");
    expect(r.narration).toBe("A hand out, flat, palm up.");
    expect(r.leaked).toBe(true);
  });
  it("unwraps a line the director put in quotation marks", () => {
    const r = speechOnly("“Denied.”");
    expect(r).toEqual({ text: "Denied.", leaked: true });
  });
});
