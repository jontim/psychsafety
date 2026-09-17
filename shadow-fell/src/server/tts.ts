import { HumeClient } from "hume";
import type { CastMember } from "../engine/world.js";

export interface SpeakRequest {
  text: string;
  /** Acting instruction for Octave: tone, pace, intent. */
  acting?: string;
  voice: CastMember["voice"];
}

/** Synthesise one line with Octave. Returns MP3 bytes. */
export async function speak(client: HumeClient, req: SpeakRequest, defaultVoiceName?: string): Promise<Buffer> {
  const description = [req.voice.description, req.acting].filter(Boolean).join(". ");
  const voiceName = req.voice.name ?? defaultVoiceName;
  const result = await client.tts.synthesizeJson({
    utterances: [{ text: req.text, description, ...(voiceName ? { voice: { name: voiceName } } : {}) }],
    format: { type: "mp3" },
  });
  const audio = result.generations[0]?.audio;
  if (!audio) throw new Error("Octave returned no audio");
  return Buffer.from(audio, "base64");
}
