import { HumeClient, getAudioStream, getBrowserSupportedMimeType, convertBlobToBase64, ensureSingleValidAudioTrack, MimeType } from "hume";
import { normalizeScores } from "../../engine/dimensions.js";
import type { Ear, Utterance } from "./types.js";

export interface HumeEarOptions {
  accessToken: string;
  configId?: string | null;
  /**
   * Pause EVI's own replies. Off by default: pausing may also stop EVI sending
   * transcripts, so the safe mode is to let EVI reply and simply never play it.
   */
  pauseAssistant?: boolean;
}

/**
 * The Hume ear: streams the microphone into an EVI session and reports each
 * final user utterance with its 48 prosody scores. EVI's replies are ignored,
 * never played; the story's director and Octave do the talking.
 */
export class HumeEar implements Ear {
  readonly kind = "hume" as const;
  private listeners: Array<(u: Utterance) => void> = [];
  private statusCb: ((s: string) => void) | null = null;
  private socket: ReturnType<HumeClient["empathicVoice"]["chat"]["connect"]> | null = null;
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunksSent = 0;
  private lastEvent = "none";
  private muted = false;
  private stopped = false;

  constructor(private readonly opts: HumeEarOptions) {}

  onUtterance(cb: (u: Utterance) => void): void { this.listeners.push(cb); }
  onStatus(cb: (s: string) => void): void { this.statusCb = cb; }

  private report(prefix: string): void {
    this.statusCb?.(`${prefix} · audio chunks sent ${this.chunksSent} · last event ${this.lastEvent}${this.muted ? " · mic muted while a character speaks" : ""}`);
  }

  async start(): Promise<void> {
    const client = new HumeClient({ accessToken: this.opts.accessToken });
    const socket = client.empathicVoice.chat.connect({
      ...(this.opts.configId ? { configId: this.opts.configId } : {}),
      verboseTranscription: true,
    });
    this.socket = socket;

    socket.on("open", () => {
      this.report("Connected to Hume. Say your line.");
      if (this.opts.pauseAssistant) socket.pauseAssistant();
    });
    socket.on("message", (msg) => {
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
        this.report(`Hume error ${msg.code ?? ""}: ${msg.message}`);
      } else if (msg.type === "chat_metadata") {
        this.report("Session open. Say your line.");
      }
    });
    socket.on("close", (e) => this.report(`Hume closed (${e.code}${e.reason ? `, ${e.reason}` : ""}).`));
    socket.on("error", (e) => this.report(`Ear error: ${e.message}`));

    await socket.waitForOpen();

    const stream = await getAudioStream();
    ensureSingleValidAudioTrack(stream);
    this.stream = stream;
    const mime = getBrowserSupportedMimeType();
    const mimeType = mime.success ? mime.mimeType : MimeType.WEBM;
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = async (e) => {
      if (e.data.size === 0 || !this.socket || this.stopped) return;
      try {
        const data = await convertBlobToBase64(e.data);
        this.socket.sendAudioInput({ data });
        this.chunksSent += 1;
        if (this.chunksSent === 1 || this.chunksSent % 50 === 0) this.report("Listening");
      } catch (error) {
        this.report(`Could not send audio: ${(error as Error).message}`);
      }
    };
    recorder.start(80);
    this.recorder = recorder;
    this.report(`Microphone open (${mimeType}).`);
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
    try { if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop(); } catch { /* already stopped */ }
    this.recorder = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    try { this.socket?.close(); } catch { /* already closed */ }
    this.socket = null;
    this.statusCb?.("Ear stopped.");
  }
}
