import type { World } from "../engine/world.js";
import type { DirectorRequest, DirectorResponse } from "../engine/director-contract.js";

export interface Health { ok: boolean; hume: boolean; octave: boolean; director: string; configId: string | null }

async function unwrap<T>(res: Response): Promise<T> {
  const body = (await res.json()) as { data?: T; error?: string };
  if (!res.ok || body.error) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body.data as T;
}

export const api = {
  health: () => fetch("/api/health").then((r) => unwrap<Health>(r)),
  world: (id: string) => fetch(`/api/worlds/${id}`).then((r) => unwrap<World>(r)),
  token: () => fetch("/api/hume/token", { method: "POST" }).then((r) => unwrap<{ accessToken: string; configId: string | null }>(r)),
  director: (req: DirectorRequest) =>
    fetch("/api/director", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req) })
      .then((r) => unwrap<{ response: DirectorResponse; source: "claude" | "understudy"; note?: string }>(r)),
  tts: async (worldId: string, speaker: string, text: string, acting?: string, signal?: AbortSignal): Promise<Blob | null> => {
    const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ worldId, speaker, text, acting }), signal });
    // 503: no key on the server. 401, 402, 403: the key is refused or out of credit. None mends by retrying, so Octave is given up on for the session.
    if (res.status === 503 || res.status === 401 || res.status === 402 || res.status === 403) { console.warn(`[octave] not available (${res.status})`); return null; }
    if (!res.ok) throw new Error(`Octave failed (${res.status})`);
    return res.blob();
  },
};
