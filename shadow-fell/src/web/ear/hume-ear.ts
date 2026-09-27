import { HumeClient, getAudioStream, getBrowserSupportedMimeType, convertBlobToBase64, ensureSingleValidAudioTrack, MimeType } from "hume";
import { normalizeScores } from "../../engine/dimensions.js";
import type { Ear, Utterance } from "./types.js";
import { RECONNECT_TRIES, flapsAfter, givenUp, pauseBefore } from "./line.js";

export interface HumeEarOptions {
  /** Mints a fresh access token; called at every connection, since a token lives half an hour and a session can outlast it. */
  getToken: () => Promise<{ accessToken: string; configId?: string | null }>;
  /**
   * Pause EVI's own replies. Off by default: pausing may also stop EVI sending
   * transcripts, so the safe mode is to let EVI reply and simply never play it.
   */
  pauseAssistant?: boolean;
  /** True when nobody is mid-speech, so a planned reconnection can happen without losing words. */
  quiet?: () => boolean;
}

export type HumeEarState = "connecting" | "open" | "reconnecting" | "closed";

/** Reconnect before the token's half-hour runs out. */
const REFRESH_AFTER_MS = 24 * 60 * 1000;

/**
 * The Hume ear: streams the microphone into an EVI session and reports each
 * final user utterance with its 48 prosody scores. EVI's replies are ignored,
 * never played; the story's director and Octave do the talking. A line that
 * drops (an EVI error, a token that ran out, a network hiccup) is picked up
 * again with a fresh token and a fresh audio stream, and said so. A line that
 * drops again as soon as it opens is tried with a growing pause and then let
 * go, never reopened without pause forever (see line.ts).
 */
export class HumeEar implements Ear {
  readonly kind = "hume" as const;
  state: HumeEarState = "connecting";
  private listeners: Array<(u: Utterance) => void> = [];
  private statusCb: ((s: string) => void) | null = null;
  private socket: ReturnType<HumeClient["empathicVoice"]["chat"]["connect"]> | null = null;
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunksSent = 0;
  private lastEvent = "none";
  private muted = false;
  private stopped = false;
  private connectedAt = 0;
  private reconnecting = false;
  /** Closes within moments of opening, in a row. */
  private flaps = 0;
  /** The last thing Hume said went wrong, for the status when the line is let go. */
  private trouble = "";

  constructor(private readonly opts: HumeEarOptions) {}

  onUtterance(cb: (u: Utterance) => void): void { this.listeners.push(cb); }
  onStatus(cb: (s: string) => void): void { this.statusCb = cb; }

  private report(prefix: string): void {
    this.statusCb?.(`${prefix} · audio chunks sent ${this.chunksSent} · last event ${this.lastEvent}${this.muted ? " · mic muted while a character speaks" : ""}`);
  }

  async start(): Promise<void> {
    await this.connect();
    const stream = await getAudioStream();
    ensureSingleValidAudioTrack(stream);
    this.stream = stream;
    if (this.muted) stream.getAudioTracks().forEach((t) => { t.enabled = false; });
    this.record();
  }

  /** Open a socket with a fresh token and wire its events. */
  private async connect(): Promise<void> {
    const { accessToken, configId } = await this.opts.getToken();
    const client = new HumeClient({ accessToken });
    const socket = client.empathicVoice.chat.connect({
      ...(configId ? { configId } : {}),
      verboseTranscription: true,
    });
    this.socket = socket;
    socket.on("open", () => {
      this.state = "open";
      this.connectedAt = Date.now();
      this.report("Connected to Hume. Say your line.");
      if (this.opts.pauseAssistant) socket.pauseAssistant();
    });
    socket.on("message", (msg) => {
      if (this.socket !== socket) return; // an old line, already replaced
      this.lastEvent = msg.type;
      console.debug("[hume]", msg.type, msg);
      if (msg.type === "user_message") {
        const text = msg.message.content ?? "";
        if (msg.interim) {
          this.report(`Hearing: "${text}"`);
          return;
        }
        const scores = normalizeScores((msg.models.prosody?.scores ?? {}) as Record<string, unknown>);
        this.report(`Heard: "${text}"`);
        if (text.trim()) for (const l of this.listeners) l({ text, scores });
      } else if (msg.type === "error") {
        console.warn("[hume] error", msg.code, msg.message);
        this.trouble = `Hume said ${msg.code ? `${msg.code}: ` : ""}${msg.message}`;
        this.report(`Hume error ${msg.code ?? ""}: ${msg.message}`);
      } else if (msg.type === "chat_metadata") {
        this.report("Session open. Say your line.");
      }
    });
    socket.on("close", (e) => {
      // an old line already replaced, a line closed on purpose, or a try that failed inside the reconnection loop: not this handler's
      if (this.socket !== socket || this.stopped || this.reconnecting) return;
      this.lastEvent = `closed ${e.code}`;
      const closeWhy = `${e.code}${e.reason ? `, ${e.reason}` : ""}`;
      this.flaps = flapsAfter(this.flaps, this.connectedAt, Date.now());
      const said = this.trouble ? `${this.trouble}; closed ${closeWhy}` : `closed ${closeWhy}`;
      if (givenUp(this.flaps)) {
        // the far end closes the line as soon as it opens: reopening it forever would flash the lamp at every flip
        this.state = "closed";
        console.warn("[hume] the line keeps closing as soon as it opens", said);
        this.report(`The ear keeps losing the line as soon as it opens (${said}). Close the microphone, wait a minute, and open it again.`);
        return;
      }
      const pause = pauseBefore(this.flaps);
      this.report(this.flaps ? `The ear lost the line again at once (${said}); trying again in ${Math.round(pause / 1000)} s.` : `The ear lost the line (${closeWhy}); picking it up again.`);
      void this.reconnect(this.flaps ? "the line dropped again at once" : "the line dropped", pause);
    });
    socket.on("error", (e) => { if (this.socket === socket) { this.trouble = `ear error: ${e.message}`; this.report(`Ear error: ${e.message}`); } });
    await socket.waitForOpen();
  }

  /** A fresh recorder on the same microphone: a new socket needs a stream that starts with its own header. */
  private record(): void {
    if (!this.stream) return;
    const mime = getBrowserSupportedMimeType();
    const mimeType = mime.success ? mime.mimeType : MimeType.WEBM;
    const recorder = new MediaRecorder(this.stream, { mimeType });
    recorder.ondataavailable = async (e) => {
      if (e.data.size === 0 || !this.socket || this.stopped || this.recorder !== recorder) return;
      // a planned refresh, before the token runs out, at a quiet moment
      if (this.state === "open" && Date.now() - this.connectedAt > REFRESH_AFTER_MS && (this.opts.quiet?.() ?? true)) { void this.reconnect("the token's half hour is nearly up"); return; }
      if (this.state !== "open") return;
      try {
        const data = await convertBlobToBase64(e.data);
        this.socket.sendAudioInput({ data });
        this.chunksSent += 1;
        if (this.chunksSent === 1 || this.chunksSent % 50 === 0) this.report("Listening");
      } catch (error) {
        if (this.state === "open") this.report(`Could not send audio: ${(error as Error).message}`);
      }
    };
    recorder.start(80);
    this.recorder = recorder;
    this.report(`Microphone open (${mimeType}).`);
  }

  /** Pick the line up again after a pause: a fresh token, a fresh socket, a fresh recorder on the same microphone. */
  private async reconnect(why = "the line dropped", pause = pauseBefore(0)): Promise<void> {
    if (this.reconnecting || this.stopped) return;
    this.reconnecting = true;
    this.state = "reconnecting";
    this.report(`Reconnecting the ear (${why})`);
    try { if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop(); } catch { /* already stopped */ }
    this.recorder = null;
    try { this.socket?.close(); } catch { /* already closed */ }
    this.socket = null;
    // a moment first, so the far end can let the old chat go before a new one asks for the line
    await new Promise((r) => setTimeout(r, pause));
    for (let attempt = 1; attempt <= RECONNECT_TRIES && !this.stopped; attempt++) {
      try {
        await this.connect();
        this.record();
        this.reconnecting = false;
        this.report("The ear is back. Say your line.");
        return;
      } catch (e) {
        this.trouble = `could not open the line: ${(e as Error).message}`;
        this.report(`Reconnecting the ear (attempt ${attempt} of ${RECONNECT_TRIES}): ${(e as Error).message}`);
        await new Promise((r) => setTimeout(r, pauseBefore(attempt)));
      }
    }
    this.reconnecting = false;
    if (this.stopped) return;
    this.state = "closed";
    this.report(`The ear could not get the line back (${this.trouble || "no reason given"}). Close the microphone and open it again.`);
  }

  /** A disabled track keeps the encoder running on silence, so the stream stays continuous. */
  mute(): void {
    this.muted = true;
    this.stream?.getAudioTracks().forEach((t) => { t.enabled = false; });
  }

  unmute(): void {
    this.muted = false;
    this.stream?.getAudioTracks().forEach((t) => { t.enabled = true; });
  }

  stop(): void {
    this.stopped = true;
    this.state = "closed";
    try { if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop(); } catch { /* already stopped */ }
    this.recorder = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    try { this.socket?.close(); } catch { /* already closed */ }
    this.socket = null;
    this.statusCb?.("Ear stopped.");
  }
}
