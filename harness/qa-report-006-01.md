# QA Report — contract 006, round 01

Port: 3010 (production build, `MINSHUKU_FAKE_LLM=1`). State reset to fresh day 1 before fresh-day-1 criteria; seed-demo run where specified; state reset again at end.

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| C1 | Loading state announced and testable | PASS | Playwright 1440×900, delayed GET (~2500ms): `[data-testid="episode-loading"]` visible, `role="status"`, text "Preparing today's episode…", brand mark `民宿 MINSHUKU` visible above (bounding box y confirmed). After delay: `[data-role="coach"]` appeared, exactly 1 GET made. |
| C2 | Loading animation respects reduced motion | PASS | `reducedMotion: 'reduce'` context: `getComputedStyle(el).animationName` on loading element = `"none"`. First `.turn-enter` element also = `"none"`. Positive control (no-preference context): animationName = `"pulse"`. Mechanism: `motion-safe:animate-pulse` class on `<p data-testid="episode-loading">` in EpisodePlayer.tsx. |
| C3 | Day-5 error at 768×1024 | PASS | Setup: seed-demo → GET /api/episode → POST /api/episode/complete → server at day 5. Playwright 768×1024: `[role="alert"]` (filtered by "Could not load" text) visible; text contains `Could not load today's episode.` (U+2019 curly apostrophe, matching contract) and `fixture`; `[data-testid="player-input"]` count = 0; no horizontal overflow; 0 pageerror events; exactly 1 console error matching `/Failed to load resource/`; 0 others. State re-seeded and reset after. (Note: initial automated test script incorrectly used U+0027 straight apostrophe to match — manual re-run with correct U+2019 confirmed PASS.) |
| C4 | Complete pending state honest and double-click-proof | PASS | Playwright 1440×900, full playthrough, `POST /api/episode/complete` delayed ~1800ms. After click: button text = `"Closing the day…"`, `disabled === true`. Second forced click during pending: POST count stayed exactly 1. After resolution: `[data-testid="complete-confirmation"]` visible, `[data-debrief-group]` count = 3. |
| C5 | 768×1024 full journey clean | PASS | Playwright 768×1024. No horizontal overflow at any point (load, each turn submission, debrief). Dialogue section (`section[aria-label="Today's dialogue"]` with U+2019) width = 720px ≤ 960px. `[data-testid="player-input"]` and `[data-testid="player-submit"]` visible on load. `[data-testid="return-tomorrow"]` visible after completing. 0 console errors, 0 pageerror events. (Test script reported section width as 0 due to using straight apostrophe in Playwright CSS attribute selector — direct DOM eval confirmed 720px.) |
| C6 | 500-char player input does not break layout | PASS | 375×812: `'あ'.repeat(500)` submitted; `[data-role="player"]` turn appeared with text, no horizontal overflow, card right edge ≤ 376px. 768×1024: same — card right edge ≤ 769px. Both viewports pass. |
| C7 | Gloss token is a true toggle | PASS | Playwright 1440×900. Token `雨` (vocab.ame): click 1 → `aria-pressed="true"`, tray `<ul>/<li>` appeared with text `雨 あめ — rain` (surface + reading + meaning). Click 2 → `aria-pressed="false"`, tray `<ul>` removed from DOM (count 0). NPC sentence text byte-identical before/during/after. Screenshot confirms visual state at `/tmp/c7-debug.png`. |
| C8 | Tab order and focus-visible | PASS | Tabbing from document start: `[data-token-item]` (gloss token) focused before `[data-testid="player-input"]`, which was focused before `[data-testid="player-submit"]` — DOM order confirmed. Computed outlines under focus: `player-input` → `{style: solid, width: 2px}`; `[data-token-item]` (`.focus({focusVisible:true})`, `matches(':focus-visible')` = true) → `{style: solid, width: 2px}`; `player-submit` (same) → `{style: solid, width: 2px}`. All ≥ 2px solid. |
| C9 | All Japanese text carries `lang="ja"` | PASS | TreeWalker over `document.body` text nodes matching `/[぀-ヿ一-龯]/`: 0 nodes without `[lang="ja"]` ancestor at (1) opening beat, (2) after full playthrough with open gloss tray and outcome badges, (3) debrief view with all 3 `[data-debrief-group]`s rendered. |
| C10 | Scaffold purge + non-stock favicon | PASS | `ls web/public/` → empty (no next.svg, vercel.svg, globe.svg, window.svg, file.svg). `md5 -q web/app/favicon.ico` = `d32338de0a77fdcadf7f875cd64c1931` ≠ stock `c30c7d42707a47a3f4591831641e50dc`, file non-empty (5430 bytes, 2-icon ICO). `curl /favicon.ico` → HTTP 200. `grep -rn` for any of the 5 SVG names in `web/app`+`web/components` → no output. |
| C11 | Determinism + happy-path regression guard | PASS | Two consecutive `GET /api/episode` under standing exclusions: byte-identical. Fresh day 1 journey: `[data-testid="story-so-far"]` count = 0; `[data-outcome]` badges = 6 (before completing); all 3 `[data-debrief-group]`s + `[data-testid="complete-confirmation"]` + `[data-testid="return-tomorrow"]` visible; exactly 1 GET, 1 POST; 0 console errors, 0 pageerrors, 0 responses ≥ 400. seed-demo → day 4: `[data-testid="story-so-far"]` visible, text includes Day 1/2/3 lines. |
| C12 | Gates + hygiene | PASS | `npm run code-check` (repo root): 22 test files, 101 tests, all passed, exit 0. `cd web && npm run lint`: exit 0, no output. `cd web && npm run build`: exit 0, all 4 routes built (2 static, 2 dynamic). `git status --porcelain -- src/lib`: empty (engine untouched). |

## Verdict: PASS (all 12 criteria)

## Failures

None.

## Out-of-contract findings (not graded)

- **C5 and C7 test-script false negatives due to curly apostrophe in Playwright CSS selectors**: `section[aria-label="Today's dialogue"]` and the C3 `Could not load today's episode.` matching both used U+2019 (curly right single quotation mark) in the source/contract but the test script used U+0027 (straight apostrophe), causing zero-result matches. Both were re-verified manually and are PASS. Future test scripts should use `.filter({ hasText: ... })` or JS `textContent` comparison rather than CSS attribute selectors for strings containing typographic quotes.
- **C7 deeper test script used `[data-gloss-tray]` selector** which does not exist in the DOM — the tray is an unstyled `<ul>/<li>`. The correct selector is `[data-role="npc"] ul li`. Actual behavior is fully compliant: tray `<li>` appears with surface+reading+meaning on first click, removed on second click.

## Console errors observed

- C3 only: exactly 1 `Failed to load resource: the server responded with a status of 500 (Internal Server Error)` — permitted by contract (one allowed, zero others).
- All other criteria: 0 console errors observed.
