import { chromium } from "playwright-core";
import fs from "node:fs";
import { spawn, execSync } from "node:child_process";
const out = process.env.OUT;
let exe = "/opt/pw-browsers/chromium";
if (!fs.existsSync(exe) || !fs.statSync(exe).isFile()) exe = execSync("find /opt/pw-browsers -type f -name chrome -o -type f -name headless_shell | head -1").toString().trim();
const server = spawn("npx", ["tsx", "src/server/index.ts"], { env: { ...process.env, NODE_ENV: "production", PORT: "8787" }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; server.stdout.on("data", (d) => { log += d; }); server.stderr.on("data", (d) => { log += d; });
const started = Date.now();
let up = false;
while (Date.now() - started < 40000) {
  try { const r = await fetch("http://localhost:8787/"); if (r.ok) { up = true; break; } } catch {}
  await new Promise((r) => setTimeout(r, 400));
}
if (!up) { console.log("server did not come up\n" + log.slice(-800)); server.kill("SIGTERM"); process.exit(1); }
const browser = await chromium.launch({ executablePath: exe, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto("http://localhost:8787/", { waitUntil: "networkidle" });
await page.waitForSelector(".role");
const tops = await page.$$eval(".role img", (els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
const heights = await page.$$eval(".role img", (els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
console.log("image tops:", tops.join(", "));
console.log("image heights:", heights.join(", "));
await (await page.$(".roles")).screenshot({ path: `${out}/roles.png` });
await browser.close();
server.kill("SIGTERM");
console.log(`screenshot at ${out}/roles.png`);
