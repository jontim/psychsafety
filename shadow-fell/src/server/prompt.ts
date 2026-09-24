import type { DirectorRequest } from "../engine/director-contract.js";
import type { World, CastMember, Beat } from "../engine/world.js";
import { findBeat, findCast } from "../engine/world.js";
import { muster } from "../engine/force.js";
import type { CanonRuntime, WardenRuntime } from "../engine/runtime.js";
import { slateCard } from "../engine/runtime.js";

const RUNTIME_FIELDS: Array<[string, string]> = [
  ["attention", "attention"], ["notices_first", "notices first"], ["default_strategy", "default strategy"], ["pressure_strategy", "under pressure"],
  ["escalation_order", "escalation order"], ["speech", "speech"], ["trust_signals", "trust signals"], ["will_not_do", "will not do"],
  ["ethical_anchor", "ethical anchor"], ["shadow_risk", "shadow risk"], ["leadership_claim", "leadership claim"],
];

function runtimeCard(w: WardenRuntime): string {
  const fields = RUNTIME_FIELDS.filter(([k]) => w.runtime[k]).map(([k, label]) => `${label}: ${w.runtime[k]}`).join("; ");
  return [
    `Runtime (director only; Behavioral Canon): ${w.role}. ${w.thesis}`,
    `Execution card: ${w.card.join(" ")}`,
    `Runtime rule: ${w.runtimeRule} Failure mode to avoid: ${w.failureMode}`,
    `Machine fields: ${fields}.`,
    `With outsiders: authority, ${w.outsider.authority} Vulnerable, ${w.outsider.vulnerable} Predators, ${w.outsider.predator} Nuisances, ${w.outsider.nuisance}`,
    ...(w.languageRail.length ? [`Language rail (binding on every line):\n${w.languageRail.map((l) => `- ${l}`).join("\n")}`] : []),
  ].join("\n");
}

function castCard(c: CastMember, dossier?: string, runtime?: WardenRuntime): string {
  const parts = [
    `### ${c.name}${c.title ? `, ${c.title}` : ""} (id: ${c.id}; ${c.faction})`,
    c.summary,
    `Speaks: ${c.register}`,
  ];
  if (c.tells.length) parts.push(`Tells the player may notice: ${c.tells.join("; ")}.`);
  if (c.knows.length) parts.push(`Knows (director only): ${c.knows.join(" ")}`);
  if (c.lines.length) parts.push(`Lines usable verbatim: ${c.lines.map((l) => `"${l}"`).join(" ")}`);
  if (dossier) parts.push(`Dossier (director only; vault canon; its Never list is binding):\n${dossier.replace(/\n## Sources[\s\S]*$/, "").trim()}`);
  if (runtime) parts.push(runtimeCard(runtime));
  return parts.join("\n");
}

/** The company's runtime as a stable block: rules, directed pairs and wrong lines. */
function runtimeBlock(world: World, rt: CanonRuntime, gate: boolean): string[] {
  const first = (id: string) => world.cast.find((c) => c.id === id)?.name.split(" ")[0] ?? id;
  const pairs = new Map<string, { a: string; b: string; ab?: string; ba?: string; chosenUse: string; risk: string }>();
  for (const p of Object.values(rt.pairs)) {
    const [a, b] = [p.from, p.to].sort();
    const key = `${a}|${b}`;
    const entry = pairs.get(key) ?? { a: a!, b: b!, chosenUse: p.chosenUse, risk: p.risk };
    if (p.from === a) entry.ab = p.note; else entry.ba = p.note;
    pairs.set(key, entry);
  }
  return [
    `## The company's runtime (Behavioral Canon v${rt.version})`,
    `Primary law: ${rt.primaryLaw}`,
    ...rt.retrieval.map((r) => `- ${r}`),
    "",
    "Company runtime:",
    ...rt.companyRuntime.map((r) => `- ${r}`),
    "",
    "Plural leadership:",
    ...rt.pluralLeadership.map((r) => `- ${r}`),
    "",
    "Serena and Tavian, combined leadership:",
    ...rt.combinedLeadership.map((r) => `- ${r}`),
    "",
    "Dialogue guardrails:",
    ...rt.guardrails.map((r) => `- ${r}`),
    ...(gate ? ["", "Candidate scoring:", ...rt.scoring.map((r) => `- ${r}`), "", "Generation loop:", ...rt.generationLoop.map((r) => `- ${r}`)] : []),
    "",
    `Outsiders: ${rt.classificationRule}`,
    `Absence: ${rt.absenceRule}`,
    ...Object.entries(rt.microParties).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "The Kids and Melindre (director only):",
    ...rt.thorbinMelindre.map((r) => `- ${r}`),
    ...rt.relationshipConsequences.map((r) => `- ${r}`),
    ...rt.genderedReflex.map((r) => `- ${r}`),
    "",
    "### Directed pairs: what each does differently because the other is here",
    ...[...pairs.values()].map((p) => `- ${first(p.a)} and ${first(p.b)}. ${first(p.a)} → ${first(p.b)}: ${p.ab} ${first(p.b)} → ${first(p.a)}: ${p.ba} Chosen use: ${p.chosenUse} Risk: ${p.risk}`),
    "",
    "### Wrong lines: score −2, never render; the correction follows each",
    ...Object.values(rt.wardens).flatMap((w) => w.wrongLines.map((l) => `- ${first(w.id)}: "${l.line}" (${l.why} Instead: ${l.instead})`)),
  ];
}

/** Stable prefix: identical on every turn so the cache holds it. */
export function systemPrompt(world: World, brief: string, dossiers: Record<string, string> = {}, runtime?: CanonRuntime, gate = true): string {
  return [
    "You are the director of a voice-first interactive story. The player speaks aloud; a listener reports how they sounded on 48 expression dimensions, folded into six axes (composure, warmth, command, candour, pressure, showmanship) from -1 to +1. You play every other character and decide what the player's tone earned.",
    "",
    "Rules of the room:",
    "- One speaker per turn, under sixty words, spoken aloud by a synthetic voice, so write speech, not prose.",
    "- line is the spoken words only: no quotation marks around it, no stage directions, no narration of gesture or pause. What the player could see goes in tell.",
    "- Characters react to how the player sounded as reported, never to what the player meant.",
    "- Show tells; never explain them. Never narrate a character's inner state.",
    "- Evidence rises only on usable admission in the counterpart's own words within the right hearing; the player may never put words in a mouth.",
    "- Meter deltas are small: -8 to +8 in an ordinary turn, up to 15 for a real turn of the scene.",
    "- Set beat.status to advance when succeedWhen is met, fail when failWhen is met, otherwise continue. Resolve by maxTurns. When the beat lists outcomes, also set beat.outcome to the key that fits; the outcome's own status wins, and the resolution sentence should say what it means for the story.",
    "- Director notes may say 'if flag X': apply them only when X appears under So far.",
    "- escalate only on a beat that declares force, and only when the counterpart resorts to violence or the player's words leave no other road. Never on a palace beat.",
    "- shot.kind reaction with a key from the counterpart's clip list; establishing on a scene's first turn; bespoke only for a verdict, a capture or a reveal, with a one-sentence prompt.",
    ...(gate ? ["- Fill slate as the scene's paperwork: who owns the problem this turn, the coverage mode, how the Wardens read the outsider, and two to four candidate moves the speaker could make with this line, each scored against the company's runtime, marked distinct when no other Warden present could make it essentially unchanged, and marked wayOfKnowing when it arises from this Warden's way of knowing, the thing their attention line says they notice first, rather than from a competence any adult in the room would show; derive the first candidate from that attention line. The line never renders a −2. When two or more moves score +1 or better, render the best-scored, and break a tie toward the move from the way of knowing, then toward the distinct move. When only one does, that is information about the character, not a failure: plurality is optional, specificity is mandatory. The move decides what the line does; the card, the dossier and the runtime decide how it sounds. The slate never replaces the character."] : []),
    "- Obey every prohibition below. If a scene seems to ask for a sealed answer, the gap is deliberate: leave it open.",
    "",
    "## Prohibitions",
    ...world.prohibitions.map((p) => `- ${p}`),
    "",
    "## Canon brief",
    brief,
    "",
    ...(runtime ? [...runtimeBlock(world, runtime, gate), ""] : []),
    "## The story",
    world.premise,
    "",
    "## Cast",
    ...world.cast.map((c) => castCard(c, dossiers[c.id], runtime?.wardens[c.id])),
  ].join("\n");
}

function beatCard(world: World, beat: Beat): string {
  const counterpart = findCast(world, beat.counterpart);
  const player = findCast(world, beat.playerRole);
  const lines = [
    `## Beat: ${beat.title} (id: ${beat.id})`,
    `Location: ${beat.location}`,
    `Player plays ${player.name} (id: ${player.id}) in the ${beat.stance} stance.`,
    `Counterpart: ${counterpart.name} (id: ${counterpart.id}).`,
    beat.present.length ? `Also present: ${beat.present.map((id) => findCast(world, id).name).join(", ")}.` : "Nobody else present.",
    `Goal: ${beat.goal}`,
    `Director notes: ${beat.notes}`,
    `Succeed when: ${beat.succeedWhen}`,
    `Fail when: ${beat.failWhen}`,
  ];
  if (beat.outcomes) {
    lines.push("Outcomes (when you resolve, set beat.outcome to exactly one of these keys):");
    for (const [key, o] of Object.entries(beat.outcomes)) lines.push(`- ${key} (${o.status}): ${o.when}`);
  }
  if (beat.force) {
    const m = muster(world, beat);
    lines.push(`Force is possible here. Threat: ${beat.force.threat} A clean win needs: ${beat.force.requires.join(", ")}. Present cover: ${m.covered.join(", ") || "none"}; missing: ${m.missing.join(", ") || "none"}.`);
  } else {
    lines.push("Force is not possible on this beat. Do not escalate.");
  }
  const clipKeys = world.clips.filter((c) => c.character === beat.counterpart).map((c) => c.key);
  if (clipKeys.length) lines.push(`Reaction clip keys for the counterpart: ${clipKeys.join(", ")}.`);
  return lines.join("\n");
}

/** The per-turn message. */
export function turnMessage(world: World, req: DirectorRequest, runtime?: CanonRuntime, gate = true): string {
  const { beat } = findBeat(world, req.beatId);
  const transcript = req.transcript.slice(-14).map((l) => {
    const who = world.cast.find((c) => c.id === l.speaker)?.name ?? l.speaker;
    return l.reading ? `${who}: "${l.text}" [${l.reading}]` : `${who}: "${l.text}"`;
  });
  const axes = Object.entries(req.axes).map(([k, v]) => `${k} ${v >= 0 ? "+" : ""}${v.toFixed(2)}`).join(", ");
  const history = req.history ?? [];
  const flags = req.flags ?? [];
  return [
    beatCard(world, beat),
    "",
    ...(runtime ? [slateCard(world, beat, runtime, gate), ""] : []),
    ...(req.steer ? [`This turn the speaker's move is fixed: ${req.steer}. Render the line from that move; the slate still scores it among the candidates.`, ""] : []),
    `Turn ${req.turn} of ${req.maxTurns}.`,
    `Meters now: ${Object.entries(req.meters).filter(([k]) => beat.meters.includes(k)).map(([k, v]) => `${k} ${Math.round(v)}`).join(", ")}.`,
    ...(history.length || flags.length ? ["", "## So far", ...history.map((h) => `- ${h.title}: ${h.label}${h.resolution ? `. ${h.resolution}` : ""}`), `Flags: ${flags.length ? flags.join(", ") : "none"}.`] : []),
    "",
    "## Transcript so far",
    ...transcript,
    "",
    `## The newest player line`,
    `"${req.playerLine}"`,
    `Listener's report: ${req.affect}`,
    `Axes: ${axes}.`,
    "",
    "Answer as the next speaker, in the required structure.",
  ].join("\n");
}
