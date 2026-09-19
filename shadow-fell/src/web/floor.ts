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

  /** Re-arm the silence timer, for example when an interim transcript shows the speaker is still going. */
  touch(): void {
    if (this.fragments.length) this.arm();
  }

  private arm(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.mode === "silence") this.timer = setTimeout(() => this.commit(), this.silenceMs);
  }

  /** End the turn now, whatever the mode. */
  commit(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.fragments.length) return;
    const fragments = this.fragments;
    this.fragments = [];
    this.opts.onChange([]);
    this.opts.onCommit(mergeFragments(fragments), fragments);
  }

  clear(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.fragments = [];
    this.opts.onChange([]);
  }
}
