import type { DirectorRequest } from "../engine/director-contract.js";
import type { World, CastMember, Beat } from "../engine/world.js";
import { findBeat, findCast } from "../engine/world.js";
import { muster } from "../engine/force.js";

function castCard(c: CastMember, dossier?: string): string {
  const parts = [
    `### ${c.name}${c.title ? `, ${c.title}` : ""} (id: ${c.id}; ${c.faction})`,
    c.summary,
    `Speaks: ${c.register}`,
  ];
  if (c.tells.length) parts.push(`Tells the player may notice: ${c.tells.join("; ")}.`);
  if (c.knows.length) parts.push(`Knows (director only): ${c.knows.join(" ")}`);
  if (c.lines.length) parts.push(`Lines usable verbatim: ${c.lines.map((l) => `"${l}"`).join(" ")}`);
  if (dossier) parts.push(`Dossier (director only; vault canon; its Never list is binding):\n${dossier.replace(/\n## Sources[\s\S]*$/, "").trim()}`);
  return parts.join("\n");
}

/** Stable prefix: identical on every turn so the cache holds it. */
export function systemPrompt(world: World, brief: string, dossiers: Record<string, string> = {}): string {
  return [
    "You are the director of a voice-first interactive story. The player speaks aloud; a listener reports how they sounded on 48 expression dimensions, folded into six axes (composure, warmth, command, candour, pressure, showmanship) from -1 to +1. You play every other character and decide what the player's tone earned.",
    "",
    "Rules of the room:",
    "- One speaker per turn, under sixty words, spoken aloud by a synthetic voice, so write speech, not prose.",
    "- Characters react to how the player sounded as reported, never to what the player meant.",
    "- Show tells; never explain them. Never narrate a character's inner state.",
    "- Evidence rises only on usable admission in the counterpart's own words within the right hearing; the player may never put words in a mouth.",
    "- Meter deltas are small: -8 to +8 in an ordinary turn, up to 15 for a real turn of the scene.",
    "- Set beat.status to advance when succeedWhen is met, fail when failWhen is met, otherwise continue. Resolve by maxTurns.",
    "- escalate only on a beat that declares force, and only when the counterpart resorts to violence or the player's words leave no other road. Never on a palace beat.",
    "- shot.kind reaction with a key from the counterpart's clip list; establishing on a scene's first turn; bespoke only for a verdict, a capture or a reveal, with a one-sentence prompt.",
    "- Obey every prohibition below. If a scene seems to ask for a sealed answer, the gap is deliberate: leave it open.",
    "",
    "## Prohibitions",
    ...world.prohibitions.map((p) => `- ${p}`),
    "",
    "## Canon brief",
    brief,
    "",
    "## The story",
    world.premise,
    "",
    "## Cast",
    ...world.cast.map((c) => castCard(c, dossiers[c.id])),
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
export function turnMessage(world: World, req: DirectorRequest): string {
  const { beat } = findBeat(world, req.beatId);
  const transcript = req.transcript.slice(-14).map((l) => {
    const who = world.cast.find((c) => c.id === l.speaker)?.name ?? l.speaker;
    return l.reading ? `${who}: "${l.text}" [${l.reading}]` : `${who}: "${l.text}"`;
  });
  const axes = Object.entries(req.axes).map(([k, v]) => `${k} ${v >= 0 ? "+" : ""}${v.toFixed(2)}`).join(", ");
  return [
    beatCard(world, beat),
    "",
    `Turn ${req.turn} of ${req.maxTurns}.`,
    `Meters now: ${Object.entries(req.meters).filter(([k]) => beat.meters.includes(k)).map(([k, v]) => `${k} ${Math.round(v)}`).join(", ")}.`,
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
