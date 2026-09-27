import { EMOTION_KEYS, type EmotionVector, zeroVector } from "../engine/dimensions.js";
import type { Utterance } from "./ear/types.js";

/**
 * The floor: fragments EVI commits at every natural pause are gathered here
 * until the speaker is done, so a dramatic pause never ends the turn. The
 * merged utterance carries the whole speech and a word-weighted blend of
 * how each fragment sounded.
 */
export interface Fragment extends Utterance {
  words: number;
}

export type FloorMode = "silence" | "manual";

export interface FloorOptions {
  mode: FloorMode;
  /** Silence after the last fragment that ends the turn, in milliseconds (silence mode). */
  silenceMs: number;
  onChange: (fragments: Fragment[]) => void;
  onCommit: (merged: Utterance, fragments: Fragment[]) => void;
}

export function mergeFragments(fragments: Fragment[]): Utterance {
  const total = fragments.reduce((a, f) => a + Math.max(1, f.words), 0) || 1;
  const scores = zeroVector();
  for (const f of fragments) {
    const w = Math.max(1, f.words) / total;
    for (const k of EMOTION_KEYS) scores[k] += f.scores[k] * w;
  }
  return { text: fragments.map((f) => f.text.trim()).filter(Boolean).join(" "), scores };
}

export class Floor {
  private fragments: Fragment[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** When the turn hands over on its own (silence mode) or the grace after Done ends, as a timestamp; null while nothing is pending. */
  handsOverAt: number | null = null;
  /** True during the short grace after Done, while the ear's last sentence is still landing. */
  finishing = false;
  mode: FloorMode;
  silenceMs: number;

  constructor(private readonly opts: FloorOptions) {
    this.mode = opts.mode;
    this.silenceMs = opts.silenceMs;
  }

  get pending(): Fragment[] { return [...this.fragments]; }
  get hasSpeech(): boolean { return this.fragments.length > 0; }

  /** A fragment EVI committed; the turn stays open. */
  add(u: Utterance): void {
    this.fragments.push({ ...u, words: u.text.trim().split(/\s+/).filter(Boolean).length });
    this.opts.onChange(this.pending);
    this.arm();
  }

  /** Re-arm the silence timer, for example when an interim transcript shows the speaker is still going; during the grace after Done, give the ear a moment longer. */
  touch(): void {
    if (this.finishing) {
      const at = Math.max(this.handsOverAt ?? 0, Date.now() + 1000);
      this.handsOverAt = at;
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => this.finish(), at - Date.now());
      return;
    }
    if (this.fragments.length) this.arm();
  }

  /**
   * The speaker says they are done. The ear's last sentence is often still on its way, so a short grace is kept
   * for it before the turn is read; a fragment that lands in the grace joins the turn instead of starting a new one.
   */
  done(graceMs = 1500): void {
    if (this.timer) clearTimeout(this.timer);
    this.finishing = true;
    this.handsOverAt = Date.now() + graceMs;
    this.timer = setTimeout(() => this.finish(), graceMs);
    this.opts.onChange(this.pending);
  }

  private finish(): void {
    this.finishing = false;
    this.timer = null;
    if (this.fragments.length) this.commit();
    else { this.handsOverAt = null; this.opts.onChange([]); }
  }

  private arm(): void {
    if (this.finishing) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.handsOverAt = null;
    if (this.mode === "silence") {
      this.handsOverAt = Date.now() + this.silenceMs;
      this.timer = setTimeout(() => this.commit(), this.silenceMs);
    }
  }

  /** End the turn now, whatever the mode. */
  commit(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.handsOverAt = null;
    this.finishing = false;
    if (!this.fragments.length) return;
    const fragments = this.fragments;
    this.fragments = [];
    this.opts.onChange([]);
    this.opts.onCommit(mergeFragments(fragments), fragments);
  }

  clear(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.handsOverAt = null;
    this.finishing = false;
    this.fragments = [];
    this.opts.onChange([]);
  }
}
