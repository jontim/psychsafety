import { type AffectState, createAffectState, updateAffect, describeAffect, CORE_AXES } from "./affect.js";
import { type EmotionVector, topDimensions } from "./dimensions.js";
import { initMeters, applyDrift, applyDeltas, type MeterValues } from "./meters.js";
import { type World, type Beat, type Act, findBeat, findCast, nextBeatId } from "./world.js";
import { affectTagFromAxes, selectClip } from "./clips.js";
import type { DirectorRequest, DirectorResponse, TranscriptLine } from "./director-contract.js";
import type { Clip } from "./world.js";
import { muster as musterScene, strategies as buildStrategies, matchStrategy, resolveForce, type Muster, type Strategy, type ForceResolution } from "./force.js";

export interface UtteranceRecord {
  text: string;
  scores: EmotionVector;
  reading: string;
  drift: MeterValues;
}

export interface SessionSnapshot {
  worldId: string;
  act: Act;
  beat: Beat;
  playerRole: string;
  counterpart: string;
  turn: number;
  meters: MeterValues;
  affect: AffectState;
  transcript: TranscriptLine[];
  status: "playing" | "force" | "advanced" | "failed" | "complete";
  suggestedClip: Clip | null;
  /** Present while status is "force": who is here and what they make possible. */
  force: { threat: string; muster: Muster; strategies: Strategy[] } | null;
}

/**
 * The running state of one player in one beat. Pure: no network, no timers.
 * The ear feeds ingest(); the director feeds applyDirector(); the UI reads snapshot().
 */
export class StorySession {
  readonly world: World;
  private beatId: string;
  private affect: AffectState;
  private meters: MeterValues;
  private transcript: TranscriptLine[] = [];
  private turn = 0;
  private status: SessionSnapshot["status"] = "playing";
  private force: SessionSnapshot["force"] = null;

  constructor(world: World, beatId: string) {
    this.world = world;
    this.beatId = beatId;
    findBeat(world, beatId);
    this.affect = createAffectState(CORE_AXES);
    this.meters = initMeters(world.meters);
  }

  get beat(): Beat {
    return findBeat(this.world, this.beatId).beat;
  }

  /** Fold a transcribed player utterance and its prosody scores into the session. */
  ingest(text: string, scores: EmotionVector): UtteranceRecord {
    if (this.status !== "playing") throw new Error(`Beat ${this.beatId} is ${this.status}`);
    this.affect = updateAffect(this.affect, scores, 0.5, CORE_AXES);
    const beatMeters = this.world.meters.filter((m) => this.beat.meters.includes(m.id));
    const drift = applyDrift(this.meters, beatMeters, this.affect.latestAxes);
    const top = topDimensions(scores, 3).map((d) => d.label.toLowerCase()).join(", ");
    const reading = `sounded ${top}`;
    this.transcript.push({ speaker: this.beat.playerRole, text, reading });
    this.turn += 1;
    return { text, scores, reading, drift };
  }

  /** Build the request the director answers for the newest player line. */
  directorRequest(): DirectorRequest {
    const last = [...this.transcript].reverse().find((l) => l.speaker === this.beat.playerRole);
    return {
      worldId: this.world.id,
      beatId: this.beatId,
      playerRole: this.beat.playerRole,
      stance: this.beat.stance,
      turn: this.turn,
      maxTurns: this.beat.maxTurns,
      playerLine: last?.text ?? "",
      affect: describeAffect(this.affect, CORE_AXES),
      axes: { ...this.affect.latestAxes },
      meters: { ...this.meters },
      transcript: [...this.transcript],
    };
  }

  /** Apply the director's answer: the line, the meter changes and the beat status. */
  applyDirector(response: DirectorResponse): { applied: MeterValues; clip: Clip | null } {
    findCast(this.world, response.speaker);
    const beatMeters = this.world.meters.filter((m) => this.beat.meters.includes(m.id));
    const applied = applyDeltas(this.meters, beatMeters, response.meterDeltas);
    this.transcript.push({ speaker: response.speaker, text: response.line });
    if (response.escalate && this.beat.force) {
      const m = musterScene(this.world, this.beat);
      this.force = { threat: response.escalate.threat, muster: m, strategies: buildStrategies(this.world, this.beat, m) };
      this.status = "force";
      if (m.cleanWin) this.resolveForce(null);
    } else if (response.beat.status === "advance") this.status = "advanced";
    else if (response.beat.status === "fail") this.status = "failed";
    else if (this.turn >= this.beat.maxTurns) this.status = "advanced";
    const clip = response.shot.kind === "bespoke" ? null : this.suggestClip(response.shot.key);
    return { applied, clip };
  }

  /**
   * While in force: pick a strategy by id, or by what the player said aloud.
   * Returns null when the words name nobody; the fight waits for a real call.
   */
  chooseStrategy(idOrSpeech: string): ForceResolution | null {
    if (this.status !== "force" || !this.force) throw new Error("No fight to resolve");
    const byId = this.force.strategies.find((s) => s.id === idOrSpeech) ?? null;
    const chosen = byId ?? matchStrategy(this.force.strategies, idOrSpeech);
    if (!chosen) return null;
    return this.resolveForce(chosen);
  }

  /** Nobody moves: resolve the fight with no strategy, which is always lost. */
  abandonFight(): ForceResolution {
    if (this.status !== "force" || !this.force) throw new Error("No fight to resolve");
    return this.resolveForce(null);
  }

  private resolveForce(chosen: Strategy | null): ForceResolution {
    if (!this.force) throw new Error("No fight to resolve");
    const resolution = resolveForce(chosen, this.force.muster, this.affect.latestAxes, this.beat);
    const beatMeters = this.world.meters.filter((m) => this.beat.meters.includes(m.id));
    applyDeltas(this.meters, beatMeters, resolution.meterDeltas);
    const narrator = this.world.narrator ?? this.beat.playerRole;
    this.transcript.push({ speaker: narrator, text: resolution.narration });
    this.force = null;
    this.status = resolution.outcome === "lost" ? "failed" : "playing";
    return resolution;
  }

  /** Move to the next beat, carrying meters and affect forward. Returns false at the end of the story. */
  advance(): boolean {
    const next = nextBeatId(this.world, this.beatId);
    if (!next) {
      this.status = "complete";
      return false;
    }
    this.beatId = next;
    this.turn = 0;
    this.transcript = [];
    this.status = "playing";
    this.force = null;
    return true;
  }

  /** The counterpart's opening when a beat begins. */
  opening(): TranscriptLine {
    const line = { speaker: this.beat.counterpart, text: this.beat.opening };
    this.transcript.push(line);
    return line;
  }

  suggestClip(preferredKey?: string): Clip | null {
    if (preferredKey) {
      const exact = this.world.clips.find((c) => c.key === preferredKey);
      if (exact) return exact;
    }
    const tag = affectTagFromAxes(this.affect.latestAxes, this.beat.stance);
    return selectClip(this.world.clips, { character: this.beat.counterpart, tag });
  }

  snapshot(): SessionSnapshot {
    const { act, beat } = findBeat(this.world, this.beatId);
    return {
      worldId: this.world.id,
      act,
      beat,
      playerRole: beat.playerRole,
      counterpart: beat.counterpart,
      turn: this.turn,
      meters: { ...this.meters },
      affect: this.affect,
      transcript: [...this.transcript],
      status: this.status,
      suggestedClip: this.suggestClip(),
      force: this.force,
    };
  }
}
