import { HumeClient, getAudioStream, getBrowserSupportedMimeType, convertBlobToBase64, ensureSingleValidAudioTrack } from "hume";
import { normalizeScores } from "../../engine/dimensions.js";
import type { Ear, Utterance } from "./types.js";

export interface HumeEarOptions {
  accessToken: string;
  configId?: string | null;
  /** Pause EVI's own replies so our director speaks instead. Default true. */
  pauseAssistant?: boolean;
}

/**
 * The Hume ear: streams the microphone into an EVI session and reports each
 * final user utterance with its 48 prosody scores. EVI's own voice is paused
 * and its audio ignored; the story's director and Octave do the talking.
 */
export class HumeEar implements Ear {
  readonly kind = "hume" as const;
  private listeners: Array<(u: Utterance) => void> = [];
  private statusCb: ((s: string) => void) | null = null;
  private socket: ReturnType<HumeClient["empathicVoice"]["chat"]["connect"]> | null = null;
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;

  constructor(private readonly opts: HumeEarOptions) {}

  onUtterance(cb: (u: Utterance) => void): void { this.listeners.push(cb); }
  onStatus(cb: (s: string) => void): void { this.statusCb = cb; }

  async start(): Promise<void> {
    const client = new HumeClient({ accessToken: this.opts.accessToken });
    const socket = client.empathicVoice.chat.connect({
      ...(this.opts.configId ? { configId: this.opts.configId } : {}),
      verboseTranscription: true,
    });
    this.socket = socket;

    socket.on("open", () => {
      this.statusCb?.("Listening.");
      if (this.opts.pauseAssistant !== false) socket.pauseAssistant();
    });
    socket.on("message", (msg) => {
      if (msg.type === "user_message" && !msg.interim) {
        const text = msg.message.content ?? "";
        const scores = normalizeScores((msg.models.prosody?.scores ?? {}) as Record<string, unknown>);
        if (text.trim()) for (const l of this.listeners) l({ text, scores });
      } else if (msg.type === "error") {
        this.statusCb?.(`Hume error: ${msg.message}`);
      } else if (msg.type === "chat_metadata") {
        this.statusCb?.("Listening. Say your line; the world reads how you say it.");
      }
    });
    socket.on("close", () => this.statusCb?.("Ear closed."));
    socket.on("error", (e) => this.statusCb?.(`Ear error: ${e.message}`));

    await socket.waitForOpen();

    const stream = await getAudioStream();
    ensureSingleValidAudioTrack(stream);
    this.stream = stream;
    const mime = getBrowserSupportedMimeType();
    const recorder = new MediaRecorder(stream, mime.success ? { mimeType: mime.mimeType } : undefined);
    recorder.ondataavailable = async (e) => {
      if (e.data.size === 0 || !this.socket) return;
      const data = await convertBlobToBase64(e.data);
      this.socket.sendAudioInput({ data });
    };
    recorder.start(100);
    this.recorder = recorder;
  }

  stop(): void {
    this.recorder?.stop();
    this.recorder = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.socket?.close();
    this.socket = null;
    this.statusCb?.("Ear stopped.");
  }
}
