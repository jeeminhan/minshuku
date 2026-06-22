# Backlog — minshuku MEXT demo (deadline ~2026-06-25)

Worked top-to-bottom, one contract each. The product thesis every contract serves: *reviews and learning are the same activity — the SRS casts today's episode, playing it is the review.*

## 1. Engine bridge + fixture LLM mode
`web/lib/engine/` server-side bridge importing `runScene`/generator/SRS from `../src/lib` (engine untouched). An `LLMClient` implementation with two modes: live Gemini (key server-side via Next API route only) and `MINSHUKU_FAKE_LLM=1` fixture/replay mode returning recorded dialogue deterministically. Done = an API route returns a generated episode JSON for a demo learner in fixture mode.

## 2. Today's episode generation + story-so-far
Daily episode endpoint: picks due items, generates the scene, weaves a thin story-so-far (persisted summary + day counter fed to the dialogue prompt — continuity the player feels, no plot-state machine). Done = two consecutive "days" produce episodes that reference each other.

## 3. Play-the-scene UI
The core screen: dialogue turns render in order; player turns are free-text input; new/passive words in NPC lines are tappable for furigana+gloss; evaluator grades each player turn inline (outcome ladder: recognized → produced_with_help → produced → mastered). Coach turns (1 and final) styled as teaching beats.

## 4. Debrief + SRS update + return-tomorrow beat
End-of-episode debrief screen: learned (new passives met) / strengthened (dues produced) / due tomorrow. SRS intervals update from aggregated outcomes. Closing beat invites tomorrow's episode.

## 5. Seeded demo learner
A demo profile with realistic SRS history and 3-4 days of story already progressed, so the interview shows "here's day 5 and how it knew what to teach today." Seed script, deterministic, documented in README.

## 6. Polish + responsive pass
民宿 aesthetic applied end to end (existing art/audio assets), 375/768/1440 clean, loading/error/empty states, no console errors.

## 7. Deploy smoke
Vercel deploy, key in env vars, fixture mode togglable for safe public URL. Done = live URL runs the full demo-learner loop.

## 8. Voice & atmosphere layer (approved 6/12)
Three pieces, all fixture-safe: (a) NPC + coach lines spoken — pre-generate audio ONCE locally with the existing TTS pipeline (src/lib/audio/tts.ts, per-template voiceConfig) for the four demo days' fixture dialogue, commit as static assets, play per revealed turn (no runtime API calls, no key on server); (b) per-scene ambience from the existing public/audio/<templateId>.m4a tracks (12 exist; minshuku-arrival-with-mom missing — generate via the music script or reuse a minshuku-* track), user-gesture-gated with a mute toggle; (c) mic input via browser SpeechRecognition (ja-JP) filling the player input — no API, graceful fallback when unsupported.

## 9. Demo storyline tour (approved 6/12)
A guided, presenter-friendly `/story` route that walks all four days as one narrative and EXPLAINS the app — the content/script is authored in DEMO-STORYLINE.md (6 beats: intro → day 1–4 → outro). Each beat = a chapter card with: a scene IMAGE slot (web/public/story/0N-*.webp; tasteful washi placeholders until the user drops in ChatGPT art — same pattern as audio/ambience), the day's story-so-far + episode dialogue with the due target words highlighted, an "under the hood" explanatory callout (what the SRS engine did and why this scene), and the debrief/knowledge change. Navigation: Next/Back + keyboard arrows + a Day 1·2·3·4 progress indicator; gesture-gated, presenter-optimized. Beat 4 plays Mom's voiced line (reuse contract-008 TTS). Beat 5 = the pitch/outro. Pull real per-day data from the existing seeded engine (don't hardcode dialogue — derive from the day fixtures/runEpisode like the play view does). Image slots: explicit dimensions, lazy-loaded, zero layout shift (web perf rules). Content source of truth = DEMO-STORYLINE.md; structure it as a storyline data module the UI renders. Keep the existing interactive /play demo intact — the tour is additive. Criteria: per-beat render + nav + progress + image-slot-with-placeholder-fallback + highlighted-target-words + voiced-beat-4 + responsive 375/768/1440 + console-clean + determinism/regression for the existing flows + gates.

## 10. Tour narration + sound unlock + "how it was built" (approved 6/22)
Make the `/story` tour read aloud and self-explain — it's the panel-facing showcase. Three parts:
(a) **Sound unlock CTA** — a prominent "▶ Begin with sound" control on the intro beat that registers the gesture the browser requires AND flips sound on, so audio reliably plays for the rest of the tour. Must be obvious; current behavior (silent until you happen to click a tiny ▶) is the bug the user hit.
(b) **Auto-narration per beat** — when a day beat (1–4) becomes active AND sound is unlocked, auto-play that day's NPC voice clip (web/public/tts/day{N}-turn2.m4a — verify each exists from contract 008), with a visible "🔊 reading…" indicator while it plays and a manual replay control. Reuse the contract-008 audio components (SoundProvider gesture gate, TtsClip autoOnReveal). Intro/outro/how-built beats have no day clip — they stay silent or use a coach briefing clip if one fits. Only ONE clip plays at a time (advancing beats stops the previous).
(c) **"How this was built" beat** — a new beat (before or as the outro) explaining it's a REAL working prototype, not a mockup: live SRS engine + rule-based grader (101 tests), Gemini-generated dialogue + per-character TTS voices, Lyria music, deployed on Vercel, and that everything you just saw runs on that same engine. Emphasize you can jump into the interactive play demo from here (link/CTA to `/`).
Keep `/` (play view) and the engine untouched except: the play view's FIRST revealed line should also auto-read once after the sound unlock so it isn't dead-silent on load (small, optional — scope if clean, else defer). Criteria: unlock CTA sets gesture+sound and a subsequent beat's audio element attempts play; per-beat correct clip src + single-active-clip + reading indicator; how-built beat content + CTA to `/`; responsive 375/768/1440; console-clean; determinism/regression for existing `/story` beats and `/`; gates. Fixture mode only.

## Season 2 (explicitly NOT for the demo)
- Live two-way voice conversation (Gemini Live native audio — the shaberu direction)
- Knowledge-mirror companion (NPC constrained to player's known vocab — day-poc idea)
- Quick-review widget for due backlogs after lapses
