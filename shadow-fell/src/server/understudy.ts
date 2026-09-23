import type { DirectorRequest, DirectorResponse } from "../engine/director-contract.js";
import type { World } from "../engine/world.js";
import { findBeat, findCast } from "../engine/world.js";
import { affectTagFromAxes } from "../engine/clips.js";
import { wardensInBeat, type CanonRuntime } from "../engine/runtime.js";

/**
 * The understudy: a deterministic director for playing without an Anthropic key.
 * It is not clever. It is enough to feel the loop: warmth opens people, pressure
 * closes them, composure keeps cover, and a hot voice on an armed beat starts a fight.
 */
export function understudy(world: World, req: DirectorRequest, runtime?: CanonRuntime): DirectorResponse {
  const { beat } = findBeat(world, req.beatId);
  const counterpart = findCast(world, beat.counterpart);
  const a = req.axes;
  const composure = a.composure ?? 0;
  const warmth = a.warmth ?? 0;
  const command = a.command ?? 0;
  const candour = a.candour ?? 0;
  const pressure = a.pressure ?? 0;
  const showmanship = a.showmanship ?? 0;
  const tag = affectTagFromAxes(a, beat.stance);
  const tell = counterpart.tells.length ? counterpart.tells[(req.turn - 1) % counterpart.tells.length] : undefined;
  const meterDeltas: Record<string, number> = {};
  let line: string;
  let debrief: string;
  let escalate: DirectorResponse["escalate"];

  const knowsIndex = Math.min(Math.max(0, Math.floor((req.turn - 1) / 2)), Math.max(0, counterpart.knows.length - 1));
  const secret = counterpart.knows[knowsIndex];

  if (beat.stance === "reading") {
    if (pressure > 0.6 && beat.force && req.turn >= 2) {
      line = counterpart.lines[0] ?? "You would not dare.";
      escalate = { threat: beat.force.threat };
      debrief = "You leaned on the heat, and the room tipped.";
    } else if (warmth > 0.25 && composure > -0.1 && secret) {
      line = softened(secret);
      meterDeltas.evidence = 10;
      meterDeltas.rapport = 6;
      debrief = "Warm and steady. It opened a door.";
    } else if (pressure > 0.4) {
      line = "You think I have not been shouted at by better than you?";
      meterDeltas.rapport = -8;
      meterDeltas.standing = 3;
      debrief = "Hot. They dug in.";
    } else if (command > 0.35) {
      line = counterpart.lines[1] ?? "Ask your question, then.";
      meterDeltas.standing = 5;
      debrief = "Command without heat. They are listening.";
    } else if (composure < -0.3) {
      line = "You sound less sure than you did a moment ago.";
      meterDeltas.standing = -6;
      debrief = "The nerves showed.";
    } else {
      line = counterpart.lines[0] ?? "Say what you came to say.";
      debrief = "Level. Nothing gained, nothing lost.";
    }
  } else {
    if (pressure > 0.6 && beat.force && req.turn >= 2) {
      line = "Enough talk.";
      escalate = { threat: beat.force.threat };
      debrief = "Your temper made the decision for them.";
    } else if (composure < -0.3) {
      line = "You are sweating. Why are you sweating?";
      meterDeltas.suspicion = 10;
      meterDeltas.cover = -6;
      debrief = "The reader heard the nerves.";
    } else if (candour > 0.25 && composure > 0) {
      line = counterpart.lines[0] ?? "Go on. I am listening.";
      meterDeltas.suspicion = -7;
      meterDeltas.rapport = 6;
      meterDeltas.cover = 3;
      debrief = "Open and calm. It played as honest.";
    } else if (showmanship > 0.35 && beat.meters.includes("fame")) {
      line = "Again! The pork verse!";
      meterDeltas.fame = 12;
      debrief = "The room is yours.";
    } else if (pressure > 0.35) {
      line = "Careful. That tone gets men written down.";
      meterDeltas.suspicion = 6;
      debrief = "Heat reads as something to hide.";
    } else {
      line = counterpart.lines[0] ?? "Hm.";
      debrief = "Level. They have not decided about you yet.";
    }
  }

  let status: DirectorResponse["beat"]["status"] = "continue";
  let resolution: string | undefined;
  const meters = req.meters;
  const evidence = (meters.evidence ?? 0) + (meterDeltas.evidence ?? 0);
  const suspicion = (meters.suspicion ?? 0) + (meterDeltas.suspicion ?? 0);
  const fame = (meters.fame ?? 0) + (meterDeltas.fame ?? 0);
  if (!escalate) {
    if (beat.stance === "reading" && evidence >= 60) {
      status = "advance";
      resolution = "They said it themselves, and the right ears heard it.";
    } else if (beat.stance === "being-read" && suspicion >= 85) {
      status = "fail";
      resolution = "They stopped believing you.";
    } else if (beat.stance === "being-read" && (suspicion <= 12 || fame >= 70) && req.turn >= 3) {
      status = "advance";
      resolution = beat.meters.includes("fame") ? "The song will be famous by morning." : "They let you go.";
    } else if (req.turn >= req.maxTurns) {
      status = evidence >= 35 || suspicion < 50 ? "advance" : "fail";
      resolution = status === "advance" ? "Time ran out, but enough was said." : "Time ran out.";
    }
  }

  const present = runtime ? wardensInBeat(runtime, beat).present : [];
  const owner = present.find((id) => id !== req.playerRole) ?? (present.length ? counterpart.id : "none");
  const slate: DirectorResponse["slate"] = {
    owner,
    coverage: present.length ? "owner" : "containment",
    outsiderMode: beat.outsider?.mode ?? "mixed",
    intentions: [
      { intention: `answer the tone the listener reported: ${debrief.toLowerCase()}`, score: 1, distinct: false, wayOfKnowing: false, note: "reacts to how it sounded, not what was meant" },
      { intention: "explain the tell out loud", score: -2, distinct: false, wayOfKnowing: false, note: "narrates inner state" },
    ],
  };

  return {
    speaker: counterpart.id,
    line,
    acting: escalate ? "sudden, sharp, the mask slipping" : tag === "warming" ? "quieter, guarded but opening" : tag === "cooling" ? "cold, clipped" : "measured, watchful",
    tell,
    meterDeltas,
    shot: req.turn === 1 ? { kind: "establishing" } : { kind: "reaction", key: `${counterpart.id}-${tag}` },
    beat: { status, resolution },
    debrief,
    slate,
    ...(escalate ? { escalate } : {}),
  };
}

function softened(fact: string): string {
  const trimmed = fact.replace(/\.$/, "");
  return trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : `${trimmed}. There. Make of it what you like.`;
}
