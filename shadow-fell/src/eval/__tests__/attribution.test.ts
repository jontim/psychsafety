import { describe, it, expect } from "vitest";
import { shadowFell } from "../../worlds/shadow-fell/world.js";
import { validateWorld, findBeat } from "../../engine/world.js";
import { loadCanonRuntime } from "../../server/runtime.js";
import { systemPrompt, turnMessage } from "../../server/prompt.js";
import { understudy } from "../../server/understudy.js";
import { CONDITIONS, SCENARIOS, WARDENS, EVAL_CAST, evalWorld, evalBeatId, identityTerms, stripIdentity, scoreCondition, verdict, hitsWrongLine, judgeSystem, matchJudgements, sampleLine, slipsStyle, opensOnCare, type Sample, type JudgedItem, type ConditionScore } from "../attribution.js";
import { chooseMoves, scoreSteering, steeringVerdict, matchSteering, type SteeringPair } from "../steering.js";

const runtime = loadCanonRuntime();

describe("the attribution eval", () => {
  it("builds a valid world with every Warden alone in every scenario", () => {
    const world = evalWorld(shadowFell);
    expect(validateWorld(world)).toEqual([]);
    const act = world.acts.find((a) => a.id === "eval")!;
    expect(SCENARIOS).toHaveLength(6);
    expect(act.beats).toHaveLength(SCENARIOS.length * WARDENS.length);
    for (const c of EVAL_CAST) expect(world.cast.some((m) => m.id === c.id)).toBe(true);
    const { beat } = findBeat(world, evalBeatId("visitor", "brask"));
    expect(beat.counterpart).toBe("brask");
    expect(beat.present).toEqual([]);
    expect(beat.outsider).toMatchObject({ mode: "mixed", confidence: "low" });
    expect(shadowFell.acts.some((a) => a.id === "eval")).toBe(false);
    expect(shadowFell.cast.some((m) => m.id === "eval-penitent")).toBe(false);
    expect(SCENARIOS.filter((s) => s.pair).map((s) => s.pair!.join("+"))).toEqual(["serena+varya", "serena+thorbin", "tav+varya", "lyra+kael", "thorbin+brask"]);
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

  it("hears the shared care reflex", () => {
    expect(opensOnCare("Sit down. Eat something first. Three nights, you said.")).toBe(true);
    expect(opensOnCare("You've walked since dawn and you're shaking. Which way do the alders face?")).toBe(true);
    expect(opensOnCare("Three nights. Not four. Which night did it start?")).toBe(false);
    expect(opensOnCare("Brask does not know what it is. Brask knows water does not climb.")).toBe(false);
  });

  it("hears Brask conjugate", () => {
    expect(slipsStyle("brask", "Brask did not ask for a cup. You said wagons. What was in them?")).toBe(true);
    expect(slipsStyle("brask", "Brask no ask for cup. You say wagons? What they have?")).toBe(false);
    expect(slipsStyle("brask", "Barn has straw, door, Brask. Eat the bread.")).toBe(false);
    expect(slipsStyle("brask", "That is not true.")).toBe(true);
    expect(slipsStyle("brask", "You promised.")).toBe(true);
    expect(slipsStyle("brask", "That not true. You make promise. Promise fail.")).toBe(false);
    expect(slipsStyle("brask", "Brask need bread. Red road. Wicked man.")).toBe(false);
    expect(slipsStyle("brask", "Do you know him?")).toBe(true);
    expect(slipsStyle("brask", "You know him? Why you here? What he say?")).toBe(false);
    expect(slipsStyle("brask", "You give word. Then break word. I ask. You not answer.")).toBe(false);
    expect(slipsStyle("brask", "Before, you say three men. Now you say two. Which true?")).toBe(false);
    expect(slipsStyle("brask", "Guards come at dawn? He leave before dawn? Then somebody tell him. Who know guards come?")).toBe(false);
    expect(slipsStyle("brask", "Bridge only crossing? Creature live somewhere else? Then we not know. Find out.")).toBe(false);
    expect(slipsStyle("brask", "Why is he angry?")).toBe(true);
    expect(slipsStyle("brask", "Nevertheless, the incentives are misaligned.")).toBe(true);
    expect(slipsStyle("brask", "Give him the benefit of the doubt.")).toBe(true);
    expect(slipsStyle("brask", "That's not the hill I want to die on.")).toBe(true);
    expect(slipsStyle("serena", "That was decided, not promised.")).toBe(false);
  });

  it("repairs prose into speech and matches numbered judgements", () => {
    expect(sampleLine('"Brask reads." A pause. "Who sent you?"')).toEqual({ line: "Brask reads. Who sent you?", rawLine: '"Brask reads." A pause. "Who sent you?"', proseLeak: "A pause." });
    expect(sampleLine("Who sent you?")).toEqual({ line: "Who sent you?" });
    const items = [{ id: "x", kind: "line" as const, text: "", situation: "" }];
    expect(matchJudgements(items, { items: [{ index: 1, voice: "tav", action: "tav", swappable: false }, { index: 7, voice: "tav", action: "tav", swappable: true }] })).toMatchObject({ unmatched: 1 });
  });

  it("scores within each Warden's own judged lines and names collisions", () => {
    const mk = (condition: "A" | "B" | "C", warden: Sample["warden"], scenario: string, i: number, intention?: string): Sample => ({
      id: `${condition}-${scenario}-${warden}-${i}`, condition, scenario, warden, stimulus: "s", stimulusLine: "x", tone: "warm", speaker: warden, line: `line ${i}`, acting: "", source: "claude",
      ...(intention ? { intention, intentionScore: 2 } : {}),
    });
    const samples: Sample[] = [mk("B", "serena", "counsel", 1), mk("B", "thorbin", "counsel", 2), mk("B", "serena", "captain", 3), mk("B", "brask", "captain", 4), { ...mk("C", "serena", "counsel", 5), source: "understudy", note: "Model returned refusal (reasoning_extraction); the understudy took the turn." }];
    const judged = new Map<string, JudgedItem>([
      ["B-counsel-serena-1:line", { index: 1, voice: "thorbin", action: "serena", swappable: true }],
      ["B-counsel-thorbin-2:line", { index: 2, voice: "thorbin", action: "thorbin", swappable: false }],
      ["B-captain-serena-3:line", { index: 3, voice: "serena", action: "serena", swappable: false }],
      // the fourth line came back unjudged
    ]);
    const B = scoreCondition("B", samples, judged, runtime);
    expect(B).toMatchObject({ n: 4, judged: 3, unjudged: 1, fallbacks: 0, voice: 2 / 3, action: 1, swapResistance: 2 / 3 });
    expect(B.perWarden.serena).toEqual({ n: 2, voice: 0.5, action: 1 });
    expect(B.perWarden.thorbin).toEqual({ n: 1, voice: 1, action: 1 });
    expect(B.perWarden.brask).toBeUndefined();
    expect(B.pairs).toEqual([{ scenario: "captain", pair: ["serena", "varya"], n: 1, voice: 1, crossed: 0 }, { scenario: "counsel", pair: ["serena", "thorbin"], n: 2, voice: 0.5, crossed: 1 }]);
    expect(B.confusions).toEqual([{ scenario: "counsel", truth: "serena", guess: "thorbin", count: 1 }]);
    const C = scoreCondition("C", samples, judged, runtime);
    expect(C).toMatchObject({ n: 1, fallbacks: 1, judged: 0 });
  });

  it("says what the data says", () => {
    const base = (condition: "A" | "B" | "C", over: Partial<ConditionScore>): ConditionScore => ({
      condition, label: CONDITIONS[condition].label, n: 4, judged: 4, offSpeaker: 0, fallbacks: 0, proseLeaks: 0, unjudged: 0, styleSlips: 0, careOpeners: 0, voice: 1, action: 1, swapResistance: 0.5, violations: 0, wrongLineHits: 0, perWarden: {}, pairs: [], confusions: [], ...over,
    });
    const A = base("A", {});
    const B = base("B", { swapResistance: 1 });
    const v = verdict({ A, B, C: base("C", { judged: 0, fallbacks: 4 }) });
    expect(v).toMatch(/C: invalid, 4 of 4 turns fell back/);
    expect(v).toMatch(/UNVALIDATED, not disproven/);
    expect(v).toMatch(/at ceiling in both/);
    expect(v).toMatch(/swap resistance rises from 50% to 100%, preliminary evidence/);
    expect(verdict({ B, C: base("C", { swapResistance: 1, intention: 0.5 }) })).toMatch(/no gain from the gate/);
    expect(verdict({ B, C: base("C", { swapResistance: 1, voice: 0.5, intention: 0.9 }) })).toMatch(/labels moves better than it renders/);
    expect(verdict({ B: base("B", { voice: 0.6, action: 0.6, judged: 40 }), C: base("C", { voice: 0.8, action: 0.7, judged: 40 }) })).toMatch(/the gate helps/);
  });

  it("switches the gate off cleanly for the ungated conditions and steers when asked", () => {
    const world = evalWorld(shadowFell);
    const gated = systemPrompt(world, "brief", {}, runtime, true);
    const ungated = systemPrompt(world, "brief", {}, runtime, false);
    expect(gated).toContain("Generation loop:");
    expect(ungated).not.toContain("Generation loop:");
    expect(ungated).not.toContain("Fill slate as the scene's paperwork");
    expect(gated).toContain("Fill slate as the scene's paperwork");
    expect(ungated).toContain("### Directed pairs");
    const { beat } = findBeat(world, evalBeatId("captain", "lyra"));
    const req = { worldId: "shadow-fell", beatId: beat.id, playerRole: beat.playerRole, stance: beat.stance, turn: 1, maxTurns: 3, playerLine: "Start with your name.", affect: "level", axes: {}, meters: {}, transcript: [] };
    expect(turnMessage(world, req, runtime, false)).not.toContain("Slate: two to four candidate moves");
    expect(turnMessage(world, req, runtime, true)).toContain("Slate: two to four candidate moves");
    expect(turnMessage(world, { ...req, steer: "ask for the concrete rule" }, runtime, true)).toContain("This turn the speaker's move is fixed: ask for the concrete rule.");
    expect(turnMessage(world, req, runtime, true)).not.toContain("move is fixed");
    expect(understudy(world, req, runtime).slate.owner).toBe("lyra");
    expect(CONDITIONS.A.gate).toBe(false);
    expect(CONDITIONS.C.gate).toBe(true);
    expect(judgeSystem(runtime)).toContain("### Brask Runebearer (id: brask)");
  });
});

describe("the steering test", () => {
  it("chooses two distinct moves at +1 or better", () => {
    expect(chooseMoves({ owner: "serena", coverage: "owner", outsiderMode: "mixed", intentions: [{ intention: "hold the boundary", score: 2 }, { intention: "Hold the boundary", score: 1 }, { intention: "grant limited access", score: 1 }, { intention: "accuse him", score: -2 }] })).toEqual(["hold the boundary", "grant limited access"]);
    expect(chooseMoves({ owner: "serena", coverage: "owner", outsiderMode: "mixed", intentions: [{ intention: "hold", score: 1 }, { intention: "narrate", score: -2 }] })).toBeNull();
    expect(chooseMoves(undefined)).toBeNull();
  });

  it("scores pairs and applies Jon's rule", () => {
    const mk = (id: string, warden: SteeringPair["warden"], lines: [string, string]): SteeringPair => ({ id, scenario: "visitor", warden, stimulus: "letter", stimulusLine: "x", tone: "warm", moves: ["a", "b"], lines, sources: ["claude", "claude"] });
    const pairs = [mk("p1", "serena", ["one", "two"]), mk("p2", "serena", ["same", "same"]), mk("p3", "brask", ["one", "two"])];
    const judged = new Map([
      ["p1", { index: 1, distinct: true, enactsFirst: true, enactsSecond: true, sameVoice: true }],
      ["p2", { index: 2, distinct: true, enactsFirst: true, enactsSecond: true, sameVoice: true }],
      ["p3", { index: 3, distinct: true, enactsFirst: true, enactsSecond: false, sameVoice: true }],
    ]);
    const s = scoreSteering(pairs, judged, []);
    expect(s).toMatchObject({ pairs: 3, judged: 3, identical: 1, causal: 1 / 3, distinct: 2 / 3, enacted: 2 / 3, sameVoice: 1, converged: 0 });
    expect(s.perWarden.serena).toEqual({ n: 2, causal: 0.5, converged: 0 });
    const withConverged = scoreSteering(pairs, judged, [], [{ scenario: "counsel", warden: "thorbin", stimulus: "hayloft", move: "sit him down and ask what care requires" }]);
    expect(withConverged.converged).toBe(1);
    expect(withConverged.perWarden.thorbin).toEqual({ n: 0, causal: 0, converged: 1 });
    expect(steeringVerdict(s)).toMatch(/^Mixed/);
    expect(steeringVerdict({ ...s, causal: 0.8 })).toMatch(/does causal work/);
    expect(steeringVerdict({ ...s, distinct: 0.1, causal: 0.05 })).toMatch(/decorative/);
    expect(steeringVerdict({ ...s, judged: 0 })).toMatch(/UNVALIDATED/);
    expect(matchSteering(pairs, { pairs: [{ index: 9, distinct: true, enactsFirst: true, enactsSecond: true, sameVoice: true }] })).toMatchObject({ unmatched: 1 });
  });
});
