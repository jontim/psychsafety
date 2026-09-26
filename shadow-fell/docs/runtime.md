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

Section 21 of the document holds voice rules that bind the rendered line for a particular Warden, compiled onto that Warden's runtime and placed under their cast card as a language rail. A rail describes production, not cognition: Brask's was the first, and its governing sentence is that his intelligence is judged from the sequence and quality of his questions, never from the sophistication of his Common. Lyra's (verdict first, framework withheld, mischief in the same deadpan) and Kael's (asks, never tells; relationship, not inventory; talks to the land aloud) followed on Jon's rulings of 23 September, after the blind run showed the two of them as the weak seam. The attribution eval counts lines that break a rail as style slips. Brask's rail also has a mechanical guard: after the speech-only repair, every conjugation of TO BE in his line, and TO DO where it does auxiliary work, is removed sentence by sentence before the line is heard, his locked lines left alone. The director is still asked to keep the rail, and the eval counts its slips on the line before the guard, so the guard catches the residue without hiding it.

## Speech, not prose

A line is what Octave reads aloud. The rules tell the director that the line is the spoken words only, with no quotation marks, stage directions or narrated pauses, and that what the player could see goes in the tell. The sanitiser enforces it: a line rendered as prose is cut down to its quoted speech and the narration becomes the tell when the director left the tell empty. The attribution eval counts these as prose leaks.

## What the director returns

`DirectorResponse.slate` is required: the owner of the problem this turn (a cast id or "none"), the coverage mode (owner, fallback, containment or retrieval), the outsider mode used, and two to four candidate moves for the speaker, each scored from −2 to +2 with a note. The line never renders a −2; with two or more moves at +1 or better it renders the best-scored, ties to the move that arises from the Warden's way of knowing, the thing their attention line says they notice first, then to the move marked distinct, the one no other Warden present could make unchanged. The way-of-knowing tie-breaker is Jon's intention-level sharpening for Lyra and Kael: their moves come from their attention, not from more voice prose, and the director is told to derive the first candidate from the attention line. The move decides what the line does and the character decides how it sounds, so the slate never replaces the character: the runtime creates the person, the gate chooses the tactic, the runtime renders the person doing it. This is §9.6 made visible, and after the first live steering evaluation it is validated preliminarily: four of four judged pairs rendered two forced moves as distinct, enacted tactics in the Warden's voice. A single move at +1 or better is a valid slate; plurality is optional, specificity is mandatory. The slate is framed to the model as the scene's paperwork, moves the character could make, not reasoning the model performed: the first live run refused every gated turn, and the API documents a refusal category for requests that try to elicit the model's internal reasoning in the response. When the director refuses, the note carries the refusal category and the understudy takes the turn. The understudy fills the slate deterministically so the shape holds without a key.

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

## Calibration

A session built with a baseline (`new StorySession(world, beatId, { baseline })`) shifts both the smoothed and the latest axes away from the player's plain voice by `CALIBRATION_STRENGTH` (0.6) before meters drift, clips are chosen or the director is briefed. The baseline comes from the Mirror's plain line; the snapshot reports `calibrated`. Without a baseline nothing changes.

## Outcomes and flags

Beats may declare `outcomes` (`OutcomeSchema` in `src/engine/world.ts`): a key, a player-facing label, a director-facing `when`, a status, flags, and `next` (a beat id, undefined for the next beat in order, or null to end the story with `ending`). The director returns `beat.outcome`; the session applies the outcome's status and flags, records the beat in `history`, and `advance()` follows `next`. The request carries `flags` and `history`, and the turn prompt shows them under "So far", so director notes can say "if flag X". The understudy picks the first outcome whose status matches its own verdict. Validation rejects an outcome that points at an unknown beat or ends the story without an ending.

## The chart

`world.chart` (optional) is the Scribe's chart: the sheet's geography plus a waypoint per beat and a glyph per ending. The web draws it as pure SVG (`src/web/chart.ts`) and lays the road by following each beat's outcomes: the first outcome's `next` is the main road, every other destination is a fork, and a `null` next is a branch to that ending's glyph. A beat with two or more destinations is a fork; its branches and labels are shown when the road arrives there, and the camera frames the scene, the roads out and where they end. Scenes inside one building sit in an inset (a magnified circle); the road leaves an inset at its `exit` and continues from its `anchor`, the place on the sheet it magnifies. Nothing on the chart reaches the director's prompt; it is a player-facing view of the same outcomes and flags. With a `plate`, the sheet is Jon's artwork: the clean plate under the road, the lettered plate above it behind a mask that opens a soft box per region name when the road reaches that region's `reveal` beat; region names without a `box` are lettered by the app instead. Vehicles (`chart.vehicles`, chosen per waypoint by `by`) lay the road: take-off, travel at the head of the line facing the way they go (a second artwork for the other facing, else a mirror), landing. Sizes are designed for a 1200-wide sheet and scale with the plate's width. A waypoint's `routes` pick the way in by the session's flags; `places` and `regions` can be revealed by a beat; `onward` continues the road past the last scene. With `foreknowledge` false (the default) nothing ahead of the road is drawn: no ghost legs, no forks, no future scenes, endings only when fired. A vehicle stays parked where the story is; a leg shorter than twice its width is a hop at its `small` size; when the next leg is by another vehicle, the arriving one lands as the next one rises in its place.
