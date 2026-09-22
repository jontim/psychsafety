# Blind Character Attribution: does the runtime make the Wardens tell apart?

Behavioral Canon v1.4 §20 marks the scored intention gate UNVALIDATED IN LIVE GENERATION. The understudy filling the slate proves the pipeline works, not that the slate constrains generation; the director could produce beautifully canonical intentions and then render generic fantasy ensemble dialogue. The success criterion is not "the model followed the schema". It is: without the name, can you tell who just did that?

## What the eval does

Two outsiders meet every Warden alone: the charming visitor with an unnamed employer (mixed, low confidence: the interesting classification case) and the brusque watch captain (authority, high confidence: the easy pole). Each outsider has three scripted lines with a tone from the mock ear. Every Warden answers every line as a one-turn scene, under three conditions:

- **A**: cast card and dossier, as the game ran before the runtime.
- **B**: A plus the relationship, outsider and fallback runtime.
- **C**: B plus the scored intention gate.

The rendered lines, and in C the highest-scored intention, lose every name, dialogue tag and character-specific noun (Warden names and their parts, the sigils: Souldrinker, Piss and Moan, Dawnseeker, Morrighad, Tyr, the Cadence). An independent judge, a separate model with only the seven execution cards, answers four questions per item: who said it by voice alone; who would do it by behaviour alone; could it be reassigned to another Warden by changing only the name, and to whom; and does it break a rule in a way worth a −2. Items are shuffled so order is no clue.

## What it measures

Per condition: voice attribution, behavioural attribution, intention attribution (C only), swap resistance, judge-flagged violations, rendered lines that match one of the document's wrong lines, and prose leaks (lines the director rendered with quotation marks or stage directions; the speech is repaired before judging and the narration moved to the tell). Turns where the director spoke as someone other than the Warden are counted and excluded. Turns the live director did not take (a refusal or an error, so the understudy answered) are counted as fallbacks, excluded from every rate, and listed with the director's note at the end of the report; a condition with no live turns gets no verdict. The judge answers by item number, and answers that match no item are counted as unjudged.

The verdict follows §20. If C does not beat B on voice, behaviour, swap resistance and violations, the gate is ornament and should be killed. If C attributes intentions better than lines, the problem sits between intention selection and surface realisation, and the chosen intention needs stronger rendering constraints rather than more lore. A B that fails to beat A says the runtime is not earning its tokens.

## Running it

```
npm run eval:attribution                       # all three conditions, seven Wardens, two scenarios, three lines each
npm run eval:attribution -- --conditions B,C --wardens serena,thorbin --stimuli 1   # a small run
npm run eval:attribution -- --dry              # understudy and a stand-in judge; exercises the plumbing
```

Flags: `--conditions`, `--wardens`, `--scenarios`, `--stimuli`, `--model` (the director; default `DIRECTOR_MODEL` or claude-opus-5), `--judge` (default `JUDGE_MODEL` or claude-sonnet-5), `--out`. Without `ANTHROPIC_API_KEY` the run is dry. The full run is 126 director calls and six judge calls; the system prompt is cached per condition.

Output goes to `eval/attribution-<stamp>/`: `samples.json` (every line with its intention), `judgements.json`, and `report.md` with the table, the verdict, per-Warden accuracy and the stripped examples as the judge saw them. The `eval/` directory is not committed; keep reports you want by copying them.

## The first live run

The first run, two Wardens and one line each, produced a refusal on every gated turn: the director answered condition C with a refusal stop reason, the understudy filled in, and the C column was the understudy's canned lines. The report now names that outright instead of scoring it. The likely cause is the slate being read as a request to expose the model's own reasoning (the API has a refusal category for exactly that), so the slate is now framed as the scene's paperwork, candidate moves for the character rather than intentions the model considered, and the director's note carries the refusal category so the next run says which it was. The same run showed condition B rendering Brask in prose with quotation marks and stage directions; the speech-only rule and repair came from that.

## Reading a report

Per-Warden voice accuracy shows who is indistinguishable: a Warden the judge never recognises has a voice problem, a Warden recognised by voice but not behaviour has lines that sound right and choose wrong. The wrong-line count is a hard floor: any hit is a −2 the gate should have caught. The stripped examples are worth reading before the numbers; a judge can be fooled by a stock phrase in either direction.

## What it does not do yet

It does not test ensemble scenes, where a Warden's line is shaped by who else is present. A second pass with two Wardens in the room, judging both lines, would test the directed pairs directly. It does not vary the judge; a second judge model would show how much of the score is the judge's taste.
