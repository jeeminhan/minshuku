# QA Report — contract 003, round 01

Server: `http://localhost:3010` (production build, `MINSHUKU_FAKE_LLM=1`, `GEMINI_API_KEY` unset)  
Story state: reset before C1 curl; reset again before C8 playthrough; left deleted at end per contract.  
Tools: Playwright (chromium 1.60.0, headless), curl, jq, shell commands.  
Screenshots: `harness/screenshots-003/`

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| C1 | API `items` extension (curl, fresh day 1) | PASS | `.status=="completed"`, `.story.day==1`, `.items` length 5 (2 active / 3 passive). `vocab.fushigi` entry exactly `{itemId:"vocab.fushigi",itemType:"vocab",mode:"passive",surface:"不思議",reading:"ふしぎ",meaning:"mysterious; strange"}`. `grammar.tsumori` has `surface=="つもり"`, `reading==null`. Two consecutive GETs byte-identical after `jq 'del(.log.id, .log.startedAt, .log.endedAt, .log.llmLatencyMs)'` (diff empty). |
| C2 | Load = opening beat only, single fetch | PASS | Day indicator `/Day 1/` found; briefing substring `friendly regular takes the counter seat` in `[data-role="coach"]`; `[data-role="npc"][data-turn="2"]` contains `週末は何か予定ある`; `player-input` and `player-submit` present. `[data-turn="3"]`–`[data-turn="7"]` absent (count=0); `[data-testid="complete-episode"]` absent; text `不思議な色` and `約束があるんだった` not in DOM. Exactly 1 GET `/api/episode` observed across C2–C7 (request listener attached before goto). Screenshot: `01-opening-beat-1440.png` |
| C3 | Gated reveal, typed text + recorded line | PASS | Empty submit: `[data-turn]` count stayed at 1 (no reveal). Filled `今日は祭りに行くテストです` + submit: `[data-role="player"][data-turn="3"]` appeared containing both the marker text AND the recorded line `週末は友だちと神社のお祭りに行くつもりだよ`. `[data-role="npc"][data-turn="4"]` appeared with substring `不思議な色`. `[data-turn="6"]` still absent. `player-input.inputValue()` === `""` after submission. Screenshot: `02-turn3-badges.png` |
| C4 | Inline outcome badges with distinct ladder states | PASS | Turn-3 block: exactly 2 `[data-outcome]` elements. `data-outcome="produced"` badge text contains `つもり`; `data-outcome="missed"` badge text contains `窓`. All `data-outcome` values on page are valid enum members. Badge computed `background-color`: produced=`rgb(226, 234, 208)`, missed=`rgb(238, 214, 202)`, body=`rgb(244, 236, 220)` — all three distinct. Screenshot: `02-turn3-badges.png` |
| C5 | Full playthrough + coach bookends + end state | PASS | Submitted non-empty text for turns 5 and 7. `[data-turn]` blocks for exactly 2,3,4,5,6,7 present; DOM order ascending `[2,3,4,5,6,7]`. Total `[data-outcome]` count = 6. Final `[data-role="coach"]` contains substring `dashed off to meet a friend`. Coach bg `rgb(245, 224, 205)` ≠ NPC bg `rgb(252, 248, 238)`. `player-input` is disabled after last submission. `complete-episode` visible and enabled. Screenshots: `03-full-playthrough-1440.png`, `04-gloss-fushigi-open.png` |
| C6 | Complete action wired honestly | PASS | Clicked `complete-episode`; `POST /api/episode/complete` fired exactly once; returned HTTP 200. `[data-testid="complete-confirmation"]` visible with text `お疲れさまでした。 Today's episode is in the book…`. `complete-episode` button removed from DOM (count=0). No second POST observed. Screenshot: `05-complete-confirmation.png` |
| C7 | Tappable gloss tokens on passive vocab | PASS | Exactly 3 `[data-token-item]` elements: `vocab.ame` in `[data-role="npc"][data-turn="2"]`, `vocab.fushigi` in turn 4, `vocab.yakusoku` in turn 6. All are native `<button>` elements (keyboard-focusable). NPC line textContent intact: turn 2 contains `週末は何か予定ある` + `雨がすごかった`; turn 4 contains `不思議な色`; turn 6 contains `約束があるんだった`. Before any tap: `ふしぎ` and `mysterious; strange` not visible. After click on `vocab.fushigi`: both `ふしぎ` and `mysterious; strange` visible in gloss tray. After focus+Enter on `vocab.ame`: `あめ` and `rain` visible. Screenshot: `04-gloss-fushigi-open.png` |
| C8 | Responsive 375 + 1440, no overflow | PASS | **375×812:** `scrollWidth=375 ≤ innerWidth+1=376` on load AND after full playthrough. `player-input` and `player-submit` visible and clickable on initial load. Max `[data-turn]` bounding-box right edge = 355px ≤ 376. **1440×900:** `scrollWidth=1440 ≤ 1441`. Dialogue section (`section[aria-label="Today's dialogue"]`) width = 720px ≤ 960px (centered reading column confirmed). Screenshots: `06-375-opening.png`, `07-375-complete.png` |
| C9 | Console + network clean | PASS | Across full 1440 playthrough (C2–C7): `pageerror` events = 0; `console` messages of type `error` = 0; responses with status ≥ 400 = 0. Single GET and single POST both returned 2xx. |
| C10 | Anti-slop computed styles | PASS | **(a)** No `<button>`, `<a>`, or `[role="button"]` has computed `background-color` equal to any banned Tailwind blue — checked all interactive elements. **(b)** `h1` computed `font-family` first family = `"Shippori Mincho"` — not in banned list; deliberately loaded via `next/font/google`. **(c)** `body` computed `background-color` = `rgb(244, 236, 220)` — neither pure white `rgb(255,255,255)` nor scaffold black `rgb(10,10,10)`. `grep -c "^\s*--" web/app/globals.css` = 23 (≥ 6). |
| C11 | Gates + hygiene | PASS | `npm run code-check`: 22 test files, 101 tests passed, exit 0. `cd web && npm run lint`: exit 0, no output. `cd web && npm run build`: exit 0, all 4 routes built. `git status --porcelain -- src/lib`: empty (no engine changes). `grep -rn "create-next-app\|vercel.com/templates" web/app`: nothing found. CSS custom properties count = 23 ≥ 6. |

## Verdict: PASS (all 11 criteria)

## Failures

None.

## Out-of-contract findings (not graded)

- **C8 script note:** The original test script incorrectly selected `main` (1440px wide) as the dialogue container because the `section[aria-label="Today's dialogue"]` Playwright locator timed out when queried too early after navigation. Verified via `page.evaluate()` that the section is 720px wide (correct). This is a test-script issue, not an app issue — the element exists and has the correct width.
- **375px turn-3 player card right edge = 355px**: The player turn cards are slightly wider than NPC turn cards (355px vs 339px) at 375. Both are within the 376px limit.
- **No `vocab.mado` surface/reading in C4 badge text**: The `missed` badge in turn 3 shows `窓` (kanji surface from the item's `surface` field), not the itemId `vocab.mado`. This is expected and correct.

## Console errors observed

None.
