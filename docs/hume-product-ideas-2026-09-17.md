# Hume emotion products: options memo (17 Sep 2026)

Working notes for Jon. Purpose: find a commercially viable, genuinely new product that uses the Hume subscription's emotion capability, built in this burner repo (not the NLI product).

## 1. What Hume can actually do today (verified Sep 2026)

- **The standalone Expression Measurement API is gone.** Hume sunset it on 15 June 2026; SDK 0.16.0 (17 June 2026) removed the `expressionMeasurement` namespace. No more batch face/video/voice/text analysis of uploaded media, and no webcam face model.
- **Emotion reading now lives inside EVI (Empathic Voice Interface).** Every user utterance in a live EVI session returns `models.prosody.scores`: 48 expression dimensions (admiration, adoration, aesthetic appreciation, amusement, anger, anxiety, awe, awkwardness, boredom, calmness, concentration, confusion, contemplation, contempt, contentment, craving, desire, determination, disappointment, disgust, distress, doubt, ecstasy, embarrassment, empathic pain, entrancement, envy, excitement, fear, guilt, horror, interest, joy, love, nostalgia, pain, pride, realization, relief, romance, sadness, satisfaction, shame, surprise negative, surprise positive, sympathy, tiredness, triumph).
- **Implication:** the product must be live, voice-conversation shaped. Prosody only (how something is said), not face, not recorded uploads.
- **Other EVI capabilities:** configs with system prompts, supplemental LLMs (Claude Opus 4.6 listed Feb 2026), custom language model (CLM) endpoint so our own server drives the dialogue, tool calling, turn-detection and interruption settings (Apr 2026), 100K+ designed voices, Octave 2 TTS with acting instructions, 11 languages, sub-second latency.
- **Pricing (third-party sources; official billing page blocked from this sandbox):** plans from $3/mo (Starter) to $500/mo (Business); EVI roughly $0.07/min (Starter) down to $0.04/min (Business). Voice minutes are the dominant COGS.
- **Company risk:** Jan 2026 Google DeepMind licensed Hume's emotion models and hired CEO Alan Cowen plus ~7 engineers. Hume continues under CEO Andrew Ettinger, projecting ~$100M 2026 revenue. Expression Measurement was sunset five months after the deal. Treat Hume as a swappable sensor, not a foundation.

## 2. Regulatory guardrails that shape the product

- **EU AI Act Art. 5(1)(f):** inferring emotions from biometric data (voice counts) in *workplace* and *education institutions* is prohibited (in force since 2 Feb 2025; fines up to EUR 35M or 7% turnover). Exceptions only for medical or safety reasons. So: no employer-deployed training, no school deployment in the EU.
- **Article 50(3) transparency:** since 2 Aug 2026, anyone deploying an emotion recognition system must inform the people exposed to it. Not delayed by the Digital Omnibus. Consumer products need a clear disclosure.
- **Annex III high-risk:** emotion recognition systems are listed as high-risk; those obligations were deferred to 2 Dec 2027 by Regulation (EU) 2026/1744. Plan a geo strategy (US/UK/AU first) and an EU compliance path before then.
- **US:** Illinois BIPA voiceprint class actions are trending (May 2026). Prosody scores are not identity voiceprints, but get explicit consent for voice capture, keep audio retention minimal, and handle children under COPPA.
- **Science honesty:** Hume prosody scores measure *perceived vocal expression*, not inner feeling. Never build lie detection or "true feelings" claims. Build around "how you come across", which is honest and is the whole point of persuasion, performance and play.

## 3. Holes and biases to watch in the framing

1. **Sunk cost.** "I pay monthly, so let's use it" is not a product reason. If the product is good, the Hume bill becomes COGS. If not, cancel the plan.
2. **Tool-first ideation.** Starting from a capability invites a solution looking for a problem. Anchor on a market with proven willingness to pay and a mechanic that is *only* possible with prosody.
3. **Workplace gravity.** Instinct pulls toward L&D and coaching. That is the banned zone in the EU. Consumer, entertainment and self-purchased learning are the open lanes.
4. **Voice COGS.** A 20-minute session costs ~$1.00 to 1.40 in EVI minutes before LLM and TTS. Design for short, replayable rounds, or premium pricing.
5. **Vendor lock.** Put prosody behind an adapter interface so the sensor can be swapped (Gemini audio understanding, audEERING, open-source SER models).
6. **Hit-driven games.** A small team should aim for a niche wedge with a content engine (LLM-generated cases/cards) and a streamer-friendly loop, not a broad title.

## 4. Options (dare to dream first)

### Option A: "Silver Tongue" (working title): a voice-first courtroom drama where the jury hears *how* you say it
- You are counsel. Witnesses are EVI characters voiced by Octave with authored acting instructions (nervous, evasive, grieving, defiant). You cross-examine by speaking.
- Two prosody mechanics: (1) the **jury meter** responds to your delivery (calmness and determination build credibility; contempt, anxiety and doubt erode it; warmth matters with sympathetic witnesses); (2) **authored witness tells**: because we script the witness's emotional state, the tells are game design, not fake lie detection.
- Content engine: LLM-generated cases with evidence graphs and contradictions; weekly docket; difficulty tiers.
- Aesthetic: noir courtroom, radio-drama sound design, a jury gallery of illustrated faces whose expressions shift with your prosody, a waveform ribbon tinted by your dominant expressions.
- Comparables: Ace Attorney (14M copies sold); Steam LLM interrogation games (Verbal Verdict, Detective Bureau, AI Interrogation Simulator) prove appetite. None uses the *player's* prosody as a mechanic.
- Model: Steam premium ($15 to 20) plus case packs, or web/mobile subscription with credits. Short sessions (8 to 12 min per witness) keep voice COGS sane.
- Regulatory: consumer entertainment sits outside Art. 5(1)(f). Add Article 50 disclosure. Do not market as "advocacy training" to EU institutions.
- Learning thesis: stealth practice of composure and persuasion under pressure. A US bar-prep or law-school licence is a later lane.

### Option B: "Say It Like You Mean It": the emotion charades party game with an AI ear
- Cards give a line plus a secret expression drawn from Hume's 48 (nostalgia, awkwardness, contempt, triumph, aesthetic appreciation). You perform; friends guess; the AI host scores from the prosody vector. Modes: duel, impossible blends ("70% awe, 30% disgust"), deadpan (score is flatness).
- Aesthetic: living-room screen plus phones, a charming Octave-voiced host, an animated bloom that visualises the 48 dimensions.
- Why it wins: rounds are seconds long (cheap), clips are shareable, streamers love it. Existing "Voice Charades" apps only have friends guessing; none scores expression with an AI ear.
- Model: $4.99 to 9.99 packs or subscription. Fastest to build (about two weeks to a playable) and it is the same engine Option A needs.

### Option C: "Once Upon a Voice": expressive read-aloud storybooks where the pictures respond to how you read
- Kids 6 to 10 read aloud; the dragon's line read angrily makes the dragon roar. Prosody is a formal pillar of reading fluency (accuracy, rate, prosody), so the pedagogy is real.
- Risks: crowded (Google Read Along, Storytime AI already scores prosody, Vooks), children's voice data (COPPA, GDPR-K), EU school deployment banned, long sessions burn minutes. Home/consumer only.

### Option D: "Open Mic": a private stage for the speech you are dreading
- Best-man toast, eulogy, TED-style talk, first stand-up set. An Octave-voiced audience reacts live to your prosody; a replay shows where you lost the room; a coach character debriefs.
- Comparables: Yoodli, Orai, Poised measure pace and fillers, not expressive dimensions, and none has a live-reacting audience. Consumer self-purchase only; no employer sales in the EU.

### The "jurist" ambiguity
- If "jurist" meant a judge/jury product: Option A absorbs it, and a lighter "AI juror" that judges pitches, jokes or stories by its emotional reaction is a possible mini-mode.
- If it was "journal" (voice diary tracking expressive tone over time): crowded wellbeing market, medical-adjacent, and longitudinal analysis is exactly what Hume just retired. Not recommended.

## 5. Recommendation
Build Option A as the product, with Option B's engine as the first playable milestone (EVI session, prosody stream, 48-dim visualiser, LLM judge, Octave host). Ship US/UK first. Put the prosody sensor behind an adapter.

## 6. Architecture sketch for this repo
- Firebase Hosting for the front end (strip NLI branding and ElevenLabs code).
- Cloud Functions (bump Node 18 to 20+): mint EVI access tokens; CLM endpoint (SSE) using Claude for character brains and game state; scoring endpoint; Firestore for cases, rounds and leaderboards.
- Browser: Hume JS SDK over WebSocket; consume `user_message.models.prosody.scores`; render the jury meter or bloom; Octave voices for characters.
- Disclosure and consent screen before the mic opens; minimal audio retention.

## Sources
- Hume TS SDK releases (0.16.0 removed Expression Measurement after 15 Jun 2026 sunset): https://github.com/HumeAI/hume-typescript-sdk/releases
- EVI types (Inference.prosody, 48 EmotionScores): https://github.com/HumeAI/hume-typescript-sdk/tree/main/src/api/resources/empathicVoice/types
- audEERING on the sunset: https://www.audeering.com/after-humes-expression-measurement-api-what-matters/
- Imentiv on the sunset: https://imentiv.ai/blog/replacing-hume-ais-expression-measurement-api-heres-what-imentiv-ai-offers/
- TechCrunch on DeepMind and Hume (Jan 2026): https://techcrunch.com/2026/01/22/google-reportedly-snags-up-team-behind-ai-voice-startup-hume-ai
- PYMNTS on Hume leadership change: https://www.pymnts.com/news/artificial-intelligence/2026/google-recruits-hume-ceo-alan-cowen-bolster-voice-ai-efforts/
- Pricing summaries: https://affinco.com/hume-ai-pricing/ and https://www.aipedia.wiki/guides/hume-ai-pricing-for-emotion-aware-voice-apps/
- FPF on Art. 5(1)(f): https://fpf.org/blog/red-lines-under-eu-ai-act-unpacking-the-prohibition-of-emotion-recognition-in-the-workplace-and-education-institutions/
- Article 50 from 2 Aug 2026: https://www.aiactblog.nl/en/posts/emotion-recognition-biometrics-transparency-ai-act-2026
- Digital Omnibus deferral to Dec 2027: https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/ and https://www.joneswalker.com/en/insights/blogs/ai-law-blog/yes-august-2-still-matters-the-eu-approved-a-high-risk-ai-delay-but-most-trans.html
- BIPA voiceprint trend: https://www.americanbar.org/groups/litigation/resources/newsletters/class-actions-derivative-suits/voiceprints-ai-bipa-new-trends-biometric-privacy-litigation/
- Ace Attorney sales: https://www.kitguru.net/tech-news/mustafa-mahmoud/ace-attorney-franchise-finally-surpasses-10-million-copies-sold/
- LLM interrogation games: https://store.steampowered.com/app/3716000 and https://steamcommunity.com/app/2778780
- Voice Charades (friends-guess only): https://play.google.com/store/apps/details?id=com.redif.actparty
- Storytime AI (scores prosody): https://www.storytimeaiapp.com/
