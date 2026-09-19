import type { EmotionVector } from "../../engine/dimensions.js";

export interface Utterance {
  text: string;
  scores: EmotionVector;
}

export interface Ear {
  readonly kind: "hume" | "mock";
  start(): Promise<void>;
  stop(): void;
  onUtterance(cb: (u: Utterance) => void): void;
  onStatus(cb: (status: string) => void): void;
  /** Stop feeding the microphone to the listener while our own voices speak. Optional. */
  mute?(): void;
  unmute?(): void;
}
