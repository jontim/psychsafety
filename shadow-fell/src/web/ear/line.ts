/**
 * How the ear picks a dropped line up again.
 *
 * A line that fails to open is tried again after a growing pause. A line that
 * opens and drops again at once is treated the same way: the far end may be
 * closing it on sight (an old chat not yet let go, a limit reached), and
 * reopening it without pause would flip the lamp between green and dim at
 * every try, forever, with nothing pressable underneath. After RECONNECT_TRIES
 * of either kind the line is let go, and the lamp says so.
 */
export const RECONNECT_TRIES = 6;

/** A close this soon after opening is a flap, not a drop. */
export const FLAP_WINDOW_MS = 10_000;

/**
 * The pause before a try: half a second after a plain drop, so the far end can
 * let the old chat go, and doubling with each failure or flap, up to eight seconds.
 */
export function pauseBefore(failures: number): number {
  return failures <= 0 ? 500 : Math.min(8000, 1000 * 2 ** (failures - 1));
}

/** How many flaps in a row this close makes: one more when the line was up for less than the window, none when it held. */
export function flapsAfter(flapsSoFar: number, openedAt: number, closedAt: number): number {
  return closedAt - openedAt < FLAP_WINDOW_MS ? flapsSoFar + 1 : 0;
}

/** True once the line has flapped as many times as it would be tried. */
export const givenUp = (flaps: number): boolean => flaps >= RECONNECT_TRIES;

/**
 * A refusal no retry can mend: the far end will say the same again in a
 * minute. Hume's E0300 is an exhausted credit balance; a bad or forbidden key
 * is the other kind. Such a line is let go at once, with the reason shown.
 */
const FATAL = /\bE0300\b|exhausted credit|credit balance|billing|unauthori[sz]ed|invalid api key|forbidden/i;
export const isFatal = (said: string): boolean => FATAL.test(said);

/** The first sentence of a message, for a lamp: "Exhausted credit balance", not the whole invoice. */
export function firstSentence(message: string): string {
  const first = message.trim().split(/(?<=[.!?])\s+/)[0] ?? message;
  return first.replace(/[.!?]+$/, "");
}
