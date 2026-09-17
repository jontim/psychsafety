import type { World } from "../engine/world.js";
import { shadowFell } from "./shadow-fell/world.js";

export const WORLDS: Record<string, World> = { [shadowFell.id]: shadowFell };

export function getWorld(id: string): World {
  const w = WORLDS[id];
  if (!w) throw new Error(`Unknown world: ${id}`);
  return w;
}

/** The copy the browser may hold: director-only material stripped. */
export function publicWorld(world: World): World {
  return {
    ...world,
    cast: world.cast.map((c) => ({ ...c, knows: [] })),
    acts: world.acts.map((a) => ({
      ...a,
      beats: a.beats.map((b) => ({ ...b, notes: "", succeedWhen: "", failWhen: "" })),
    })),
  };
}
