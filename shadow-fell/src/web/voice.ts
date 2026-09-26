import { api } from "./backend.js";

/** How long one line may take to arrive from Octave before the browser's own voice takes it. */
const OCTAVE_TIMEOUT_MS = 30000;

/**
 * Speaks lines in order: Octave through the server when available, the browser's own voice otherwise.
 * Nothing here holds the app hostage: a stopped line lets go of its turn, a slow request is abandoned,
 * and a line that never ends is cut off by a guard, so a caller awaiting `speak` always gets its answer.
 */
export class Voice {
  private queue: Promise<void> = Promise.resolve();
  private audio = new Audio();
  /** Lets the line now playing finish early: `stop()` calls it, since a paused sound never ends on its own. */
  private release: (() => void) | null = null;
  private aborter: AbortController | null = null;
  octave = true;
  /** True while a line is being fetched or heard. */
  speaking = false;

  constructor(private readonly worldId: string) {}

  speak(speaker: string, text: string, acting?: string): Promise<void> {
    const run = async (): Promise<void> => {
      this.speaking = true;
      try { await this.play(speaker, text, acting); }
      finally { this.speaking = false; }
    };
    this.queue = this.queue.then(run).catch((e) => console.warn("voice", e));
    return this.queue;
  }

  private async play(speaker: string, text: string, acting?: string): Promise<void> {
    if (this.octave) {
      const aborter = new AbortController();
      this.aborter = aborter;
      const timer = setTimeout(() => aborter.abort(), OCTAVE_TIMEOUT_MS);
      try {
        const blob = await api.tts(this.worldId, speaker, text, acting, aborter.signal);
        if (blob) {
          await this.playBlob(blob);
          return;
        }
        this.octave = false;
      } catch (e) {
        if (aborter.signal.aborted) return; // stopped, or given up on: the line is over
        console.warn("octave", e);
      } finally {
        clearTimeout(timer);
        if (this.aborter === aborter) this.aborter = null;
      }
    }
    await this.speakLocally(text);
  }

  private playBlob(blob: Blob): Promise<void> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        if (this.release === finish) this.release = null;
        URL.revokeObjectURL(url);
        resolve();
      };
      this.release = finish;
      this.audio.src = url;
      this.audio.onended = finish;
      this.audio.onerror = finish;
      this.audio.play().catch(finish);
      // a sound that reports a length but never ends is let go a little after it should have
      this.audio.onloadedmetadata = () => { if (Number.isFinite(this.audio.duration)) setTimeout(finish, this.audio.duration * 1000 + 1500); };
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

  /** Cut the line now playing (and any still arriving); whoever awaited it gets their turn back. */
  stop(): void {
    this.aborter?.abort();
    this.audio.pause();
    this.release?.();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }
}
