// Resolve each character's voice against the voices that actually exist in the Hume library.
//
// The pack names a preferred voice per character, but the library is Jon's and he labels voices
// his own way: film characters by first name so they can be reused ("Soraya", "Tavian"), new
// faces by the label in docs/voices.md ("Shadow Fell Visitor"). Rather than keep the pack and the
// library in lockstep by hand, the server loads the library once at startup, tries the pack name
// and then the ways Jon labels things, and reports exactly who got which voice. A character with
// no match is still voiced: Octave designs one on the fly from the description.
import type { HumeClient } from "hume";
import type { CastMember, World } from "../engine/world.js";

export interface VoiceResolution {
  id: string;
  character: string;
  /** The name the pack asks for, if it asks for one. */
  requested?: string;
  /** The library voice that will be used. */
  resolved?: string;
  /** How it was found: "pack name" or the alias that matched. */
  via?: string;
  /** True when no library voice matched and Octave designs one from the description. */
  designed: boolean;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const titleCase = (s: string) =>
  s.split(/[-\s]+/).filter(Boolean).map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" ");

/**
 * Names to try for one character, most specific first: the pack's own name, then the character's
 * first name (or the bare label for "The Heckler"), the id spelt out, and the "Shadow Fell" prefix
 * on each of those.
 */
export function candidateNames(member: Pick<CastMember, "id" | "name" | "voice">): string[] {
  const out: string[] = [];
  const push = (s?: string) => {
    if (s && !out.some((o) => norm(o) === norm(s))) out.push(s);
  };
  const isLabel = /^the\s+/i.test(member.name);
  const bare = member.name.replace(/^the\s+/i, "").trim();
  const first = bare.split(/\s+/)[0]!;
  const fromId = titleCase(member.id);
  push(member.voice.name);
  if (isLabel) {
    push(bare);
    push(fromId);
    push(`Shadow Fell ${bare}`);
    push(`Shadow Fell ${fromId}`);
  } else {
    push(first);
    push(fromId);
    push(bare);
    push(`Shadow Fell ${first}`);
    push(`Shadow Fell ${fromId}`);
  }
  return out;
}

/** Match every cast member against the library names; case, punctuation and spacing do not matter. */
export function resolveVoices(cast: Pick<CastMember, "id" | "name" | "voice">[], library: string[]): VoiceResolution[] {
  const byNorm = new Map(library.map((n) => [norm(n), n] as const));
  return cast.map((member) => {
    const requested = member.voice.name;
    for (const candidate of candidateNames(member)) {
      const hit = byNorm.get(norm(candidate));
      if (hit) {
        const via = requested && norm(candidate) === norm(requested) ? "pack name" : `alias "${candidate}"`;
        return { id: member.id, character: member.name, requested, resolved: hit, via, designed: false };
      }
    }
    return { id: member.id, character: member.name, requested, designed: true };
  });
}

/** Names of every custom voice in the caller's Hume library. */
export async function loadVoiceLibrary(client: HumeClient): Promise<string[]> {
  const names: string[] = [];
  const page = await client.tts.voices.list({ provider: "CUSTOM_VOICE" });
  for await (const voice of page) names.push(voice.name);
  return names;
}

/** One line per character, for the console. */
export function formatResolutions(rows: VoiceResolution[]): string {
  const width = Math.max(...rows.map((r) => r.id.length));
  return rows
    .map((r) =>
      r.designed
        ? `  ${r.id.padEnd(width)}  designed from description${r.requested ? ` (no library voice for "${r.requested}")` : ""}`
        : `  ${r.id.padEnd(width)}  ${r.resolved}  (${r.via})`,
    )
    .join("\n");
}

export interface VoiceDirectory {
  /** Reload the library from Hume. Safe to call again; failures keep the previous library. */
  refresh(): Promise<void>;
  /** The resolution table for one world. */
  table(world: World): VoiceResolution[];
  /** The voice to hand to Octave for one character: the resolved library name, or none. */
  voiceFor(member: CastMember): CastMember["voice"];
  status(): { library: string[]; loadedAt: string | null; error: string | null };
}

export function createVoiceDirectory(client: HumeClient | null): VoiceDirectory {
  let library: string[] = [];
  let loadedAt: Date | null = null;
  let error: string | null = client ? null : "no Hume API key, so the library was not loaded";
  return {
    async refresh() {
      if (!client) return;
      try {
        library = await loadVoiceLibrary(client);
        loadedAt = new Date();
        error = null;
      } catch (e) {
        error = (e as Error).message;
        console.warn(`Voices: could not load the Hume library (${error}); the pack's names will be tried as written.`);
      }
    },
    table(world) {
      return resolveVoices(world.cast, library);
    },
    voiceFor(member) {
      // Until the library has loaded, keep the pack's name and let Octave try it as written.
      if (!loadedAt) return member.voice;
      const [row] = resolveVoices([member], library);
      return { ...member.voice, name: row?.resolved };
    },
    status() {
      return { library: [...library], loadedAt: loadedAt ? loadedAt.toISOString() : null, error };
    },
  };
}
