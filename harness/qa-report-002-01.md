# QA Report — contract 002, round 01

**Server:** `http://localhost:3010` (`cd web && PORT=3010 MINSHUKU_FAKE_LLM=1 npm run start`)
**State at start:** fresh reset (`rm -f web/.data/story-state.json`)
**State at end:** fresh reset (left deleted per instructions)

---

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| C1 | Fresh day 1 | PASS | `jq -e '.status=="completed" and .story.day==1 and .story.summary=="" and .story.promptContext=="" and (.log.turns|length>=4)'` → `true`; turns count = 6; day1.json saved to /tmp/day1.json |
| C2 | Advance day | PASS | POST /api/episode/complete → HTTP 200, `content-type: application/json`; `.day==2`, `.summary` length > 0; `grep -F` of day-1 `log.result` against `.summary` exits 0 — result appears verbatim with `Day 1:` prefix |
| C3 | Persistence survives restart | PASS | State file `.day==2`, `.summary` byte-identical to C2 response; server killed (PID 99815), restarted with same command; GET → `.story.day==2` exits 0 |
| C4 | Day-2 context carries day 1 | PASS | `.story.promptContext` is a non-empty string (full "Story so far..." block); both `.story.summary` and `.story.promptContext` pass `grep -F` for day-1 `log.result`; `grep -rn "promptContext" web/lib` matches only `web/lib/engine/storyContextClient.ts` and `web/lib/engine/runEpisode.ts` — both under `web/lib/engine/`, none elsewhere |
| C5 | Day 2 is a different episode, fixture-fast | PASS | `.status=="completed"`; `diff <(jq -S '.log.turns' day1.json) <(jq -S '.log.turns' day2.json)` non-empty (speaker changed from `cafe_regular` to `mom`, dialogue text fully different); `time_total` = 0.031s (< 5s) |
| C6 | GET idempotent within a day | PASS | Two consecutive GETs after `jq 'del(.log.id,.log.startedAt,.log.endedAt,.log.llmLatencyMs)'` are byte-identical (`diff` exits 0); state file still `.day==2` after both GETs |
| C7 | Second advance accumulates; double-complete rejected | PASS | POST → `.day==3`; summary contains day-1 `log.result` (`grep -F` pass) and day-2 `log.result` (`grep -F` pass) verbatim; immediate second POST → HTTP 409, `Content-Type: application/json`, `.error` = `"No pending episode to complete — GET /api/episode to generate today's episode first."` (contains "episode") |
| C8 | Fixture exhaustion fails loud | PASS | At day 3 (no committed fixture), GET returns HTTP 500 JSON `{ "error": "No committed fixture for story day 3 (web/fixtures/ holds days 1, 2). Refusing to replay another day's episode…" }` — branch (a): 5xx with error mentioning both "fixture" and "day"; no silent replay |
| C9 | Hygiene + gates | PASS | `ls web/fixtures/*.json \| wc -l` = 2; `git check-ignore web/.data/story-state.json` exits 0; `grep -rln "story-state" web/app web/lib` → `web/lib/engine/storyStore.ts`, `web/lib/engine/runEpisode.ts`, `web/lib/engine/fixtureClient.ts` (all server code, no client-side); `npm run code-check` → 22 test files, 101 tests passed; `cd web && npm run lint` exit 0; `cd web && npm run build` exit 0 (routes: `ƒ /api/episode`, `ƒ /api/episode/complete`) |

---

## Verdict: PASS (all 9 criteria)

---

## Failures

None.

---

## Out-of-contract findings (not graded)

- The C9 hygiene grep for `story-state` also matches `web/lib/engine/fixtureClient.ts` in addition to `storyStore.ts` and `runEpisode.ts`. The contract says "only server code (`web/lib/engine/**` or `web/app/api/**`)" — all three files are under `web/lib/engine/`, so this is fully compliant; no issue.
- The `story.promptContext` field in the day-2 response includes a prose preamble ("Story so far (today is day 2 of the player's stay — keep light continuity with these past events; the dialogue may reference them naturally):") before the verbatim `Day 1:` line. The `grep -F` check on the verbatim result string passes regardless, and the contract makes no constraint on the preamble.

---

## Console errors observed

None observed (no browser involved; all criteria tested via curl/jq at the API layer).

---

## Gate results (C9 detail)

```
npm run code-check (repo root):
  Test Files  22 passed (22)
       Tests  101 passed (101)
    Duration  2.74s

cd web && npm run lint: exit 0 (no warnings)

cd web && npm run build: exit 0
  Route (app)
  ┌ ○ /
  ├ ○ /_not-found
  ├ ƒ /api/episode
  └ ƒ /api/episode/complete
```
