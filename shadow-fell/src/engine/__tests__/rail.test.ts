import { describe, it, expect } from "vitest";
import { repairBraskRail, isBraskFossil } from "../rail.js";

describe("Brask's rail guard", () => {
  it("turns the four leaks into Jon's four lines", () => {
    expect(repairBraskRail("Posters are Tav work.").text).toBe("Posters Tav work.");
    expect(repairBraskRail("Brask is big one. Yes.").text).toBe("Brask big one. Yes.");
    expect(repairBraskRail("Carry man is crime here?").text).toBe("Carry man crime here?");
    expect(repairBraskRail("Word is yours.").text).toBe("Word yours.");
  });

  it("strips TO BE wherever it is conjugated, and TO DO only where it does auxiliary work", () => {
    expect(repairBraskRail("Do you know him?").text).toBe("You know him?");
    expect(repairBraskRail("What do they want?").text).toBe("What they want?");
    expect(repairBraskRail("Why did he leave?").text).toBe("Why he leave?");
    expect(repairBraskRail("That isn't true.").text).toBe("That not true.");
    expect(repairBraskRail("I don't know yet.").text).toBe("I not know yet.");
    expect(repairBraskRail("He was here yesterday.").text).toBe("He here yesterday.");
    expect(repairBraskRail("What is wrong?").text).toBe("What wrong?");
    expect(repairBraskRail("Is he here?").text).toBe("He here?");
    expect(repairBraskRail("It's done. I'm sure.").text).toBe("It done. I sure.");
    expect(repairBraskRail("Tav's work is good.").text).toBe("Tav's work good.");
    expect(repairBraskRail("What I do with it?").text).toBe("What I do with it?");
    expect(repairBraskRail("Brask do this. You do that.").text).toBe("Brask do this. You do that.");
  });

  it("leaves a clean line and a locked line alone", () => {
    expect(repairBraskRail("You give word. Then break word. I ask. You not answer.")).toEqual({ text: "You give word. Then break word. I ask. You not answer.", repaired: false });
    expect(repairBraskRail("She was in my house. Then I was in hers. Then she was nowhere. The matter is closed.").repaired).toBe(false);
    expect(isBraskFossil("The matter is closed.")).toBe(true);
    expect(isBraskFossil("The matter is yours.")).toBe(false);
    const mixed = repairBraskRail("The matter is closed. Word is yours.");
    expect(mixed.text).toBe("The matter is closed. Word yours.");
    expect(mixed.repaired).toBe(true);
  });
});
