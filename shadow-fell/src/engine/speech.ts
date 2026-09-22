/**
 * A line is the words a character says, nothing else: Octave reads it aloud. When a director
 * renders prose ("Brask reads." A hand out, flat, palm up. "You came a long way."), keep the
 * speech and hand the narration to the tell, where observable action belongs.
 */
export interface SpeechSplit {
  /** The spoken words only. */
  text: string;
  /** Narration found outside the quotes, if any; an observable beat for the tell. */
  narration?: string;
  /** True when the line was not pure speech. */
  leaked: boolean;
}

const QUOTES = /[“”"]/g;

export function speechOnly(line: string): SpeechSplit {
  const raw = line.trim();
  const quoteCount = (raw.match(QUOTES) ?? []).length;
  // A line that opens with a quotation mark and closes with one is a rendering, not speech.
  if (quoteCount >= 2 && /^[“"]/.test(raw)) {
    const parts = raw.split(QUOTES);
    const speech: string[] = [];
    const narration: string[] = [];
    // Split on quotes: odd indexes are inside quotes, even indexes are outside.
    parts.forEach((part, i) => {
      const t = part.trim();
      if (!t) return;
      if (i % 2 === 1) speech.push(t);
      else narration.push(t);
    });
    if (speech.length) {
      const text = speech.join(" ").replace(/\s+/g, " ").trim();
      const note = narration.join(" ").replace(/\s+/g, " ").trim();
      return { text, ...(note ? { narration: note } : {}), leaked: text !== raw };
    }
  }
  return { text: raw, leaked: false };
}
