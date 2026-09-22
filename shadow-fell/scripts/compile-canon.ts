/**
 * npm run compile:canon
 * Reads src/canon/behavioral-canon.md and writes src/canon/runtime.json.
 * The test suite checks the two stay in step, so run this after editing the doc.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileCanon } from "../src/server/compile-canon.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "src/canon/behavioral-canon.md");
const target = path.join(root, "src/canon/runtime.json");

const runtime = compileCanon(fs.readFileSync(source, "utf8"));
fs.writeFileSync(target, `${JSON.stringify(runtime, null, 2)}\n`);
console.log(
  `compiled Behavioral Canon v${runtime.version}: ${Object.keys(runtime.wardens).length} wardens, ${Object.keys(runtime.pairs).length} directed pairs, ` +
  `${runtime.fallbacks.length} fallback domains, ${runtime.tests.length} regression tests, ${runtime.rulings.length} ruling(s) applied -> ${path.relative(root, target)}`,
);
