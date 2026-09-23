import type { World, Beat } from "./world.js";
import { findCast } from "./world.js";

/**
 * The company's runtime: Jon's Behavioral Canon & Social Runtime compiled into
 * data (see src/server/compile-canon.ts). Pure functions here; the JSON is loaded
 * server-side so the web bundle never carries it.
 */

export const OUTSIDER_MODES = ["authority", "vulnerable", "predator", "nuisance", "mixed"] as const;
export type OutsiderMode = (typeof OUTSIDER_MODES)[number];
export const COVERAGE_MODES = ["owner", "fallback", "containment", "retrieval"] as const;
export type CoverageMode = (typeof COVERAGE_MODES)[number];

export interface WrongLine { line: string; why: string; instead: string }

export interface WardenRuntime {
  id: string;
  name: string;
  /** "Ranger • intelligence operator • probability thinker" */
  role: string;
  thesis: string;
  /** Execution card bullets (section 3). */
  card: string[];
  runtimeRule: string;
  failureMode: string;
  /** Machine fields (section 9.2): notices_first, default_strategy, will_not_do... */
  runtime: Record<string, string>;
  /** How this Warden handles each class of outsider (section 16). */
  outsider: Record<Exclude<OutsiderMode, "mixed">, string>;
  /** Fast drift diagnostics (section 18). */
  wrongLines: WrongLine[];
  /** Voice rules that bind the rendered line (section 21); empty for most Wardens. */
  languageRail: string[];
}

/** What A does differently because B is here (section 5). */
export interface DirectedPair { from: string; to: string; note: string; chosenUse: string; risk: string }

export interface FallbackDomain { domain: string; owner: string; fallbacks: string[]; limit: string }

export interface CanonTest { section: string; test: string; expected: string }

export interface CanonRuntime {
  version: string;
  header: string;
  primaryLaw: string;
  retrieval: string[];
  companyRuntime: string[];
  pluralLeadership: string[];
  combinedLeadership: string[];
  guardrails: string[];
  scoring: string[];
  stateVariables: string[];
  generationLoop: string[];
  classificationRule: string;
  absenceRule: string;
  microParties: Record<string, string>;
  machineFields: string[];
  wardens: Record<string, WardenRuntime>;
  pairs: Record<string, DirectedPair>;
  fallbacks: FallbackDomain[];
  kids: string[];
  creekBed: string;
  thorbinMelindre: string[];
  sleepingArrangements: string[];
  relationshipConsequences: string[];
  genderedReflex: string[];
  sourceMined: string[];
  careCustody: string[];
  careRules: string[];
  torMorrighad: string[];
  torMorrighadState: Record<string, string>;
  tests: CanonTest[];
  /** Section 20: the candidate gate's validation status and the eval that decides it. Never sent to the director. */
  validation: string[];
  rulings: Array<{ replace: string; source: string }>;
}

export interface CoverageRow { domain: string; owner: string; mode: "owner" | "fallback" | "containment"; by?: string; limit: string }

/** Wardens in a beat: the player's role, the counterpart and anyone else present, when they have a runtime. */
export function wardensInBeat(runtime: CanonRuntime, beat: Beat): { present: string[]; absent: string[] } {
  const present = [...new Set([beat.playerRole, beat.counterpart, ...beat.present].filter((id) => id in runtime.wardens))];
  const absent = Object.keys(runtime.wardens).filter((id) => !present.includes(id));
  return { present, absent };
}

/** Section 17 applied to who is in the room: owner, a fallback in their own grammar, or containment. */
export function coverage(runtime: CanonRuntime, present: string[]): CoverageRow[] {
  return runtime.fallbacks.map((f) => {
    if (present.includes(f.owner)) return { domain: f.domain, owner: f.owner, mode: "owner", limit: f.limit };
    const by = f.fallbacks.find((id) => present.includes(id));
    return by ? { domain: f.domain, owner: f.owner, mode: "fallback", by, limit: f.limit } : { domain: f.domain, owner: f.owner, mode: "containment", limit: f.limit };
  });
}

/** Directed pairs whose both ends are in the room. */
export function livePairs(runtime: CanonRuntime, present: string[]): DirectedPair[] {
  return Object.values(runtime.pairs).filter((p) => present.includes(p.from) && present.includes(p.to));
}

/** The per-turn slate: who is here, who owns what, who covers for whom, and how the outsider reads. */
export function slateCard(world: World, beat: Beat, runtime: CanonRuntime, gate = true): string {
  const { present, absent } = wardensInBeat(runtime, beat);
  const first = (id: string) => findCast(world, id).name.split(" ")[0]!;
  const lines: string[] = ["## The slate"];
  if (!present.length) {
    lines.push("No Warden is in this scene, so the company's runtime is idle: score the counterpart's intentions against their own card and what they know.");
  } else {
    lines.push(`Wardens in the scene: ${present.map((id) => (id === beat.playerRole ? `${first(id)} (the player's role)` : first(id))).join(", ")}. Absent: ${absent.map(first).join(", ") || "none"}.`);
    const rows = coverage(runtime, present);
    const byOwner = new Map<string, string[]>();
    for (const r of rows) if (r.mode === "owner") byOwner.set(r.owner, [...(byOwner.get(r.owner) ?? []), r.domain.toLowerCase()]);
    if (byOwner.size) lines.push(`Owned outright: ${[...byOwner].map(([id, ds]) => `${ds.join(", ")} (${first(id)})`).join("; ")}.`);
    for (const r of rows) {
      if (r.mode === "fallback") lines.push(`- ${r.domain}: ${first(r.owner)} is absent; ${first(r.by!)} covers it in their own grammar, never as ${first(r.owner)}. Limit: ${r.limit}`);
      else if (r.mode === "containment") lines.push(`- ${r.domain}: ${first(r.owner)} is absent and so are the fallbacks; contain, delay, seek help or leave it unresolved. Limit: ${r.limit}`);
    }
    const pairs = livePairs(runtime, present);
    if (pairs.length) lines.push(`Directed pairs live here: ${pairs.map((p) => `${first(p.from)} → ${first(p.to)}`).join("; ")}. Their notes are in the company's runtime; let each change what they do because the other is here.`);
  }
  if (beat.outsider) {
    lines.push(`The outsider as the scene opens: ${beat.outsider.mode}, confidence ${beat.outsider.confidence}.${beat.outsider.note ? ` ${beat.outsider.note}` : ""} Classify by demonstrated behaviour, never by rank, species or magic, and reclassify as it changes.`);
  }
  if (gate) lines.push("Slate: two to four candidate moves for the speaker this turn, scored −2 to +2 against the company's runtime and marked distinct when no other Warden present could make them unchanged and wayOfKnowing when they arise from this Warden's way of knowing. Never render a −2; with two or more at +1 or better render the best-scored, ties to the way of knowing, then to the distinct move. The move decides what the line does; the character decides how it sounds. Give the owner, the coverage and the outsider mode alongside them.");
  return lines.join("\n");
}
