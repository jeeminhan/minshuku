# Generator state — Contract 007, build round 1

## PREVIEW URL

**https://minshuku-d6thyax1u-jeemin-hans-projects.vercel.app**

Vercel project `minshuku`, team scope `jeemin-hans-projects` (teamId `team_NC3lBtArJwIQTY9nFaTE6psW`), Root Directory `web`, framework nextjs. NOT promoted to production.

## ⚠ BLOCKER for C8–C12: Deployment Protection is still ON

The preview URL currently returns **401 (Vercel Authentication)** to unauthenticated requests. The contract requires protection OFF ("C8 pins this"), and I attempted the documented fix — `PATCH /v9/projects/minshuku {"ssoProtection": null}` — **twice**, but the Claude Code permission classifier denied the call both times as an unauthorized security weakening. I did not work around it. **One manual step remains for the user/orchestrator:** either flip it in the dashboard (Project minshuku → Settings → Deployment Protection → Vercel Authentication → Disabled) or authorize:

```
curl -X PATCH "https://api.vercel.com/v9/projects/minshuku?teamId=team_NC3lBtArJwIQTY9nFaTE6psW" \
  -H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json" \
  -d '{"ssoProtection":null}'
```

No redeploy needed afterwards — protection is enforced at the edge, the deployment itself is done and verified (below) through the authenticated proxy.

**Everything behind the 401 already works.** Verified live via `npx vercel curl <path> --deployment <URL>` (CLI-session-authenticated bypass, protection untouched):

- GET `/api/episode` → 200, `cache-control: no-store`, `x-vercel-cache: MISS`, Set-Cookie `minshuku-story=v1.1.0.1`; day 1, 5 items all with non-empty surface/meaning, `log.itemOutcomes` non-empty (content packs + kuromoji dict traced and readable — C11's lambda proof).
- GET `/demo` → 303, `location: /`, Set-Cookie `v1.4.1.0`; subsequent GETs with the jar → day 4, summary has Day 1/2/3; two consecutive GET bodies byte-identical under standing exclusions, **and byte-identical to the local cookie-mode day-4 body** (which is itself byte-identical to seed-demo's file-mode day-4 body — the full C3 equivalence chain holds live).
- POST `/api/episode/complete` with the jar → 200, `.day == 5`, `.debrief` present; next GET → 500 with `.error` containing `fixture` (C10's fail-loud parity, live).

## Vercel auth mechanism (C11)

The CLI is session-authenticated as user `jeeminhan` (`npx vercel whoami`). The session token lives at `~/Library/Application Support/com.vercel.cli/auth.json` (JSON key `token`). For C11 the evaluator can either:

- run `npx vercel env ls --scope jeemin-hans-projects` from the repo root (it is `vercel link`ed — `.vercel/project.json` exists, gitignored), no `--token` needed; or
- `export VERCEL_TOKEN=$(node -e "const os=require('os');console.log(require(os.homedir()+'/Library/Application Support/com.vercel.cli/auth.json').token)")` and use `--token $VERCEL_TOKEN`.

Current output (verified): `MINSHUKU_FAKE_LLM=1` and `MINSHUKU_STORE=cookie`, both Production+Preview+Development; **no row matches GEMINI_API_KEY in any environment**.

## What changed (files + why)

- **`web/lib/engine/storyStore.ts`** — new `StoryStore` interface (`logDir`, async `read`/`write`, `cookieToSet`) + `FileStoryStore` (pre-007 file behavior verbatim). Also: state/log paths now anchor on `webAppDir()` which strips a trailing `.next/standalone/web` from cwd — the standalone server `process.chdir`s into the build dir, and without this the file store would silently write state/logs inside `.next/` (breaking C1's `web/.data` check and the seed-demo interplay). Under `next dev`/`next start` the function is a no-op (cwd unchanged) — file mode unregressed.
- **`web/lib/engine/runEpisode.ts`** — `runEpisode(store: StoryStore)`: state via `store.read()`, pending via `store.write()`, scene-run log dir via `store.logDir`. No engine edits — `logDir` was already a `runScene` parameter.
- **`web/lib/engine/lessonBatch.ts`** (new) — `day4LessonBatch()` extracted from seed-demo; the ONE shared definition used by both seed-demo and the cookie replay.
- **`web/lib/engine/cookieStore.ts`** (new) — `CookieStoryStore`: cookie `minshuku-story` = `v1.<day>.<seeded 0|1>.<pending 0|1>` (no JSON — value survives every cookie encoder byte-identically). `read()` replays days 1..N−1 through runEpisode+completeEpisode against an in-memory store (appending `day4LessonBatch()` at the day-4 boundary when seeded), and when `pending=1` re-runs day N to reconstruct the full PendingEpisode (the evaluator-review subtlety — POST re-runs runEpisode in cookie mode). Missing cookie → fresh day 1; corrupt cookie → loud 500. Scene-run logs → `os.tmpdir()/minshuku/logs/web`. Also `createStoryStore()` (the `MINSHUKU_STORE=cookie` switch) and `isCookieStoreMode()`.
- **`web/app/api/episode/route.ts`**, **`web/app/api/episode/complete/route.ts`** — store injection from the request cookie, Set-Cookie on write (`cookieToSet()`; a 409 never writes and never sets a cookie), explicit `cache-control: no-store` on ALL responses (the local standalone server emits no cache-control by default — relying on platform defaults would have failed C10), `maxDuration = 60`.
- **`web/app/demo/route.ts`** (new) — cookie mode: 303 with literal `Location: /` + Set-Cookie `v1.4.1.0` (idempotent reset-to-day-4); file mode: 400 JSON error pointing at `npm --prefix web run seed-demo` (the documented generator's-choice).
- **`web/scripts/seed-demo.ts`** — imports `day4LessonBatch` from the shared module; passes `new FileStoryStore()` to `runEpisode` (still file-mode by definition).
- **`web/next.config.ts`** — `output: "standalone"` (the contract's dual-server QA path); `outputFileTracingIncludes` for both API routes covering `data/{vocab,grammar}.json` + `data/templates/**` under BOTH `data/...` (web/data symlink) and `../data/...` keys, plus `node_modules/kuromoji/dict/**` (also on the complete route — cookie-mode POST replays episodes, so the evaluator runs there too).
- **`README.md`** — `## Deploy (Vercel)` section (C12: project `minshuku`, Root Directory `web`, `MINSHUKU_FAKE_LLM=1`, `MINSHUKU_STORE=cookie`, no-GEMINI_API_KEY statement + live-mode flip, `/demo` + cookie model `day`/`seeded`/`pending` + resets, `npx vercel` / `npx vercel --prod`).
- **`.gitignore`** — `.vercel` line added by `vercel link` itself.

**No engine changes:** `git status --porcelain -- src/lib` is empty (C7).

## Vercel project config (set via API with the CLI session token)

- `rootDirectory: "web"`, `framework: "nextjs"`.
- `installCommand: "npm install && npm --prefix .. install"` — **load-bearing**: the engine under `../src/lib` resolves `@google/genai`/`kuromoji`/`zod` from the repo-root `node_modules`, which Vercel does not install when Root Directory is `web`. First deploy failed with "Module not found: @google/genai" until this override.
- Env vars `MINSHUKU_FAKE_LLM=1`, `MINSHUKU_STORE=cookie` (all environments, type plain).
- `vercel link` auto-connected the GitHub repo `jeeminhan/minshuku` — future pushes may trigger Vercel builds (harmless: fixture mode, no key).
- Deployment protection: see blocker above.

## Exact local server start commands (C1–C5; corrected from the contract's guess)

The standalone server is at `web/.next/standalone/web/server.js` (NOT `web/.next/standalone/server.js` — the repo-root tracing root nests the app dir). Static assets must be copied in after every build or the page loads without JS:

```
cd web && npm run build && cd ..
cp -r web/.next/static web/.next/standalone/web/.next/static
cp -r web/public web/.next/standalone/web/public
PORT=3020 MINSHUKU_FAKE_LLM=1 node web/.next/standalone/web/server.js
PORT=3021 MINSHUKU_FAKE_LLM=1 MINSHUKU_STORE=cookie node web/.next/standalone/web/server.js
```

## Notes for the evaluator

1. **C2 step (d) jar nuance:** step (c)'s GET ALSO carries a Set-Cookie (`v1.2.0.1`, pending=true) and updates a `-c jar -b jar` jar — so a literal a→b→c→d sequence with one jar gives (d) a pending=true cookie and a legitimate 200/day-3, not a 409. The contract's own parenthetical pins (d) to "the day-2/pending-false cookie from step b": snapshot the jar after (b) (`cp jar jar-b`) and run (d) with `-b jar-b`, or send `Cookie: minshuku-story=v1.2.0.0` explicitly. Verified: that POST → 409. (e) empty jar → 409. Both verified locally.
2. **C6 manifest:** entries are manifest-relative; both routes' `.nft.json` carry `data/vocab.json`, `data/grammar.json`, 26 template files, and 12 `kuromoji/dict/*.dat.gz` entries (the dict also on the complete route — intentional, see above), all resolving to real files.
3. C8/C9 Playwright journeys were self-verified **locally** on the standalone servers (15/15 incl. full day-1 file-mode journey with exactly 1 GET + 1 POST and zero console/page errors, and the /demo → day-4 → /demo-revisit reset loop). Live Playwright needs the protection flip first.
4. Local verification scripts live at `/tmp/pw-harness/verify-007.mjs` (and prior contracts' scripts alongside).
5. Pre-existing uncommitted modifications to `scripts/review-loop.ts` and `scripts/review-trends.ts` predate this contract (also noted in the 006 state file) — not part of 007's diff.

## Gate results

`npm run code-check` (repo root):

```
 Test Files  22 passed (22)
      Tests  101 passed (101)
```

`cd web && npm run lint` — exit 0. `npm run build` — exit 0:

```
┌ ○ /
├ ○ /_not-found
├ ƒ /api/episode
├ ƒ /api/episode/complete
└ ƒ /demo
```

## Self-verification summary (local, standalone production servers)

- C1: two GETs byte-identical under standing exclusions; `web/.data/story-state.json` exists; full 1440×900 Playwright day-1 journey (coach beat, 6 `[data-outcome]`, 3 `[data-debrief-group]`, return-tomorrow, 1 GET, 1 POST, zero errors); seed-demo → story-so-far Day 1/2/3. PASS.
- C2: a=1, b=2 (+Set-Cookie, summary starts `Day 1:`), c=2 (summary contains `Day 1:`), d=409 (step-b cookie), e=409 (empty jar); no state file. PASS.
- C3: /demo → 303 `location: /` + Set-Cookie; day-4 body byte-identical to file-mode post-seed-demo body. PASS.
- C4: cookie day-2 body byte-identical to file day-2 body. PASS.
- C5: repo `logs/` file list unchanged, no state file, scene-runs went to `$TMPDIR/minshuku/logs/web/scene-runs.jsonl`, `git status` shows only contract-007 file changes. PASS.
- C6/C7: PASS (above).
- C8–C12 behaviors: verified live through `vercel curl`; the unauthenticated-access half is blocked on the protection flip.

## State left

Servers on 3020/3021 killed (ports confirmed free); `web/.data/story-state.json` deleted (fresh day 1 on next request). Nothing committed.

## Known issues

Only the deployment-protection blocker above. No code issues found.
