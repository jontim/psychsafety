import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CanonRuntime } from "../engine/runtime.js";

/** The compiled Behavioral Canon (src/canon/runtime.json), loaded once at startup. */
export function loadCanonRuntime(): CanonRuntime {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const file = path.resolve(here, "../canon/runtime.json");
  return JSON.parse(fs.readFileSync(file, "utf8")) as CanonRuntime;
}
