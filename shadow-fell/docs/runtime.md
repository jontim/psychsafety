# The company's runtime: how the Behavioral Canon reaches the director

Jon's *Stormwardens Behavioral Canon & Social Runtime* is an execution layer: what a Warden notices, chooses, refuses, says and does when the plot applies pressure, and what each does differently because a particular other Warden is in the room. The Shadow Fell compiles it into data and hands the director exactly the slice a scene needs.

## Source of truth

- `src/canon/behavioral-canon.md` is the document, checked in as markdown from Jon's v1.4 docx. One private phrase in section 5 (Tavian and Lyra) is reworded here; the vault holds the verbatim text. The docx's own header and footer still read v1.3; the compiler records the version as 1.4.
- `npm run compile:canon` reads it and writes `src/canon/runtime.json`. The test suite recompiles the document and compares, so an edited document with a stale JSON fails the build. Edit the document, run the compile, commit both.
- The compiler reads the document by its headings and fails loudly if a section it depends on has moved: the seven execution cards (§3), the 21 pairs in both directions (§5), the machine fields (§9.2), the Kids and Melindre amendment (§12), outsider behaviour (§16), the ten fallback domains (§17), the wrong lines (§18) and every `TEST` / `Expected` pair (§6, §12.7, §13.1, §14.5, §15.12, §19).

## What is applied on the way through, as data

- The Contradiction Ledger's live names: Moradin becomes Morrighad, Thorbardin becomes Tor-Morrighad, Oghma becomes Ogma. The document keeps Jon's text; the runtime carries only live names, and a test checks it.
- Jon's rule that the ninety-five percent stays in the writers' layer: the number is removed wherever it appears, so "the 95% fault line" reaches the director as "the fault line". Prompts leak; the sentence is what the director needs.
- Dated rulings made after the document was frozen, each one a find and a replace with its source. Today there is one: the §12.1 sentence about the slave route, which Jon superseded on 2026-09-22 (the route breaks only at the end of the Mhasun assault). The runtime records which rulings were applied.
- The §14 placeholder bullet about the dwarven homeland is dropped; §15 replaced it.

## What the director receives

In the cached system prompt, identical every turn:

- The company's runtime: the primary law, the retrieval and precedence rules, the company runtime, plural leadership, Serena and Tavian's combined leadership, the dialogue guardrails, candidate scoring, the generation loop, the outsider classification rule, the absence rule and the micro-party rules, and the Kids and Melindre relationship rules.
- All 21 directed pairs, both directions, with the chosen use and the risk rule for each.
- All 21 wrong lines, with why each is wrong and the correction.
- Under each Warden's cast card, below the dossier: their role, thesis, execution card, runtime rule, failure mode, machine fields (what they notice first, default strategy, escalation order, speech, trust signals, what they will not do, ethical anchor, shadow risk, leadership claim), and how they handle each class of outsider.

In the per-turn message, after the beat card:

- The slate: which Wardens are in the scene (the player's role, the counterpart and anyone present), which are absent, which domains are owned outright, which are covered by a fallback in their own grammar, and which are in containment because the owner and both fallbacks are away. The directed pairs live in the scene are listed by name. The beat's `outsider` field says how the Wardens read the non-Warden party as the scene opens and with what confidence; the director reclassifies on behaviour.

Beats with no Warden present (Soraya's room) get an idle slate: the runtime does not apply, and the counterpart is scored against their own card.

## Language rails

Section 21 of the document holds voice rules that bind the rendered line for a particular Warden, compiled onto that Warden's runtime and placed under their cast card as a language rail. A rail describes production, not cognition: Brask's is the first, and its governing sentence is that his intelligence is judged from the sequence and quality of his questions, never from the sophistication of his Common. The attribution eval counts lines that break a rail as style slips.

## Speech, not prose

A line is what Octave reads aloud. The rules tell the director that the line is the spoken words only, with no quotation marks, stage directions or narrated pauses, and that what the player could see goes in the tell. The sanitiser enforces it: a line rendered as prose is cut down to its quoted speech and the narration becomes the tell when the director left the tell empty. The attribution eval counts these as prose leaks.

## What the director returns

`DirectorResponse.slate` is required: the owner of the problem this turn (a cast id or "none"), the coverage mode (owner, fallback, containment or retrieval), the outsider mode used, and two to four candidate moves for the speaker, each scored from −2 to +2 with a note. The line never renders a −2; with two or more moves at +1 or better it renders the best-scored, ties to the move marked distinct, the one no other Warden present could make unchanged. The move decides what the line does and the character decides how it sounds, so the slate never replaces the character: the runtime creates the person, the gate chooses the tactic, the runtime renders the person doing it. This is §9.6 made visible, and after the first live steering evaluation it is validated preliminarily: four of four judged pairs rendered two forced moves as distinct, enacted tactics in the Warden's voice. A single move at +1 or better is a valid slate; plurality is optional, specificity is mandatory. The slate is framed to the model as the scene's paperwork, moves the character could make, not reasoning the model performed: the first live run refused every gated turn, and the API documents a refusal category for requests that try to elicit the model's internal reasoning in the response. When the director refuses, the note carries the refusal category and the understudy takes the turn. The understudy fills the slate deterministically so the shape holds without a key.

## The steering surface

`DirectorRequest.steer` fixes the speaker's move for one turn: the turn message says the move is fixed and the line renders from it, while the slate still scores it among the candidates. The game's client never sets it; the steering eval does, and it is the mechanism by which a scene could one day be steered by the story rather than left to the director's pick.

## The slate panel

The stage has a "Slate" pill in the band, and the S key toggles it. It shows the owner, the coverage, the outsider mode, which director took the turn, and the intentions with their scores: gold for +2, blue for +1, violet and crimson for the drifts and violations, the chosen one framed. It is an authoring view and off by default; the browser remembers the choice.

## Beats declare their outsider

Each beat carries `outsider: { mode, confidence, note }` where mode is authority, vulnerable, predator, nuisance or mixed. The tour beats follow §19 directly: the watch captain is authority and never a predator, the heckler is a nuisance until his hands light, the sleeping wizard is mixed, the carriage visitor is mixed at low confidence, and the alley's heckler is a predator in custody.

## What stays out of the prompt

Sections 14 and 15 (chosen risk, Tor-Morrighad) are compiled and available but not sent: the homeland sits outside this story's window. The §13 source list, the §9.1 field documentation and the integration notes in §8, §10 and §11 are for people, not the director. Everything is in `runtime.json` for tools that want it.

## Guards

`src/server/__tests__/runtime.test.ts` checks that the JSON is in step with the document; that the seven Wardens are keyed by their pack ids and complete; that every directed pair and fallback domain exists and points at real Wardens; that no retired name, no ninety-five and no private phrase survives; that the rulings were applied; that the slate reads each beat correctly (who is present, who covers, who is idle); that the runtime sits in the cached prefix and the slate in the turn message; and that the understudy fills a valid slate for every beat.

## Next

An offline eval, "which Warden said this?": generate lines per beat, strip the names, ask the model to attribute them, and score specificity. §9.6 step 8 says that if a scene could be reassigned to another Warden with only the name changed, specificity is too low; the eval makes that a number.
