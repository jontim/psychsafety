# The Shadow Fell

A voice-first story set in the Stormwardens world, in the unshown middle of *Death Came to Dinner*. You speak; a listener reports how you sounded across 48 expression dimensions; the characters react to that reading, not to what you meant.

*Working title, from the Halyran idiom: when a Sayah-class Shadow arrives, the crown's attention has fallen on you.*

## What it is

- **Two acts, seven scenes.** In the Sky Palace, First Caliphina Soraya Anvar and Lt. Navid Qasran question the survivors and hire deniable hands. On the road, the Stormwardens spend six months making the ballad famous across Tharcia and taking the ones who talk.
- **Two stances.** *Reading*: you question someone with authored tells and get words a paladin can swear to. *Being read*: your composure is what they react to.
- **A force layer, simple by design.** Palace scenes never become fights. Tour scenes can. Each Warden carries capabilities and named moves; each armed scene names the capabilities a clean win needs. Full cover means you win and play on; short cover means you choose a strategy from the people you have, aloud or by clicking, and the tone you call it in still counts. Stat blocks sit on each cast member for a later resolution engine.
- **Three voices.** The ear is Hume's Empathic Voice Interface; its own replies are never played (add `?pause=1` to the page address to pause them at Hume's end instead, if transcripts still arrive for you in that mode). The director is Claude, returning a structured turn (line, acting note, meter deltas, shot, beat status). The voices are Hume's Octave with acting instructions per character, falling back to the browser's own voice.
- **Offline first.** Without keys, a mock ear lets you type lines and pick a tone, and an understudy director takes every turn deterministically. The whole loop is playable on a laptop with no accounts.

## Getting it out of the carrier

The project was first pushed inside another repository as a carrier. To lift it into its own repository on a Mac, without needing a clone of the carrier:

```bash
git clone --branch claude/hume-emotion-product-ideas-vix7je --single-branch git@github.com:jontim/psychsafety.git /tmp/shadow-fell-carrier
/tmp/shadow-fell-carrier/shadow-fell/scripts/export-to-local.sh      # creates ~/Projects/shadow-fell as a fresh git repo
/tmp/shadow-fell-carrier/shadow-fell/scripts/sync-to-local.sh        # every time after that: updates ~/Projects/shadow-fell in place, keeps your .env, portraits and clips
rm -rf /tmp/shadow-fell-carrier
```

## Run it locally

```bash
cd ~/Projects/shadow-fell
cp .env.example .env     # add HUME_API_KEY, HUME_SECRET_KEY, ANTHROPIC_API_KEY when you have them
npm install
npm run dev              # web on http://localhost:5173, server on :8787
```

Other scripts: `npm test` (engine and world-pack tests), `npm run typecheck`, `npm run build` then `npm start` (serves the built app from the server on :8787).

Keys never reach the browser. The server mints a short-lived Hume access token per session and proxies Octave and the director.

## Holding the floor

EVI commits a transcript at every natural pause. The app gathers those fragments on "the floor" and only hands the whole speech to the director when your turn ends: after 2, 3 or 5 seconds of silence (your choice, remembered), or only when you press "Done, over to them" or hit Return. A dramatic pause never ends a turn. The merged speech carries a word-weighted blend of how each fragment sounded.

## The Mirror

Before the tour, the roles screen offers the Mirror: a warm-up with the Scribe. He asks for your plain voice, then your best lie, your best support, your best command and your best showman, and says in plain words what a listener hears, with the ribbon live beside each attempt. The plain line becomes a baseline, remembered per browser, and every reading on the tour is shifted away from it (`calibrateAxes` in `src/engine/mirror.ts`), so the room hears what you did on purpose rather than what you always sound like. The band shows `Mirror: calibrated` once a baseline is held; the roles screen lets you retake or forget it.

## Story footage

Besides reaction and establishing clips, the pack declares story clips: an instruction before the Mirror, a bridge for every beat (narrowed to a branch by a flag: the dispatch after a broken cover, the study after a dispatch that said Omahnd, the proclamation after a hedge, the hire after Omahnd's quick or slow denial), and an ending for each outcome that ends the story. Each carries the Scribe's narration and a text-to-video prompt. Until a clip is rendered the interlude shows a title card and the Scribe reads the narration; once `public/clips/<key>.mp4` exists the footage plays under it, and the same file is reused every time that branch is entered. Render them with `npx tsx scripts/render-clips.ts --only story` (about two and a half minutes of video). Every story prompt ends with an explicit silence clause, because a video model given people in frame will invent speech and any lettering in frame renders as gibberish; if a clip still comes out talking, regenerate it with `--force --only <key>`. To bake the Scribe's own voice into the files, run `npx tsx scripts/voice-clips.ts` (Octave through your Hume key, muxed with ffmpeg): it keeps the silent original as `<key>.raw.mp4`, writes a `<key>.voiced` marker, and the interlude then plays the file with sound instead of speaking over it.

## Branches

A beat may carry `documents`, papers on the table the player reads in a parchment panel beside the stage and the director reads in the beat card; the accounting of the attempt is one. A beat may list `outcomes`: named ways it can end. The director picks one as it resolves; each outcome sets flags the later beats can read (director notes say "if flag X") and says where the story goes next, a beat id, the next beat in order, or `null` to end the story with an ending the debrief shows. Act I is built this way from the night of the attack: the windowless room, the dispatch, the Caliph's study and the proclamation, two roads of which end the story before the Stormwardens are ever played.

## The chart

The opening screen is the Scribe's chart: a stylised aviation chart of the continent with the story's road drawn on it, the way an old adventure film draws a red line across a map. Each scene is a waypoint with the player's portrait; the four palace scenes sit in a magnified inset of the Sky Palace, and the road leaves it for the flight north. On the opening screen the road inks itself in scene by scene; pick a waypoint for its boarding card and begin there, or play from the start. Between scenes the chart is the first interlude: the leg to the next scene draws itself (a sky cutter flies the long ones), the portrait and the place appear when it arrives, and where the road forks the branches are shown and the camera pulls back until every road out is in view, the early endings included, each a glyph off the road with what it costs written beside it. When an ending fires, its branch is drawn and the glyph lit before the ending footage plays. During play the Chart pill opens the road so far over the stage.

The artwork is Jon's: `world.chart.plate` names a clean plate of the continent and a lettered plate whose region names are unmasked as the road reaches them (`regions[].box` is a name's area on the lettered plate). The map fills in as the road crosses it: a name with `reveal: "near"` is discovered when the vehicle passes within `reach` of it, in the air or on the ground, whether or not anything happens there, the way a new map fills in as you fly over it; a beat id reveals a name at that scene's arrival, "never" keeps it under the mask, and a name with no `reveal` is lettered from the start. `world.chart.vehicles` are the sprites that lay the road, a skyship for the flight and a carriage for the tour; a vehicle with lettering on it carries a second artwork (`alt`) for the other facing, so it turns by swapping rather than mirroring, and each waypoint says what it is reached `by`. The vehicle springs up at the start of a leg, flies or rolls at the head of the line, and shrinks away to nothing at the end; the next vehicle springs out of the same spot. The road into a waypoint can depend on what the player decided: `via` is the plain way, `routes` are other ways each taken when its flag is set (the flight north goes straight to the Reach, or by way of Omahnd when the dispatch said Omahnd), and the roads not taken show as ghosts at the fork before, with what would take them. Past the last staged scene the road goes on (`onward`) to the last kingdom town before the border, Eronyr, a place revealed late in the tour. `node scripts/chart-boxes.mjs <clean> <lettered>` diffs the two plates and prints candidate label boxes; `npx tsx scripts/chart-letters.ts` then lifts the names off the lettered plate into a transparent layer (`plate.letters`), since two renders of the same map never align pixel for pixel and unmasking the lettered plate itself would show the seams. A name drawn where the clean plate has a mark of its own is lifted whole with `lift: "all"`; a name the road never reaches keeps `reveal: "never"`. The files live under `public/chart/`; until Jon's plates and sprites are dropped there, the app runs on frames cut from his map animation. A world without a plate can draw its own sheet instead (`land` as an SVG path, waters, ranges as chevrons, forests, places), and a world without a chart gets the role cards. `validateWorld` refuses a chart that leaves a beat or an ending unplaced, a vehicle unnamed, or a name revealed by a beat that does not exist. The story's stops follow the route Jon drew; no town on the tour is named.

## How a turn works

1. The ear reports a final utterance: transcript plus 48 prosody scores (`user_message.models.prosody.scores`).
2. The engine folds the scores into an affect state (exponential moving average) and six signed axes: composure, warmth, command, candour, pressure, showmanship. Each scene's meters drift by their axis weights.
3. The director receives the beat card, the counterpart's tells and what they know, the meters, the transcript and the listener's reading, and answers with one spoken line, an acting instruction, meter deltas, a shot and a beat status. On armed scenes it may escalate.
4. Octave speaks the line in the character's voice; the stage shows the reaction; the ribbon shows what a stranger heard in your last line.

## Layout

```
src/engine/      pure TypeScript, no network: dimensions, affect, meters, world schema, clips, force, session
src/worlds/      world packs; shadow-fell is the first
src/canon/       the director's canon brief (in-text canon only; seals carried as prohibitions)
src/server/      Express: token minting, director (Claude or understudy), Octave proxy
src/web/         Vite front end: stage, ribbon, meters, transcript, force chooser, consent gate, ears, voice
public/portraits placeholder portraits (initials on the canon palette); drop film frames here
public/clips     reaction and establishing clips once rendered (see the clip manifest in the world pack)
scripts/         smoke test (headless Chromium) and the export script
```

## Portraits and voices

Portraits were generated through Higgsfield from Jon's saved elements (new faces for the unmasked Indigo, the heckler, the watch captain, the sleeping wizard and the carriage visitor); their URLs are in `art/portraits.json`. Run `npx tsx scripts/fetch-portraits.ts` to download them into `public/portraits/`; the server serves a real still over the placeholder automatically, and the clip renderer uses it as the first frame.

Voices: see `docs/voices.md` for the seventeen Octave voices, their design descriptions and the exact names the pack expects; `scripts/design-voices.ts` auditions and saves them.

The company's runtime: see `docs/runtime.md` for how the Behavioral Canon is compiled into the director (`npm run compile:canon` after editing `src/canon/behavioral-canon.md`), the per-beat slate, the scored intentions the director returns, and the Slate panel (the S key).

The evals: see `docs/eval.md` for the blind attribution test that decides whether the runtime makes the Wardens tell apart (`npm run eval:attribution`) and the steering test that decides whether the gate is causal (`npm run eval:steering`); both take `--dry` without keys.

## Clips

The world pack carries a clip manifest: one reaction clip per counterpart per affect tag (warming, cooling, shock, bored, calculating, pressed, neutral) and one establishing shot per location, each with a render prompt. Render them through Showrunner, drop the files under `public/clips/`, and set each clip's `file` to its public path. Until then the stage shows the counterpart's portrait with an affect-tinted vignette.

## Disclosure

The consent gate before the microphone opens states that an AI system infers expression from the player's voice and that audio is streamed to Hume AI. Keep it: from 2 August 2026 the EU AI Act's Article 50 requires informing people exposed to an emotion recognition system, and the reading is presented as how a stranger would hear you, never as what you feel.

## Canon notes for Jon

- The attaché is **Lt. Navid Qasran**, confirmed by Jon on 17 September 2026.
- The heckler, the watch captain, the sleeping wizard and the carriage visitor are working material for your canon check; the film shows them but does not name them.
- The final town is never named. The carriage visitor's employer is never named. The three seals are prohibitions in the brief and in the world pack.

## Roadmap

- Live faces: a single canonical image per counterpart turned into a live character driven by Octave's audio.
- Bespoke shots, Jon's ruling of 23 September: the game asks the player whether they want video action shots of their play, generated close to real time as a summary of or reaction to how they played. The feature is priced per batch of shots, paid on a tab or with the player's own fal key entered in the app, and every shot generated is kept and grows the library. fal's H3 Max renders them; the verdict, the capture and the reveal are the first shot moments.
- The complex force engine: stat blocks and predefined specialty attacks with a resolution table, replacing the coverage-and-voice resolver.
- More worlds: the courtroom pack as the broad market front door, the spy safehouse third.
- Custom language model endpoint instead of `assistant` pause, once a public tunnel is acceptable.
