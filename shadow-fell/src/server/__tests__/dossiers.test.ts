import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadDossiers } from "../dossiers.js";
import { systemPrompt } from "../prompt.js";
import { shadowFell } from "../../worlds/shadow-fell/world.js";

const root = path.resolve(import.meta.dirname, "../../..");
const dossiers = loadDossiers(root, "shadow-fell");
const castIds = new Set(shadowFell.cast.map((c) => c.id));

// Names retired by the Contradiction Ledger and the original-world conversion. None may reach the director.
const DEAD_NAMES: RegExp[] = [
  /Faer[uû]n/i, /\bToril\b/, /Mystra/i, /\bthe Weave\b/, /\bMoradin\b/, /\bOghma\b/, /\bHarpers?\b/, /Red Wizards?/i,
  /\bThay(an)?\b/, /Sespech/i, /Moonshae/i, /Silverymoon/i, /Berdusk/i, /Waterdeep/i, /Waterdhavian/i, /Myth Drannor/i,
  /\bLolth\b/, /Szass/i, /Sel[uû]ne/i, /Underdark/i, /Cormyr/i, /Dalelands/i, /\bSembia\b/i, /Mielikki/i,
  /Piss and Vinegar/i, /\bVeyra\b/, /\bVerya\b/, /Lord Marshal Serena/i, /Thorbardin/i,
];

describe("dossiers", () => {
  it("exist for the cast that carries deep canon", () => {
    expect(Object.keys(dossiers).sort()).toEqual(
      ["ambassador", "brask", "indigo", "kael", "lyra", "navid", "rashan", "sahir", "serena", "soraya", "tav", "thorbin", "varya"],
    );
  });

  it("belong only to cast members of the pack", () => {
    for (const id of Object.keys(dossiers)) expect(castIds.has(id), `${id} is not in the cast`).toBe(true);
  });

  it("each carry a binding Never section and stay lean enough for the cache", () => {
    for (const [id, text] of Object.entries(dossiers)) {
      expect(text, `${id} has no Never section`).toMatch(/^## Never$/m);
      expect(text, `${id} has no Sources section`).toMatch(/^## Sources$/m);
      expect(text.split(/\s+/).length, `${id} is over budget`).toBeLessThanOrEqual(800);
    }
  });

  it("use only live names, and so do the brief and the pack", () => {
    const brief = fs.readFileSync(path.join(root, "src/canon/brief.md"), "utf8");
    const pack = fs.readFileSync(path.join(root, "src/worlds/shadow-fell/world.ts"), "utf8");
    // The brief and the pack list the dead names once, as "never" rules; those lines are the one place they belong.
    const withoutRules = (text: string) => text.split("\n").filter((line) => !/\bnever\b/i.test(line)).join("\n");
    const withoutSources = (text: string) => text.replace(/\n## Sources[\s\S]*$/, "");
    const texts = { ...Object.fromEntries(Object.entries(dossiers).map(([k, v]) => [k, withoutSources(v)])), brief: withoutRules(brief), pack: withoutRules(pack) };
    for (const [name, text] of Object.entries(texts)) {
      for (const dead of DEAD_NAMES) expect(text, `${name} contains a dead name: ${dead}`).not.toMatch(dead);
    }
  });

  it("reach the director under the right cast card", () => {
    const prompt = systemPrompt(shadowFell, "brief", dossiers);
    for (const [id, text] of Object.entries(dossiers)) {
      const member = shadowFell.cast.find((c) => c.id === id)!;
      const card = prompt.indexOf(`### ${member.name}`);
      const firstLine = text.split("\n").find((l) => l.startsWith("## Who") || l.startsWith("## How"))!;
      const at = prompt.indexOf(firstLine, card);
      expect(card, `${id} card missing`).toBeGreaterThan(-1);
      expect(at, `${id} dossier not under its card`).toBeGreaterThan(card);
    }
    expect(prompt).not.toContain("## Sources");
    expect(systemPrompt(shadowFell, "brief")).not.toContain("Dossier (director only");
  });
});
