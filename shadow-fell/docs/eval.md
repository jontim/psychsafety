# Blind Character Attribution: does the runtime make the Wardens tell apart?

Behavioral Canon v1.4 §20 now marks the scored intention gate VALIDATED PRELIMINARILY: in the first live steering evaluation, alternate +1/+2 moves produced distinct enacted tactics while preserving speaker voice in four of four judged pairs, a sample too small to generalise from, so the gate stays pending a larger run. It had been marked unvalidated, and the test that changed that was built to kill it. The success criterion is not "the model followed the schema". It is: without the name, can you tell who just did that?

## What the eval does

Six outsiders meet every Warden alone, each with three scripted lines and a tone from the mock ear. Two are the §19 poles: the charming visitor with an unnamed employer (mixed, low confidence) and the brusque watch captain (authority, high confidence). Four exist only for the eval and are built to collide pairs the bare card cannot easily tell apart: a frightened farrier asking for moral counsel (Serena against Thorbin), a smooth factor with a partly false story (Tavian against Varya), a hill farmer reporting an anomaly (Lyra against Kael), and a frightened runaway (Thorbin against Brask); the captain collides Serena with Varya. Every Warden answers every line as a one-turn scene, under three conditions:

- **A**: cast card and dossier, as the game ran before the runtime.
- **B**: A plus the relationship, outsider and fallback runtime.
- **C**: B plus the scored intention gate.

The rendered lines, and in C the highest-scored intention, lose every name, dialogue tag and character-specific noun (Warden names and their parts, the sigils: Souldrinker, Piss and Moan, Dawnseeker, Morrighad, Tyr, the Cadence). An independent judge, a separate model with only the seven execution cards, answers four questions per item: who said it by voice alone; who would do it by behaviour alone; could it be reassigned to another Warden by changing only the name, and to whom; and does it break a rule in a way worth a −2. Items are shuffled so order is no clue.

## What it measures

Per condition: voice attribution, behavioural attribution, move attribution (C only), swap resistance, judge-flagged violations, rendered lines that match one of the document's wrong lines, style slips (lines that break a Warden's language rail; today Brask's), care openers (lines that open on the shared practical-care reflex of sit, eat and you have walked, the family resemblance becoming one voice, which the shared-care de-duplication guardrail now addresses), and prose leaks (lines the director rendered with quotation marks or stage directions; the speech is repaired before judging and the narration moved to the tell). Turns where the director spoke as someone other than the Warden are counted and excluded. Turns the live director did not take (a refusal or an error, so the understudy answered) are counted as fallbacks, excluded from every rate, and listed with the director's note at the end of the report; a condition with no live turns gets no verdict. The judge answers by item number, and answers that match no item are counted as unjudged.

Per-Warden rates are accuracies within that Warden's own judged lines. Collision scenarios report voice accuracy on the pair's own lines and how often one was taken for the other, and a confusion list says who was taken for whom.

The verdict says what the data says and no more. A condition that did not run is called invalid and the gate stays unvalidated, not disproven. Dimensions at ceiling in both conditions are named as such rather than counted as ties, so a runtime that only moves swap resistance is credited for it. Fewer than twenty judged lines is called preliminary. Between B and C the verdict never kills the gate on its own: that is the steering test's job.

## The steering test

`npm run eval:steering` decides whether the gate is causal rather than decorative. For each Warden and stimulus the gated director runs once to fill the slate; the two best distinct moves at +1 or better are then forced one at a time through the request's steering field, and a line is rendered from each. A judge, given the character, the stimulus, the two moves and the two lines, says whether the lines do materially different things, whether each enacts its move, and whether both still sound like the Warden. A pair that passes all three is causal. Word-for-word identical lines are counted before the judge sees them. When the slate offers only one move at +1 or better, the harness does not manufacture a second: plurality is optional and specificity is mandatory, so that stimulus is recorded as converged, one overwhelmingly canonical response, and reported per Warden as character data. A Warden with a broad repertoire in a situation gives the director latitude; one with strong value convergence is predictable. Judgements are checkpointed after every scenario. Jon's rule: if the lines come out effectively identical the slate is decorative and the gate goes; if the difference is obvious while both still sound like the Warden, the director has a steering surface. Sixty percent causal keeps it; under thirty percent distinct kills it; between, read the examples. Flags match the attribution eval; the default is one stimulus per scenario, so a full run is 42 slates and 84 steered lines.

## Running it

```
npm run eval:attribution                       # all three conditions, seven Wardens, two scenarios, three lines each
npm run eval:attribution -- --conditions B,C --wardens serena,thorbin --stimuli 1   # a small run
npm run eval:attribution -- --dry              # understudy and a stand-in judge; exercises the plumbing
```

Flags: `--conditions`, `--wardens`, `--scenarios`, `--stimuli`, `--model` (the director; default `DIRECTOR_MODEL` or claude-opus-5), `--judge` (default `JUDGE_MODEL` or claude-sonnet-5), `--out`, and `--resume <dir>`, which re-judges a saved `samples.json` without generating again: every director turn is written as it lands, so a judge failure never costs the generation. The judge works in batches of eight items with room to think, writes its judgements after every batch, and a batch that comes back without an answer leaves its items unjudged rather than ending the run; a resumed run judges only what is missing. Without `ANTHROPIC_API_KEY` the run is dry. A full run at three stimuli is 378 director calls and 18 judge calls; at one stimulus, 126 and 18. The system prompt is cached per condition.

Output goes to `eval/attribution-<stamp>/`: `samples.json` (every line with its intention), `judgements.json`, and `report.md` with the table, the verdict, per-Warden accuracy and the stripped examples as the judge saw them. The `eval/` directory is not committed; keep reports you want by copying them.

## The first live run

The first run, two Wardens and one line each, produced a refusal on every gated turn: the director answered condition C with a refusal stop reason, the understudy filled in, and the C column was the understudy's canned lines. The report now names that outright instead of scoring it. The likely cause is the slate being read as a request to expose the model's own reasoning (the API has a refusal category for exactly that), so the slate is now framed as the scene's paperwork, candidate moves for the character rather than intentions the model considered, and the director's note carries the refusal category so the next run says which it was. The same run showed condition B rendering Brask in prose with quotation marks and stage directions; the speech-only rule and repair came from that.

## Reading a report

Per-Warden voice accuracy shows who is indistinguishable: a Warden the judge never recognises has a voice problem, a Warden recognised by voice but not behaviour has lines that sound right and choose wrong. The wrong-line count is a hard floor: any hit is a −2 the gate should have caught. The stripped examples are worth reading before the numbers; a judge can be fooled by a stock phrase in either direction.

## What it does not do yet

It does not test ensemble scenes, where a Warden's line is shaped by who else is present. A second pass with two Wardens in the room, judging both lines, would test the directed pairs directly. It does not vary the judge; a second judge model would show how much of the score is the judge's taste.
