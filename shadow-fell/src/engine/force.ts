import type { Beat, Capability, CastMember, World } from "./world.js";
import { findCast } from "./world.js";

/**
 * The force layer. Simple on purpose: a fight is a question of who is in the
 * room. Full cover of the beat's requirements is a clean win. Short cover means
 * the player chooses a strategy from the people they have, and the voice they
 * call it in still counts.
 */
export interface Muster {
  present: CastMember[];
  covered: Capability[];
  missing: Capability[];
  cleanWin: boolean;
}

export interface Strategy {
  id: string;
  label: string;
  /** Cast ids the strategy relies on. */
  uses: string[];
  covers: Capability[];
  /** Share of the beat's requirements this strategy covers, 0..1. */
  coverage: number;
  /** Extra weight from named moves, 0 to 0.3. */
  bonus: number;
  /** A line the player might say to call it; also the keyword bank for voice matching. */
  call: string;
  /** Scribe line when a named move lands. */
  landed?: string;
}

export type ForceOutcome = "clean" | "won" | "costly" | "lost";

export interface ForceResolution {
  outcome: ForceOutcome;
  score: number;
  narration: string;
  meterDeltas: Record<string, number>;
}

export function muster(world: World, beat: Beat): Muster {
  const ids = [beat.playerRole, ...beat.present];
  const present = ids.map((id) => findCast(world, id));
  const requires = beat.force?.requires ?? [];
  const have = new Set<Capability>();
  for (const member of present) for (const c of member.capabilities) have.add(c);
  const covered = requires.filter((c) => have.has(c));
  const missing = requires.filter((c) => !have.has(c));
  return { present, covered, missing, cleanWin: requires.length > 0 && missing.length === 0 };
}

const MOVE: Record<Capability, (name: string) => string> = {
  muscle: (n) => `${n} takes the door`,
  blade: (n) => `${n} closes the distance`,
  concurrence: (n) => `${n} cuts them off from the Concurrence`,
  legitimacy: (n) => `${n} declares the court convened`,
  stealth: (n) => `${n} vanishes and comes back behind them`,
  brains: (n) => `${n} calls the timing`,
  face: (n) => `${n} keeps them talking`,
  bait: (n) => `${n} draws them in`,
  healing: (n) => `${n} keeps them breathing for trial`,
  command: (n) => `${n} gives the order`,
  spectacle: (n) => `${n} makes the room look`,
};

/** Build the strategies the present cast makes possible: one per capability, then the best pairs. */
export function strategies(world: World, beat: Beat, m: Muster): Strategy[] {
  const requires = beat.force?.requires ?? [];
  if (requires.length === 0) return [];
  const singles: Strategy[] = [];
  for (const member of m.present) {
    const named = new Set<Capability>();
    for (const move of member.moves) {
      if (!requires.includes(move.capability)) continue;
      named.add(move.capability);
      singles.push({
        id: `${member.id}:${move.id}`,
        label: move.label,
        uses: [member.id],
        covers: [move.capability],
        coverage: 1 / requires.length,
        bonus: move.bonus,
        call: `${member.name} ${move.capability} ${move.label}`,
        landed: move.line,
      });
    }
    for (const cap of member.capabilities) {
      if (!requires.includes(cap) || named.has(cap)) continue;
      singles.push({
        id: `${member.id}:${cap}`,
        label: MOVE[cap](member.name),
        uses: [member.id],
        covers: [cap],
        coverage: 1 / requires.length,
        bonus: 0,
        call: `${member.name} ${cap}`,
      });
    }
  }
  const pairs: Strategy[] = [];
  for (let i = 0; i < singles.length; i++) {
    for (let j = i + 1; j < singles.length; j++) {
      const a = singles[i]!;
      const b = singles[j]!;
      if (a.uses[0] === b.uses[0] || a.covers[0] === b.covers[0]) continue;
      const covers = [...new Set([...a.covers, ...b.covers])];
      pairs.push({
        id: `${a.id}+${b.id}`,
        label: `${a.label}; ${b.label}`,
        uses: [...a.uses, ...b.uses],
        covers,
        coverage: covers.length / requires.length,
        bonus: Math.min(0.3, a.bonus + b.bonus),
        call: `${a.call} ${b.call}`,
        landed: [a.landed, b.landed].filter(Boolean).join(" "),
      });
    }
  }
  const all = [...pairs, ...singles].sort((x, y) => y.coverage + y.bonus - (x.coverage + x.bonus) || x.label.localeCompare(y.label));
  const seen = new Set<string>();
  return all.filter((s) => (seen.has(s.label) ? false : (seen.add(s.label), true))).slice(0, 6);
}

/** Match what the player said to the strategy it names; null if nothing matches. */
export function matchStrategy(list: Strategy[], text: string): Strategy | null {
  const words = text.toLowerCase();
  let best: { s: Strategy; hits: number } | null = null;
  for (const s of list) {
    const tokens = s.call.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    const hits = tokens.filter((t) => words.includes(t)).length;
    if (hits > 0 && (!best || hits > best.hits || (hits === best.hits && s.coverage > best.s.coverage))) best = { s, hits };
  }
  return best?.s ?? null;
}

/**
 * Resolve a fight. Coverage carries most of the weight, named moves add a
 * little, and the voice that called it (command and composure) carries the
 * rest. Deterministic, so a replay with the same people and the same tone
 * ends the same way. Thresholds: won at 0.6, costly at 0.3, lost below.
 */
export function resolveForce(
  strategy: Strategy | null,
  m: Muster,
  axes: Record<string, number>,
  beat: Beat,
): ForceResolution {
  const threat = beat.force?.threat ?? "a fight";
  const names = (ids: string[]) => ids.map((id) => m.present.find((p) => p.id === id)?.name ?? id).join(" and ");
  if (m.cleanWin) {
    return {
      outcome: "clean",
      score: 1,
      narration: `${threat} It is over before it starts: ${m.present.map((p) => p.name).join(", ")} have every angle covered.`,
      meterDeltas: { standing: 8, rapport: -6 },
    };
  }
  const coverage = strategy?.coverage ?? 0;
  const bonus = strategy?.bonus ?? 0;
  const voice = Math.max(-1, Math.min(1, ((axes.command ?? 0) + (axes.composure ?? 0)) / 2));
  const score = Math.round((coverage * 0.6 + bonus + ((voice + 1) / 2) * 0.4) * 100) / 100;
  if (!strategy) {
    return { outcome: "lost", score, narration: `${threat} Nobody moves in time. They are gone.`, meterDeltas: { standing: -10, evidence: -10 } };
  }
  if (score >= 0.6) {
    return {
      outcome: "won",
      score,
      narration: `${threat} ${names(strategy.uses)} settle it: ${strategy.label}. ${strategy.landed ?? "Rough, but done."}`,
      meterDeltas: { standing: 6, rapport: -10 },
    };
  }
  if (score >= 0.3) {
    return {
      outcome: "costly",
      score,
      narration: `${threat} ${strategy.label}. It works, at a price: someone is hurt, and Serena's bar just rose.`,
      meterDeltas: { standing: 2, rapport: -14, evidence: -6, cover: -8 },
    };
  }
  return { outcome: "lost", score, narration: `${threat} ${strategy.label}, and it is not enough. They slip the net.`, meterDeltas: { standing: -10, evidence: -10 } };
}
