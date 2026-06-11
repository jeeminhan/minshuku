# Generator state — Contract 001, build round 1

**No engine changes were made.** The pre-authorized env-var override for `DATA_DIR`/`dicPath` was NOT needed — the contract's permitted workarounds were sufficient (see "cwd plumbing" below). `src/lib` is byte-identical to before this round.

**Environment note for the evaluator (not a code issue):** an unrelated `vercel dev` process (another project of the user's) was holding port 3000 on this machine during the build round, so `next dev` fell back to port 3001. If `curl http://localhost:3000/api/episode` returns a 404 with a `server: Vercel` header, port 3000 is occupied by that foreign process — check the dev-server startup output for the actual port (it prints `Local: http://localhost:XXXX`) and run the curls against that port. Do not kill the foreign process without asking the user.

## What changed (files + why)

- `web/lib/engine/demoLearner.ts` — fixed demo learner: seed `ReviewItem[]` (same 5 items as `scripts/run-scene.ts defaultSeed()`, all `nextReviewAt: null` → all due), fixed `now = 2026-06-01T09:00:00.000Z`, persona `"intermediate-n3-foreign-student"`, recentContext `{ lastTemplateId: null, lastLocation: null }`.
- `web/lib/engine/fixtureClient.ts` — `FixtureLLMClient implements LLMClient` + `createLLMClient()` selection. **This is the only file that reads `MINSHUKU_FAKE_LLM` and the only web file that references `GEMINI_API_KEY`** (both in `web/lib/engine/`, server code — relevant to C6/C8).
- `web/lib/engine/runEpisode.ts` — bridge calling `runScene` with the fixed learner and an explicit `logDir` of `<repo>/logs/web` (`join(process.cwd(), "..", "logs", "web")`; cwd is `web/` per HARNESS.md). Each request appends one line to `logs/web/scene-runs.jsonl` (root `logs/` is gitignored). `userId: "demo-learner"`.
- `web/app/api/episode/route.ts` — `GET` returns the `RunSceneResult` JSON; `export const dynamic = "force-dynamic"` (so live-mode-without-key fails at request time with a JSON 500, not at build-time prerender); catch-all returns `{ error: <message> }` with status 500.
- `web/fixtures/episode-demo-learner.json` — the committed fixture (see below).
- `web/package.json` — added engine runtime deps so they resolve from `web/`: `@google/genai`, `dotenv`, `kuromoji`, `zod` (+ dev `@types/kuromoji`), same version ranges as the root package.json.
- `web/tsconfig.json` — added path alias `"@engine/*": ["../src/lib/*"]`.
- `web/next.config.ts` — `outputFileTracingRoot` + `turbopack.root` = repo root (the app imports `../src/lib`), `serverExternalPackages: ["kuromoji"]` (old UMD package that reads its dictionary from disk; must not be bundled).
- `web/data` — **symlink** → `../data` (cwd plumbing, see below).

### cwd plumbing (engine untouched)

The engine resolves two paths from `process.cwd()`, which is `web/` under `next dev`:

1. `src/lib/content.ts:79` — `DATA_DIR = join(process.cwd(), "data")` → solved by the `web/data -> ../data` symlink.
2. `src/lib/evaluator/conjugation.ts:25` — kuromoji dict at `join(process.cwd(), "node_modules", "kuromoji", "dict")` → solved by adding `kuromoji` to `web/package.json`, so `web/node_modules/kuromoji/dict` exists.

Both are contract-permitted workarounds; the orchestrator's one-shot engine-change authorization was not used.

## Fixture design (C6 reference)

- **Fixtures directory: `web/fixtures/`** — one file, `episode-demo-learner.json`.
- **Keying strategy: ordered sequence.** The fixture holds an ordered `responses` array; the Nth `complete()` call on a `FixtureLLMClient` returns the Nth entry (`label` fields are documentation only). A fresh client is constructed per request inside `createLLMClient()`, so the cursor always starts at 0. For the fixed demo learner the engine makes exactly 4 `complete()` calls in a fixed order: 1× `generateDialogue`, then 3× `syntheticPlayerTurn` (player turns 3, 5, 7). If the call count ever exceeds the fixture, the client throws a descriptive "fixture exhausted" error (→ JSON 500), never a silent wrap-around.
- The fixture content was authored against the exact plan the engine builds for the fixed seed (verified by executing `buildScenePlan` and then full `runScene` with the fixture before wiring the route). It honors the same constraints a real recorded Gemini run must: active surfaces つもり/窓 absent from briefing + AI lines, passive surfaces 雨/不思議/約束 each present in AI lines.

## Evaluator annotation 1 (C1) — exact no-key run command and .env handling

Start command for all fixture-mode QA:

```sh
cd /Users/jeeminhan/Code/minshuku/web && env -u GEMINI_API_KEY MINSHUKU_FAKE_LLM=1 npm run dev
```

`.env` audit (confirmed this round):

- **`web/` contains no `.env`, `.env.local`, or any `.env*` file** (`ls -a web | grep -E '^\.env'` → empty). Next.js only auto-loads env files from its project root (`web/`), so nothing is auto-loaded.
- The **repo root** `.env` DOES contain `GEMINI_API_KEY` (used by the CLI scripts). It is NOT loaded by the Next process: Next doesn't read parent-directory env files, and the engine's `import "dotenv/config"` (in `src/lib/llm/client.ts`) resolves `.env` from `process.cwd()` = `web/`, where no file exists. Verified empirically: with the command above, `GET /api/episode` in live mode (flag unset) 500s with the missing-key error — proof the root key never reaches the server process.
- If anyone later creates `web/.env.local` with a key, the `env -u` prefix will NOT strip it (Next loads it after process start). Keep `web/.env*` out of fixture-mode QA runs; `web/.gitignore` already ignores `.env*`.

## Evaluator annotation 2 (C4) — `log.llmPrompt` determinism

**`log.llmPrompt` IS deterministic across runs; the exclusion list `del(.log.id, .log.startedAt, .log.endedAt, .log.llmLatencyMs)` is complete as written — do not extend it.**

Why: replay is at the `complete()` level, above prompt construction. The prompt is built by `generateDialogue` purely from the `ScenePlan`, which is a pure function of (seed items, fixed `now`, fixed recentContext, static `data/` files) — no timestamps, UUIDs, or randomness are embedded (no `Math.random`/`Date.now` anywhere in the prompt path). `log.llmResponse` is the fixture text, also constant. `llmLatencyMs` is constant 0 from the fixture client but remains in the exclusion list per the contract.

Verified empirically this round: two consecutive curls, `jq 'del(.log.id, .log.startedAt, .log.endedAt, .log.llmLatencyMs)'` on both → `cmp` reports byte-identical; the raw `llmPrompt` sha1 was additionally checked identical across the two responses.

## Evaluator annotation 3 — seed/template compatibility (skipped-branch note)

The fixed seed cannot produce `status: "skipped"` unless the seed or `data/` is changed:

- `no_due_items` is impossible: every seed item has `nextReviewAt: null`, which `pickDueItems` treats as always due.
- `no_compatible_template` does not occur: executing `buildScenePlan(seed, DEMO_NOW, {null, null})` against the committed `data/` deterministically selects template **`cafe-regular-encounter`** with active targets **`grammar.tsumori` + `vocab.mado`**, passives `vocab.ame`/`vocab.fushigi`/`vocab.yakusoku` (verified by direct execution this round).

Therefore: **if `/api/episode` ever returns `status: "skipped"`, read it as a regression in the seed, the data files, or the engine selection logic — not as an environmental mystery.** The response body will still be JSON with `reason` and `message` fields (the route serializes the full `RunSceneResult` either way). A "fixture exhausted" 500 likewise means the plan drifted away from the recorded fixture.

## Gate results

`npm run code-check` (repo root) — pass:

```
      Tests  101 passed (101)
   Start at  14:27:08
   Duration  2.49s (transform 529ms, setup 0ms, collect 3.39s, tests 5.68s, environment 3ms, prepare 2.15s)
```

`cd web && npm run lint` — exit 0, no warnings. `npm run build` — exit 0:

```
┌ ○ /
├ ○ /_not-found
└ ƒ /api/episode

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

## Self-verification against a running fixture server (port 3001, see environment note)

- C1: `curl -si` → `HTTP/1.1 200 OK`, `content-type: application/json`.
- C2: `status === "completed"`, `log.turns.length === 6`, all turns have numeric `turn` / non-empty `speaker` / non-empty `text`; player turns 3/5/7 each carry a non-empty `evaluatorResults` array.
- C3: briefing/result non-empty; `itemOutcomes` = `grammar.tsumori → mastered` (つもり produced unprompted in turns 3 and 7), `vocab.mado → produced` (turn 5).
- C4: byte-identical after the contract's `jq del(...)` (verified with `cmp`).
- C5: 0.014s.
- C7: restarted with both `MINSHUKU_FAKE_LLM` and `GEMINI_API_KEY` unset → `HTTP/1.1 500`, body `{"error":"Live LLM mode requires GEMINI_API_KEY (set it server-side, e.g. in web/.env.local), or set MINSHUKU_FAKE_LLM=1 to replay committed fixtures without an API key."}`.
- C6/C8 greps: `MINSHUKU_FAKE_LLM` and `GEMINI_API_KEY` appear only in `web/lib/engine/fixtureClient.ts`; `grep -rn "NEXT_PUBLIC" web/app web/lib` → no matches.

## Known issues / notes

- Port 3000 collision (see environment note at top) — not caused by this repo.
- `npm install` in `web/` initially produced a broken hoisted tree (`es-abstract` mismatch crashing ESLint); fixed with a clean `rm -rf web/node_modules && npm install`. If lint ever crashes with `Cannot find module 'es-abstract/...'`, do the same.
- `web/` has no lockfile (predates this contract); dependency versions are pinned to the same ranges as the root package.json.
- Each `/api/episode` request appends to `logs/web/scene-runs.jsonl` (gitignored). Harmless; persistence semantics arrive in contract 002/004.
- Dev server start command is unchanged: `cd web && npm run dev` (use the `env -u ... MINSHUKU_FAKE_LLM=1` form above for QA).
