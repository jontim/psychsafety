import { HumeClient } from "hume";
import type { CastMember } from "../engine/world.js";

export interface SpeakRequest {
  text: string;
  /** Acting instruction for Octave: tone, pace, intent. */
  acting?: string;
  voice: CastMember["voice"];
}

const missingVoices = new Set<string>();

/**
 * Synthesise one line with Octave. Uses the character's saved voice from the
 * caller's library (provider CUSTOM_VOICE is the SDK default for named voices);
 * if that voice does not exist yet, falls back to a voice designed on the fly
 * from the description, and remembers not to retry the name this session.
 */
export async function speak(client: HumeClient, req: SpeakRequest, defaultVoiceName?: string): Promise<Buffer> {
  const description = [req.voice.description, req.acting].filter(Boolean).join(". ");
  const voiceName = req.voice.name ?? defaultVoiceName;
  const attempt = async (name?: string) => {
    const result = await client.tts.synthesizeJson({
      utterances: [{ text: req.text, description, ...(name ? { voice: { name } } : {}) }],
      format: { type: "mp3" },
    });
    const audio = result.generations[0]?.audio;
    if (!audio) throw new Error("Octave returned no audio");
    return Buffer.from(audio, "base64");
  };
  if (voiceName && !missingVoices.has(voiceName)) {
    try {
      return await attempt(voiceName);
    } catch (error) {
      missingVoices.add(voiceName);
      console.warn(`Octave: voice "${voiceName}" unavailable (${(error as Error).message}); designing one from the description instead.`);
    }
  }
  return attempt();
}
