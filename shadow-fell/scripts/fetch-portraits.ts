// Download generated portraits listed in art/portraits.json into public/portraits/<id>.png.
// Usage: npx tsx scripts/fetch-portraits.ts [--force]
import fs from "node:fs";
import path from "node:path";

const manifestPath = path.resolve("art/portraits.json");
if (!fs.existsSync(manifestPath)) { console.error("art/portraits.json not found"); process.exit(1); }
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<string, { url: string; job?: string; note?: string }>;
const outDir = path.resolve("public/portraits");
fs.mkdirSync(outDir, { recursive: true });
const force = process.argv.includes("--force");

for (const [id, entry] of Object.entries(manifest)) {
  const target = path.join(outDir, `${id}.png`);
  if (!force && fs.existsSync(target)) { console.log(`${id}: already there`); continue; }
  process.stdout.write(`${id}: downloading... `);
  try {
    const res = await fetch(entry.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
    console.log(`saved public/portraits/${id}.png`);
  } catch (error) {
    console.log(`FAILED: ${(error as Error).message}`);
  }
}
console.log("Done. Restart the dev server and the placeholders are replaced.");
