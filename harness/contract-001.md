# Contract 001 — Engine bridge + fixture LLM mode

Backlog item: `web/lib/engine/` server-side bridge importing `runScene`/generator/SRS from `../src/lib` (engine untouched). An `LLMClient` implementation with two modes: live Gemini (key server-side via Next API route only) and `MINSHUKU_FAKE_LLM=1` fixture/replay mode returning recorded dialogue deterministically. Done = an API route returns a generated episode JSON for a demo learner in fixture mode.

Scope:
- `web/lib/engine/` — server-only bridge that wires `runScene` (`src/lib/runScene.ts`) with a demo learner: a fixed `ReviewItem[]` seed (all due), a fixed `now`, a fixed `recentContext` (`{ lastTemplateId: null, lastLocation: null }` is fine), persona `"intermediate-n3-foreign-student"`, and an explicit `logDir` (pass it — do not rely on the engine's cwd default).
- `web/lib/engine/fixtureClient.ts` (name flexible) — a `FixtureLLMClient implements LLMClient` (`src/lib/llm/client.ts`) that replays recorded `complete()` responses from a committed fixtures directory (suggested: `web/fixtures/`). Selection: `MINSHUKU_FAKE_LLM=1` → fixture client; otherwise `GeminiClient`. Keying may be prompt-hash or ordered sequence — either is acceptable as long as replay is deterministic for the demo learner. A record path (wrapping the live client and writing fixtures) may exist behind a separate env flag, but committed fixtures are what QA runs against. Fixtures may be seeded from existing real runs in `logs/scene-runs.jsonl` instead of a live recording session.
- `web/app/api/episode/route.ts` — GET returns the `RunSceneResult` as JSON (`{ status: "completed", log: SceneRunLog }` shape from `src/lib/runScene.ts`).
- Plumbing required for the engine to run under Next with cwd = `web/`: the engine resolves `data/` and the kuromoji dictionary from `process.cwd()` (`src/lib/content.ts:79`, `src/lib/evaluator/conjugation.ts:25`). Permitted fixes that keep the engine untouched: symlink `web/data -> ../data`, add `kuromoji` (and any other runtime deps the engine pulls in, e.g. `zod`, `@google/genai`, `dotenv`) to `web/package.json`, and `serverExternalPackages` / `outputFileTracingRoot` in `web/next.config.ts` as needed.
- `web/tsconfig.json` / `next.config.ts` adjustments needed to compile `../src/lib` imports under TS strict.

Out of scope:
- Any edit to files under `src/lib` (engine is read-only). **Open question for the orchestrator if the cwd workarounds above prove insufficient:** would the user accept an engine change making `DATA_DIR`/`dicPath` overridable via env? Do not assume yes — surface it instead.
- Story-so-far / day counter persistence (contract 002).
- Any UI: no pages, no components, no styling (contract 003+).
- SRS state persistence between requests, debrief, seeded multi-day learner (contracts 004–005).
- Recording fixtures against live Gemini as part of QA — QA never touches the live API.

## How the evaluator runs this

Start: `cd web && MINSHUKU_FAKE_LLM=1 npm run dev` with `GEMINI_API_KEY` **unset** (verify with `env | grep GEMINI` → empty). Endpoint under test: `GET http://localhost:3000/api/episode`.

## Criteria (each must be mechanically checkable)

- [ ] C1: With the server started as above (fixture mode, no `GEMINI_API_KEY` anywhere in the environment), `curl -si http://localhost:3000/api/episode` returns HTTP 200 with `Content-Type: application/json`. Because `GeminiClient`'s constructor throws without a key, a 200 here is proof no live client was constructed.
- [ ] C2: The response body parses as JSON with `status === "completed"` and `log.turns` an array of length ≥ 4; every element has numeric `turn`, non-empty string `speaker`, and non-empty string `text`; at least one element has `speaker === "player"` and a non-empty `evaluatorResults` array.
- [ ] C3: `log.briefing` and `log.result` are non-empty strings, and `log.itemOutcomes` is a non-empty array where every `outcome` is one of `missed | recognized | produced_with_help | produced | mastered`.
- [ ] C4: Determinism — two consecutive `curl` calls to `/api/episode` return responses that are byte-identical after deleting only the nondeterministic fields `log.id`, `log.startedAt`, `log.endedAt`, and `log.llmLatencyMs` (e.g. compare `jq 'del(.log.id, .log.startedAt, .log.endedAt, .log.llmLatencyMs)'` output of both).
- [ ] C5: Fixture-mode response is fast: `curl -s -o /dev/null -w "%{time_total}" http://localhost:3000/api/episode` completes in under 5 seconds (a live multi-call Gemini run cannot — this guards against accidental live fallback).
- [ ] C6: Committed fixtures exist: the fixtures directory named in `harness/generator-state.md` (suggested `web/fixtures/`) contains ≥ 1 `.json` file, and `grep -r "MINSHUKU_FAKE_LLM" web/lib web/app` shows the flag is read in exactly the bridge/client-selection code path.
- [ ] C7: Live-mode failure is graceful: restart the server with `MINSHUKU_FAKE_LLM` unset and `GEMINI_API_KEY` unset; `GET /api/episode` returns a 5xx with a JSON body containing an `error` string that mentions the missing key or fixture flag — not an HTML error page and not a hung request.
- [ ] C8: Key stays server-side: `grep -rn "GEMINI_API_KEY" web/app web/lib` matches only server code (`web/app/api/**` or `web/lib/engine/**`), and `grep -rn "NEXT_PUBLIC" web/app web/lib` shows no Gemini/LLM-related public env var.
- [ ] C9: Gates — at repo root `npm run code-check` exits 0 with all 101 engine tests passing (proves the engine was not regressed), and `cd web && npm run lint && npm run build` both exit 0.

## Evaluator review

ACCEPTED — with three inline annotations the build round must satisfy before QA runs.

### C1 — ACCEPTED with one tightening note

The no-API-key proof is sound: `GeminiClient`'s constructor throws synchronously without a key (confirmed in `src/lib/llm/client.ts`), so HTTP 200 is an unambiguous machine-checkable signal that the live client was never instantiated. The evaluator command is exact (`curl -si`, check status line and `Content-Type` header). One required tightening: the generator must document in `harness/generator-state.md` the exact shell one-liner the evaluator should run to unset `GEMINI_API_KEY` for the duration of the dev-server process (e.g. `env -u GEMINI_API_KEY cd web && MINSHUKU_FAKE_LLM=1 npm run dev`), because a key set in `.env.local` will be picked up by the Next.js process even if the shell variable is unset. If `.env.local` is absent in the repo (as HARNESS.md implies), the current wording is sufficient — but the generator must confirm this in generator-state.md.

### C2 — ACCEPTED

Field-presence checks are exact and grounded in the actual `SceneRunLog` type (`src/lib/types.ts` lines 175–180). `log.turns[n].evaluatorResults` is typed as `EvaluatorResult[] | undefined` — present only on player turns — so the criterion correctly asks for "at least one player turn with a non-empty evaluatorResults array" rather than requiring every turn to have it. No ambiguity; a jq script can verify this with a single exit code.

### C3 — ACCEPTED

Outcome enum is exactly the five values in `EvaluatorResult["outcome"]` in `src/lib/types.ts`. No judgment required.

### C4 — ACCEPTED with a critical annotation

The exclusion list `(log.id, log.startedAt, log.endedAt, log.llmLatencyMs)` covers the nondeterministic timestamp and UUID fields declared in `SceneRunLog`. However there is a latent risk: `log.llmPrompt` and `log.llmResponse` are also fields on `SceneRunLog` (lines 167–168). If the fixture client replays at the `complete()` level (above prompt construction), then `llmPrompt` will be deterministic and need not be excluded. If replay is at a lower level where prompt construction itself varies (e.g. timestamps embedded in the prompt), those fields would also need exclusion. The contract allows either keying strategy. **Required action for the generator:** document in `harness/generator-state.md` whether `log.llmPrompt` is deterministic across runs with the same fixed seed (it should be, since `now` is fixed). If it is, the exclusion list is complete as written and C4 is mechanically runnable as specified. If it is not, add `log.llmPrompt` and `log.llmResponse` to the exclusion list before QA runs — do not leave this ambiguous for the evaluator to discover at runtime.

### C5 — ACCEPTED

The 5-second wall-clock threshold is the right polarity test: a cold Gemini run with multiple `complete()` calls will never finish in 5 seconds. No judgment required.

### C6 — ACCEPTED with one precision note

`grep -r "MINSHUKU_FAKE_LLM" web/lib web/app` verifies the flag is read somewhere in those trees, but does not verify it is read in the client-selection code path as opposed to, say, a comment or a test file. This is acceptable because the real proof is C1 (the 200 response proves fixture mode ran). C6 is effectively a source-hygiene check, not a behavioral check, and its wording reflects that. No revision needed.

The criterion also references `harness/generator-state.md` for the fixtures directory path. That file does not yet exist (this is contract 001, the first build round). **Required action for the generator:** create `harness/generator-state.md` before QA runs, naming the exact fixtures directory path and the keying strategy (prompt-hash or ordered sequence).

### C7 — ACCEPTED

The criterion is mechanically exact: 5xx status code, JSON body (not HTML), field named `error` containing a non-empty string that mentions key or flag. The evaluator can check all three with curl + jq + grep, zero judgment.

### C8 — ACCEPTED

The grep patterns are unambiguous. The negative assertion (`NEXT_PUBLIC` not present for any LLM-related var) is checkable: if the output is empty, the criterion passes. No ambiguity.

### C9 — ACCEPTED

The gate commands are exact shell commands with exact exit-code semantics. The test count (101) is pinned, which is the right call — it catches both regressions (fewer tests pass) and accidental test deletion (count drops). No judgment required.

### cwd-workaround open question

The out-of-scope note correctly frames the `DATA_DIR`/`dicPath` env-override question as a decision for the orchestrator, not a build-round improvisation. The contract prohibits assuming yes, requiring the generator to surface it if needed. This framing is correct and complete — no revision needed.

### Missing criterion (not blocking acceptance — flag for awareness)

The contract has no criterion for the `status: "skipped"` branch of `RunSceneResult`. If `pickDueItems` returns an empty list or no template matches the fixed seed, `runScene` returns `{ status: "skipped", reason: ..., message: ... }` and the API would return a non-`"completed"` response that C2 would catch as a failure without a clear diagnostic. This is acceptable because the fixed seed is specified to have all items due, so a skipped result would be a genuine build bug. However, the generator should ensure the fixed `ReviewItem[]` seed has at least one item compatible with an available template — failure mode otherwise produces a confusing C2 failure rather than a clear "seed is wrong" message. Consider adding a note to `generator-state.md` documenting the seed's template compatibility, or adding a C2a variant: "if status is not `completed`, the response body contains `reason` and `message` strings."