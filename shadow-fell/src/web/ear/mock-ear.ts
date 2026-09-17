import { blend, TONE_NAMES, type TonePreset } from "../../engine/mock-ear.js";
import type { Ear, Utterance } from "./types.js";

/** Typed lines with a chosen tone. For playing without a microphone or a Hume key. */
export class MockEar implements Ear {
  readonly kind = "mock" as const;
  private listeners: Array<(u: Utterance) => void> = [];
  private statusCb: ((s: string) => void) | null = null;
  tones: Array<{ preset: TonePreset; weight: number }> = [{ preset: "calm", weight: 1 }];

  async start(): Promise<void> {
    this.statusCb?.("Mock ear: type a line and pick how you said it.");
  }
  stop(): void {}
  onUtterance(cb: (u: Utterance) => void): void { this.listeners.push(cb); }
  onStatus(cb: (s: string) => void): void { this.statusCb = cb; }

  setTone(preset: TonePreset, weight = 1): void {
    this.tones = [{ preset, weight }];
  }
  mixTone(preset: TonePreset, weight: number): void {
    const others = this.tones.filter((t) => t.preset !== preset);
    this.tones = weight > 0 ? [...others, { preset, weight }] : others;
    if (this.tones.length === 0) this.tones = [{ preset: "calm", weight: 1 }];
  }
  say(text: string): void {
    const scores = blend(this.tones);
    for (const l of this.listeners) l({ text, scores });
  }
  static presets(): TonePreset[] { return TONE_NAMES; }
}
