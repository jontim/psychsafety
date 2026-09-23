# Voices for The Shadow Fell

Every speaking character has a voice in Jon's Hume library as of 2026-09-20, with one deliberate gap.

- **Film cast**, cleaned up and cloned straight from the film so they sound as they do on screen, saved by **first name** so the same voices can serve other projects: Soraya, Navid, Rashan, Tavian, Serena, Thorbin, Varya, Brask, Lyra, Kael.
- **New faces**, designed from the descriptions below and saved under the **label** in the table: Shadow Fell Scribe, Shadow Fell Indigo, Shadow Fell Heckler, Shadow Fell Watch Captain, Shadow Fell Sleeper, Shadow Fell Visitor.
- **Sahir has no voice.** He never says anything in the film. The pack names no voice for him; if a scene ever needs him to speak, Octave designs one on the fly from his description.

## Heard in play

Jon has played against Soraya and Varya with the cloned voices and calls both flawless (23 September 2026). The Indigo and Sahir are still designed on the fly from their descriptions; a clone named "Shadow Fell Indigo" in the library would be picked up at the next server start.

## How the server finds them

The pack names a preferred voice per character, but it does not have to match the library letter for letter. At startup the server loads the custom voices from Hume and, for each character, tries the pack's name, then the character's first name (or the bare label for "The Heckler"), then the same with a "Shadow Fell" prefix. Case, spacing and punctuation are ignored. It prints the result:

```
Voices for The Shadow Fell (16 custom voices in your Hume library):
  scribe   Shadow Fell Scribe  (pack name)
  soraya   Soraya  (pack name)
  tav      Tavian  (pack name)
  sahir    designed from description
```

The same table is at `GET /api/voices` while the dev server runs; add `?refresh=1` after saving a new voice in Hume so it is picked up without a restart. From the terminal, `npx tsx scripts/design-voices.ts --check` does the same.

A character whose name resolves to nothing is still voiced, designed from the description, and the console says so. That is the case to watch for after renaming anything in Hume.

## Designing a new voice

For a new face that needs a voice: `npx tsx scripts/design-voices.ts --audition <id>` renders three candidates into `art/voices/` from the description below; `--save <id>=<n>` saves the one you like under the pack's name. Or do it by hand in the Hume platform: design a voice, paste the description and the sample line, save it under the label.

Accent canon comes from the vault: Halyran royals and court speak with a refined, regal British Empire accent; Halyran commoners with a warm North African French-accented, Arabic-inflected, melodic lilt. Thorbin's written lines carry a Scots lilt ("Goin' somewhere are ye, laddie?"). The acting note in the pack still steers a cloned voice per line; the clone fixes the timbre, the note fixes the delivery.

| Library name | Character | Source | Design description for Octave | Sample line |
|---|---|---|---|---|
| Shadow Fell Scribe | The Scribe, narrator | designed | Older narrator, unhurried, warm, a scribe reading his own fair copy aloud; neutral British | "The Stormwardens present: what the ballad did not sing." |
| Soraya | Soraya Anvar, First Caliphina | cloned from the film | Woman of 28, refined regal British Empire accent, a commander's ease; quick, direct, dry, amused | "Alive, silent, and mine. Kaveh, bind them." |
| Navid | Lt. Navid Qasran | cloned from the film | Man of 27, warm North African French-accented voice, Arabic-inflected, melodic; quick, courteous, a smile in it | "These are our guests, do not be so rude. They have come to help us, no?" |
| Shadow Fell Indigo | The Indigo, surviving assassin | designed | Man in his forties, grounded wizard in custody; clipped, superior, precise diction gone tired, contempt worn thin, fear underneath | "Your father's cutlery has opinions, Caliphina. I have none left." |
| Rashan | Caliph Rashan Anvar | cloned from the film | Man of 52, refined regal British Empire accent; dry, unhurried, amused, a father before a sovereign | "Guests, then. The worst kind." |
| none | Caliphant Sahir Anvar | silent in the film | Man of 31, refined regal British Empire accent; measured, quiet, every word weighed | "And alive to reach trial." |
| Tavian | Tavian Larkvale | cloned from the film | Man of 28, a charming bard; warm, quick, musical phrasing, a performer's clarity, a grin in the voice | "Talk, or die. It's your choice. We get paid either way." |
| Serena | Serena Duskbane | cloned from the film | Woman of 30, a paladin; calm, level, certain, warm underneath, never hurried | "You've just confessed in front of a paladin of Tyr." |
| Thorbin | Thorbin Ironhart | cloned from the film | Very old dwarf cleric; deep, rolling, fond, florid phrasing, a Scots lilt, patient, terrifying only when still | "So who did do the planning, lad?" |
| Varya | Varya Stormveil | cloned from the film | Woman of 33; low, flat, exact, unhurried, quiet authority, the pause is the sentence | "Close the door." |
| Brask | Brask Runebearer | cloned from the film | Huge steppe warrior of 34; deep, slow, few words, literal, no ornament | "We practise." |
| Lyra | Lyra Veyrin | cloned from the film | Young elf woman presenting about 24; dry, sly, deadpan, faintly disdainful | "The Concurrence only cuts people off when I ask it really nicely." |
| Kael | Kael Thornmere | cloned from the film | Young man of 19; soft, exact, gentle, unhurried, a kindness that does not bargain | "Morning. Then you haven't missed anything." |
| Shadow Fell Heckler | The Heckler | designed | Superior young wizard; clipped, bored, sneering, talks down | "Do I know you, half-man?" |
| Shadow Fell Watch Captain | The Watch Captain | designed | Weary provincial officer, middle-aged; procedural, dry, would rather be at breakfast | "A wizard goes missing the night your troupe plays, and you would like your carriage back." |
| Shadow Fell Sleeper | The Sleeping Wizard | designed | Middle-aged wizard woken at night; indignant, thick with sleep, then careful | "But it's the middle of the night." |
| Shadow Fell Visitor | The Carriage Visitor | designed | Smooth, patient man; faintly amused, cultured, unhurried, never surprised | "You're difficult people to catch." |
