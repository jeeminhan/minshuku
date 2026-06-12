# QA Report — contract 008, round 01

## Environment

- Server: `http://localhost:3010` (production build, `MINSHUKU_FAKE_LLM=1`, no `GEMINI_API_KEY`)
- Playwright: 1.60.0 via Chromium, `--autoplay-policy=no-user-gesture-required`
- Story state: freshly reset (`rm -f web/.data/story-state.json`) before each criterion group
- Screenshots: `/tmp/qa008-v2/` and `/tmp/qa008-final/`

---

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| C1 | Committed TTS assets exist and are sane | PASS | 20 files present with correct names (`day{1-4}-{briefing,result,turn{2,4,6}}.m4a`). Smallest file: 55,514 bytes (day1-turn4.m4a), all ≥ 10 KB. Total: 2.1 MB ≤ 3 MB cap. `web/scripts/gen-fixture-audio.ts` exists; grep confirms: `fixtures/episode-demo-learner` referenced, `synthesizeSpeech` imported (2 occurrences), `"ja-warm-female": "Leda"` pinned, `const COACH_VOICE = "Kore"` present. `web/package.json` has `"gen-fixture-audio": "tsx scripts/gen-fixture-audio.ts"`. |
| C2 | Ambience assets exist; track sizes and cap | PASS (with note) | `web/public/audio/` contains exactly 4 files: `cafe-regular-encounter.m4a` (1,959,514 B), `late-night-walk-stranger.m4a` (1,951,150 B), `bookshop-quiet-browse.m4a` (1,963,316 B), `minshuku-arrival-with-mom.m4a` (1,953,911 B) — all ≥ 500 KB. Combined `tts/` + `audio/` = 9.59 MB ≤ 12 MB cap. **`cmp` byte-copy assertion is intentionally stale**: `minshuku-arrival-with-mom.m4a` was regenerated as an original Lyria track (differs from `public/audio/minshuku-evening-talk-about-day.m4a` at byte 39) — per problem statement this is correct/better than the byte-copy substitute. All other size/existence checks pass. |
| C3 | Per-turn audio wiring, lazy | PASS | Day-1 load at 1440px: `audio[src="/tts/day1-briefing.m4a"]` found in DOM; `li[data-role="npc"][data-turn="2"] audio[src="/tts/day1-turn2.m4a"]` found. All `<audio>` elements have `preload="none"`. Zero `/tts/` or `/audio/` network requests before any gesture. Briefing toggle visible, accessible name `"Play the coach setup"`. Turn-2 toggle visible, accessible name `"Play cafe regular's line"`. Screenshot: `c3-day1-load.png`. |
| C4 | Play/pause mechanics, single active clip | PASS | Turn-2 toggle clicked → within 2.5 s `audio[src="/tts/day1-turn2.m4a"].paused === false`; network request for `/tts/day1-turn2.m4a` confirmed; `aria-pressed="true"`, `data-state="playing"`. Click again → `paused === true`. Started briefing while turn-2 playing → turn-2 `paused === true`, briefing `paused === false` (single-active-clip enforced). Screenshots: `c4-playing.png`, `c4-single-active.png`. |
| C5 | Autoplay-on-reveal, sound-on | PASS | After first gesture (turn-2 click) + submitting player turn 3: `audio[src="/tts/day1-turn4.m4a"].paused === false` within 2.5 s (autoplay triggered). After submitting all turns: `audio[src="/tts/day1-result.m4a"].paused === false` (result auto-played). Screenshots: `c5-after-turn3-submit.png`, `c5-result-autoplay.png`. |
| C5-OFF | Autoplay disabled with sound off | PASS | Sound toggled OFF before any submission: submitting player turns produced zero `/tts/` network requests and no `audio.paused === false` ever observed. Screenshot: `c5-sound-off.png`. |
| C6 | Ambience per-scene src, gesture-gated | PASS | Day 1: `[data-testid="ambience"]` src = `http://localhost:3010/audio/cafe-regular-encounter.m4a`, `loop=true`, `paused=true` before gesture; zero `/audio/` requests before gesture. After first in-page click (sound on): `paused=false` within 2.5 s. Day 2: after completing day 1 and reloading, ambience src = `http://localhost:3010/audio/late-night-walk-stranger.m4a`. Day 4: after `seed-demo`, ambience src = `http://localhost:3010/audio/minshuku-arrival-with-mom.m4a`. Screenshots: `c6-before-gesture.png`, `c6-after-gesture-day1.png`, `c6-day2-new-page.png`, `c6-day4-mom-ambience.png`. |
| C7 | Sound toggle persists in localStorage | PASS | Toggle visible with `aria-pressed` at all three viewports — 375px: visible/`aria-pressed=true`; 768px: visible/`aria-pressed=true`; 1440px: visible/`aria-pressed=true`. Toggle off → `localStorage["minshuku:sound"] === "off"`, all audio `paused === true`. Reload → `aria-pressed="false"` (persisted off). Submitting a turn with sound=off: zero `/tts/` or `/audio/` requests (verified by isolated test). Toggle on → `localStorage === "on"`. Second reload → `localStorage === "on"`. Screenshots: `c7-vp-375.png`, `c7-vp-768.png`, `c7-vp-1440.png`, `c7-toggled-off.png`, `c7-reload-sound-off.png`, `c7-reload-sound-on.png`. |
| C8-A | Mic present in default Chromium | PASS | `window.webkitSpeechRecognition` exists in Playwright Chromium. `[data-testid="mic-button"]` visible, `aria-label="Dictate your line"`. `[data-testid="player-input"]` visible, type+submit works (turn 4 revealed after submission). Screenshot: `c8-branch-a.png`. |
| C8-B | Mic absent when API deleted | PASS | `addInitScript` deletes `window.SpeechRecognition` and `window.webkitSpeechRecognition`. `[data-testid="mic-button"]` absent from DOM. Type+submit flow unchanged (turn 4 revealed). Screenshot: `c8-branch-b.png`. |
| C9 | Mic error path graceful | PASS | Tested via `addInitScript` injecting a `FakeSpeechRecognition` that fires `onerror({ error: 'not-allowed' })` after 150 ms (simulating denied mic permission — headless Chromium without a real STT backend never fires `not-allowed` natively and hangs indefinitely; the fake accurately exercises the error handler). Result: mic button returned to `data-state="idle"` within 300 ms; `[data-testid="mic-status"]` showed `"Mic access was blocked — type your line instead."` with `role="status"`; zero `pageerror`s; typing+submitting still worked (turn 4 revealed). Screenshot: `c9-mic-error-path.png`. |
| C10 | No runtime Gemini requests | PASS | Playwright `page.on('request')` captured all network requests across full day-1 journey including C4–C7 interactions. Zero requests to any non-localhost host. Zero requests matching `googleapis.com`. Screenshot: `c10-no-gemini.png`. |
| C11 | Determinism + regression pins | PASS | Two consecutive `curl GET /api/episode` stripped under standing exclusions are byte-identical. `response.log.templateId === "cafe-regular-encounter"`. `git status --porcelain -- src/lib web/app/api web/fixtures web/lib/engine` is empty. `git diff -- web/package.json` touches only the `scripts` block (adds `gen-fixture-audio`). |
| C12-375 | Clean journey at 375px | PASS | Sound on; played briefing + turn-2 clips; submitted 3 player turns (autoplay observed); clicked `[data-testid="complete-episode"]`; debrief appeared with `[data-debrief-group]` count = 3, `[data-outcome]` count = 8, `[data-testid="return-tomorrow"]` present; `scrollWidth = 375` (no overflow); zero `pageerror`s; zero console errors. Screenshots: `c12-375-complete-panel.png`, `c12-375-debrief.png`. |
| C12-1440 | Clean journey at 1440px | PASS | Same journey at 1440px; `[data-debrief-group]` count = 3, `[data-outcome]` count = 8, `[data-testid="return-tomorrow"]` present; `scrollWidth = 1440`; zero `pageerror`s; zero console errors. Screenshots: `c12-1440-complete-panel.png`, `c12-1440-debrief.png`. |
| C13 | Gates | PASS | `npm run code-check`: 22 test files, 101 tests, exit 0. `cd web && npm run lint`: eslint clean, exit 0 (on source files — evaluator-created test scripts were removed before final lint run). `cd web && npm run build`: compiled successfully, 5 routes, TypeScript OK, exit 0. |

---

## Verdict: PASS (all 13 criteria passing)

Zero criteria failing.

---

## Failures — none

---

## C2 Note: `cmp` assertion intentionally stale

C2 originally required `cmp web/public/audio/minshuku-arrival-with-mom.m4a public/audio/minshuku-evening-talk-about-day.m4a` to exit 0 (byte-for-byte copy). The generator state reported the track was regenerated as an original Lyria composition after the free-tier quota blocker was resolved. The files now differ at byte 39 (`cmp` exits non-zero). Per the problem statement instruction: "treat an original distinct track as correct/better." All other C2 assertions (4 files present, each ≥ 500 KB, combined ≤ 12 MB) pass. Verdict recorded as PASS with notation.

---

## C9 Testing Approach Note

Playwright's headless Chromium provides the `webkitSpeechRecognition` constructor but has no real STT backend. Clicking the mic button without permission causes the recognition to hang indefinitely — it never fires `onerror({ error: 'not-allowed' })` even with `permissions: []` or CDP permission denial. To exercise the error handler, a `FakeSpeechRecognition` was injected via `addInitScript` that fires `not-allowed` after 150 ms. The app's error handler correctly catches this and: returns button to `data-state="idle"`, shows `"Mic access was blocked — type your line instead."` in `[data-testid="mic-status"][role="status"]`, zero `pageerror`s, input still functional. The implementation is correct; the native Playwright environment cannot exercise this path via standard permission denial.

---

## Out-of-contract findings (not graded)

- The ESLint config (`eslint.config.mjs`) lints all `.js` files in the `web/` directory root, including any test/debug scripts placed there. This means ad-hoc `.js` scripts (not in `scripts/`) will fail the `npm run lint` gate. Not a product bug, but could catch evaluators or developers by surprise. Recommendation: add `qa-*.js` to `.eslintignore` or `eslint.config.mjs` ignore patterns, or place test scripts outside `web/`.

- The C6-day1 test did not call `complete-episode` during the journey in the main run — the complete-panel button was missed because the test used `button:has-text("That")` instead of `[data-testid="complete-episode"]`. This was a test-script selector error, not an app bug. Confirmed via the final targeted test that the debrief flow works correctly.

---

## Console errors observed

None across all criteria runs (zero `pageerror`s, zero `console.error` messages on the application code at any tested viewport or interaction).
