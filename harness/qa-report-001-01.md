# QA Report — contract 001, round 01

Server under test: `http://localhost:3001` (fixture mode, `MINSHUKU_FAKE_LLM=1`, no `GEMINI_API_KEY`; started by harness).
C7 verified via `next start` (production build) on port 3003 with neither env var set — separate process, killed after test.

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| C1 | HTTP 200 + `Content-Type: application/json` in fixture mode (no key) | PASS | `curl -si http://localhost:3001/api/episode` → `HTTP/1.1 200 OK`, `content-type: application/json` |
| C2 | `status === "completed"`, `log.turns` ≥ 4, all turns have numeric `turn` / non-empty `speaker` / non-empty `text`, ≥ 1 player turn with non-empty `evaluatorResults` | PASS | 6 turns total; `all_turns_valid: true`; 3 player turns each with `evaluatorResults`; see jq output below |
| C3 | `log.briefing` and `log.result` non-empty strings; `log.itemOutcomes` non-empty array with only valid outcomes | PASS | briefing: "You're at the little cafe…" (253 chars); result: "You chatted…" (150 chars); itemOutcomes: `grammar.tsumori → mastered`, `vocab.mado → produced`; `outcomes_valid: true` |
| C4 | Two consecutive responses byte-identical after `jq 'del(.log.id, .log.startedAt, .log.endedAt, .log.llmLatencyMs)'` | PASS | `R1=$(curl …)`, `R2=$(curl …)`, `[ "$R1" = "$R2" ]` → `"IDENTICAL: PASS"` |
| C5 | Total response time < 5 seconds | PASS | `0.047988s` (≈ 48 ms), well under 5 s |
| C6 | `web/fixtures/` contains ≥ 1 `.json` file; `MINSHUKU_FAKE_LLM` appears in `web/lib` or `web/app` client-selection code | PASS | `web/fixtures/episode-demo-learner.json` (1923 bytes); flag read in `web/lib/engine/fixtureClient.ts` line 40 (`process.env.MINSHUKU_FAKE_LLM === "1"`), comments on lines 36-37 — both in server-only engine bridge |
| C7 | Without `MINSHUKU_FAKE_LLM` and without `GEMINI_API_KEY`, endpoint returns 5xx JSON with `error` string mentioning missing key or flag | PASS | `next start --port 3003` (env -u GEMINI_API_KEY, no MINSHUKU_FAKE_LLM): `HTTP/1.1 500`, `content-type: application/json`, body `{"error":"Live LLM mode requires GEMINI_API_KEY (set it server-side, e.g. in web/.env.local), or set MINSHUKU_FAKE_LLM=1 to replay committed fixtures without an API key."}` |
| C8 | `GEMINI_API_KEY` only in server code; no `NEXT_PUBLIC` LLM env var | PASS | `grep -rn "GEMINI_API_KEY" web/app web/lib` → only `web/lib/engine/fixtureClient.ts` lines 43, 45 (server-only bridge); `grep -rn "NEXT_PUBLIC" web/app web/lib` → no matches |
| C9 | `npm run code-check` exits 0 (101 tests pass); `cd web && npm run lint` exits 0; `npm run build` exits 0 | PASS | `code-check`: 22 test files, 101 tests passed; `lint`: exit 0, no warnings; `build`: exit 0, routes `○ /`, `○ /_not-found`, `ƒ /api/episode` |

## Verdict: PASS (all 9 criteria)

## Failures

None.

## Key evidence (truncated outputs)

### C1
```
HTTP/1.1 200 OK
content-type: application/json
```

### C2 (jq summary)
```json
{
  "status": "completed",
  "turns_total": 6,
  "turns_with_player": 3,
  "player_turns_with_evaluator": 3,
  "all_turns_valid": true
}
```
All 6 turns: `turn` is number, `speaker` and `text` are non-empty. Player turns 3, 5, 7 each carry `evaluatorResults` arrays (length 2 each).

### C3
```json
{
  "briefing": "You're at the little cafe in town when a friendly regular takes the counter seat next to you…",
  "result": "You chatted with the cafe regular about your festival plans…",
  "itemOutcomes": [
    {"itemId": "grammar.tsumori", "outcome": "mastered"},
    {"itemId": "vocab.mado", "outcome": "produced"}
  ]
}
```

### C4
```
R1 == R2 → IDENTICAL: PASS
```
Only `log.id`, `log.startedAt`, `log.endedAt`, `log.llmLatencyMs` differ between raw calls (timestamps and UUID). After `jq del(…)`, outputs are byte-identical. `log.llmPrompt` is deterministic (confirmed identical across both calls).

### C5
```
0.047988s
```

### C6
```
web/fixtures/episode-demo-learner.json  (1923 bytes, 1 file)

web/lib/engine/fixtureClient.ts:36: // Client selection — the only place MINSHUKU_FAKE_LLM is read.
web/lib/engine/fixtureClient.ts:37: // MINSHUKU_FAKE_LLM=1 → deterministic fixture replay…
web/lib/engine/fixtureClient.ts:40:   if (process.env.MINSHUKU_FAKE_LLM === "1") {
web/lib/engine/fixtureClient.ts:47:         "or set MINSHUKU_FAKE_LLM=1 to replay committed fixtures…"
```

### C7
```
HTTP/1.1 500 Internal Server Error
content-type: application/json

{"error":"Live LLM mode requires GEMINI_API_KEY (set it server-side, e.g. in web/.env.local), or set MINSHUKU_FAKE_LLM=1 to replay committed fixtures without an API key."}
```
Test server: `next start --port 3003` with `env -u GEMINI_API_KEY` and `MINSHUKU_FAKE_LLM` absent. Not an HTML page; `error` field mentions `GEMINI_API_KEY` (missing key) and `MINSHUKU_FAKE_LLM=1` (fixture flag). Process killed after test.

### C8
```
grep GEMINI_API_KEY → web/lib/engine/fixtureClient.ts:43 and :45 only (server bridge)
grep NEXT_PUBLIC    → (no matches)
```

### C9
```
code-check: Test Files 22 passed (22) | Tests 101 passed (101) | Duration 2.36s
lint:       exit 0, no warnings
build:      exit 0
  ○ /
  ○ /_not-found
  ƒ /api/episode
```

## Out-of-contract findings (not graded)

- The `next dev` command enforces a single-instance guard (checks for an existing `next-server` process in the same project dir and refuses to start a second one). C7 was tested using `next start` (production mode) on port 3003 instead of a second dev instance. Behavioral equivalence holds: both modes run the same route handler and the same `createLLMClient()` error path. This is not a defect, just a note for future evaluators: use `next start` for C7.
- Each request appends a line to `logs/web/scene-runs.jsonl` (gitignored). This is intentional per generator-state.md and harmless.

## Console errors observed

None observable at the API level. Build and lint emitted no warnings or errors.
