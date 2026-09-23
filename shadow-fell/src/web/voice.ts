import { api } from "./backend.js";

/** Speaks lines in order: Octave through the server when available, the browser's own voice otherwise. */
export class Voice {
  private queue: Promise<void> = Promise.resolve();
  private audio = new Audio();
  octave = true;

  constructor(private readonly worldId: string) {}

  speak(speaker: string, text: string, acting?: string): Promise<void> {
    this.queue = this.queue.then(() => this.play(speaker, text, acting)).catch((e) => console.warn("voice", e));
    return this.queue;
  }

  private async play(speaker: string, text: string, acting?: string): Promise<void> {
    if (this.octave) {
      try {
        const blob = await api.tts(this.worldId, speaker, text, acting);
        if (blob) {
          await this.playBlob(blob);
          return;
        }
        this.octave = false;
      } catch (e) {
        console.warn("octave", e);
      }
    }
    await this.speakLocally(text);
  }

  private playBlob(blob: Blob): Promise<void> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      this.audio.src = url;
      this.audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      this.audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      this.audio.play().catch(() => resolve());
    });
  }

  private speakLocally(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window)) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95;
      // A synthesiser with no voices never fires onend; do not let it hold the turn.
      const guard = setTimeout(resolve, 1500 + text.length * 80);
      u.onend = () => { clearTimeout(guard); resolve(); };
      u.onerror = () => { clearTimeout(guard); resolve(); };
      window.speechSynthesis.speak(u);
    });
  }

  stop(): void {
    this.audio.pause();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }
}
