import { StorySession, type SessionSnapshot } from "../engine/session.js";
import { findCast, type World } from "../engine/world.js";
import { affectTagFromAxes } from "../engine/clips.js";
import type { DirectorResponse } from "../engine/director-contract.js";
import { api, type Health } from "./backend.js";
import { MockEar } from "./ear/mock-ear.js";
import { HumeEar } from "./ear/hume-ear.js";
import type { Ear, Utterance } from "./ear/types.js";
import { Voice } from "./voice.js";
import { Floor, type Fragment, type FloorMode } from "./floor.js";
import { h, castName, renderMeters, renderRibbon, renderTranscript, portraitFor } from "./ui/render.js";
import type { TonePreset } from "../engine/mock-ear.js";

const WORLD_ID = "shadow-fell";

interface App {
  health: Health;
  world: World;
  session: StorySession | null;
  ear: Ear;
  mock: MockEar;
  voice: Voice;
  consented: boolean;
  busy: boolean;
  status: string;
  lastResponse: DirectorResponse | null;
  lastSource: string;
  reaction: string;
  screen: "roles" | "stage" | "debrief";
  floor: Floor;
  speechSoFar: Fragment[];
}

const root = document.getElementById("app")!;
let app: App;

async function boot(): Promise<void> {
  const [health, world] = await Promise.all([api.health(), api.world(WORLD_ID)]);
  const mock = new MockEar();
  const voice = new Voice(WORLD_ID);
  voice.octave = health.octave;
  const savedMode = (safeGet("floorMode") as FloorMode | null) ?? "silence";
  const savedSilence = Number(safeGet("floorSilenceMs") ?? 3000);
  const floor = new Floor({
    mode: savedMode,
    silenceMs: savedSilence,
    onChange: (fragments) => { app.speechSoFar = fragments; renderSpeechSoFar(); },
    onCommit: (merged) => { void processUtterance(merged); },
  });
  app = { health, world, session: null, ear: mock, mock, voice, consented: false, busy: false, status: "", lastResponse: null, lastSource: "", reaction: "", screen: "roles", floor, speechSoFar: [] };
  mock.onUtterance((u) => { void processUtterance(u); });
  mock.onStatus(setStatus);
  render();
}

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
}

/** The live "your speech so far" line, updated without a full redraw. */
function renderSpeechSoFar(): void {
  const el = document.querySelector<HTMLElement>(".speech-so-far");
  if (!el) return;
  const text = app.speechSoFar.map((f) => f.text).join(" ");
  el.textContent = text ? `Your speech so far: "${text}"` : "";
  const done = document.querySelector<HTMLButtonElement>(".btn-done");
  if (done) done.disabled = !app.speechSoFar.length;
}

function setStatus(s: string): void {
  app.status = s;
  const el = document.querySelector<HTMLElement>(".status");
  if (el) el.textContent = s;
}

function band(): HTMLElement {
  const pills = h("div", { class: "pills" },
    h("span", { class: `pill ${app.ear.kind === "hume" ? "on" : "off"}` }, app.ear.kind === "hume" ? "Ear: Hume EVI" : app.health.hume ? "Ear: mock (Hume ready)" : "Ear: mock"),
    h("span", { class: `pill ${app.health.octave ? "on" : "off"}` }, app.health.octave ? "Voice: Octave" : "Voice: browser"),
    h("span", { class: `pill ${app.health.director !== "understudy" ? "on" : "off"}` }, `Director: ${app.health.director}`),
  );
  return h("header", { class: "band" },
    h("div", {}, h("h1", {}, app.world.title), h("div", { class: "tag" }, app.world.tagline)),
    pills,
  );
}

function render(): void {
  root.replaceChildren(band(), app.screen === "roles" ? rolesScreen() : app.screen === "stage" ? stageScreen() : debriefScreen());
}

function rolesScreen(): HTMLElement {
  const main = h("main", {},
    h("h2", { class: "screen-title" }, "Choose who you are"),
    h("p", { class: "screen-sub" }, app.world.premise),
  );
  const grid = h("div", { class: "roles" });
  for (const role of app.world.roles) {
    const member = findCast(app.world, role.id);
    const beat = app.world.acts.flatMap((a) => a.beats.map((b) => ({ act: a, beat: b }))).find((x) => x.beat.playerRole === role.id);
    if (!beat) continue;
    const card = h("button", { class: "role" },
      h("img", { src: portraitFor(member), alt: member.name }),
      h("div", { class: "body" },
        h("div", { class: "name" }, role.label, h("span", { class: `stance ${beat.beat.stance}` }, beat.beat.stance === "reading" ? "reading" : "being read")),
        h("div", { class: "meta" }, `${beat.act.title} · ${beat.beat.title}`),
        h("div", { class: "sum" }, role.summary),
      ),
    );
    card.addEventListener("click", () => startBeat(beat.beat.id));
    grid.append(card);
  }
  main.append(grid);
  return main;
}

function startBeat(beatId: string): void {
  app.session = new StorySession(app.world, beatId);
  app.lastResponse = null;
  app.reaction = "";
  const opening = app.session.opening();
  app.screen = "stage";
  render();
  void speakMuted(opening.speaker, opening.text);
}

function stageScreen(): HTMLElement {
  const session = app.session!;
  const snap = session.snapshot();
  const counterpart = findCast(app.world, snap.counterpart);
  const clip = snap.suggestedClip;
  const tag = affectTagFromAxes(snap.affect.latestAxes, snap.beat.stance);

  const stage = h("div", { class: "stage" });
  if (clip?.file) {
    const v = h("video", { src: clip.file, autoplay: "", muted: "", loop: "", playsinline: "" });
    stage.append(v);
  } else {
    stage.append(h("img", { src: portraitFor(counterpart), alt: counterpart.name }));
  }
  stage.append(
    h("div", { class: `vignette ${snap.affect.latest ? tag : ""}` }),
    h("div", { class: "top" }, h("div", { class: "scene" }, `${snap.act.title} · ${snap.beat.title}`), h("div", { class: "goal" }, snap.beat.goal)),
    h("div", { class: "card" },
      h("div", { class: "who" }, `${counterpart.name}${counterpart.title ? `, ${counterpart.title}` : ""}`),
      h("div", { class: "where" }, snap.beat.location),
      h("div", { class: "react" }, app.reaction),
    ),
  );

  const side = h("div", {});
  side.append(renderMeters(app.world, snap), renderRibbon(snap.affect), renderTranscript(app.world, snap.transcript, snap.playerRole));
  const debrief = h("div", { class: "panel" }, h("h3", {}, "The listener's note"),
    h("div", { class: "debrief" }, app.lastResponse?.debrief ?? "Say your first line."),
    app.lastResponse?.tell ? h("div", { class: "tell" }, `You might have noticed: ${app.lastResponse.tell}`) : null,
    app.lastSource === "understudy" ? h("div", { class: "status" }, "The understudy is directing (no Anthropic key).") : null,
  );
  side.append(debrief);

  const main = h("main", {},
    h("div", { class: "stage-grid" }, h("div", {}, stage, h("div", { class: "goal-line" }, snap.beat.goal), controls(snap)), side),
  );
  return main;
}

function controls(snap: SessionSnapshot): HTMLElement {
  const box = h("div", { class: "controls" });
  if (snap.status === "force" && snap.force) {
    const f = snap.force;
    const panel = h("div", { class: "panel force" }, h("h3", {}, "It tips"),
      h("div", { class: "threat" }, f.threat),
      h("div", { class: "muster" }, `Here: ${f.muster.present.map((p) => p.name).join(", ")}. Covered: ${f.muster.covered.join(", ") || "nothing"}. Missing: ${f.muster.missing.join(", ") || "nothing"}.`),
    );
    const list = h("div", { class: "strategies" });
    for (const s of f.strategies) {
      const b = h("button", { class: "strategy" }, h("span", {}, s.label), h("span", { class: "cov" }, `${Math.round((s.coverage + s.bonus) * 100)}%`));
      b.addEventListener("click", () => callStrategy(s.id));
      list.append(b);
    }
    const nobody = h("button", { class: "btn ghost" }, "Nobody moves");
    nobody.addEventListener("click", () => callStrategy("", true));
    panel.append(list, h("div", { class: "row", style: "margin-top:8px" }, nobody), h("div", { class: "status" }, "Call it aloud, or choose. How you sound when you call it still counts."));
    box.append(panel);
  }

  const status = h("div", { class: "status" }, app.status);
  if (app.ear.kind === "hume") {
    const select = h("select", { class: "floor-mode" }) as HTMLSelectElement;
    for (const [value, label] of [["silence:2000", "End my turn after 2 s of silence"], ["silence:3000", "End my turn after 3 s of silence"], ["silence:5000", "End my turn after 5 s of silence"], ["manual:0", "Only when I press Done"]] as const) {
      const o = h("option", { value }, label) as HTMLOptionElement;
      if ((app.floor.mode === "manual" && value.startsWith("manual")) || (app.floor.mode === "silence" && value === `silence:${app.floor.silenceMs}`)) o.selected = true;
      select.append(o);
    }
    select.addEventListener("change", () => {
      const [mode, ms] = select.value.split(":") as [FloorMode, string];
      app.floor.mode = mode;
      if (mode === "silence") app.floor.silenceMs = Number(ms);
      safeSet("floorMode", mode);
      safeSet("floorSilenceMs", String(app.floor.silenceMs));
      app.floor.touch();
    });
    const done = h("button", { class: "btn gold btn-done" }, "Done, over to them") as HTMLButtonElement;
    done.disabled = !app.speechSoFar.length;
    done.addEventListener("click", () => app.floor.commit());
    box.append(
      h("div", { class: "row" }, select, done),
      h("div", { class: "speech-so-far" }, app.speechSoFar.length ? `Your speech so far: "${app.speechSoFar.map((f) => f.text).join(" ")}"` : ""),
    );
  }
  const row = h("div", { class: "row" });
  const micBtn = h("button", { class: `btn ${app.ear.kind === "hume" ? "live" : "gold"}` }, app.ear.kind === "hume" ? "Listening (stop)" : "Use the microphone");
  micBtn.addEventListener("click", () => (app.ear.kind === "hume" ? stopHume() : askConsent()));
  if (!app.health.hume) { micBtn.setAttribute("disabled", ""); micBtn.title = "Set HUME_API_KEY and HUME_SECRET_KEY in .env to use the microphone."; }
  const leave = h("button", { class: "btn ghost" }, "Leave the scene");
  leave.addEventListener("click", () => { stopHume(); app.voice.stop(); app.screen = "roles"; app.session = null; render(); });
  row.append(micBtn, leave);
  box.append(row);

  const say = h("textarea", { class: "say", placeholder: app.ear.kind === "hume" ? "Or type a line; the mock tone applies to typed lines." : "Type your line here, then choose how you said it." }) as HTMLTextAreaElement;
  const tones = h("div", { class: "tones" });
  const current = app.mock.tones[0]?.preset ?? "calm";
  for (const t of MockEar.presets()) {
    const b = h("button", { class: `tone ${t === current ? "on" : ""}` }, t);
    b.addEventListener("click", () => { app.mock.setTone(t as TonePreset); tones.querySelectorAll(".tone").forEach((x) => x.classList.toggle("on", x.textContent === t)); });
    tones.append(b);
  }
  const send = h("button", { class: "btn" }, "Say it");
  const submit = () => { const text = say.value.trim(); if (!text || app.busy) return; say.value = ""; app.mock.say(text); };
  send.addEventListener("click", submit);
  say.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } });
  box.append(say, h("div", { class: "row" }, tones, send), status);
  return box;
}

function askConsent(): void {
  if (app.consented) { void startHume(); return; }
  const backdrop = h("div", { class: "modal-backdrop" });
  const ok = h("button", { class: "btn gold" }, "I understand, open the microphone");
  const no = h("button", { class: "btn ghost" }, "Not now");
  const modal = h("div", { class: "modal" },
    h("h2", {}, "Before the microphone opens"),
    h("p", {}, "This story uses an AI system that infers expression from your voice. While you play, your microphone audio is streamed to Hume AI, which returns a transcript and a reading of how you sounded on 48 expression dimensions. The reading describes how a stranger would hear you, not what you feel."),
    h("p", { class: "small" }, "Audio is not stored by this app. Characters and outcomes react to that reading. You can stop at any time."),
    h("div", { class: "row" }, ok, no),
  );
  ok.addEventListener("click", () => { app.consented = true; backdrop.remove(); void startHume(); });
  no.addEventListener("click", () => backdrop.remove());
  backdrop.append(modal);
  document.body.append(backdrop);
}

async function startHume(): Promise<void> {
  try {
    setStatus("Minting a Hume token...");
    const { accessToken, configId } = await api.token();
    const pauseAssistant = new URLSearchParams(location.search).get("pause") === "1";
    const ear = new HumeEar({ accessToken, configId, pauseAssistant });
    ear.onUtterance((u) => app.floor.add(u));
    ear.onStatus((status) => { if (status.startsWith("Hearing:")) app.floor.touch(); setStatus(status); });
    await ear.start();
    app.ear = ear;
    render();
  } catch (e) {
    setStatus(`Could not start the Hume ear: ${(e as Error).message}`);
  }
}

function stopHume(): void {
  if (app.ear.kind === "hume") {
    app.ear.stop();
    app.ear = app.mock;
    app.floor.clear();
    app.status = "Microphone closed. Type a line, or open the microphone again.";
    render();
  }
}

/** Speak a line with the microphone muted, so the ear never hears our own characters. */
async function speakMuted(speaker: string, text: string, acting?: string): Promise<void> {
  app.ear.mute?.();
  try {
    await app.voice.speak(speaker, text, acting);
  } finally {
    app.ear.unmute?.();
  }
}

async function processUtterance(u: Utterance): Promise<void> {
  const session = app.session;
  if (!session) return;
  if (app.busy) {
    // the director is still thinking or a character is speaking; hold the speech and try again
    setTimeout(() => { void processUtterance(u); }, 400);
    return;
  }
  const snap = session.snapshot();
  if (snap.status === "force") { callStrategy(u.text); return; }
  if (snap.status !== "playing") return;
  app.busy = true;
  try {
    session.ingest(u.text, u.scores);
    app.reaction = "";
    render();
    setStatus("The director is thinking...");
    const turn = await api.director(session.directorRequest());
    app.lastResponse = turn.response;
    app.lastSource = turn.source;
    const { clip } = session.applyDirector(turn.response);
    const tag = affectTagFromAxes(session.snapshot().affect.latestAxes, snap.beat.stance);
    app.reaction = turn.response.escalate ? "hands move" : clip ? `reads you as ${clip.tag}` : `reads you as ${tag}`;
    setStatus(turn.note ?? "");
    render();
    await speakMuted(turn.response.speaker, turn.response.line, turn.response.acting);
    const after = session.snapshot();
    if (after.status === "advanced" || after.status === "failed") {
      app.screen = "debrief";
      render();
    } else if (after.status === "playing" && after.transcript.at(-1)?.speaker === app.world.narrator) {
      // a clean force win narrated itself
      const last = after.transcript.at(-1)!;
      await speakMuted(last.speaker, last.text);
    }
  } catch (e) {
    setStatus(`Turn failed: ${(e as Error).message}`);
  } finally {
    app.busy = false;
  }
}

function callStrategy(idOrSpeech: string, abandon = false): void {
  const session = app.session;
  if (!session) return;
  const res = abandon ? session.abandonFight() : session.chooseStrategy(idOrSpeech);
  if (!res) {
    const names = session.snapshot().force?.muster.present.map((p) => p.name).join(", ") ?? "";
    setStatus(`That names nobody. Call someone who is here (${names}) or choose below.`);
    return;
  }
  app.reaction = res.outcome === "lost" ? "they slip the net" : res.outcome === "costly" ? "it works, at a price" : "settled";
  render();
  void speakMuted(app.world.narrator ?? session.snapshot().playerRole, res.narration).then(() => {
    const after = session.snapshot();
    if (after.status === "failed") { app.screen = "debrief"; render(); }
  });
}

function debriefScreen(): HTMLElement {
  const session = app.session!;
  const snap = session.snapshot();
  const resolution = app.lastResponse?.beat.resolution ?? (snap.status === "failed" ? "The scene got away from you." : "The scene resolved.");
  const main = h("main", { class: "debrief-screen" },
    h("h2", { class: "screen-title" }, snap.status === "failed" ? "It got away" : "Scene closed"),
    h("div", { class: "resolution" }, resolution),
  );
  const grid = h("div", { class: "grid" }, h("div", {}, renderMeters(app.world, snap), renderRibbon(snap.affect)), renderTranscript(app.world, snap.transcript, snap.playerRole));
  const next = h("button", { class: "btn gold" }, "Next scene");
  next.addEventListener("click", () => {
    if (session.advance()) {
      const beat = session.snapshot().beat;
      const opening = session.opening();
      app.lastResponse = null;
      app.reaction = "";
      app.screen = "stage";
      render();
      void speakMuted(opening.speaker, opening.text);
      setStatus(`${castName(app.world, beat.playerRole)}: ${beat.goal}`);
    } else {
      app.screen = "roles";
      app.session = null;
      render();
    }
  });
  const again = h("button", { class: "btn ghost" }, "Choose another role");
  again.addEventListener("click", () => { app.screen = "roles"; app.session = null; render(); });
  main.append(grid, h("div", { class: "row", style: "margin-top:16px" }, next, again));
  return main;
}

document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.shiftKey) return;
  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.tagName === "SELECT")) return;
  if (app?.ear.kind === "hume" && app.floor.hasSpeech) { e.preventDefault(); app.floor.commit(); }
});

boot().catch((e) => {
  root.replaceChildren(h("main", {}, h("h2", { class: "screen-title" }, "The server is not answering"), h("p", {}, `Start it with npm run dev. (${(e as Error).message})`)));
});
