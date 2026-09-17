// Smoke test: drives the built app in headless Chromium against a running server.
// Usage: node scripts/smoke.mjs http://localhost:8787 /path/to/chrome /out/dir
import { chromium } from "playwright-core";

const [base = "http://localhost:8787", executablePath = process.env.CHROME_PATH, outDir = "."] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

process.on("unhandledRejection", (e) => { console.log(JSON.stringify({ fatal: String(e), errors }, null, 2)); process.exit(1); });
await page.goto(base, { waitUntil: "networkidle" });
await page.waitForSelector(".role");
await page.screenshot({ path: `${outDir}/01-roles.png`, fullPage: true });

// Thorbin in the alley: reading stance with force possible and short cover.
await page.click(".role:has-text('Thorbin')");
await page.waitForSelector(".stage");
await page.screenshot({ path: `${outDir}/02-stage-opening.png` });

async function say(text, tone) {
  await page.click(`.tone:has-text('${tone}')`);
  await page.fill("textarea.say", text);
  await page.click("button:has-text('Say it')");
  await page.waitForFunction(() => document.querySelector(".status")?.textContent !== "The director is thinking...", null, { timeout: 20000 });
  await page.waitForTimeout(300);
}

await say("Now then, lad. Nobody here wants this to be a long night. Who sent you to hear the song?", "warm");
await page.screenshot({ path: `${outDir}/03-stage-warm.png` });
const metersAfterWarm = await page.$$eval(".meter", (els) => els.map((e) => e.textContent.replace(/\s+/g, " ").trim()));
await say("Answer me. Now.", "angry");
await say("I said ANSWER.", "angry");
await page.waitForTimeout(300);
const forceVisible = await page.$(".panel.force");
await page.screenshot({ path: `${outDir}/04-stage-force.png` });
let forceText = null;
if (forceVisible) {
  forceText = await forceVisible.textContent();
  await page.click(".strategy >> nth=0");
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${outDir}/05-after-force.png` });
}
const transcript = await page.$$eval(".line", (els) => els.map((e) => e.textContent.replace(/\s+/g, " ").trim()));
const screenAfterForce = (await page.$(".debrief-screen")) ? "debrief" : "stage";

// Soraya: palace beat, no force possible
if (screenAfterForce === "debrief") await page.click("button:has-text('Choose another role')");
else await page.click("button:has-text('Leave the scene')");
await page.click(".role:has-text('Soraya')");
await page.waitForSelector(".stage");
await say("You will find I am patient, and my father is not. Tell me about the blue.", "calm");
await page.screenshot({ path: `${outDir}/06-soraya.png` });

// phone width
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(200);
await page.screenshot({ path: `${outDir}/07-phone.png`, fullPage: true });

console.log(JSON.stringify({ errors, metersAfterWarm, forceVisible: Boolean(forceVisible), forceText: forceText?.slice(0, 300), screenAfterForce, transcript: transcript.slice(-6) }, null, 2));
await browser.close();
