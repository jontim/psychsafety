/**
 * Compiles Jon's Behavioral Canon & Social Runtime (src/canon/behavioral-canon.md)
 * into the machine-usable runtime the director loads (src/canon/runtime.json).
 *
 * The markdown is the source of truth; this file only reads its shape. Two things
 * are applied on the way through, both as data rather than edits to the text:
 * the Contradiction Ledger's live names, and rulings Jon made after the document
 * was frozen. Anything the parser cannot find throws, so a changed heading fails
 * loudly instead of silently dropping canon.
 */
import type { CanonRuntime, CanonTest, DirectedPair, FallbackDomain, WardenRuntime } from "../engine/runtime.js";

export const DOC_VERSION = "1.4";

const WARDEN_IDS: Record<string, string> = { VARYA: "varya", THORBIN: "thorbin", SERENA: "serena", BRASK: "brask", KAEL: "kael", LYRA: "lyra", TAVIAN: "tav" };
export const WARDEN_NAMES: Record<string, string> = {
  varya: "Varya Stormveil", thorbin: "Thorbin Ironhart", serena: "Serena Duskbane", brask: "Brask Runebearer",
  kael: "Kael Thornmere", lyra: "Lyra Veyrin", tav: "Tavian Larkvale",
};

/** Contradiction Ledger: live names for anything that can reach a prompt. */
const NORMALISE: Array<[RegExp, string]> = [
  [/\bMoradin\b/g, "Morrighad"],
  [/\bThorbardin\b/g, "Tor-Morrighad"],
  [/\bOghma\b/g, "Ogma"],
  // Jon, 2026-09-22: the number is canon in the writers' layer and never reaches a prompt.
  [/\b95%\s*/g, ""],
];

/** Rulings Jon made after the document was frozen; each replaces one sentence and names its source. */
export const RULINGS: Array<{ find: RegExp; replace: string; source: string }> = [
  {
    find: /After the break in the slave route, Melindre['’]s farm became a major safe stop for escaped Mhasun slaves\./,
    replace: "Melindre's farm was a stop on the railroad for years before the strike, and before the two of them were anything to each other: a network Thorbin built, supplied, kept warm and trained over forty years against the day of the assault, with no stream of escapees before the crucible, only the occasional scattered caravan as a test of readiness.",
    source: "Jon, 2026-09-22: the route breaks only at the end of the Mhasun assault; the railroad was primed against the assault and the stop is older than the romance.",
  },
];

function clean(text: string): string {
  let t = text;
  for (const r of RULINGS) t = t.replace(r.find, r.replace);
  for (const [re, to] of NORMALISE) t = t.replace(re, to);
  return t.replace(/[ \t]{2,}/g, " ").trim();
}

function idOf(name: string): string {
  const id = WARDEN_IDS[name.trim().toUpperCase()];
  if (!id) throw new Error(`Not a Warden: ${name}`);
  return id;
}

interface Block { num: number; sub: string; text: string }

function testsOf(section: string, blocks: Block[]): CanonTest[] {
  const out: CanonTest[] = [];
  let current: CanonTest | null = null;
  for (const b of blocks) {
    if (b.text.startsWith("TEST:")) { current = { section, test: clean(b.text.slice(5)), expected: "" }; out.push(current); }
    else if (b.text.startsWith("Expected:") && current) current.expected = clean(b.text.slice(9));
  }
  for (const t of out) if (!t.expected) throw new Error(`Section ${section}: test without an expectation: ${t.test}`);
  return out;
}

export function compileCanon(markdown: string): CanonRuntime {
  const blocks: Block[] = [];
  let num = 0;
  let sub = "";
  let header = "";
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("<!--")) continue;
    const h1 = /^# (\d+)\s+(.*)$/.exec(line);
    if (h1) { num = Number(h1[1]); sub = ""; continue; }
    const h2 = /^## (.*)$/.exec(line);
    if (h2) { sub = h2[1]!.trim(); if (num === 0) header = sub; continue; }
    blocks.push({ num, sub, text: line });
  }
  const at = (n: number, pick?: (s: string) => boolean): Block[] => blocks.filter((b) => b.num === n && (pick ? pick(b.sub) : true));
  const texts = (bs: Block[]): string[] => bs.map((b) => clean(b.text.replace(/^- /, "")));
  const wardenSub = (s: string): string | null => WARDEN_IDS[s.split(/\s+/)[0]!.toUpperCase()] ?? null;

  // Preamble
  const pre = at(0);
  const primaryLaw = clean(pre.find((b) => b.text.startsWith("PRIMARY LAW"))?.text.replace(/^PRIMARY LAW\s*•\s*/, "") ?? "");
  const retrieval = texts(pre.filter((b) => /^(Precedence|Retrieval order|current_owner|Directed relationships|Candidate gate|Frozen baseline|NPC scene retrieval|Absent-owner retrieval|No-safe-fallback):/.test(b.text)));
  if (!primaryLaw || retrieval.length < 9) throw new Error("Preamble: primary law or retrieval rules missing");

  // 1, 2, 4, 7
  const companyRuntime = texts(at(1));
  const pluralLeadership = texts(at(2));
  const combinedLeadership = texts(at(4));
  const guardrails = texts(at(7).filter((b) => b.text.startsWith("- ")));

  // 3: execution cards
  const wardens: Record<string, WardenRuntime> = {};
  const ensure = (id: string): WardenRuntime => (wardens[id] ??= {
    id, name: WARDEN_NAMES[id]!, role: "", thesis: "", card: [], runtimeRule: "", failureMode: "", runtime: {},
    outsider: { authority: "", vulnerable: "", predator: "", nuisance: "" }, wrongLines: [],
  });
  for (const b of at(3)) {
    const id = wardenSub(b.sub);
    if (!id) continue;
    const w = ensure(id);
    if (b.text.startsWith("- ")) w.card.push(clean(b.text.slice(2)));
    else if (b.text.startsWith("RUNTIME RULE")) w.runtimeRule = clean(b.text.replace(/^RUNTIME RULE\s*•\s*/, ""));
    else if (b.text.startsWith("Failure mode to avoid.")) w.failureMode = clean(b.text.replace(/^Failure mode to avoid\.\s*/, ""));
    else if (!w.role) w.role = clean(b.text);
    else if (!w.thesis) w.thesis = clean(b.text);
  }

  // 5: directed pairs
  const pairs: Record<string, DirectedPair> = {};
  for (const s of [...new Set(at(5).map((b) => b.sub).filter((x) => x.includes("↔")))]) {
    const bs = at(5, (x) => x === s);
    const notes: Array<{ from: string; to: string; note: string }> = [];
    let chosenUse = "";
    let risk = "";
    for (const b of bs) {
      const m = /^([A-Z]+) → ([A-Z]+): (.*)$/.exec(b.text);
      if (m) notes.push({ from: idOf(m[1]!), to: idOf(m[2]!), note: clean(m[3]!) });
      else if (b.text.startsWith("Chosen use:")) chosenUse = clean(b.text.slice(11));
      else if (b.text.startsWith("Risk / intervention rule:")) risk = clean(b.text.slice(25));
    }
    if (notes.length !== 2 || !chosenUse || !risk) throw new Error(`Pair ${s} is incomplete`);
    for (const n of notes) pairs[`${n.from}->${n.to}`] = { ...n, chosenUse, risk };
  }

  // 9: runtime objects, scoring, state, loop
  for (const b of at(9)) {
    const id = wardenSub(b.sub);
    if (!id) continue;
    const m = /^([a-z_]+): (.*)$/.exec(b.text);
    if (m) ensure(id).runtime[m[1]!] = clean(m[2]!);
  }
  const scoring = texts(at(9, (s) => s.startsWith("9.4")));
  const stateVariables = texts(at(9, (s) => s.startsWith("9.5")));
  const generationLoop = texts(at(9, (s) => s.startsWith("9.6")));

  // 12: the Kids, Melindre
  const kids = texts(at(12, (s) => s.startsWith("12.1")));
  const creekBed = texts(at(12, (s) => s.startsWith("12.2"))).join(" ");
  const thorbinMelindre = texts(at(12, (s) => s.startsWith("12.3")));
  const sleepingArrangements = texts(at(12, (s) => s.startsWith("12.4")));
  const relationshipConsequences = texts(at(12, (s) => s.startsWith("12.5")));
  const genderedReflex = texts(at(12, (s) => s.startsWith("12.6")));

  // 13, 14, 15
  const sourceMined = texts(at(13, (s) => s === "").filter((b) => !b.text.startsWith("Sources reviewed")));
  const careCustody = texts(at(14, (s) => s === "").filter((b) => !/LEGACY PLACEHOLDER/.test(b.text)));
  const careRules = texts(at(14, (s) => /^14\.[1-4]/.test(s)));
  const torMorrighad = texts(at(15, (s) => !/^15\.1[12]/.test(s)));
  const torMorrighadState: Record<string, string> = {};
  for (const b of at(15, (s) => s.startsWith("15.11"))) { const m = /^([a-z_]+): (.*)$/.exec(b.text); if (m) torMorrighadState[m[1]!] = clean(m[2]!); }

  // 16: outsider behaviour
  let classificationRule = "";
  const MODE = { Authority: "authority", Victims: "vulnerable", Predators: "predator", Fools: "nuisance" } as const;
  for (const b of at(16)) {
    if (b.text.startsWith("CLASSIFICATION RULE:")) { classificationRule = clean(b.text.slice(20)); continue; }
    const id = wardenSub(b.sub);
    if (!id) continue;
    const m = /^(Authority|Victims|Predators|Fools): (.*)$/.exec(b.text);
    if (m) ensure(id).outsider[MODE[m[1] as keyof typeof MODE]] = clean(m[2]!);
  }

  // 17: absence rules
  const absenceRule = texts(at(17, (s) => s === "")).join(" ");
  const fallbacks: FallbackDomain[] = [];
  for (const s of [...new Set(at(17).map((b) => b.sub))]) {
    if (!s || /^17\./.test(s)) continue;
    const bs = at(17, (x) => x === s);
    const get = (label: string) => bs.find((b) => b.text.startsWith(label))?.text.slice(label.length).trim() ?? "";
    fallbacks.push({ domain: s, owner: idOf(get("Owner:")), fallbacks: [idOf(get("Fallback 1:")), idOf(get("Fallback 2:"))], limit: clean(get("Limit:")) });
  }
  const microParties: Record<string, string> = {};
  for (const b of at(17, (s) => s.startsWith("17.1"))) {
    const m = /^(One Warden|Two Wardens|Three Wardens|Owner absent|No safe fallback): (.*)$/.exec(b.text);
    if (m) microParties[m[1]!] = clean(m[2]!);
  }
  const machineFields = texts([...at(17, (s) => s.startsWith("17.2")), ...at(19, (s) => s.startsWith("19.1"))]);

  // 18: wrong lines
  for (const b of at(18)) {
    const id = wardenSub(b.sub);
    if (!id) continue;
    const w = ensure(id);
    const wrong = /^[−-]2 WRONG: [“"](.*)[”"]$/.exec(b.text);
    if (wrong) w.wrongLines.push({ line: clean(wrong[1]!), why: "", instead: "" });
    else if (b.text.startsWith("Why:") && w.wrongLines.length) w.wrongLines[w.wrongLines.length - 1]!.why = clean(b.text.slice(4));
    else if (b.text.startsWith("Instead:") && w.wrongLines.length) w.wrongLines[w.wrongLines.length - 1]!.instead = clean(b.text.slice(8));
  }

  const tests: CanonTest[] = [
    ...testsOf("6", at(6)),
    ...testsOf("12.7", at(12, (s) => s.startsWith("12.7"))),
    ...testsOf("13.1", at(13, (s) => s.startsWith("13.1"))),
    ...testsOf("14.5", at(14, (s) => s.startsWith("14.5"))),
    ...testsOf("15.12", at(15, (s) => s.startsWith("15.12"))),
    ...testsOf("19", at(19, (s) => s === "")),
  ];

  // Completeness: a changed heading fails here, not in a scene.
  for (const id of Object.keys(WARDEN_NAMES)) {
    const w = wardens[id];
    if (!w) throw new Error(`No runtime compiled for ${id}`);
    if (!w.role || !w.thesis || w.card.length < 5 || !w.runtimeRule || !w.failureMode) throw new Error(`${id}: execution card incomplete`);
    if (Object.keys(w.runtime).length < 8) throw new Error(`${id}: runtime object incomplete`);
    if (Object.values(w.outsider).some((v) => !v)) throw new Error(`${id}: outsider modes incomplete`);
    if (w.wrongLines.length !== 3 || w.wrongLines.some((l) => !l.why || !l.instead)) throw new Error(`${id}: wrong lines incomplete`);
  }
  if (Object.keys(pairs).length !== 42) throw new Error(`Expected 42 directed pairs, found ${Object.keys(pairs).length}`);
  if (fallbacks.length !== 10) throw new Error(`Expected 10 fallback domains, found ${fallbacks.length}`);
  if (!classificationRule || !absenceRule || Object.keys(microParties).length !== 5) throw new Error("Sections 16 and 17 incomplete");
  if (tests.length < 40) throw new Error(`Expected at least 40 regression tests, found ${tests.length}`);

  return {
    version: DOC_VERSION, header, primaryLaw, retrieval, companyRuntime, pluralLeadership, combinedLeadership, guardrails,
    scoring, stateVariables, generationLoop, classificationRule, absenceRule, microParties, machineFields,
    wardens, pairs, fallbacks, kids, creekBed, thorbinMelindre, sleepingArrangements, relationshipConsequences, genderedReflex,
    sourceMined, careCustody, careRules, torMorrighad, torMorrighadState, tests,
    rulings: RULINGS.map((r) => ({ replace: r.replace, source: r.source })),
  };
}
