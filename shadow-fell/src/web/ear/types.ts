import type { EmotionVector } from "../../engine/dimensions.js";

export interface Utterance {
  text: string;
  scores: EmotionVector;
}

export interface Ear {
  readonly kind: "hume" | "mock";
  /** The live ear's line: open, reconnecting, or closed. The mock is always open. */
  readonly state?: "connecting" | "open" | "reconnecting" | "closed";
  /** Why the line is closed for good this session, in a few words the lamp can show. */
  readonly whyClosed?: string;
  start(): Promise<void>;
  stop(): void;
  onUtterance(cb: (u: Utterance) => void): void;
  onStatus(cb: (status: string) => void): void;
  /** Stop feeding the microphone to the listener while our own voices speak. Optional. */
  mute?(): void;
  unmute?(): void;
}
