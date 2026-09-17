import type { Clip } from "./world.js";

export type AffectTag = Clip["tag"];

/**
 * Map the player's latest axes to the reaction the counterpart shows.
 * The counterpart reacts to how the player came across, not to what they meant.
 */
export function affectTagFromAxes(axes: Record<string, number>, stance: "reading" | "being-read" = "reading"): AffectTag {
  const composure = axes.composure ?? 0;
  const warmth = axes.warmth ?? 0;
  const pressure = axes.pressure ?? 0;
  const command = axes.command ?? 0;
  const candour = axes.candour ?? 0;
  const showmanship = axes.showmanship ?? 0;

  if (pressure > 0.45 && warmth < 0) return "cooling";
  if (stance === "being-read" && composure < -0.35) return "calculating"; // they notice you slip
  if (stance === "reading" && (pressure > 0.3 || command > 0.45)) return "pressed";
  if (warmth > 0.3 && composure > 0) return "warming";
  if (candour > 0.4 && showmanship > 0.2) return "shock";
  if (showmanship < -0.35 && composure > 0) return "bored";
  if (Math.abs(composure) < 0.15 && Math.abs(warmth) < 0.15 && Math.abs(pressure) < 0.15) return "neutral";
  return command > 0 ? "calculating" : "neutral";
}

/** Pick the best clip for a character and tag; falls back by tag, then by character, then to any establishing shot. */
export function selectClip(clips: Clip[], want: { character?: string; tag: AffectTag; kind?: Clip["kind"] }): Clip | null {
  const kind = want.kind ?? "reaction";
  const byExact = clips.find((c) => c.kind === kind && c.character === want.character && c.tag === want.tag);
  if (byExact) return byExact;
  const byNeutral = clips.find((c) => c.kind === kind && c.character === want.character && c.tag === "neutral");
  if (byNeutral) return byNeutral;
  const byCharacter = clips.find((c) => c.kind === kind && c.character === want.character);
  if (byCharacter) return byCharacter;
  return clips.find((c) => c.kind === "establishing") ?? null;
}
