import "dotenv/config";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { HumeClient, fetchAccessToken } from "hume";
import { WORLDS, getWorld, publicWorld } from "../worlds/index.js";
import type { World } from "../engine/world.js";
import { createDirector } from "./director.js";
import { speak } from "./tts.js";
import { findCast } from "../engine/world.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const brief = fs.readFileSync(path.join(root, "src/canon/brief.md"), "utf8");

const PORT = Number(process.env.PORT ?? 8787);
const humeKey = process.env.HUME_API_KEY;
const humeSecret = process.env.HUME_SECRET_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.DIRECTOR_MODEL ?? "claude-opus-5";
const effort = (process.env.DIRECTOR_EFFORT ?? "medium") as "low" | "medium" | "high" | "xhigh" | "max";

const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;
const hume = humeKey ? new HumeClient({ apiKey: humeKey }) : null;
const directors = new Map(Object.values(WORLDS).map((w) => [w.id, createDirector(w, { model, effort, brief }, anthropic)]));

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    data: {
      ok: true,
      hume: Boolean(humeKey && humeSecret),
      octave: Boolean(humeKey),
      director: anthropic ? model : "understudy",
      configId: process.env.HUME_CONFIG_ID ?? null,
    },
  });
});

app.get("/api/worlds", (_req, res) => {
  res.json({ data: Object.values(WORLDS).map((w) => ({ id: w.id, title: w.title, tagline: w.tagline, roles: w.roles })) });
});

const PORTRAIT_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

/** A real still under public/portraits/<id>.<ext> beats the placeholder in the pack. */
export function localPortrait(id: string): string | null {
  for (const ext of PORTRAIT_EXTENSIONS) {
    if (fs.existsSync(path.join(root, "public/portraits", `${id}.${ext}`))) return `/portraits/${id}.${ext}`;
  }
  return null;
}

/** Rendered clips and real portraits on disk are served automatically; the pack never needs editing. */
function withRenderedClips(world: World): World {
  const dir = path.join(root, "public/clips");
  return {
    ...world,
    cast: world.cast.map((c) => {
      const local = localPortrait(c.id);
      return local ? { ...c, portrait: local } : c;
    }),
    clips: world.clips.map((c) => (c.file || !fs.existsSync(path.join(dir, `${c.key}.mp4`)) ? c : { ...c, file: `/clips/${c.key}.mp4` })),
  };
}

app.get("/api/worlds/:id", (req, res) => {
  try {
    res.json({ data: withRenderedClips(publicWorld(getWorld(String(req.params.id)))) });
  } catch (error) {
    res.status(404).json({ error: (error as Error).message });
  }
});

app.post("/api/hume/token", async (_req, res) => {
  try {
    if (!humeKey || !humeSecret) {
      res.status(503).json({ error: "HUME_API_KEY and HUME_SECRET_KEY are not set; use the mock ear." });
      return;
    }
    const accessToken = await fetchAccessToken({ apiKey: humeKey, secretKey: humeSecret });
    res.json({ data: { accessToken, configId: process.env.HUME_CONFIG_ID ?? null } });
  } catch (error) {
    console.error("token", error);
    res.status(502).json({ error: `Could not mint a Hume token: ${(error as Error).message}` });
  }
});

app.post("/api/director", async (req, res) => {
  try {
    const worldId = String(req.body?.worldId ?? "");
    const direct = directors.get(worldId);
    if (!direct) {
      res.status(404).json({ error: `Unknown world ${worldId}` });
      return;
    }
    const turn = await direct(req.body);
    res.json({ data: turn });
  } catch (error) {
    console.error("director", error);
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post("/api/tts", async (req, res) => {
  try {
    if (!hume) {
      res.status(503).json({ error: "HUME_API_KEY is not set; the browser will use its own voice." });
      return;
    }
    const { worldId, speaker, text, acting } = req.body ?? {};
    const world = getWorld(String(worldId));
    const member = findCast(world, String(speaker));
    const audio = await speak(hume, { text: String(text), acting: acting ? String(acting) : undefined, voice: member.voice }, process.env.HUME_DEFAULT_VOICE);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.send(audio);
  } catch (error) {
    console.error("tts", error);
    res.status(502).json({ error: `Octave failed: ${(error as Error).message}` });
  }
});

const dist = path.join(root, "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const server = app.listen(PORT, () => {
  console.log(`The Shadow Fell server listening on http://localhost:${PORT}`);
  console.log(`  ear: ${humeKey && humeSecret ? "Hume EVI" : "mock only"} | voice: ${humeKey ? "Octave" : "browser"} | director: ${anthropic ? model : "understudy"}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use, probably by an earlier "npm run dev" that is still running.`);
    console.error(`  Stop it with:  lsof -ti :${PORT} | xargs kill      (and the same for the Vite port, 5173)`);
    console.error(`  Or set PORT in .env to another port; the Vite proxy follows it.`);
    process.exit(1);
  }
  throw error;
});
