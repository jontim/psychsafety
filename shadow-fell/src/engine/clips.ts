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

export interface StoryWant {
  role: "instruction" | "bridge" | "ending";
  beat?: string;
  flags?: string[];
  outcome?: string;
}

/**
 * Story footage: the bridge for a beat, narrowed to a branch when a flagged clip
 * matches one of the story's flags; the ending for an outcome; an instruction for
 * a screen. Library footage is reused every time that branch is entered.
 */
export function selectStoryClip(clips: Clip[], want: StoryWant): Clip | null {
  const story = clips.filter((c) => c.kind === "story" && c.moment?.role === want.role);
  if (want.role === "ending") {
    return story.find((c) => c.moment?.outcome === want.outcome && c.moment?.beat === want.beat)
      ?? story.find((c) => c.moment?.outcome === want.outcome && !c.moment?.beat)
      ?? null;
  }
  const forBeat = story.filter((c) => (c.moment?.beat ?? null) === (want.beat ?? null));
  const flags = want.flags ?? [];
  return forBeat.find((c) => c.moment?.flag && flags.includes(c.moment.flag)) ?? forBeat.find((c) => !c.moment?.flag) ?? null;
}

/** Pick the best clip for a character and tag; falls back by tag, then by character, then to any establishing shot. */
export function selectClip(clips: Clip[], want: { character?: string; tag: AffectTag; kind?: Clip["kind"] }): Clip | null {
  const kind = want.kind ?? "reaction";
  const byExact = clips.find((c) => c.kind === kind && c.character === want.character && c.tag === want.tag);
  if (kind === "story") return byExact ?? null;
  if (byExact) return byExact;
  const byNeutral = clips.find((c) => c.kind === kind && c.character === want.character && c.tag === "neutral");
  if (byNeutral) return byNeutral;
  const byCharacter = clips.find((c) => c.kind === kind && c.character === want.character);
  if (byCharacter) return byCharacter;
  return clips.find((c) => c.kind === "establishing") ?? null;
}
