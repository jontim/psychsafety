import { z } from "zod";

/** A line of the running scene, as the director sees it. */
export const TranscriptLineSchema = z.object({
  speaker: z.string(),
  text: z.string(),
  /** Present on player lines: the short affect reading attached to that line. */
  reading: z.string().optional(),
});
export type TranscriptLine = z.infer<typeof TranscriptLineSchema>;

export const DirectorRequestSchema = z.object({
  worldId: z.string(),
  beatId: z.string(),
  playerRole: z.string(),
  stance: z.enum(["reading", "being-read"]),
  turn: z.number().int().nonnegative(),
  maxTurns: z.number().int().positive(),
  /** The player's newest line, already transcribed. */
  playerLine: z.string(),
  /** describeAffect() output for the newest line. */
  affect: z.string(),
  /** Signed axis scores for the newest line, -1..1. */
  axes: z.record(z.string(), z.number()).default({}),
  meters: z.record(z.string(), z.number()),
  transcript: z.array(TranscriptLineSchema),
});
export type DirectorRequest = z.infer<typeof DirectorRequestSchema>;

export const ShotSchema = z.object({
  kind: z.enum(["reaction", "establishing", "bespoke"]),
  /** Clip-library key for reaction and establishing shots. */
  key: z.string().optional(),
  /** Only for bespoke shots: a one-sentence render prompt. */
  prompt: z.string().optional(),
});

export const OutsiderModeSchema = z.enum(["authority", "vulnerable", "predator", "nuisance", "mixed"]);
export const CoverageModeSchema = z.enum(["owner", "fallback", "containment", "retrieval"]);

/** One candidate move the speaker could make this turn, scored against the company's runtime. */
export const IntentionSchema = z.object({
  /** One clause: a move the speaker could make with this line. */
  intention: z.string(),
  /** +2 canon-positive, +1 compatible, 0 neutral, -1 drift risk, -2 canon violation. */
  score: z.number().int().min(-2).max(2),
  /** A few words on why it scores so. */
  note: z.string().optional(),
});

/** The director's slate: the scene's paperwork, filled every turn alongside the line. */
export const SlateSchema = z.object({
  /** Cast id of who owns the problem this turn, or "none". */
  owner: z.string(),
  /** Whether the owner is here, a fallback covers in their own grammar, or the scene contains and delays. */
  coverage: CoverageModeSchema,
  /** How the Wardens read the outsider right now; reclassified on behaviour. */
  outsiderMode: OutsiderModeSchema,
  /** Two to four candidate moves for the speaker this turn; the line renders the best-scored. */
  intentions: z.array(IntentionSchema).min(2).max(4),
});
export type Slate = z.infer<typeof SlateSchema>;

export const DirectorResponseSchema = z.object({
  /** Cast id of who speaks next. */
  speaker: z.string(),
  /** What they say. Spoken aloud by Octave; keep it under about 60 words. */
  line: z.string(),
  /** Octave acting instruction: tone, pace, intent. Under 140 characters. */
  acting: z.string(),
  /** What the player could have noticed: an observable tell, never an explanation. */
  tell: z.string().optional(),
  /** Signed meter changes the scene earns this turn, in points. */
  meterDeltas: z.record(z.string(), z.number()).default({}),
  shot: ShotSchema,
  beat: z.object({
    status: z.enum(["continue", "advance", "fail"]),
    /** One sentence the debrief shows when the beat resolves. */
    resolution: z.string().optional(),
  }),
  /** One line for the debrief ribbon: how the player came across this turn. */
  debrief: z.string(),
  /**
   * Only on beats that declare force: the counterpart resorts to violence, or the
   * player's words leave no other road. The line above is the move that starts it.
   */
  escalate: z.object({ threat: z.string() }).optional(),
  /** Required: the generation loop, reported. */
  slate: SlateSchema,
});
export type DirectorResponse = z.infer<typeof DirectorResponseSchema>;

/** The same response with the slate optional: the attribution eval's ungated conditions run the director without the gate. */
export const DirectorResponseLooseSchema = DirectorResponseSchema.extend({ slate: SlateSchema.optional() });
export type DirectorResponseLoose = z.infer<typeof DirectorResponseLooseSchema>;
