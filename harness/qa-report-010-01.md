# QA Report — contract 010, round 01

Server: http://localhost:3010 (fixture mode, MINSHUKU_FAKE_LLM=1, GEMINI_API_KEY unset)
Playwright: throwaway install at /tmp/pw-test (chromium headless)
Screenshots: /tmp/pw-test/screenshots/

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| C-UNLOCK | Intro sound-unlock CTA sets gesture + sound | PASS | `[data-testid="sound-unlock"]` visible with text "▶Begin with sound" (contains "sound"). Zero /tts/* requests before gesture. After click: `data-unlocked="true"` present, `[data-testid="sound-toggle"]` `aria-pressed="true"`. Muted-session test (localStorage `minshuku:sound=off`): toggle flips false→true on CTA click. Screenshot: 01-intro-unlock-cta.png, 02-after-unlock.png |
| C-NARRATION | Each day beat auto-plays dayN-turn2.m4a + reading indicator + replay | PASS | Day 1–4: each mounts exactly 1 `<audio>` with correct src (day1-turn2.m4a…day4-turn2.m4a), `paused=false` within 1.5 s of activation, `/tts/dayN-turn2.m4a` network request fired, `[data-testid="reading-indicator"]` ("🔊 reading…") visible while playing. `[data-testid="replay-clip"]` present with non-empty accessible name. Replay click: audio stays `paused=false`, `data-state="playing"` confirmed — no new network request (cached), satisfying the alternate condition. Screenshot: 03-day1-narration.png, 04-day4-single-clip.png |
| C-SINGLE | Only one clip plays at a time; non-day beats play no day clip | PASS | Full walk Intro→Day1→Day2→Day3→Day4→How-built→Outro: at every step exactly 0 or 1 audio playing (day beats: 1, non-day beats: 0). Day-4: `querySelectorAll('audio[src*="day4-turn2.m4a"]').length === 1` (Mom block folded into single BeatNarration). How-built and Outro: 0 day-narration audio elements playing. |
| C-HOWBUILT | "How this was built" beat with 5 substance claims + working / CTA | PASS | Beat reachable by stepping Next from Day 4. Visible text (inside `[data-testid="tour-beat"]`) contains: (1) "101 tests" + "SRS" + "rule-based grader" ✓; (2) "Gemini" + "TTS" ✓; (3) "Lyria" ✓; (4) "Vercel" ✓; (5) "real working prototype" + "same engine" ✓. `[data-testid="play-cta"]` visible, `href="/"`, label "→Play the live demo". Zero day-narration audio on this beat. Screenshot: 05-how-built.png |
| C-NAV7 | 7 navigable beats; progress + Next/Back + arrows correct | PASS | `[data-testid="tour-progress"]` has 7 children. ArrowRight advances beat (intro→day-1→day-2), ArrowLeft retreats. `[data-testid="tour-back"]` `disabled=true` on beat 0 (intro). `[data-testid="tour-next"]` `disabled=true` on beat 6 (outro). Exactly 1 `[data-testid="tour-beat"]` visible at a time. Active pip (`aria-current="step"`) present at every step. |
| C-RESP | Responsive 375/768/1440, no horizontal overflow | PASS | All 3 viewports, all 7 beats: `scrollWidth - innerWidth = 0`. At 375: unlock-cta right edge 225px < 375px, reading-indicator right 235px < 375px, replay-clip right 125px < 375px, play-cta right 255px < 375px. Screenshot: resp-375.png, resp-768.png, resp-1440.png |
| C-CLEAN | Console-clean across full narrated walkthrough | PASS | Listeners registered before `goto`. Full walk at 1440×900: 0 `pageerror` events, 0 console errors, 0 responses ≥ 400, 0 off-host requests (no googleapis.com). Autoplay `.catch()` in BeatNarration keeps policy rejections silent. |
| C-REG-STORY | Existing day beats render scenes/highlights/callouts (regression) | PASS | Day 1: highlights `grammar.tsumori`, `vocab.mado` ✓. Day 2: `vocab.ame` ✓. Day 3: `vocab.fushigi` ✓. Day 4: `grammar.temo-ii`, `vocab.motsu` ✓. All day beats: `[data-testid="tour-callout"]` non-empty ✓, `[data-testid="tour-knowledge"]` non-empty ✓. Beats 0–4: `[data-testid="scene-image"]` bounding box 780×438 (non-zero), `[data-testid="scene-placeholder"]` visible ✓. Two consecutive loads: Day-1 text identical (1152 chars both times) ✓. |
| C-REG-PLAY | Play view + engine unchanged; API regressions | PASS | `git status --porcelain`: no modifications to `web/app/page.tsx`, `web/components/episode/**`, `web/app/api/**`, `web/fixtures/**`, `web/lib/engine/**`, `src/lib/**`. `web/components/audio/SoundProvider.tsx` unchanged. `curl /api/episode` with fresh state-file: `status=completed, day=1, items=5, templateId=cafe-regular-encounter` ✓. After `seed-demo`: `story.day=4` ✓. `/story` visit leaves `web/.data/story-state.json` byte-identical (cmp passes). Note: `web/lib/demo/storyTour.ts` is modified (memoization fix, per orchestrator pre-approval) — see out-of-contract findings. |
| C-GATE | npm run code-check + web lint + web build | PASS | `npm run code-check`: 101 tests passed (22 files). `cd web && npm run lint`: clean (no output). `cd web && npm run build`: compiled successfully, `/story` route ƒ Dynamic, all 4 routes present. |

## Verdict: PASS (all criteria)

## Failures
None.

## Out-of-contract findings (not graded)

- **storyTour.ts memoization (C-REG-PLAY literal text):** `web/lib/demo/storyTour.ts` appears in `git status --porcelain` as modified, which literally contradicts C-REG-PLAY's "no modifications to `web/lib/demo/storyTour.ts`". However, the orchestrator task brief explicitly states this memoization fix was pre-applied and approved to resolve the kuromoji "second-render 500" regression. The diff is purely additive (adds a `tourCache` Promise variable and wraps `buildStoryTour()` to memoize; the original computation is renamed `computeStoryTour()` and logic is byte-identical). The `/story` route now serves reliably on repeated loads. Graded as PASS per orchestrator pre-approval.

- **`scene-image` width/height HTML attributes absent:** The contract text says `[data-testid="scene-image"]` should have "explicit non-zero width/height". `SceneImage.tsx` puts `data-testid="scene-image"` on a `<figure>` element (not `<img>`), which has no HTML `width`/`height` attributes; instead it uses CSS `aspectRatio: 1600/900` + `w-full`. The rendered bounding box is 780×438 (non-zero). This component is unchanged from contract-009 and the behavior is correct. The contract language is misleading for a `<figure>` container — flag for future contract wording but not a regression introduced by this round.

- **Reading indicator on the day-1 screenshot appears invisible in screenshot 03:** The screenshot was captured immediately after stepping to Day 1 before the audio began playing, so the indicator was not yet visible. The subsequent detailed test confirmed `readingVisible=true` within 1.5 s and `paused=false`.

## Console errors observed
None.
