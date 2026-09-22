import { describe, it, expect } from "vitest";
import { shadowFell } from "../../worlds/shadow-fell/world.js";
import { validateWorld, findBeat } from "../../engine/world.js";
import { loadCanonRuntime, } from "../../server/runtime.js";
import { systemPrompt, turnMessage } from "../../server/prompt.js";
import { understudy } from "../../server/understudy.js";
import { CONDITIONS, SCENARIOS, WARDENS, evalWorld, evalBeatId, identityTerms, stripIdentity, scoreCondition, verdict, hitsWrongLine, judgeSystem, type Sample, type JudgedItem } from "../attribution.js";

const runtime = loadCanonRuntime();

describe("the attribution eval", () => {
  it("builds a valid world with every Warden alone in every scenario", () => {
    const world = evalWorld(shadowFell);
    expect(validateWorld(world)).toEqual([]);
    const act = world.acts.find((a) => a.id === "eval")!;
    expect(act.beats).toHaveLength(SCENARIOS.length * WARDENS.length);
    const { beat } = findBeat(world, evalBeatId("visitor", "brask"));
    expect(beat.counterpart).toBe("brask");
    expect(beat.present).toEqual([]);
    expect(beat.outsider).toMatchObject({ mode: "mixed", confidence: "low" });
    expect(shadowFell.acts.some((a) => a.id === "eval")).toBe(false);
  });

  it("strips every name, tag and sigil before the judge sees a line", () => {
    const terms = identityTerms(shadowFell);
    const line = "Serena Duskbane said it, and Tav laughed; Thorbin's hammer and Brask's Souldrinker stayed put. Piss and Moan, lass, by Morrighad.";
    const stripped = stripIdentity(line, terms);
    for (const t of ["Serena", "Duskbane", "Tav", "Thorbin", "Brask", "Souldrinker", "Piss and Moan", "Morrighad"]) expect(stripped).not.toContain(t);
    expect(stripped).toContain("lass");
    expect(stripped).toContain("hammer");
  });

  it("recognises a wrong line when the director renders one", () => {
    expect(hitsWrongLine("Nature obeys me.", runtime)).toBe(true);
    expect(hitsWrongLine("Nobody will know if we kill him quietly, lad.", runtime)).toBe(true);
    expect(hitsWrongLine("Sit down. You have walked a long way to say very little.", runtime)).toBe(false);
  });

  it("scores conditions and applies Jon's rule", () => {
    const mk = (condition: "A" | "B" | "C", warden: Sample["warden"], i: number, intention?: string): Sample => ({
      id: `${condition}-${warden}-${i}`, condition, scenario: "visitor", warden, stimulus: "letter", stimulusLine: "x", tone: "warm", speaker: warden, line: `line ${i}`, acting: "", source: "test", ...(intention ? { intention, intentionScore: 2 } : {}),
    });
    const samples: Sample[] = [mk("B", "serena", 1), mk("B", "brask", 2), mk("C", "serena", 3, "hold the line"), mk("C", "brask", 4, "state the truth")];
    const judged = new Map<string, JudgedItem>([
      ["B-serena-1:line", { id: "B-serena-1:line", voice: "serena", action: "thorbin", swappable: true }],
      ["B-brask-2:line", { id: "B-brask-2:line", voice: "kael", action: "brask", swappable: true, violation: "secret killing" }],
      ["C-serena-3:line", { id: "C-serena-3:line", voice: "serena", action: "serena", swappable: false }],
      ["C-brask-4:line", { id: "C-brask-4:line", voice: "brask", action: "brask", swappable: false }],
      ["C-serena-3:intention", { id: "C-serena-3:intention", voice: "serena", action: "serena", swappable: false }],
      ["C-brask-4:intention", { id: "C-brask-4:intention", voice: "brask", action: "thorbin", swappable: true }],
    ]);
    const B = scoreCondition("B", samples, judged, runtime);
    const C = scoreCondition("C", samples, judged, runtime);
    expect(B).toMatchObject({ n: 2, voice: 0.5, action: 0.5, swapResistance: 0, violations: 1 });
    expect(C).toMatchObject({ n: 2, voice: 1, action: 1, swapResistance: 1, violations: 0, intention: 0.5 });
    expect(verdict({ B, C })).toMatch(/^Keep the gate/);
    expect(verdict({ B, C: { ...C, voice: 0.5, action: 0.5, intention: 1 } })).toMatch(/picks intentions better than it renders/);
    expect(verdict({ B, C: { ...C, voice: 0.5, action: 0.5, intention: 0.25 } })).toMatch(/^Kill the gate/);
  });

  it("switches the gate off cleanly for the ungated conditions", () => {
    const world = evalWorld(shadowFell);
    const gated = systemPrompt(world, "brief", {}, runtime, true);
    const ungated = systemPrompt(world, "brief", {}, runtime, false);
    expect(gated).toContain("Generation loop:");
    expect(ungated).not.toContain("Generation loop:");
    expect(ungated).not.toContain("report it in slate");
    expect(ungated).toContain("### Directed pairs");
    const { beat } = findBeat(world, evalBeatId("captain", "lyra"));
    const req = { worldId: "shadow-fell", beatId: beat.id, playerRole: beat.playerRole, stance: beat.stance, turn: 1, maxTurns: 3, playerLine: "Start with your name.", affect: "level", axes: {}, meters: {}, transcript: [] };
    expect(turnMessage(world, req, runtime, false)).not.toContain("Before the line");
    expect(turnMessage(world, req, runtime, true)).toContain("Before the line");
    expect(understudy(world, req, runtime).slate.owner).toBe("lyra");
    expect(CONDITIONS.A.gate).toBe(false);
    expect(CONDITIONS.C.gate).toBe(true);
    expect(judgeSystem(runtime)).toContain("### Brask Runebearer (id: brask)");
  });
});
