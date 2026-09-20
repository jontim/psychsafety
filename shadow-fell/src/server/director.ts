import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { DirectorRequestSchema, DirectorResponseSchema, type DirectorRequest, type DirectorResponse } from "../engine/director-contract.js";
import type { World } from "../engine/world.js";
import { findBeat } from "../engine/world.js";
import { systemPrompt, turnMessage } from "./prompt.js";
import { understudy } from "./understudy.js";

export interface DirectorOptions {
  model: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  brief: string;
  /** Long-form character dossiers keyed by cast id; see src/server/dossiers.ts. */
  dossiers?: Record<string, string>;
}

export interface DirectorTurn {
  response: DirectorResponse;
  source: "claude" | "understudy";
  note?: string;
}

/** Post-validation the schema cannot express: speaker and shot must belong to the beat. */
function sanitise(world: World, req: DirectorRequest, r: DirectorResponse): DirectorResponse {
  const { beat } = findBeat(world, req.beatId);
  const allowed = new Set([beat.counterpart, ...beat.present, world.narrator ?? ""]);
  const speaker = allowed.has(r.speaker) ? r.speaker : beat.counterpart;
  const escalate = beat.force && r.escalate ? r.escalate : undefined;
  const shot = r.shot.kind === "reaction" && r.shot.key && !world.clips.some((c) => c.key === r.shot.key)
    ? { kind: "reaction" as const }
    : r.shot;
  return { ...r, speaker, shot, ...(escalate ? { escalate } : { escalate: undefined }) };
}

export function createDirector(world: World, opts: DirectorOptions, client: Anthropic | null) {
  const system = systemPrompt(world, opts.brief, opts.dossiers);

  return async function direct(input: unknown): Promise<DirectorTurn> {
    const req = DirectorRequestSchema.parse(input);
    if (!client) return { response: sanitise(world, req, understudy(world, req)), source: "understudy", note: "No ANTHROPIC_API_KEY; the understudy is directing." };

    try {
      const message = await client.messages.parse({
        model: opts.model,
        max_tokens: 4000,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: turnMessage(world, req) }],
        output_config: { effort: opts.effort, format: zodOutputFormat(DirectorResponseSchema) },
      });
      if (message.stop_reason === "refusal" || !message.parsed_output) {
        return { response: sanitise(world, req, understudy(world, req)), source: "understudy", note: `Model returned ${message.stop_reason}; the understudy took the turn.` };
      }
      return { response: sanitise(world, req, message.parsed_output), source: "claude" };
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        return { response: sanitise(world, req, understudy(world, req)), source: "understudy", note: "Rate limited; the understudy took the turn." };
      }
      if (error instanceof Anthropic.APIError) {
        return { response: sanitise(world, req, understudy(world, req)), source: "understudy", note: `API error ${error.status}: ${error.message}. The understudy took the turn.` };
      }
      throw error;
    }
  };
}
