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

The attribution eval: see `docs/eval.md` for the blind test that decides whether the runtime and the scored gate make the Wardens tell apart (`npm run eval:attribution`, `--dry` without keys).

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
- Bespoke shots: fal's H3 Max for the verdict, the capture and the reveal, pre-rendered speculatively while the player is still speaking.
- The complex force engine: stat blocks and predefined specialty attacks with a resolution table, replacing the coverage-and-voice resolver.
- More worlds: the courtroom pack as the broad market front door, the spy safehouse third.
- Custom language model endpoint instead of `assistant` pause, once a public tunnel is acceptable.
