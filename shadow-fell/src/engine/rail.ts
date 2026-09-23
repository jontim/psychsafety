/**
 * Brask's rail guard: the mechanical part of his language rail. The director is asked to keep
 * TO BE and TO DO out of his mouth; when a conjugation slips back in, the guard removes it,
 * sentence by sentence, leaving his locked lines alone. Every "is" is a conjugation of TO BE,
 * and so are "are", "am", "was" and "were" (Jon, 2026-09-23). TO DO goes only where it does
 * auxiliary work: opening a question, after a question word, or carrying a "not"; "do" as a deed
 * ("What I do with it?") stays.
 */

/** Locked lines of his that predate the rail; the guard never touches a sentence carrying one. Jon has not ruled whether they are fossils, re-rendered or a deliberate tell. */
export const BRASK_FOSSILS: readonly string[] = [
  "she was in my house",
  "then i was in hers",
  "then she was nowhere",
  "the matter is closed",
  "i'm not afraid to care",
  "these are your people",
  "what is wrong with the way of the storm warden",
  "we are wardens to many",
  "this one is good",
  "the world has become this small",
  "what do you choose now",
];

const normalise = (s: string) => s.toLowerCase().replace(/’/g, "'").replace(/[^a-z' ]+/g, " ").replace(/\s+/g, " ").trim();

export function isBraskFossil(sentence: string, fossils: readonly string[] = BRASK_FOSSILS): boolean {
  const n = normalise(sentence);
  return fossils.some((f) => n.includes(f));
}

export interface RailRepair {
  /** The line with the conjugations removed. */
  text: string;
  /** True when the guard changed anything. */
  repaired: boolean;
}

function repairSentence(sentence: string): string {
  let t = sentence;
  // "is not", "did not", "isn't", "don't": the negation stays, the verb goes.
  t = t.replace(/\b(is|are|am|was|were|do|does|did)\s+not\b/gi, "not");
  t = t.replace(/\b(isn't|aren't|wasn't|weren't|ain't|don't|doesn't|didn't)\b/gi, "not");
  // contracted TO BE on pronouns and question words; a possessive on a noun ("Tav's work") is untouched.
  t = t.replace(/\bI'm\b/g, "I").replace(/\bI\s+am\b/g, "I");
  t = t.replace(/\b(you|we|they)'re\b/gi, "$1");
  t = t.replace(/\b(he|she|it|that|this|there|here|what|who|where|how|why|when)'s\b/gi, "$1");
  // TO DO as an auxiliary: opening a question, or after a question word.
  t = t.replace(/^\s*(do|does|did)\s+/i, "");
  t = t.replace(/\b(what|why|who|whom|where|when|how|which)\s+(do|does|did)\s+/gi, "$1 ");
  // every conjugation of TO BE goes; the two things it linked stand side by side.
  t = t.replace(/\b(is|are|am|was|were)\b\s*/gi, "");
  t = t.replace(/\s{2,}/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim();
  return t ? t[0]!.toUpperCase() + t.slice(1) : t;
}

/** Remove the conjugations of TO BE and TO DO from a line of Brask's, sentence by sentence, skipping his locked lines. */
export function repairBraskRail(line: string, fossils: readonly string[] = BRASK_FOSSILS): RailRepair {
  const parts = line.split(/([.!?…]+["”']?\s*)/);
  let out = "";
  for (let i = 0; i < parts.length; i += 2) {
    const sentence = parts[i] ?? "";
    const end = parts[i + 1] ?? "";
    if (!sentence.trim()) { out += sentence + end; continue; }
    out += (isBraskFossil(sentence, fossils) ? sentence : repairSentence(sentence)) + end;
  }
  const text = out.replace(/\s{2,}/g, " ").trim();
  return { text, repaired: text !== line.trim() };
}
