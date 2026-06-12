# Generator state — contract 008 (Voice & atmosphere layer)

Mode: BUILD. Round 1.

## What changed

### New: generation script
- `web/scripts/gen-fixture-audio.ts` — one-time local TTS generator. Parses the 12 NPC
  lines + 8 coach beats out of the four `web/fixtures/episode-demo-learner*.json` files
  (no hand-copied strings), synthesizes via `synthesizeSpeech` from `@engine/audio/tts`,
  encodes WAV→m4a with ffmpeg (mono AAC 64k). Voice table maps
  `ja-warm-female → Leda` (mom), `ja-friendly-young-adult → Puck` (cafe_regular),
  `ja-soft-ambiguous → Aoede` (stranger), `ja-warm-middle-aged → Charon` (bookshop_owner),
  coach → `Kore`. Loads the repo-root `.env` explicitly (it lives one level up from `web/`).
  **Idempotent/resumable**: skips clips already on disk, and honors 429 `retryDelay` with
  backoff so a rate-limited run resumes cleanly. Run via `npm --prefix web run gen-fixture-audio`.
- `web/package.json` — added `"gen-fixture-audio"` to the `scripts` block only
  (dependencies/devDependencies untouched — verified by `git diff`).

### New: audio components (`web/components/audio/`)
- `SoundProvider.tsx` — context: global sound on/off (localStorage `minshuku:sound`, read via
  `useSyncExternalStore` so storage is the single source of truth; default ON for stable SSR
  hydration), first-gesture gate (`pointerdown`/`keydown`, capture), single-active-clip registry
  (`registerClip`/`notifyPlaying`), and a "stop everything when sound goes off" effect.
- `TtsClip.tsx` — per-line play/pause button (`data-testid="tts-toggle"`, `aria-pressed`,
  `data-state`) owning a lazy `<audio preload="none">`. Starting one pauses the rest.
  Autoplay-on-reveal fires once when `autoOnReveal` + sound on + gestured. Off = manual play no-op.
- `AmbiencePlayer.tsx` — one looping `<audio data-testid="ambience" loop preload="none">`,
  vol 0.25, plays only after a gesture with sound on.
- `SoundToggle.tsx` — header mute control (`data-testid="sound-toggle"`, `aria-pressed`).
- `useSpeechInput.ts` — feature-detected `SpeechRecognition ?? webkitSpeechRecognition`
  (`useSyncExternalStore`, false on server so the button never SSR-renders). `lang: "ja-JP"`,
  final transcript appended to the input draft. Every recognition error returns to idle and
  shows a short `mic-status` message; never throws.

### Edited: episode components
- `episodeData.ts` — added `templateId: z.string()` to the completed-episode `log` schema
  (was being stripped; needed for ambience src `/audio/<templateId>.m4a`). No API change.
- `EpisodePlayer.tsx` — wraps body in `<SoundProvider>`; `<AmbiencePlayer>` + `<SoundToggle>`
  in the header; passes `day` + `autoOnReveal` to NpcTurn/CoachBeat. Autoplay decision is
  derived purely from `submittedCount` (lint-clean — no refs read during render): nothing
  auto-plays on first load; turns after the most-recent submitted player turn auto-play.
- `NpcTurn.tsx` / `CoachBeat.tsx` — each renders a `TtsClip` with the pinned src
  (`/tts/day<N>-turn<M>.m4a`, `/tts/day<N>-{briefing|result}.m4a`).
- `PlayerInput.tsx` — adds the mic button (only when supported) wired to `useSpeechInput`.

### New: assets
- `web/public/audio/` (4 files, byte-copied): `cafe-regular-encounter.m4a`,
  `late-night-walk-stranger.m4a`, `bookshop-quiet-browse.m4a` from repo-root `public/audio/`,
  and `minshuku-arrival-with-mom.m4a` = byte-for-byte copy of `minshuku-evening-talk-about-day.m4a`
  (`cmp` exits 0).
- `web/public/tts/` — **11 of 20 clips** generated (see Known issues).

### Edited: docs
- `README.md` — added a short note on how/when `gen-fixture-audio` runs (once, locally,
  never in CI/runtime/QA).

## Gate results

```
npm run code-check       -> 101 passed (22 files), exit 0
cd web && npm run lint   -> eslint clean, exit 0
cd web && npm run build  -> Compiled successfully, TypeScript OK, 4 routes, exit 0
```

Asset caps: `web/public/tts/` = 1.3 MB (cap 3 MB); `tts` + `audio` = 8.7 MB (cap 12 MB). Both well under.

## Self-verify (production build, port 3020, fresh state, no GEMINI_API_KEY)
- `GET /api/episode` -> `status: completed, day: 1, log.templateId: "cafe-regular-encounter"`.
- Two consecutive GETs byte-identical under standing exclusions (C11) PASS.
- `/tts/day1-turn2.m4a` -> 200, 66276 bytes; `/audio/cafe-regular-encounter.m4a` -> 200, 1.96 MB.
- `/tts/day3-turn2.m4a` -> 404 (not yet generated).
- `git status --porcelain -- src/lib web/app/api web/fixtures web/lib/engine` -> empty PASS.
- `git diff -- web/package.json` -> only the `scripts` block changed PASS.
- Server killed, `web/.data/story-state.json` removed after verify.

## KNOWN ISSUE — 9 of 20 TTS clips not yet generated (free-tier daily quota)

The AI-Studio key works (per your pre-verification) but the **free tier caps
`gemini-3.1-flash-tts` at 10 requests per day** (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`,
`quotaValue: 10`). The first run produced 11 clips before the wall; the resume run with
backoff retried 7x over ~7 min and the limit held — it is a hard daily cap, not a rolling
window (the `retryDelay` field is misleading).

**Present (11):** all of day 1 (`day1-briefing/result/turn2/turn4/turn6`) and all of day 2.
**Missing (9):** `day3-result`, `day3-turn2/4/6`, `day4-briefing`, `day4-result`, `day4-turn2/4/6`.

Per the contract's instruction ("if clips blow the cap, note it but don't fail") and the
daily-quota reality, I stopped rather than burning more budget. **To finish: tomorrow
(or with a paid/higher-quota key) run `npm --prefix web run gen-fixture-audio` once — the
script is resumable and will only synthesize the 9 missing files** (the 11 on disk are skipped).
Total stays well under the 3 MB cap (11 clips = 1.3 MB; 20 should land ~2.3 MB).

### Impact on criteria
- **C1** (exactly 20 files) — currently 11/20, will FAIL until the remaining 9 are generated.
  The script wiring it greps for (fixture refs, `synthesizeSpeech` import, `ja-warm-female -> Leda`,
  coach -> `Kore`, `gen-fixture-audio` npm script) is all present and correct.
- **C2** (ambience) — fully satisfied now (4 files, cmp passes, combined size under cap).
- **C3–C5** (per-turn wiring, play/pause, autoplay) — the QA journey is **day 1** (fresh state),
  and **all day-1 clips exist**, so these are fully testable now.
- **C6** (ambience per-scene incl. day 4) — ambience tracks are byte-copies and all present;
  testable now (no TTS dependency).
- **C7–C10, C12, C13** — no dependency on the missing day-3/4 TTS clips for the day-1 journey.
- **C11** — fully satisfied (verified above).

## Notes for the evaluator
- Standing-exclusions determinism confirmed. `log.templateId` is in the raw route response;
  `jq '.log.templateId'` on day 1 -> `"cafe-regular-encounter"`.
- All `<audio>` are `preload="none"` — no audio bytes fetched before a gesture/play.
- Ambience src maps `log.templateId -> /audio/<templateId>.m4a` with no fallback.
- Mic button is **absent from the DOM** when both `SpeechRecognition` constructors are deleted
  (Branch B); present otherwise (Branch A). Error path lands at idle + `mic-status` message.
- Start command unchanged: `cd web && MINSHUKU_FAKE_LLM=1 npm run dev` (or `npm run start`
  against the production build). QA: no `GEMINI_API_KEY` in the server env.
- No git commit performed.
