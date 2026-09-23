import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileCanon } from "../compile-canon.js";
import { loadCanonRuntime } from "../runtime.js";
import { systemPrompt, turnMessage } from "../prompt.js";
import { understudy } from "../understudy.js";
import { shadowFell } from "../../worlds/shadow-fell/world.js";
import { coverage, livePairs, slateCard, wardensInBeat } from "../../engine/runtime.js";
import { DirectorResponseSchema, type DirectorRequest } from "../../engine/director-contract.js";
import { findBeat } from "../../engine/world.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const source = fs.readFileSync(path.join(root, "src/canon/behavioral-canon.md"), "utf8");
const runtime = loadCanonRuntime();
const WARDENS = ["brask", "kael", "lyra", "serena", "tav", "thorbin", "varya"];
const DEAD = [/\bMoradin\b/, /\bThorbardin\b/, /\bOghma\b/, /Mystra/, /\bHarpers?\b/, /\bThay\b/, /Red Wizards?/i, /\bVeyra\b/, /\bVerya\b/, /Lord Marshal Serena/];

function request(beatId: string): DirectorRequest {
  const { beat } = findBeat(shadowFell, beatId);
  return { worldId: "shadow-fell", beatId, playerRole: beat.playerRole, stance: beat.stance, turn: 1, maxTurns: beat.maxTurns, playerLine: "Sit up.", affect: "level", axes: { warmth: 0.3, composure: 0.2 }, meters: {}, transcript: [] };
}

describe("the compiled canon", () => {
  it("is in step with the source document", () => {
    expect(compileCanon(source)).toEqual(runtime);
  });

  it("carries the seven Wardens under their pack ids, complete", () => {
    expect(Object.keys(runtime.wardens).sort()).toEqual(WARDENS);
    for (const w of Object.values(runtime.wardens)) {
      expect(w.card.length, w.id).toBeGreaterThanOrEqual(5);
      expect(w.runtimeRule, w.id).not.toBe("");
      expect(w.failureMode, w.id).not.toBe("");
      expect(Object.keys(w.runtime)).toEqual(expect.arrayContaining(["notices_first", "default_strategy", "will_not_do", "ethical_anchor", "shadow_risk", "leadership_claim"]));
      expect(Object.values(w.outsider).every(Boolean), w.id).toBe(true);
      expect(w.wrongLines, w.id).toHaveLength(3);
    }
  });

  it("has every directed pair and every fallback domain", () => {
    expect(Object.keys(runtime.pairs)).toHaveLength(42);
    for (const a of WARDENS) for (const b of WARDENS) if (a !== b) expect(runtime.pairs[`${a}->${b}`], `${a}->${b}`).toBeDefined();
    expect(runtime.fallbacks).toHaveLength(10);
    for (const f of runtime.fallbacks) {
      expect(WARDENS).toContain(f.owner);
      expect(f.fallbacks).toHaveLength(2);
      for (const id of f.fallbacks) { expect(WARDENS).toContain(id); expect(id).not.toBe(f.owner); }
      expect(f.limit).not.toBe("");
    }
    expect(runtime.tests.length).toBeGreaterThanOrEqual(40);
    expect(runtime.tests.map((t) => t.section)).toEqual(expect.arrayContaining(["6", "12.7", "13.1", "14.5", "15.12", "19"]));
  });

  it("uses live names, keeps the number in the writers' layer, and applies the rulings", () => {
    const json = JSON.stringify(runtime);
    for (const dead of DEAD) expect(json, `dead name ${dead}`).not.toMatch(dead);
    expect(json).not.toMatch(/95\s*%|ninety-five/i);
    expect(json).not.toMatch(/fag/i);
    expect(runtime.kids.join(" ")).toContain("for years before the strike");
    expect(runtime.kids.join(" ")).not.toContain("After the break in the slave route");
    expect(runtime.kids.join(" ")).toContain("finished at sixteen, when she left for Valerith");
    expect(runtime.kids.join(" ")).not.toContain("finishing her formation");
    expect(runtime.tests.some((t) => t.section === "19" && /unnamed employer/.test(t.test))).toBe(true);
    expect(runtime.fallbacks.find((f) => f.domain === "Stand-and-hold")!.limit).toMatch(/^Brask's mass, reach, pain tolerance/);
    expect(runtime.validation.join(" ")).toContain("VALIDATED PRELIMINARILY");
    expect(runtime.validation.join(" ")).toContain("Plurality is optional. Specificity is mandatory.");
    expect(runtime.guardrails.some((g) => g.startsWith("Shared-care de-duplication"))).toBe(true);
    expect(runtime.guardrails.find((g) => g.startsWith("Shared-care de-duplication"))).toContain("what the living system is telling him");
    expect(runtime.guardrails.find((g) => g.startsWith("Shared-care de-duplication"))).toContain("failed to remain present for");
    expect(runtime.wardens.lyra!.runtime.attention).toContain("what consequence is still happening?");
    expect(runtime.wardens.kael!.runtime.attention).toContain("what relationship has been made wrong?");
    expect(runtime.wardens.varya!.runtime.attention).toContain("what fact doesn't fit?");
    expect(runtime.wardens.lyra!.card.some((c) => c.startsWith("Ordinary cognitive signature"))).toBe(true);
    expect(runtime.wardens.tav!.card.some((c) => c.startsWith("Obtains information through social and narrative movement"))).toBe(true);
    expect(runtime.wardens.thorbin!.card.some((c) => c.includes("never his manner: he is not a carer with soup"))).toBe(true);
    expect(runtime.wardens.thorbin!.runtime.attention).toContain("never a carer with soup");
    expect(runtime.guardrails.some((g) => g.includes("material care into a bedside manner"))).toBe(true);
    expect(runtime.wardens.lyra!.languageRail.length).toBeGreaterThanOrEqual(12);
    expect(runtime.wardens.lyra!.languageRail.join(" ")).toContain("Verdict first, framework withheld");
    expect(runtime.wardens.lyra!.languageRail.join(" ")).toContain("Mischief in the same deadpan as her verdicts");
    expect(runtime.validation.join(" ")).toContain("Collision resistance, a tie-breaker only");
    expect(runtime.validation.join(" ")).toContain("the runtime renders the person doing that tactic");
    expect(runtime.wardens.brask!.languageRail.length).toBeGreaterThanOrEqual(14);
    expect(runtime.wardens.brask!.languageRail.join(" ")).toContain("Then we not know.");
    for (const id of ["tav", "serena", "thorbin", "varya", "kael"]) expect(runtime.wardens[id]!.languageRail).toEqual([]);
    expect(runtime.pairs["serena->tav"]!.risk).toMatch(/^The fault line remains canon/);
    expect(runtime.wardens.thorbin!.wrongLines[0]!.line).toMatch(/^Morrighad commands it/);
    expect(runtime.torMorrighad.join(" ")).not.toContain("LEGACY PLACEHOLDER");
  });
});

describe("the slate", () => {
  it("knows who is in each beat and who covers for whom", () => {
    const { beat } = findBeat(shadowFell, "the-alley");
    const { present, absent } = wardensInBeat(runtime, beat);
    expect([...present].sort()).toEqual(["brask", "serena", "thorbin", "varya"]);
    expect([...absent].sort()).toEqual(["kael", "lyra", "tav"]);
    const rows = coverage(runtime, present);
    expect(rows.find((r) => r.domain.startsWith("Arcane"))!.mode).toBe("containment");
    expect(rows.find((r) => r.domain.startsWith("Adaptive social"))).toMatchObject({ mode: "fallback", by: "varya" });
    expect(rows.find((r) => r.domain.startsWith("Legitimacy"))!.mode).toBe("owner");
    expect(livePairs(runtime, present)).toHaveLength(12);
    const card = slateCard(shadowFell, beat, runtime);
    expect(card).toContain("Thorbin (the player's role)");
    expect(card).toContain("Lyra is absent and so are the fallbacks");
    expect(card).toContain("Tavian is absent; Varya covers it in their own grammar");
    expect(card).toContain("predator, confidence high");
  });

  it("goes idle when no Warden is in the room", () => {
    const { beat } = findBeat(shadowFell, "no-windows");
    expect(wardensInBeat(runtime, beat).present).toEqual([]);
    expect(slateCard(shadowFell, beat, runtime)).toContain("No Warden is in this scene");
  });

  it("reads the outsider the way the pack opens the scene", () => {
    const { beat } = findBeat(shadowFell, "stay-inconspicuous");
    const card = slateCard(shadowFell, beat, runtime);
    expect(card).toContain("Varya (the player's role)");
    expect(card).toContain("authority, confidence high");
    expect(card).toContain("Kael is absent; Varya covers it");
    for (const act of shadowFell.acts) for (const b of act.beats) expect(b.outsider, b.id).toBeDefined();
  });

  it("reaches the director: the runtime in the cached prefix, the slate on every turn", () => {
    const system = systemPrompt(shadowFell, "brief", {}, runtime);
    expect(system).toContain("## The company's runtime (Behavioral Canon v1.4)");
    expect(system).toContain("Primary law: Under pressure, a Stormwarden becomes more themselves, not less.");
    expect(system).toContain("### Directed pairs");
    expect(system).toContain("### Wrong lines");
    expect(system).toMatch(/### Varya Stormveil[\s\S]*Runtime \(director only; Behavioral Canon\): Ranger/);
    expect(system).toMatch(/### Brask Runebearer[\s\S]*Language rail \(binding on every line\):[\s\S]*Then we not know/);
    const block = system.slice(system.indexOf("## The company's runtime"), system.indexOf("## The story"));
    for (const dead of DEAD) expect(block, `dead name ${dead}`).not.toMatch(dead);
    expect(block).not.toMatch(/95\s*%/);
    expect(system).not.toContain("VALIDATED PRELIMINARILY");
    expect(system).toContain("Shared-care de-duplication");
    expect(block).toContain("Serena → Tavian:");
    const msg = turnMessage(shadowFell, request("morning"), runtime);
    expect(msg).toContain("## The slate");
    expect(msg).toContain("mixed, confidence high");
    expect(msg.indexOf("## The slate")).toBeLessThan(msg.indexOf("## Transcript so far"));
  });

  it("is filled by the understudy for every beat, in the shape the schema requires", () => {
    for (const act of shadowFell.acts) {
      for (const beat of act.beats) {
        const r = understudy(shadowFell, request(beat.id), runtime);
        expect(() => DirectorResponseSchema.parse(r), beat.id).not.toThrow();
        expect(r.slate.outsiderMode).toBe(beat.outsider?.mode ?? "mixed");
        expect(r.slate.intentions.length).toBeGreaterThanOrEqual(2);
        if (wardensInBeat(runtime, beat).present.length) expect(r.slate.owner).not.toBe("none");
      }
    }
    expect(understudy(shadowFell, request("no-windows"), runtime).slate.owner).toBe("none");
  });
});
