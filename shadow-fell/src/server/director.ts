import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { DirectorRequestSchema, DirectorResponseSchema, DirectorResponseLooseSchema, type DirectorRequest, type DirectorResponse, type DirectorResponseLoose } from "../engine/director-contract.js";
import type { World } from "../engine/world.js";
import { findBeat } from "../engine/world.js";
import type { CanonRuntime } from "../engine/runtime.js";
import { systemPrompt, turnMessage } from "./prompt.js";
import { speechOnly } from "../engine/speech.js";
import { repairBraskRail } from "../engine/rail.js";
import { understudy } from "./understudy.js";

export interface DirectorOptions {
  model: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  brief: string;
  /** Long-form character dossiers keyed by cast id; see src/server/dossiers.ts. */
  dossiers?: Record<string, string>;
  /** The compiled Behavioral Canon; see src/server/runtime.ts. */
  runtime?: CanonRuntime;
  /**
   * The scored intention gate: the generation loop in the prompt and a required slate in the answer.
   * On by default; the attribution eval turns it off for its ungated conditions.
   */
  gate?: boolean;
}

export interface DirectorTurn {
  response: DirectorResponse;
  source: "claude" | "understudy";
  note?: string;
  /** Brask's line before the rail guard removed a conjugation of TO BE or TO DO, when it did. */
  railRaw?: string;
}

/** Post-validation the schema cannot express: speaker and shot must belong to the beat. */
function sanitise(world: World, req: DirectorRequest, r: DirectorResponseLoose, gate: boolean): { response: DirectorResponse; railRaw?: string } {
  const { beat } = findBeat(world, req.beatId);
  const allowed = new Set([beat.counterpart, ...beat.present, world.narrator ?? ""]);
  const speaker = allowed.has(r.speaker) ? r.speaker : beat.counterpart;
  const escalate = beat.force && r.escalate ? r.escalate : undefined;
  const shot = r.shot.kind === "reaction" && r.shot.key && !world.clips.some((c) => c.key === r.shot.key)
    ? { kind: "reaction" as const }
    : r.shot;
  const speech = speechOnly(r.line);
  const spoken = speech.text || r.line;
  // Brask's rail guard: every conjugation of TO BE, and TO DO doing auxiliary work, comes out of his mouth.
  const guard = speaker === "brask" ? repairBraskRail(spoken) : null;
  const line = guard?.repaired ? guard.text : spoken;
  const tell = r.tell ?? speech.narration;
  const known = new Set(world.cast.map((c) => c.id));
  // With the gate off, the slate is empty on purpose: no intentions were asked for, so none are reported.
  const slate = gate && r.slate
    ? { ...r.slate, owner: known.has(r.slate.owner) ? r.slate.owner : "none" }
    : { owner: "none", coverage: "owner" as const, outsiderMode: beat.outsider?.mode ?? ("mixed" as const), intentions: [] };
  const response = { ...r, speaker, line, ...(tell ? { tell } : {}), shot, slate, ...(escalate ? { escalate } : { escalate: undefined }) };
  return { response, ...(guard?.repaired ? { railRaw: spoken } : {}) };
}

export function createDirector(world: World, opts: DirectorOptions, client: Anthropic | null) {
  const gate = opts.gate !== false;
  const system = systemPrompt(world, opts.brief, opts.dossiers, opts.runtime, gate);

  return async function direct(input: unknown): Promise<DirectorTurn> {
    const req = DirectorRequestSchema.parse(input);
    if (!client) return { ...sanitise(world, req, understudy(world, req, opts.runtime), gate), source: "understudy", note: "No ANTHROPIC_API_KEY; the understudy is directing." };

    try {
      const message = await client.messages.parse({
        model: opts.model,
        max_tokens: 16000,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: turnMessage(world, req, opts.runtime, gate) }],
        output_config: { effort: opts.effort, format: zodOutputFormat(gate ? DirectorResponseSchema : DirectorResponseLooseSchema) },
      });
      if (message.stop_reason === "refusal" || !message.parsed_output) {
        const details = (message as { stop_details?: { category?: string | null; explanation?: string | null } | null }).stop_details;
        const why = details ? ` (${details.category ?? "uncategorised"}${details.explanation ? `: ${details.explanation}` : ""})` : "";
        return { ...sanitise(world, req, understudy(world, req, opts.runtime), gate), source: "understudy", note: `Model returned ${message.stop_reason}${why}; the understudy took the turn.` };
      }
      return { ...sanitise(world, req, message.parsed_output, gate), source: "claude" };
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        return { ...sanitise(world, req, understudy(world, req, opts.runtime), gate), source: "understudy", note: "Rate limited; the understudy took the turn." };
      }
      if (error instanceof Anthropic.APIError) {
        return { ...sanitise(world, req, understudy(world, req, opts.runtime), gate), source: "understudy", note: `API error ${error.status}: ${error.message}. The understudy took the turn.` };
      }
      throw error;
    }
  };
}
