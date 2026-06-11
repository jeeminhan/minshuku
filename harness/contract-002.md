# Contract 002 — Today's episode generation + story-so-far

Backlog item: Daily episode endpoint: picks due items, generates the scene, weaves a thin story-so-far (persisted summary + day counter fed to the dialogue prompt — continuity the player feels, no plot-state machine). Done = two consecutive "days" produce episodes that reference each other.

Scope:

- **Persistence (the documented choice): a single JSON file at `web/.data/story-state.json`**, read from disk on every request and rewritten on every state change. No database, no in-memory module cache — deleting the file resets the story to day 1 on the very next request, *without* a server restart (criteria depend on this). The server creates `web/.data/` on demand. Survives restarts by construction. Required fields: `day` (number, 1-based), `summary` (string), `pending` (object or null — the not-yet-folded-in result of the current day's generated episode). The generator may add fields (e.g. persisted `recentContext`).
- **`GET /api/episode` (extended, backward compatible with contract 001):** response keeps top-level `status` and `log` exactly as in contract 001 and ADDS a top-level `story` object: `{ day: number, summary: string, promptContext: string }`. `story.day` = current day; `story.summary` = the persisted story-so-far fed into *today's* generation (`""` on day 1); `story.promptContext` = the exact story-so-far text block injected into the dialogue-generation prompt (`""` on day 1, when nothing is injected). A successful GET records the generated episode's `log.result` (plus whatever else `pending` needs, e.g. templateId/location) as `pending` in the state file. Repeat GETs on the same day are idempotent: same episode, same `pending`, day never advances.
- **Advance-day mechanism: `POST /api/episode/complete`** (new route, `web/app/api/episode/complete/route.ts`). Folds `pending` into the story: appends the pending episode's `log.result` to `summary` **verbatim** (a day label prefix like `Day 1: …` is fine — criteria use `grep -F` on the result string, so it must appear unmodified), increments `day`, clears `pending`, persists, and returns 200 with JSON `{ day, summary }` reflecting the NEW state. If there is no pending episode (fresh state, or `complete` called twice in a row), returns **409** with JSON `{ error: <string mentioning "episode"> }`. No LLM call is involved — the summary is accumulated `log.result` lines, nothing more (this is the "thin" in thin story-so-far).
- **Prompt injection via LLM-client wrapper** (`web/lib/engine/`, new or extended module): the engine builds the dialogue prompt purely from the `ScenePlan` (`src/lib/llm/generateDialogue.ts`), so the only engine-untouched injection point is a wrapper `LLMClient` that, on the first `complete()` call of a run (the `generateDialogue` call), appends the story-so-far block to the prompt before delegating to the inner client (fixture or Gemini). **`story.promptContext` must be captured from the actual `complete()` call arguments inside the wrapper** — not assembled independently — so the field is truthful by construction. Note for the evaluator: `log.llmPrompt` is recorded *upstream* of the wrapper (`rawPrompt`, `src/lib/llm/generateDialogue.ts:184`), so it will NOT contain the injected block; `story.promptContext` is the dedicated field the backlog allows for exactly this reason.
- **Day-keyed fixtures:** `web/fixtures/` gains a day-2 fixture (suggested `episode-demo-learner-day2.json`); the fixture client selects the fixture by the current day. The day-2 dialogue is authored to reference day-1 events (prose continuity is for the demo audience, not for QA — no criterion judges it), and its turns must differ textually from day 1's (that IS checked). If the current day has no committed fixture (e.g. day 3), the API must fail loud — JSON 5xx whose `error` mentions the fixture or day — never silently replay another day's fixture.
- **`recentContext` continuity (optional within this scope):** the state file may persist day-1's `templateId`/location and feed them into day-2's `buildScenePlan` (13 templates exist in `data/templates/`, so an alternative template is available). The generator must verify the day-2 plan still completes against committed `data/`; if it ever yields `no_compatible_template`, keep `recentContext` at nulls and document the fallback in `harness/generator-state.md`. No criterion depends on the day-2 `templateId` differing.
- `web/.gitignore` — add an entry covering `/.data/` (the state file is runtime state, never committed).
- SRS seed: day 2 reuses the same fixed demo seed from contract 001 (`web/lib/engine/demoLearner.ts`) — SRS state evolution between days is contract 004, not this one.

Out of scope:
- Any edit to files under `src/lib` (engine read-only, as always).
- Plot-state machine, character memory, thread/beat logic — the summary is a flat string and a counter, period.
- LLM-generated summarization of the day (the summary is accumulated `log.result` lines).
- SRS interval updates / outcome persistence between days (contract 004).
- Any UI (contract 003+). Multi-day seeded history (contract 005).
- Live-mode QA — fixture mode only, as always.

## How the evaluator runs this

Start (identical to contract 001 — fixture mode, no key):

```sh
cd /Users/jeeminhan/Code/minshuku/web && env -u GEMINI_API_KEY MINSHUKU_FAKE_LLM=1 npm run dev
```

Reset to day 1 at any point (no restart needed — see Scope):

```sh
rm -f /Users/jeeminhan/Code/minshuku/web/.data/story-state.json
```

Port caveat from contract 001 still applies: if port 3000 is held by a foreign `vercel dev` process, `next dev` falls back to 3001 — read the actual port from the dev-server startup line and substitute it in every command below.

The criteria are a single ordered walkthrough; run them in order. `day1.json` / `day2.json` refer to response bodies saved along the way.

## Criteria (each must be mechanically checkable)

- [ ] C1: **Fresh day 1.** After the reset command, `curl -s http://localhost:3000/api/episode | tee /tmp/day1.json | jq -e '.status=="completed" and .story.day==1 and .story.summary=="" and .story.promptContext=="" and (.log.turns|length>=4)'` exits 0. (Top-level `status`/`log` shape from contract 001 is unchanged — `story` is additive.)
- [ ] C2: **Advance day.** `curl -si -X POST http://localhost:3000/api/episode/complete` returns HTTP 200 with `Content-Type: application/json`; the body satisfies `jq -e '.day==2 and (.summary|length>0)'`, and `grep -F "$(jq -r '.log.result' /tmp/day1.json)"` succeeds against `jq -r '.summary'` of the body — the day-1 result line is in the summary **verbatim**.
- [ ] C3: **Persistence survives restart.** `jq -e '.day==2 and (.summary|length>0)' /Users/jeeminhan/Code/minshuku/web/.data/story-state.json` exits 0 and the file's `.summary` is byte-identical to C2's response `.summary`. Then kill the dev server, restart it with the same start command, and `curl -s http://localhost:3000/api/episode | tee /tmp/day2.json | jq -e '.story.day==2'` exits 0.
- [ ] C4: **Day-2 generation context carries day 1.** In `/tmp/day2.json`, `.story.promptContext` is a non-empty string and both `.story.summary` and `.story.promptContext` contain the day-1 `log.result` (from `/tmp/day1.json`) verbatim (`grep -F`). Source check that the field is captured, not fabricated: `grep -rn "promptContext" /Users/jeeminhan/Code/minshuku/web/lib` matches inside the LLM-client wrapper module (the capture site named in `harness/generator-state.md`).
- [ ] C5: **Day 2 is a different episode, still fixture-fast.** `/tmp/day2.json` has `.status=="completed"`, and `jq -S '.log.turns' /tmp/day1.json` vs `jq -S '.log.turns' /tmp/day2.json` differ (`diff` non-empty — the day-2 fixture is a distinct recorded episode, not a replay of day 1). `curl -s -o /dev/null -w "%{time_total}" http://localhost:3000/api/episode` completes in under 5 seconds.
- [ ] C6: **GET is idempotent and deterministic within a day.** Two further consecutive `curl -s http://localhost:3000/api/episode` calls are byte-identical after `jq 'del(.log.id, .log.startedAt, .log.endedAt, .log.llmLatencyMs)'` (same exclusion list as contract 001 — `story` is fully deterministic and must NOT need excluding), and afterwards `jq -e '.day==2' /Users/jeeminhan/Code/minshuku/web/.data/story-state.json` still exits 0 — GETs never advance the day.
- [ ] C7: **Second advance accumulates; double-complete rejected.** `curl -s -X POST http://localhost:3000/api/episode/complete` returns `.day==3` and its `.summary` contains BOTH the day-1 `log.result` (from `/tmp/day1.json`) and the day-2 `log.result` (from `/tmp/day2.json`) verbatim (`grep -F` each). An immediate second `curl -si -X POST http://localhost:3000/api/episode/complete` returns HTTP 409 with a JSON body whose `.error` is a non-empty string containing the word `episode` — not HTML, not a 200.
- [ ] C8: **Fixture exhaustion fails loud, never replays.** With the state now at day 3, `curl -s http://localhost:3000/api/episode` either (a) returns a 5xx JSON body whose `.error` is non-empty and mentions the fixture or day, or (b) — only if a day-3 fixture was committed — returns 200 with `.story.day==3` and `.log.turns` differing (per the C5 `jq -S`/`diff` method) from both `/tmp/day1.json` and `/tmp/day2.json`. Silent byte-replay of a previous day's turns is a FAIL.
- [ ] C9: **Hygiene + gates.** `ls /Users/jeeminhan/Code/minshuku/web/fixtures/*.json | wc -l` ≥ 2; `cd /Users/jeeminhan/Code/minshuku && git check-ignore web/.data/story-state.json` exits 0; `grep -rln "story-state" /Users/jeeminhan/Code/minshuku/web/app /Users/jeeminhan/Code/minshuku/web/lib` matches only server code (`web/lib/engine/**` or `web/app/api/**`). Gates: at repo root `npm run code-check` exits 0 with all 101 engine tests passing, and `cd web && npm run lint && npm run build` both exit 0.

## Evaluator review

**ACCEPTED** — with four annotations the generator must read before building.

### Annotation 1 — `rawPrompt` upstream location confirmed; `story.promptContext` claim is sound

The contract's central architectural claim holds. `src/lib/llm/generateDialogue.ts:184` confirms `rawPrompt` is assembled from `system` and `user` strings *before* `client.complete()` is ever called, and is returned directly as a field on the result struct. The wrapper `LLMClient` sits between `generateDialogue` and the inner client; any context it appends to the prompt args on the first `complete()` call will therefore be invisible in `rawPrompt`/`log.llmPrompt`, and `story.promptContext` is the correct and only place to surface it. The contract's explanation of why `log.llmPrompt` won't contain the injected block is accurate.

### Annotation 2 — C3 restart step: the QA agent must handle port uncertainty explicitly

C3 requires killing the dev server and restarting it. The contract notes the port-3000/3001 caveat at the top but does not repeat it for the restart step. A QA agent running C3 mechanically must re-read the actual port from the restarted server's startup output before issuing the `curl`. The QA agent should not assume the port stays stable between start and restart. This is a procedural note, not a criterion defect — the criteria themselves are correct.

### Annotation 3 — C4 source-check grep depends on generator-state.md naming the wrapper module

C4's source-check leg (`grep -rn "promptContext" /Users/jeeminhan/Code/minshuku/web/lib` must match inside the LLM-client wrapper module, "the capture site named in `harness/generator-state.md`") is only independently verifiable if `generator-state.md` for contract 002 names that file before QA runs. The grep itself is mechanical; the pass condition is `grep` exits 0 AND the matching file path is under `web/lib/engine/` (server-side). The QA agent should assert the match is in `web/lib/engine/` (not `web/app/` or elsewhere) — the criterion implies this but does not spell it out. Generator must document the exact file path in `generator-state.md` before QA round 1.

### Annotation 4 — C2 grep command needs the body captured before the pipe

C2 specifies checking the response body with `grep -F "$(jq -r '.log.result' /tmp/day1.json)"` against `jq -r '.summary'` of the body, but the body of the POST is not automatically saved to a file. The QA agent must save the POST response body (e.g. `curl -si -X POST ... | tee /tmp/complete1.json`) before running the grep check. The criterion is logically complete — the intent is unambiguous — but the QA agent should use `tee` or a variable to capture the body so the two-step check (status-line check + jq body check + grep check) is all runnable. This is an execution-note for the QA agent, not a defect in the criterion.

### Criterion-by-criterion mechanical-checkability verdict

| Criterion | Mechanical? | Notes |
|-----------|-------------|-------|
| C1 | Yes | Single pipeline, exits 0 or not. Reset precondition is explicit. |
| C2 | Yes | Status line + jq + grep — see Annotation 4 re: saving the body. |
| C3 | Yes | File check + restart + curl. Port re-read required (Annotation 2). |
| C4 | Yes | jq field checks + grep -F + source grep. Annotation 3 re: match location. |
| C5 | Yes | jq-S diff + time_total. |
| C6 | Yes | Two curls, jq del, diff, file day check. State precondition is day 2 (follows C3/C4/C5). |
| C7 | Yes | POST returns day 3 + grep-F both results + second POST returns 409 with "episode". |
| C8 | Yes | Binary: 5xx with fixture/day in error, or 200 with distinct turns. No judgment call. |
| C9 | Yes | All shell commands with exact exit-code semantics. |

No criterion requires a judgment call. All pass/fail conditions are expressed as exit codes, jq boolean expressions, grep exit codes, or HTTP status codes. The ordered walkthrough state chain (C1 sets up C2, C2 sets up C3, etc.) is well-specified — each criterion names the files (`/tmp/day1.json`, `/tmp/day2.json`, the state file path) that carry state forward.
