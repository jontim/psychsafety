// Download generated portraits listed in art/portraits.json into public/portraits/<id>.png.
//
// Usage: npx tsx scripts/fetch-portraits.ts [--force] [--candidates]
//   --force        re-download every portrait, even ones already on disk
//   --candidates   also download each character's candidate reruns into public/portraits/candidates/<id>-<n>.png
//
// A portrait is re-downloaded automatically when the manifest now points at a different job than the
// one on disk (the job id is remembered in public/portraits/<id>.job), so changing a pick in the manifest
// and re-running this script is enough. Portraits with no remembered job are re-downloaded once.
import fs from "node:fs";
import path from "node:path";

type Take = { url: string; job?: string; note?: string; rejected?: string };
type Entry = Take & { candidates?: Take[] };

const manifestPath = path.resolve("art/portraits.json");
if (!fs.existsSync(manifestPath)) { console.error("art/portraits.json not found"); process.exit(1); }
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<string, Entry>;
const outDir = path.resolve("public/portraits");
fs.mkdirSync(outDir, { recursive: true });
const force = process.argv.includes("--force");
const wantCandidates = process.argv.includes("--candidates");

async function download(url: string, target: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
}

for (const [id, entry] of Object.entries(manifest)) {
  const target = path.join(outDir, `${id}.png`);
  const stamp = path.join(outDir, `${id}.job`);
  const onDisk = fs.existsSync(stamp) ? fs.readFileSync(stamp, "utf8").trim() : "";
  const wanted = entry.job ?? entry.url;
  const have = fs.existsSync(target);
  if (!force && have && onDisk === wanted) {
    console.log(`${id}: already there`);
  } else {
    const why = have && onDisk && onDisk !== wanted ? "manifest points at a new take, re-downloading" : "downloading";
    process.stdout.write(`${id}: ${why}... `);
    try {
      await download(entry.url, target);
      fs.writeFileSync(stamp, `${wanted}\n`);
      console.log(`saved public/portraits/${id}.png`);
    } catch (error) {
      console.log(`FAILED: ${(error as Error).message}`);
    }
  }

  if (!wantCandidates || !entry.candidates?.length) continue;
  const candidateDir = path.join(outDir, "candidates");
  fs.mkdirSync(candidateDir, { recursive: true });
  for (const [i, take] of entry.candidates.entries()) {
    if (take.rejected) continue;
    const candidateTarget = path.join(candidateDir, `${id}-${i + 1}.png`);
    if (!force && fs.existsSync(candidateTarget)) { console.log(`  candidate ${i + 1}: already there`); continue; }
    process.stdout.write(`  candidate ${i + 1} (${take.note ?? take.job ?? "no note"}): downloading... `);
    try {
      await download(take.url, candidateTarget);
      console.log(`saved public/portraits/candidates/${id}-${i + 1}.png`);
    } catch (error) {
      console.log(`FAILED: ${(error as Error).message}`);
    }
  }
}
console.log("Done. Restart the dev server and the placeholders are replaced.");
