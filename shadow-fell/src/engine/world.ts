import { z } from "zod";

export const StanceSchema = z.enum(["reading", "being-read"]);
export type Stance = z.infer<typeof StanceSchema>;

export const CapabilitySchema = z.enum([
  "muscle", "blade", "concurrence", "legitimacy", "stealth", "brains",
  "face", "bait", "healing", "command", "spectacle",
]);
export type Capability = z.infer<typeof CapabilitySchema>;

export const OutcomeSchema = z.object({
  /** Player-facing: shown in the debrief when this outcome lands. */
  label: z.string(),
  /** Director-facing: what earns this outcome. */
  when: z.string(),
  status: z.enum(["advance", "fail"]).default("advance"),
  /** Flags this outcome sets for the rest of the story. */
  flags: z.array(z.string()).default([]),
  /** Where the story goes: a beat id; undefined for the next beat in order; null to end here. */
  next: z.string().nullable().optional(),
  /** Player-facing text when next is null. */
  ending: z.string().optional(),
});
export type Outcome = z.infer<typeof OutcomeSchema>;

export const ForceSchema = z.object({
  /** What violence looks like if this beat tips over, in one sentence. */
  threat: z.string(),
  /** Capabilities that, all present, make the fight a foregone conclusion. */
  requires: z.array(CapabilitySchema).min(1),
  scale: z.enum(["scuffle", "fight", "battle"]).default("fight"),
});
export type ForceSpec = z.infer<typeof ForceSchema>;

/** A named specialty move: what a Warden is famous for doing when it comes to it. */
export const MoveSchema = z.object({
  id: z.string(),
  label: z.string(),
  capability: CapabilitySchema,
  /** Extra weight in resolution, 0 to 0.3. Signature gear and doctrine earn it. */
  bonus: z.number().min(0).max(0.3).default(0.1),
  /** The line the scribe uses when the move lands. */
  line: z.string(),
});
export type Move = z.infer<typeof MoveSchema>;

export const VoiceSchema = z.object({
  /** Octave voice name from Jon's Hume voice library, if one exists. */
  name: z.string().optional(),
  /** Standing acting note for Octave: accent, register, age, texture. */
  description: z.string(),
});

export const CastMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string().optional(),
  faction: z.string(),
  /** One paragraph the director uses to play them. In-text canon only. */
  summary: z.string(),
  /** How they speak: accent canon, register, verbal habits. */
  register: z.string(),
  voice: VoiceSchema,
  /** Authored, observable tells the player can notice; the director may show, never explain. */
  tells: z.array(z.string()).default([]),
  /** What this character knows and will only give up under the right pressure. */
  knows: z.array(z.string()).default([]),
  /** Canonical lines the director may reuse verbatim. */
  lines: z.array(z.string()).default([]),
  /** What this person brings to a fight; used by the force layer to muster a scene. */
  capabilities: z.array(CapabilitySchema).default([]),
  /** Named specialty moves; the force layer offers them as strategies. */
  moves: z.array(MoveSchema).default([]),
  /** Stat block for a future resolution engine; unused by the simple resolver. */
  stats: z.record(z.string(), z.number()).default({}),
  portrait: z.string().optional(),
});
export type CastMember = z.infer<typeof CastMemberSchema>;

export const MeterSpecSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  start: z.number().min(0).max(100),
  axes: z.array(z.object({ axis: z.string(), weight: z.number() })),
  driftScale: z.number().optional(),
});

export const ClipSchema = z.object({
  key: z.string(),
  kind: z.enum(["reaction", "establishing", "story"]),
  character: z.string().optional(),
  /** Story footage only: the moment it plays at. A bridge plays as a beat begins (a flag narrows it to a branch); an ending plays when an outcome ends the story; an instruction plays before a screen such as the Mirror. */
  moment: z.object({ role: z.enum(["instruction", "bridge", "ending"]), beat: z.string().optional(), flag: z.string().optional(), outcome: z.string().optional() }).optional(),
  /** Story footage only: what the Scribe reads over it; also the title card when no footage is rendered yet. */
  narration: z.string().optional(),
  /** The affect tag the runtime selects on. */
  tag: z.enum(["warming", "cooling", "shock", "bored", "calculating", "pressed", "neutral"]),
  /** Generation prompt for Showrunner; the file is produced offline. */
  prompt: z.string(),
  /** Published path under /clips once generated; absent means not yet rendered. */
  file: z.string().optional(),
  /** Story footage only: the file carries the Scribe's narration as its audio track (scripts/voice-clips.ts), so it plays unmuted and the app does not speak over it. */
  voiced: z.boolean().optional(),
});
export type Clip = z.infer<typeof ClipSchema>;

export const BeatSchema = z.object({
  id: z.string(),
  title: z.string(),
  stance: StanceSchema,
  playerRole: z.string(),
  counterpart: z.string(),
  /** Others present; the director may give them a line. */
  present: z.array(z.string()).default([]),
  location: z.string(),
  /** The player's goal, in one sentence they can hold in their head. */
  goal: z.string(),
  /** Where this scene sits against the film, for the player. */
  when: z.string().optional(),
  /** The player's brief, shown before and during the scene: who you are, what wins, what the room can see, what tends to work, what is forbidden. Director-only material stays in notes. */
  brief: z.object({ you: z.string(), win: z.string(), room: z.string(), lean: z.string(), never: z.string() }).partial().optional(),
  /** Director notes: what the scene is really about, what must not happen. */
  notes: z.string(),
  /** The counterpart's opening line if the director has nothing better. */
  opening: z.string(),
  /** Plain-language conditions the director judges against. */
  succeedWhen: z.string(),
  failWhen: z.string(),
  /**
   * Named ways the beat can end. When present, the director picks exactly one as it
   * resolves; the outcome sets flags the later beats can read, and says where the
   * story goes next: a beat id, undefined for the next beat in order, or null to end
   * the story here with the ending text. Absent means the beat ends on advance or
   * fail and the story continues in order.
   */
  outcomes: z.record(z.string(), OutcomeSchema).optional(),
  /** Papers on the table: player-facing, and read to the director. Each is a title and its lines. */
  documents: z.array(z.object({ title: z.string(), body: z.array(z.string()).min(1) })).optional(),
  /** Which meters this beat shows. */
  meters: z.array(z.string()),
  /** Maximum player turns before the director must resolve the beat. */
  maxTurns: z.number().int().positive().default(10),
  /** Absent means the scene cannot become a fight; the director must not escalate it. */
  force: ForceSchema.optional(),
  /** How the Wardens read the non-Warden party as the scene opens; the director reclassifies on behaviour. */
  outsider: z.object({
    mode: z.enum(["authority", "vulnerable", "predator", "nuisance", "mixed"]),
    confidence: z.enum(["low", "medium", "high"]).default("medium"),
    note: z.string().optional(),
  }).optional(),
});
export type Beat = z.infer<typeof BeatSchema>;

export const ActSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  beats: z.array(BeatSchema).min(1),
});
export type Act = z.infer<typeof ActSchema>;

export const RoleSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** One sentence on what playing this person feels like. */
  summary: z.string(),
});

/** A point on the chart, in chart units. */
const PointSchema = z.tuple([z.number(), z.number()]);

/**
 * The Scribe's chart: a stylised map of the world with the story's road laid on it. Geography is the world
 * pack's to draw (an SVG path for the land, ranges as chevron lines, forests, waters); every beat gets a
 * waypoint, every ending a glyph, and a scene that happens inside one building can sit in an inset.
 */
export const ChartSchema = z.object({
  width: z.number(),
  height: z.number(),
  title: z.string(),
  sheet: z.string().optional(),
  note: z.string().optional(),
  /** Land as an SVG path (islands as further subpaths). Everything outside is sea. Optional when a plate carries the artwork. */
  land: z.string().optional(),
  /** Artwork under the road: a clean plate the size of the sheet, and a lettered plate whose region names are unmasked as the road reaches them. */
  plate: z.object({ clean: z.string(), lettered: z.string().optional(), /** The lettering alone, on transparency (scripts/chart-letters.ts lifts it off the lettered plate); preferred over unmasking the lettered plate when the two plates do not align. */ letters: z.string().optional() }).optional(),
  /** The vehicles that lay the road, by key: a sprite each, sized in chart units, facing left or right in the artwork. */
  vehicles: z.record(z.string(), z.object({ src: z.string(), width: z.number(), height: z.number(), faces: z.enum(["left", "right"]).default("right"), /** The same vehicle drawn facing the other way; without it the sprite is mirrored, which is wrong for one with lettering on it. */ alt: z.string().optional(), /** Its size on a hop (a leg shorter than twice its width) and while parked after one: a ship moving a little within a city. */ small: z.number().default(0.55) })).default({}),
  /** Whether the road ahead is on the sheet before it is travelled. False (the default) is the fog of no map: scenes not yet reached, the roads to them, the forks and the endings are not drawn until the road gets there. True draws them faint and shows the forks on arrival. */
  foreknowledge: z.boolean().default(false),
  waters: z.array(z.object({ id: z.string(), label: z.string().optional(), d: z.string(), at: PointSchema.optional() })).default([]),
  rivers: z.array(z.object({ id: z.string(), d: z.string() })).default([]),
  /** Mountain ranges as polylines, drawn as chevrons; a frontier range also carries the dashed border. */
  ranges: z.array(z.object({ id: z.string(), label: z.string().optional(), sub: z.string().optional(), points: z.array(PointSchema).min(2), at: PointSchema.optional(), tone: z.enum(["ink", "frontier"]).default("ink") })).default([]),
  forests: z.array(z.object({ id: z.string(), label: z.string().optional(), d: z.string(), at: PointSchema.optional() })).default([]),
  /** Region names. `reveal`: "near" when the road passes within `reach` chart units of the name (the joy of a map filling in as you cross it), a beat id at that beat's arrival, "never" for a name kept under the mask, or absent for shown from the start; `box` is its area on the lettered plate, unmasked instead of lettering it. */
  regions: z.array(z.object({ id: z.string(), label: z.string(), at: PointSchema, size: z.enum(["large", "small"]).default("large"), tone: z.enum(["ink", "home", "rival", "faint"]).default("ink"), sub: z.string().optional(), reveal: z.string().optional(), reach: z.number().optional(), box: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(), /** How scripts/chart-letters.ts lifts this name off the lettered plate: "letters" subtracts the clean plate's ink first; "all" takes every stroke in the box, for a name drawn where the clean plate has a mark of its own. */ lift: z.enum(["letters", "all"]).default("letters") })).default([]),
  /** Named places with a glyph. `reveal`: "near" when the road passes within `reach` of it, a beat id at that beat's arrival, "never", or absent for shown from the start. */
  places: z.array(z.object({ id: z.string(), label: z.string(), at: PointSchema, glyph: z.enum(["palace", "city", "port", "pass"]).default("city"), reveal: z.string().optional(), reach: z.number().optional() })).default([]),
  /** Off-sheet directions, lettered at the margin. */
  beyond: z.array(z.object({ label: z.string(), at: PointSchema, dir: z.enum(["n", "s", "e", "w"]) })).default([]),
  /** A magnified circle for scenes inside one building: waypoints in it are placed in chart units inside the circle; the road leaves it at `exit` and continues from `anchor`, the place on the sheet it magnifies. */
  insets: z.array(z.object({ id: z.string(), title: z.string(), cx: z.number(), cy: z.number(), r: z.number(), anchor: PointSchema, exit: PointSchema, plan: z.array(z.string()).default([]) })).default([]),
  /** A waypoint per beat. `by` names the vehicle that lays the road into it (none: on foot, no vehicle). `via` is the plain way in; `routes` are other ways, each taken when its flag is set, so the road can depend on what the player decided. */
  waypoints: z.array(z.object({ beat: z.string(), at: PointSchema, place: z.string(), label: z.string().optional(), inset: z.string().optional(), via: z.array(PointSchema).default([]), routes: z.array(z.object({ flag: z.string(), via: z.array(PointSchema).default([]), label: z.string().optional() })).default([]), side: z.enum(["left", "right", "above", "below"]).optional(), by: z.string().optional() })),
  endings: z.array(z.object({ outcome: z.string(), at: PointSchema, label: z.string(), glyph: z.enum(["storm", "fade", "withdraw"]).default("storm"), inset: z.string().optional() })).default([]),
  /** Where the road goes on past the last scene, dotted and fading: points after the last waypoint. */
  onward: z.array(PointSchema).default([]),
  compass: PointSchema.optional(),
  cartouche: PointSchema.optional(),
  scale: z.object({ at: PointSchema, px: z.number(), label: z.string() }).optional(),
});
export type Chart = z.infer<typeof ChartSchema>;

export const WorldSchema = z.object({
  id: z.string(),
  title: z.string(),
  tagline: z.string(),
  /** Story premise the director and the player both read. */
  premise: z.string(),
  palette: z.record(z.string(), z.string()),
  cast: z.array(CastMemberSchema).min(1),
  roles: z.array(RoleSchema).min(1),
  meters: z.array(MeterSpecSchema).min(1),
  acts: z.array(ActSchema).min(1),
  clips: z.array(ClipSchema).default([]),
  /** Hard prohibitions the director must never violate (seals and regression traps). */
  prohibitions: z.array(z.string()).default([]),
  /** Cast id that narrates force resolutions and scene cards. */
  narrator: z.string().optional(),
  /** The Scribe's chart: the story as a road on a map. Optional; without it the web falls back to role cards. */
  chart: ChartSchema.optional(),
});
export type World = z.infer<typeof WorldSchema>;

export type WorldInput = z.input<typeof WorldSchema>;

/** Parse a world pack, applying schema defaults, so authors can omit empty lists. */
export function defineWorld(world: WorldInput): World {
  return WorldSchema.parse(world);
}

export function findCast(world: World, id: string): CastMember {
  const member = world.cast.find((c) => c.id === id);
  if (!member) throw new Error(`Unknown cast member: ${id}`);
  return member;
}

export function findBeat(world: World, id: string): { act: Act; beat: Beat } {
  for (const act of world.acts) {
    const beat = act.beats.find((b) => b.id === id);
    if (beat) return { act, beat };
  }
  throw new Error(`Unknown beat: ${id}`);
}

export function nextBeatId(world: World, id: string): string | null {
  const flat = world.acts.flatMap((a) => a.beats.map((b) => b.id));
  const i = flat.indexOf(id);
  return i >= 0 && i + 1 < flat.length ? flat[i + 1]! : null;
}

export function validateWorld(world: World): string[] {
  const problems: string[] = [];
  const castIds = new Set(world.cast.map((c) => c.id));
  const meterIds = new Set(world.meters.map((m) => m.id));
  const beatIds = new Set(world.acts.flatMap((a) => a.beats.map((b) => b.id)));
  const clipKeys = new Set<string>();
  for (const clip of world.clips) {
    if (clipKeys.has(clip.key)) problems.push(`Duplicate clip key ${clip.key}`);
    clipKeys.add(clip.key);
    if (clip.character && !castIds.has(clip.character)) problems.push(`Clip ${clip.key} names unknown character ${clip.character}`);
  }
  for (const role of world.roles) if (!castIds.has(role.id)) problems.push(`Role ${role.id} is not in the cast`);
  if (world.narrator && !castIds.has(world.narrator)) problems.push(`Narrator ${world.narrator} is not in the cast`);
  for (const act of world.acts) {
    for (const beat of act.beats) {
      if (!castIds.has(beat.playerRole)) problems.push(`Beat ${beat.id}: unknown playerRole ${beat.playerRole}`);
      if (!castIds.has(beat.counterpart)) problems.push(`Beat ${beat.id}: unknown counterpart ${beat.counterpart}`);
      for (const p of beat.present) if (!castIds.has(p)) problems.push(`Beat ${beat.id}: unknown present ${p}`);
      for (const m of beat.meters) if (!meterIds.has(m)) problems.push(`Beat ${beat.id}: unknown meter ${m}`);
      for (const [key, o] of Object.entries(beat.outcomes ?? {})) {
        if (o.next && !beatIds.has(o.next)) problems.push(`Beat ${beat.id}: outcome ${key} goes to unknown beat ${o.next}`);
        if (o.next === null && !o.ending) problems.push(`Beat ${beat.id}: outcome ${key} ends the story without an ending`);
      }
    }
  }
  if (world.chart) {
    const c = world.chart;
    const insetIds = new Set(c.insets.map((x) => x.id));
    const charted = new Set<string>();
    for (const w of c.waypoints) {
      if (!beatIds.has(w.beat)) problems.push(`Chart: waypoint for unknown beat ${w.beat}`);
      if (charted.has(w.beat)) problems.push(`Chart: beat ${w.beat} has two waypoints`);
      charted.add(w.beat);
      if (w.inset && !insetIds.has(w.inset)) problems.push(`Chart: waypoint ${w.beat} names unknown inset ${w.inset}`);
    }
    for (const id of beatIds) if (!charted.has(id)) problems.push(`Chart: beat ${id} has no waypoint`);
    for (const w of c.waypoints) if (w.by && !(w.by in c.vehicles)) problems.push(`Chart: waypoint ${w.beat} travels by unknown vehicle ${w.by}`);
    const revealOk = (r: string | undefined): boolean => !r || r === "never" || r === "near" || beatIds.has(r);
    for (const rg of c.regions) if (!revealOk(rg.reveal)) problems.push(`Chart: region ${rg.id} is revealed by unknown beat ${rg.reveal}`);
    for (const pl of c.places) if (!revealOk(pl.reveal)) problems.push(`Chart: place ${pl.id} is revealed by unknown beat ${pl.reveal}`);
    if (!c.plate && !c.land) problems.push("Chart: no plate and no land to draw");
    const endingKeys = new Set(world.acts.flatMap((a) => a.beats.flatMap((b) => Object.entries(b.outcomes ?? {}).filter(([, o]) => o.next === null).map(([k]) => k))));
    const placed = new Set<string>();
    for (const e of c.endings) {
      if (!endingKeys.has(e.outcome)) problems.push(`Chart: ending glyph for unknown ending ${e.outcome}`);
      if (e.inset && !insetIds.has(e.inset)) problems.push(`Chart: ending ${e.outcome} names unknown inset ${e.inset}`);
      placed.add(e.outcome);
    }
    for (const k of endingKeys) if (!placed.has(k)) problems.push(`Chart: ending ${k} has no place on the chart`);
  }
  return problems;
}
