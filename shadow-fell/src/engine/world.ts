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
  return problems;
}
