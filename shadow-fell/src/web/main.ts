import { StorySession, type SessionSnapshot } from "../engine/session.js";
import { findCast, type World, type Beat } from "../engine/world.js";
import { affectTagFromAxes, selectStoryClip } from "../engine/clips.js";
import type { Clip } from "../engine/world.js";
import type { DirectorResponse } from "../engine/director-contract.js";
import { api, type Health } from "./backend.js";
import { MockEar } from "./ear/mock-ear.js";
import { HumeEar } from "./ear/hume-ear.js";
import type { Ear, Utterance } from "./ear/types.js";
import { Voice } from "./voice.js";
import { Floor, type Fragment, type FloorMode } from "./floor.js";
import { h, castName, renderMeters, renderRibbon, renderTranscript, renderSlate, portraitFor } from "./ui/render.js";
import type { TonePreset } from "../engine/mock-ear.js";
import { computeAxes, createAffectState, updateAffect, type AffectState } from "../engine/affect.js";
import { MIRROR_ASKS, readAsk, baselineFrom, calibrateAxes, describeBaseline, type Baseline, type MirrorReading } from "../engine/mirror.js";

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
  screen: "roles" | "stage" | "debrief" | "mirror" | "interlude";
  /** Story footage and the Scribe's words between screens. */
  interlude: Interlude | null;
  /** The warm-up in progress, when the Mirror screen is up. */
  mirror: MirrorState | null;
  /** The player's plain voice from the Mirror, remembered per browser; the tour is read against it. */
  baseline: Baseline | null;
  floor: Floor;
  speechSoFar: Fragment[];
  /** The director's slate panel: an authoring view, remembered per browser. */
  slateOpen: boolean;
}

interface Interlude {
  clip: Clip | null;
  title: string;
  text: string;
  onDone: () => void;
}

interface MirrorState {
  step: number;
  results: MirrorReading[];
  baseline: Baseline | null;
  lastAffect: AffectState | null;
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
  app = { health, world, session: null, ear: mock, mock, voice, consented: false, busy: false, status: "", lastResponse: null, lastSource: "", reaction: "", screen: "roles", floor, speechSoFar: [], slateOpen: safeGet("slateOpen") === "1", mirror: null, baseline: loadBaseline(), interlude: null };
  mock.onUtterance((u) => { void processUtterance(u); });
  mock.onStatus(setStatus);
  render();
}

function loadBaseline(): Baseline | null {
  try {
    const raw = safeGet("mirrorBaseline");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Baseline;
    return parsed && typeof parsed === "object" && parsed.axes ? parsed : null;
  } catch { return null; }
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
  const el = document.querySelector<HTMLElement>(".turn-status") ?? document.querySelector<HTMLElement>(".status");
  if (el) el.textContent = s;
}

function band(): HTMLElement {
  const pills = h("div", { class: "pills" },
    h("span", { class: `pill ${app.ear.kind === "hume" ? "on" : "off"}` }, app.ear.kind === "hume" ? "Ear: Hume EVI" : app.health.hume ? "Ear: mock (Hume ready)" : "Ear: mock"),
    h("span", { class: `pill ${app.health.octave ? "on" : "off"}` }, app.health.octave ? "Voice: Octave" : "Voice: browser"),
    h("span", { class: `pill ${app.health.director !== "understudy" ? "on" : "off"}` }, `Director: ${app.health.director}`),
    h("span", { class: `pill ${app.baseline ? "on" : "off"}`, title: app.baseline ? describeBaseline(app.baseline) : "Warm up in the Mirror to calibrate the ear to your plain voice" }, app.baseline ? "Mirror: calibrated" : "Mirror: not yet"),
    slatePill(),
  );
  return h("header", { class: "band" },
    h("div", {}, h("h1", {}, app.world.title), h("div", { class: "tag" }, app.world.tagline)),
    pills,
  );
}

function toggleSlate(): void {
  app.slateOpen = !app.slateOpen;
  safeSet("slateOpen", app.slateOpen ? "1" : "0");
  render();
}

function slatePill(): HTMLElement {
  const pill = h("button", { class: `pill toggle ${app.slateOpen ? "on" : "off"}`, title: "Show the director's slate (S)" }, app.slateOpen ? "Slate: open" : "Slate");
  pill.addEventListener("click", toggleSlate);
  return pill;
}

function render(): void {
  root.replaceChildren(band(), app.screen === "roles" ? rolesScreen() : app.screen === "stage" ? stageScreen() : app.screen === "mirror" ? mirrorScreen() : app.screen === "interlude" ? interludeScreen() : debriefScreen());
}

function rolesScreen(): HTMLElement {
  const main = h("main", {},
    h("h2", { class: "screen-title" }, "Choose who you are"),
    h("p", { class: "screen-sub" }, app.world.premise),
  );
  main.append(mirrorCard());
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
        beat.beat.when ? h("div", { class: "when" }, beat.beat.when) : null,
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
  app.session = new StorySession(app.world, beatId, { baseline: app.baseline });
  enterBeat();
}

/** Play the bridge for the current beat on the current branch, then open the stage on the counterpart's opening line. */
function enterBeat(): void {
  const session = app.session!;
  app.lastResponse = null;
  app.reaction = "";
  const snap = session.snapshot();
  const bridge = snap.bridge;
  const text = bridge?.narration ?? snap.beat.when ?? snap.beat.goal;
  showInterlude(bridge, `${snap.act.title} · ${snap.beat.title}`, text, () => {
    const opening = session.opening();
    app.screen = "stage";
    render();
    void speakMuted(opening.speaker, opening.text);
  });
}

// ---------- Interludes: story footage between screens ----------

function showInterlude(clip: Clip | null, title: string, text: string, onDone: () => void): void {
  const it: Interlude = { clip, title, text, onDone };
  app.interlude = it;
  app.screen = "interlude";
  render();
  void (async () => {
    await speakMuted(narratorId(), text);
    await new Promise((r) => setTimeout(r, 600));
    if (app.screen === "interlude" && app.interlude === it) finishInterlude();
  })();
}

function finishInterlude(): void {
  const it = app.interlude;
  if (!it) return;
  app.interlude = null;
  app.voice.stop();
  it.onDone();
}

function interludeScreen(): HTMLElement {
  const it = app.interlude!;
  const stage = h("div", { class: "stage interlude-stage" });
  if (it.clip?.file) stage.append(h("video", { src: it.clip.file, autoplay: "", muted: "", loop: "", playsinline: "" }));
  stage.append(
    h("div", { class: "vignette" }),
    h("div", { class: "top" }, h("div", { class: "scene" }, it.title)),
    h("div", { class: "ask" }, it.text),
    h("div", { class: "card" }, h("div", { class: "who" }, castName(app.world, narratorId())), h("div", { class: "where" }, it.clip?.file ? "Library footage." : "No footage rendered for this moment yet; the Scribe reads it.")),
  );
  const cont = h("button", { class: "btn gold btn-continue" }, "Continue");
  cont.addEventListener("click", finishInterlude);
  return h("main", {}, h("div", { class: "interlude" }, stage, h("div", { class: "row", style: "margin-top:12px" }, cont)));
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
  const brief = renderBrief(snap.beat);
  if (brief) side.append(brief);
  for (const doc of snap.beat.documents ?? []) side.append(renderDocument(doc));
  side.append(renderMeters(app.world, snap), renderRibbon(snap.affect));
  const debrief = h("div", { class: "panel" }, h("h3", {}, "The listener's note"),
    h("div", { class: "debrief" }, app.lastResponse?.debrief ?? "Say your first line."),
    app.lastResponse?.tell ? h("div", { class: "tell" }, `You might have noticed: ${app.lastResponse.tell}`) : null,
    app.lastSource === "understudy" ? h("div", { class: "note" }, "The understudy is directing (no Anthropic key).") : null,
  );
  side.append(debrief, renderTranscript(app.world, snap.transcript, snap.playerRole));
  if (app.slateOpen) side.append(renderSlate(app.world, app.lastResponse, app.lastSource));

  const main = h("main", {},
    h("div", { class: "stage-grid" }, h("div", {}, turnStrip(snap, counterpart.name), stage, h("div", { class: "goal-line" }, snap.beat.goal), controls(snap)), side),
  );
  return main;
}

/** The rule that ends the player's turn: the floor select and Done with the microphone, a hint without it. */
function floorRule(): HTMLElement {
  const rule = h("div", { class: "turn-rule" });
  if (app.ear.kind === "hume") {
    const select = h("select", { class: "floor-mode" }) as HTMLSelectElement;
    const floorRules: Array<[string, string]> = [["silence:2000", "2 s of silence hands it over"], ["silence:3000", "3 s of silence hands it over"], ["silence:5000", "5 s of silence hands it over"], ["manual:0", "Only Done hands it over"]];
    for (const [value, label] of floorRules) {
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
    rule.append(select, done);
  } else {
    rule.append(h("span", { class: "hint" }, "Type a line below and choose how you said it, or open the microphone."));
  }
  return rule;
}

/** The pilot's T: what is happening now, the rule that ends your turn, and how they read you, above the stage where it is seen. */
function turnState(snap: SessionSnapshot, counterpartName: string): { state: string; cls: string } {
  const thinking = app.status === "The director is thinking...";
  const state = app.busy ? (thinking ? "The director is thinking" : `${counterpartName} is speaking`) : snap.status === "force" ? "It tips. Call it." : "Your turn";
  return { state, cls: `turn-strip ${app.busy ? "busy" : "yours"}` };
}

function turnRead(counterpartName: string): string {
  return app.reaction ? (app.reaction.startsWith("reads") ? `${counterpartName} ${app.reaction}.` : app.reaction) : "Not read yet.";
}

/** Patch the strip in place at the end of a turn, so a line the player has started typing survives. */
function refreshTurnStrip(): void {
  const strip = document.querySelector<HTMLElement>(".turn-strip");
  const session = app.session;
  if (!strip || !session) return;
  const snap = session.snapshot();
  const name = castName(app.world, snap.beat.counterpart);
  const { state, cls } = turnState(snap, name);
  strip.className = cls;
  const stateEl = strip.querySelector<HTMLElement>(".turn-state");
  if (stateEl) stateEl.textContent = state;
  const readEl = strip.querySelector<HTMLElement>(".turn-read");
  if (readEl) readEl.textContent = turnRead(name);
}

function turnStrip(snap: SessionSnapshot, counterpartName: string): HTMLElement {
  const { state, cls } = turnState(snap, counterpartName);
  const strip = h("div", { class: cls });
  const rule = floorRule();
  const read = turnRead(counterpartName);
  strip.append(
    h("div", { class: "turn-state" }, state),
    rule,
    h("div", { class: "turn-read" }, read),
    h("div", { class: "turn-status status" }, app.status),
    h("div", { class: "speech-so-far" }, app.speechSoFar.length ? `Your speech so far: "${app.speechSoFar.map((f) => f.text).join(" ")}"` : ""),
  );
  return strip;
}

/** A paper on the table, as the player would read it. */
function renderDocument(doc: { title: string; body: string[] }): HTMLElement {
  const box = h("div", { class: "panel document" }, h("div", { class: "doc-eyebrow" }, "On the table"), h("h3", {}, doc.title));
  for (const line of doc.body) box.append(h("p", {}, line));
  return box;
}

/** The player's brief: where this sits, who you are, what wins, what the room can see, what tends to work, what is forbidden. */
function renderBrief(beat: Beat): HTMLElement | null {
  const b = beat.brief;
  if (!b && !beat.when) return null;
  const box = h("div", { class: "panel brief" }, h("h3", {}, "The brief"));
  if (beat.when) box.append(h("div", { class: "when" }, beat.when));
  const rows: Array<[string, string | undefined]> = [["You", b?.you], ["Win", b?.win], ["Who hears", b?.room], ["Lean", b?.lean], ["Never", b?.never]];
  for (const [label, text] of rows) if (text) box.append(h("div", { class: "brief-row" }, h("span", { class: "label" }, label), h("span", { class: "text" }, text)));
  return box;
}

/** Microphone, leave, the typed line and its tones, and Say it. */
function inputBox(leaveLabel: string, onLeave: () => void): HTMLElement {
  const wrap = h("div", { class: "input-box" });
  const row = h("div", { class: "row" });
  const micBtn = h("button", { class: `btn ${app.ear.kind === "hume" ? "live" : "gold"}` }, app.ear.kind === "hume" ? "Listening (stop)" : "Use the microphone");
  micBtn.addEventListener("click", () => (app.ear.kind === "hume" ? stopHume() : askConsent()));
  if (!app.health.hume) { micBtn.setAttribute("disabled", ""); micBtn.title = "Set HUME_API_KEY and HUME_SECRET_KEY in .env to use the microphone."; }
  const leave = h("button", { class: "btn ghost" }, leaveLabel);
  leave.addEventListener("click", onLeave);
  row.append(micBtn, leave);
  wrap.append(row);

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
  wrap.append(say, h("div", { class: "row" }, tones, send));
  return wrap;
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

  box.append(inputBox("Leave the scene", () => { stopHume(); app.voice.stop(); app.screen = "roles"; app.session = null; render(); }));
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
  if (app.screen === "mirror") { await processMirrorUtterance(u); return; }
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
      if (after.ending) showInterlude(after.endingClip, "The story ends here", after.ending, () => { app.screen = "debrief"; render(); });
      else { app.screen = "debrief"; render(); }
    } else if (after.status === "playing" && after.transcript.at(-1)?.speaker === narratorId()) {
      // a clean force win narrated itself
      const last = after.transcript.at(-1)!;
      await speakMuted(last.speaker, last.text);
    }
  } catch (e) {
    setStatus(`Turn failed: ${(e as Error).message}`);
  } finally {
    app.busy = false;
    refreshTurnStrip();
  }
}

// ---------- The Mirror ----------

/** The Scribe, or whoever the pack names as narrator. */
function narratorId(): string {
  return app.world.narrator ?? "scribe";
}

function saveBaseline(b: Baseline | null): void {
  app.baseline = b;
  if (b) safeSet("mirrorBaseline", JSON.stringify(b));
  else { try { localStorage.removeItem("mirrorBaseline"); } catch { /* private mode */ } }
}

function mirrorCard(): HTMLElement {
  const card = h("div", { class: "mirror-card" });
  const text = h("div", { class: "text" },
    h("div", { class: "eyebrow" }, "Before the tour"),
    h("h3", {}, "Warm up in the Mirror"),
    h("p", {}, "Five minutes with the Scribe. He asks for your plain voice, then your best lie, your best support, your best command and your best showman, and tells you in plain words what the world hears. Your plain voice becomes the mark the whole tour is read against."),
    h("p", { class: "state" }, app.baseline ? `Calibrated to your plain voice, taken ${new Date(app.baseline.takenAt).toLocaleString()}. ${describeBaseline(app.baseline)} Retake it any time.` : "Not yet taken. Until then the ear reads you against a stranger's idea of neutral."),
  );
  const go = h("button", { class: "btn gold" }, app.baseline ? "Enter the Mirror again" : "Enter the Mirror");
  go.addEventListener("click", startMirror);
  const actions = h("div", { class: "actions" }, go);
  if (app.baseline) {
    const clear = h("button", { class: "btn ghost" }, "Forget my baseline");
    clear.addEventListener("click", () => { saveBaseline(null); render(); });
    actions.append(clear);
  }
  card.append(text, actions);
  return card;
}

function startMirror(): void {
  app.session = null;
  const clip = selectStoryClip(app.world.clips, { role: "instruction", beat: "mirror" });
  showInterlude(clip, "The Mirror", clip?.narration ?? "Before the tour, a quiet room. Nothing here counts against you.", () => {
    app.mirror = { step: 0, results: [], baseline: null, lastAffect: null };
    app.reaction = "";
    app.status = "";
    app.screen = "mirror";
    render();
    void speakMuted(narratorId(), MIRROR_ASKS[0]!.line);
  });
}

function mirrorStrip(): HTMLElement {
  const m = app.mirror!;
  const done = m.step >= MIRROR_ASKS.length;
  const state = app.busy ? "The Scribe is speaking" : done ? "The Mirror is done" : "Your turn";
  const last = m.results.at(-1);
  const read = last ? (last.heard.length ? `The Scribe hears you as ${last.heard.join(" and ")}.` : "The Scribe hears nothing leaning either way.") : "Not read yet.";
  const strip = h("div", { class: `turn-strip ${app.busy ? "busy" : "yours"}` });
  strip.append(
    h("div", { class: "turn-state" }, state),
    done ? h("div", { class: "turn-rule" }, h("span", { class: "hint" }, "Begin the tour, or take it again.")) : floorRule(),
    h("div", { class: "turn-read" }, read),
    h("div", { class: "turn-status status" }, app.status),
    h("div", { class: "speech-so-far" }, app.speechSoFar.length ? `Your speech so far: "${app.speechSoFar.map((f) => f.text).join(" ")}"` : ""),
  );
  return strip;
}

function refreshMirrorStrip(): void {
  const strip = document.querySelector<HTMLElement>(".turn-strip");
  if (!strip || !app.mirror) return;
  strip.replaceWith(mirrorStrip());
}

function mirrorScreen(): HTMLElement {
  const m = app.mirror!;
  const done = m.step >= MIRROR_ASKS.length;
  const ask = MIRROR_ASKS[Math.min(m.step, MIRROR_ASKS.length - 1)]!;
  const stage = h("div", { class: "stage mirror-stage" },
    h("div", { class: "vignette" }),
    h("div", { class: "top" }, h("div", { class: "scene" }, done ? "The Mirror · done" : `The Mirror · ${m.step + 1} of ${MIRROR_ASKS.length} · ${ask.title}`)),
    h("div", { class: "ask" }, done ? "That is the whole of it. Your plain voice is the mark now; the tour is read against it." : ask.line),
    h("div", { class: "card" },
      h("div", { class: "who" }, castName(app.world, narratorId())),
      h("div", { class: "where" }, "A quiet room before the tour. Nothing here counts against you."),
      h("div", { class: "react" }, done ? "" : ask.measure),
    ),
  );
  const leave = () => { stopHume(); app.voice.stop(); app.mirror = null; app.screen = "roles"; render(); };
  const main = h("div", {}, mirrorStrip(), stage);
  if (!done) main.append(h("div", { class: "controls" }, inputBox("Leave the Mirror", leave)));
  else {
    const begin = h("button", { class: "btn gold" }, "Begin the tour with this voice");
    begin.addEventListener("click", () => { saveBaseline(m.baseline); app.mirror = null; app.screen = "roles"; render(); });
    const again = h("button", { class: "btn ghost" }, "Take it again");
    again.addEventListener("click", startMirror);
    const skip = h("button", { class: "btn ghost" }, "Leave without it");
    skip.addEventListener("click", leave);
    main.append(h("div", { class: "controls" }, h("div", { class: "row" }, begin, again, skip)));
  }
  const side = h("div", {});
  side.append(renderMirrorProgress(m));
  if (m.lastAffect) side.append(renderRibbon(m.lastAffect));
  side.append(renderHears(m));
  if (done && m.baseline) side.append(renderBaselinePanel(m.baseline));
  return h("main", {}, h("div", { class: "stage-grid" }, main, side));
}

function renderMirrorProgress(m: MirrorState): HTMLElement {
  const box = h("div", { class: "panel mirror-progress" }, h("h3", {}, "The Mirror"));
  MIRROR_ASKS.forEach((ask, i) => {
    const r = m.results[i];
    const state = r ? "done" : i === m.step ? "now" : "next";
    const word = r ? (r.band === "plain" ? "taken" : r.band === "high" ? "held" : r.band === "middle" ? "half" : "missed") : state === "now" ? "now" : "";
    box.append(h("div", { class: `ask ${state} ${r?.band ?? ""}` }, h("span", { class: "n" }, String(i + 1)), h("span", { class: "t" }, ask.title), h("span", { class: "w" }, word)));
  });
  return box;
}

function renderHears(m: MirrorState): HTMLElement {
  const box = h("div", { class: "panel mirror-hears" }, h("h3", {}, "What the world hears"));
  const last = m.results.at(-1);
  if (!last) { box.append(h("div", { class: "empty" }, "Say the plain line and the Scribe will tell you what he heard.")); return box; }
  box.append(h("div", { class: "verdict" }, last.verdict));
  if (last.heard.length) box.append(h("div", { class: "heard" }, `Heard as ${last.heard.join(" and ")}.`));
  return box;
}

function renderBaselinePanel(b: Baseline): HTMLElement {
  const box = h("div", { class: "panel baseline" }, h("h3", {}, "Your plain voice"), h("div", { class: "words" }, describeBaseline(b)));
  box.append(h("div", { class: "note" }, "Every reading on the tour is shifted away from this, so the room hears what you did on purpose, not what you always sound like."));
  return box;
}

async function processMirrorUtterance(u: Utterance): Promise<void> {
  const m = app.mirror;
  if (!m || m.step >= MIRROR_ASKS.length) return;
  if (app.busy) { setTimeout(() => { void processMirrorUtterance(u); }, 400); return; }
  app.busy = true;
  try {
    const ask = MIRROR_ASKS[m.step]!;
    const raw = computeAxes(u.scores);
    if (ask.id === "plain") m.baseline = baselineFrom(u.scores);
    const reading = readAsk(ask, ask.id === "plain" ? raw : calibrateAxes(raw, m.baseline));
    m.results.push(reading);
    m.lastAffect = updateAffect(createAffectState(), u.scores);
    m.step += 1;
    setStatus("");
    render();
    await speakMuted(narratorId(), reading.verdict);
    const next = MIRROR_ASKS[m.step];
    if (next) await speakMuted(narratorId(), next.line);
  } catch (e) {
    setStatus(`The Mirror slipped: ${(e as Error).message}`);
  } finally {
    app.busy = false;
    refreshMirrorStrip();
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
  void speakMuted(narratorId() ?? session.snapshot().playerRole, res.narration).then(() => {
    const after = session.snapshot();
    if (after.status === "failed") { app.screen = "debrief"; render(); }
  });
}

function debriefScreen(): HTMLElement {
  const session = app.session!;
  const snap = session.snapshot();
  const last = snap.history.at(-1);
  const resolution = app.lastResponse?.beat.resolution || last?.resolution || (snap.status === "failed" ? "The scene got away from you." : "The scene resolved.");
  const main = h("main", { class: "debrief-screen" },
    h("h2", { class: "screen-title" }, snap.ending ? "The story ends here" : snap.status === "failed" ? "It got away" : "Scene closed"),
    last?.outcome ? h("div", { class: "outcome" }, last.label) : null,
    h("div", { class: "resolution" }, resolution),
    snap.ending ? h("div", { class: "ending" }, snap.ending) : null,
  );
  const grid = h("div", { class: "grid" }, h("div", {}, renderMeters(app.world, snap), renderRibbon(snap.affect)), renderTranscript(app.world, snap.transcript, snap.playerRole));
  const next = h("button", { class: "btn gold" }, "Next scene");
  next.addEventListener("click", () => {
    if (session.advance()) {
      enterBeat();
    } else {
      app.screen = "roles";
      app.session = null;
      render();
    }
  });
  const again = h("button", { class: "btn ghost" }, "Choose another role");
  again.addEventListener("click", () => { app.screen = "roles"; app.session = null; render(); });
  main.append(grid, h("div", { class: "row", style: "margin-top:16px" }, ...(snap.ending ? [] : [next]), again));
  return main;
}

document.addEventListener("keydown", (e) => {
  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.tagName === "SELECT")) return;
  if ((e.key === "s" || e.key === "S") && !e.metaKey && !e.ctrlKey && !e.altKey && app) { e.preventDefault(); toggleSlate(); return; }
  if (e.key !== "Enter" || e.shiftKey) return;
  if (app?.ear.kind === "hume" && app.floor.hasSpeech) { e.preventDefault(); app.floor.commit(); }
});

boot().catch((e) => {
  root.replaceChildren(h("main", {}, h("h2", { class: "screen-title" }, "The server is not answering"), h("p", {}, `Start it with npm run dev. (${(e as Error).message})`)));
});
