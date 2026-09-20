// Long-form character dossiers for the director, one markdown file per cast member at
// src/worlds/<worldId>/dossiers/<castId>.md. They are derived from the vault, never written
// from memory, and each ends with a Never section the director must obey. They are loaded on
// the server only and injected into the cached system prompt under the character's cast card;
// the browser never sees them.
import fs from "node:fs";
import path from "node:path";

export function dossierDir(root: string, worldId: string): string {
  return path.join(root, "src", "worlds", worldId, "dossiers");
}

export function loadDossiers(root: string, worldId: string): Record<string, string> {
  const dir = dossierDir(root, worldId);
  if (!fs.existsSync(dir)) return {};
  const out: Record<string, string> = {};
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
    out[file.slice(0, -".md".length)] = fs.readFileSync(path.join(dir, file), "utf8").trim();
  }
  return out;
}
