# Dossiers: how the cast knows who they are

Each speaking character in a world pack has a cast card: a summary, how they speak, tells, what they know, and lines usable verbatim. That is enough to run a scene and not enough to run a person. A dossier is the long-form document underneath the card, and it is where the vault's canon reaches the director.

## Where they live and how they travel

- One markdown file per character at `src/worlds/<world>/dossiers/<cast id>.md`.
- The server loads them at startup and prints which characters have one.
- The director's cached system prompt carries each dossier directly under its character's cast card, labelled director-only. The browser never receives them, and the understudy ignores them.
- Every dossier ends with a `## Never` section. It is binding on the director and lists what is sealed, protected or open for that character, so a gap in a scene stays a gap.
- Every dossier ends with a `## Sources` section naming the vault notes it was derived from.

## The shape

The seven Wardens follow the Archive's fixed structure, the two-page record the Library keeps on each of them: who they are, how they speak, what they carry, then the Archive record (way of knowing, sacred value, core gift, shadow, visible behaviours, accessible family fears, the four hidden-architecture entries, the defining moment, and the lesson most easily taught to others paired with the lesson least believed about themselves), then Never, then Sources. Where the vault has not decided a field it says "not on record" rather than guessing; the Archive cannot hallucinate, and neither may a dossier. The four hidden-architecture entries are restated from the vault's character architecture where the rendered Archive page is not itself in the vault. The House Anvar dossiers follow the Showrunner profiles and the family note and are shorter.

## The sourcing rule

Dossiers are derived from the vault, never written from memory. Jon's decisions about canon are final; the vault holds them; the dossier repeats them. Spelling and factual slips in a chat are corrected against the vault (Veyrin, not Verin; Larkvale, not Larkspur), but events and canon will keep morphing as the world comes to life, so a dossier is a snapshot with sources, not an authority. When canon moves, re-derive the dossier from the notes rather than editing it in place.

Dossiers are written in the third person, as reference, because the director plays everyone. Second-person character prompts ("you are Lyra") belong in Hume configs for other products, not here: in The Shadow Fell, Hume is the ear and the director is every voice.

## Guards

A test in `src/server/__tests__/dossiers.test.ts` checks that every dossier belongs to a cast member, carries a Never and a Sources section, stays under 800 words so the prompt cache holds, and reaches the director under the right card. The same test scans the dossiers, the canon brief and the pack for names the Contradiction Ledger has retired (the inherited-world names and the dead spellings), so nothing that should have died can reach a scene.

## Who has one

Lyra, Varya, Tavian, Serena, Thorbin, Brask, Kael, Soraya, Navid, Rashan, Sahir and the Indigo. The heckler, the watch captain, the sleeping wizard, the carriage visitor and the Scribe are working material the film shows unnamed; their cast cards are the whole of their canon until Jon says otherwise.
