# QA Report — contract 009, round 01

Server: http://localhost:3010 (fixture mode, MINSHUKU_FAKE_LLM=1, no GEMINI_API_KEY)
Playwright: throwaway install at /tmp/pw-qa (chromium)
State: story freshly reset; web/public/story/ contains only README.md (zero .webp files)

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| C1 | Storyline module encodes 6 beats | PASS | `web/lib/demo/storyline.ts` exists; all 6 image-slot basenames present (`00-minshuku-dusk` through `05-ladder`); all 6 highlight surfaces (`つもり`/`窓`/`雨`/`不思議`/`てもいい`/`持つ`) present; day beats have non-empty narrative + callout arrays; no NPC dialogue hardcoded; `storyTour.ts` imports and calls both `runEpisode` and `completeEpisode`. `web/public/story/` holds only README.md (zero .webp). |
| C2 | Tour renders 6 navigable beats; `/story` loads clean | PASS | HTTP 200, no pageerror on load; exactly 1 `[data-testid="tour-beat"]` visible at a time; stepping Next 0→5 advances through all 6 beats; Day-1 beat text contains café-scene content; Day-4 beat text mentions Mom/民宿; zero non-localhost requests across full walkthrough. |
| C3 | Next/Back + arrow keys change beat | PASS | Click `tour-next` → beat content changes from beat-0 to beat-1 (text differs); `ArrowRight` → advances to beat-2 (text differs again); `ArrowLeft` → returns to beat-1 text; click `tour-back` → returns to beat-0 text. At beat-0 the Back button is `disabled`. At beat-5 the Next button is `disabled`. |
| C4 | Progress indicator reflects state across all six | PASS | `[data-testid="tour-progress"]` present and visible; contains exactly 6 pip buttons labelled Intro · Day 1 · Day 2 · Day 3 · Day 4 · Outro; at each beat 0–5 exactly one pip has `data-active="true"` (verified per-step); each pip is a clickable button with `aria-label="Go to <label>"`; active pip advances as Next/Back are pressed. |
| C5 | Scene image: explicit dimensions, lazy, placeholder visible with zero files | PASS | `[data-testid="scene-image"]` present on every beat 0–4; bounding box 780×438.75px (non-zero, 16:9); `[data-testid="scene-placeholder"]` visible (778×437px, washi-toned 民宿 palette); no `<img>` element rendered (placeholder-only mode — no real art exists); zero `/story/*.webp` network requests across full tour; height diff between beat-1 and beat-3 image slots: 0.00006px (effectively zero — no layout shift). |
| C6 | Highlighted target words present per beat, anchored to real items | PASS | Day-1: `[data-tour-highlight]` elements with `data-item-id="grammar.tsumori"` (×2, text "つもり") and `data-item-id="vocab.mado"` (×1, text "窓") — no other item IDs; callout and knowledge panels non-empty. Day-2: `data-item-id="vocab.ame"` (×2, text "雨"). Day-3: `data-item-id="vocab.fushigi"` (×1, text "不思議"). Day-4: `data-item-id="grammar.temo-ii"` (text "てもいい") + `data-item-id="vocab.motsu"` (text "持つ"); `vocab.yakusoku` absent. Highlights span both NPC and player turns (per generator's documented judgment call; accepted per orchestrator note — active targets surface in learner turns, passive `持つ` in Mom's NPC line; all data-item-ids correct and sentence text unaltered). |
| C7 | Beat 4 plays Mom's voiced line | PASS | On Day-4 beat: `<audio src="/tts/day4-turn2.m4a" preload="none">` present; zero `/tts/*` requests before any gesture; `[data-testid="sound-toggle"]` present; visible play button `title="Play Mom's welcome at the door"` with text "▶ Play Mom's welcome at the door" (non-empty accessible name); with sound toggled off and play clicked, `audio.paused === true` (sound-off gate works — contract-008 SoundProvider semantics reused). |
| C8 | Responsive 375 / 768 / 1440, no horizontal overflow | PASS | At all three viewports across all 6 beats: `document.documentElement.scrollWidth - window.innerWidth <= 1` (zero overflow detected); `[data-testid="tour-progress"]` visible at all viewports including 375; `[data-testid="tour-beat"]` bounding-box right edge within viewport at all sizes. Progress pips wrap to two rows at 375 (Intro·Day1·Day2·Day3 on row 1, Day4·Outro on row 2) — both rows visible with no clipping. |
| C9 | Console-clean across full tour | PASS | Full walk 0→5 + beat-4 sound-toggle interaction at 1440×900: zero `pageerror` events; zero `console.error` messages; zero HTTP ≥400 responses; zero requests to any non-localhost host (in particular no `googleapis.com`). |
| C10 | Determinism: derived data stable | PASS | Two consecutive `page.goto("/story")` loads: Day-1 through Day-4 beat text content byte-identical across both runs. Day-4 highlights stable at `[grammar.temo-ii, vocab.motsu]` across a third independent load, confirming fixture-derived seeded-progression episode (not day-1 data). |
| C-REG | Interactive play view at `/` unchanged | PASS | `git status --porcelain` shows NO modifications to `web/app/page.tsx`, `web/components/episode/`, `web/components/audio/`, `web/app/api/`, `web/fixtures/`, `web/lib/engine/runEpisode.ts`, `web/lib/engine/fixtureClient.ts`, `web/lib/engine/demoLearner.ts`, `web/lib/engine/lessonBatch.ts`, or `src/lib/`. `web/lib/engine/storyStore.ts` has zero diff deletions (unmodified). `InMemoryStoryStore` lives in `storyTour.ts`, not storyStore.ts. `seed-demo` script exists (`tsx scripts/seed-demo.ts`). `/api/episode` returns `status: "completed", day: 1` confirming play view still works. `story-state.json` absent from git diff (tour never wrote it). |
| C-GATE | Gates pass | PASS | `npm run code-check` (repo root): 22 test files, 101/101 tests passed. `cd web && npm run lint`: clean (no output). `cd web && npm run build`: compiled successfully; `/story` listed as `ƒ (Dynamic)` server-rendered route. |

## Verdict: PASS (all 12 criteria)

## Failures

None.

## Out-of-contract findings (not graded)

- Progress pips at 375px wrap to two rows rather than scrolling horizontally. Both rows are visible and functional; this is a reasonable responsive layout decision, not an overflow issue. Worth noting for the live demo in case the presenter's screen is narrower than expected.
- The Day-4 beat screenshot shows `持つ` highlighted in a MOM-turn line ("誰か若い人が**持つ**ことに…") and `てもいい` in a YOU-turn line ("入ってもいいですか"). This is the generator's documented judgment call (active items surface in learner turns; only the passive `vocab.motsu` surfaces in Mom's NPC line). The criterion C6 is satisfied because each `[data-tour-highlight]` carries the correct `data-item-id` with matching visible JA text.
- Beat-5 (Outro) renders an in-app knowledge-ladder list instead of a `SceneImage`; this is explicitly permitted by the contract ("or a simple in-app knowledge-ladder list — generator's choice") and is not tested by C5 (which covers only beats 0–4).

## Console errors observed

None. Zero `pageerror`, zero `console.error` events across all test runs.

## Screenshots

- `/tmp/pw-qa/screenshots/beat0-intro-1440.png` — Intro beat at 1440×900: washi placeholder visible, 6-pip progress indicator with INTRO active, narrative text present.
- `/tmp/pw-qa/screenshots/beat4-day4-1440.png` — Day-4 beat at 1440×900: Mom's dialogue with `持つ` highlighted, YOU-turn with `てもいい` highlighted, "Mom's welcome — hear her line. ▶ PLAY" audio control, UNDER THE HOOD callout, LEARNED/STRENGTHENED/DUE TOMORROW debrief panels.
- `/tmp/pw-qa/screenshots/beat0-mobile-375.png` — Intro beat at 375×812: two-row pip layout, placeholder, narrative — no overflow.
- `/tmp/pw-qa/screenshots/beat4-mobile-375.png` — Day-4 beat at 375×812: PLAY button, callout, debrief panels all within viewport.
