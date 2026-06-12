# QA Report — contract 007, round 01

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| C1 | File mode unregressed | PASS | Two consecutive GET /api/episode bodies byte-identical after standing exclusions (Python diff = empty). `web/.data/story-state.json` created. Playwright 1440×900: coach beat visible (`data-role="coach"` count=1), 3 player turns submitted via `[data-testid="player-input"]` + `[data-testid="player-submit"]`, 6 `[data-outcome]` badges, 1 `[data-testid="complete-episode"]` click, 3 `[data-debrief-group]`s, `[data-testid="return-tomorrow"]` present. Exactly 1 GET + 1 POST. Zero console errors, zero pageerrors. `npm --prefix web run seed-demo` → GET day=4, summary contains `Day 1:`, `Day 2:`, `Day 3:`. Screenshots: `/tmp/c1-loaded.png`, `/tmp/c1-after-turns.png`, `/tmp/c1-debrief.png`. |
| C2 | Cookie mode state advancement + 409 parity | PASS | (a) Fresh jar GET → day=1. (b) POST complete → HTTP 200, `day=2`, `summary` starts `Day 1:`, response carries `Set-Cookie: minshuku-story=v1.2.0.0`. (c) GET with jar → `day=2`, summary contains `Day 1:`. (d) POST with step-b pending=false cookie (`v1.2.0.0`) → HTTP 409. (e) POST with fresh empty jar → HTTP 409. `web/.data/story-state.json` never created. |
| C3 | /demo seeds day 4; cookie state ≡ file state | PASS | GET `/demo` → HTTP 303, `Location: /`, `Set-Cookie: minshuku-story=v1.4.1.0`. Subsequent GET → `day=4`, summary contains `Day 1:`, `Day 2:`, `Day 3:`. Cookie-mode day-4 body byte-identical to file-mode day-4 body (after seed-demo) under standing exclusions — Python diff = empty. Equivalence chain confirmed. |
| C4 | Replay equivalence on organic day 2 | PASS | Cookie-mode day-2 GET body (via fresh jar → GET → POST → GET) byte-identical to file-mode day-2 body (rm state → GET → POST → GET) under standing exclusions. Python diff = empty. |
| C5 | Cookie mode writes nothing to repo | PASS | Full C2 + C3 journeys run on cookie-mode server. After: `web/.data/story-state.json` absent. `find logs -type f \| sort` unchanged (37 files before = 37 files after). `git status --porcelain \| grep -v "^??"` shows only the 11 contract-007 tracked-path modifications, no new files. Scene logs confirmed routing to `$TMPDIR/minshuku/logs/web/`. |
| C6 | Tracing manifest carries runtime-read files | PASS | Episode route NFT (`web/.next/server/app/api/episode/route.js.nft.json`): 206 entries. `data/vocab.json` (2 entries, resolves), `data/grammar.json` (2 entries, resolves), 26 `data/templates/**` entries (all resolve), 12 `node_modules/kuromoji/dict/*.dat.gz` entries (resolve). Complete route NFT: same vocab/grammar/templates coverage; kuromoji also present (intentional — cookie POST replays episodes). All paths verified resolving to real files via `os.path.exists`. |
| C7 | Gates + engine untouched | PASS | `npm run code-check`: 22 test files, 101 tests, all passed. `cd web && npm run lint`: exit 0. `npm run build`: exit 0, routes `○ /`, `ƒ /api/episode`, `ƒ /api/episode/complete`, `ƒ /demo`. `git status --porcelain -- src/lib`: empty output. |
| C8 | Live day-1 flow on preview URL | PASS | `curl -s -o /dev/null -w '%{http_code}' https://minshuku-d6thyax1u-jeemin-hans-projects.vercel.app` → 200 (no auth headers). Playwright 1440×900 fresh context: coach beat (`data-role="coach"` count=1), 3 player turns, 6 `[data-outcome]` badges, complete button clicked, 3 `[data-debrief-group]`s, `[data-testid="return-tomorrow"]` present. Exactly 1 GET `/api/episode` + 1 POST `/api/episode/complete`. Zero console errors, zero pageerrors. Screenshots: `/tmp/c8-live-loaded.png`, `/tmp/c8-live-after-turns.png`, `/tmp/c8-live-debrief.png`. |
| C9 | Live demo-seeded flow via /demo | PASS | Fresh Playwright context navigates to `<preview>/demo` → lands on `/`. `[data-testid="story-so-far"]` visible with `Day 1:`, `Day 2:`, `Day 3:` text; no `Day 4:`. Play day 4: 3 turns, 3 `[data-debrief-group]`s, `[data-testid="return-tomorrow"]` visible. Navigate to `/demo` again in same context → story-so-far again shows `Day 1:`, `Day 2:`, `Day 3:`, no `Day 4:` (reset-to-day-4 confirmed). Zero console errors, zero pageerrors. Screenshots: `/tmp/c9-live-after-demo.png`, `/tmp/c9-live-day4-debrief.png`, `/tmp/c9-live-demo-reset.png`. |
| C10 | Live determinism, cache headers, fail-loud parity | PASS | Jar primed via `GET <preview>/demo`. Two consecutive GETs: bodies byte-identical under standing exclusions. Both responses carry `cache-control: no-store`. Both carry `x-vercel-cache: MISS` (value is never `HIT`). POST complete with jar → HTTP 200, `day=5`, `debrief` present. Next GET → HTTP 500, body `{"error":"No committed fixture for story day 5 (web/fixtures/ holds days 1, 2, 3, 4)…"}` — contains `fixture`. |
| C11 | No GEMINI_API_KEY; lambda reads traced files | PASS | `npx vercel env ls --scope jeemin-hans-projects` output: only `MINSHUKU_STORE=cookie` and `MINSHUKU_FAKE_LLM=1`, both Production+Preview+Development. No row matching `GEMINI_API_KEY` in any environment. Live day-1 episode: 5 items all with non-empty `surface` and `meaning` (e.g. `surface=つもり`, `meaning=intend to / plan to do something`). `log.itemOutcomes` non-empty (2 outcomes with `morphologyOk`, `targetPresent` fields from kuromoji-backed evaluator). Content packs and kuromoji dict traced and readable. |
| C12 | README documents deploy story | PASS | `README.md` section `## Deploy (Vercel)` (line 127+) contains: project name `minshuku` and Root Directory `web` (line 129); env vars `MINSHUKU_FAKE_LLM=1` and `MINSHUKU_STORE=cookie` (lines 135–136); explicit statement "No `GEMINI_API_KEY` is set in fixture mode" + later live-mode flip (add `GEMINI_API_KEY`, remove `MINSHUKU_FAKE_LLM`) (line 138); `/demo` entry point (line 146); cookie state model `day`/`seeded`/`pending` with reset instructions (lines 140–146); deploy commands `npx vercel` (preview) and `npx vercel --prod` (production, only after preview passes QA) (lines 151–152). |

## Verdict: PASS (all 12 criteria)

## Failures

None.

## Out-of-contract findings (not graded)

- The `logs/web/scene-runs.jsonl` file already exists from prior contracts and is accumulated during file-mode runs (not cookie-mode). This is expected pre-existing state.
- Pre-existing uncommitted modifications to `scripts/review-loop.ts` and `scripts/review-trends.ts` noted in the generator state file — predating this contract, not part of the diff.
- The complete-route NFT also includes kuromoji entries (not required by C6 but intentional per the generator — cookie POST replays episodes). No issue.

## Console errors observed

None on any Playwright journey (local or live).

## Viewport coverage

| Viewport | Journey | Result |
|----------|---------|--------|
| 1440×900 | Local file-mode day-1 (C1) | PASS — no overflow, all selectors present |
| 1440×900 | Live day-1 (C8) | PASS — no overflow, all selectors present |
| 1440×900 | Live /demo day-4 (C9) | PASS — no overflow |
| 375×812 | Live /demo day-4 (per HARNESS.md) | PASS — `body.scrollWidth=375` equals viewport, no horizontal overflow, player input visible, zero console errors |

## Key screenshots

- `/tmp/c1-loaded.png` — local file-mode day 1 on load
- `/tmp/c1-after-turns.png` — local file-mode after 3 turns with outcome badges
- `/tmp/c1-debrief.png` — local file-mode debrief + return-tomorrow
- `/tmp/c8-live-loaded.png` — live day 1 loaded (1440px)
- `/tmp/c8-live-after-turns.png` — live after turns
- `/tmp/c8-live-debrief.png` — live debrief
- `/tmp/c9-live-after-demo.png` — live /demo landing showing Day 1–3 summary
- `/tmp/c9-live-day4-debrief.png` — live day 4 debrief
- `/tmp/c9-live-demo-reset.png` — live /demo revisit reset
- `/tmp/live-day4-opening.png` — live day-4 opening screenshot (1440px, required)
- `/tmp/375-live-demo-landing.png` — live /demo at 375px showing story-so-far
