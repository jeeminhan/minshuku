# Generator state — Contract 005, build round 1

**No engine changes** — `src/lib` untouched (`git status --porcelain -- src/lib` empty). `applyOutcome`/`pickDueItems` still grep-match exactly one web file, `web/lib/engine/storyStore.ts`, which imports both from the engine. The seed script contains neither symbol and no `2026-06-*` literal (C3 greps verified: both 0).

## What changed (files + why)

- **`web/scripts/seed-demo.ts` (new)** — the deterministic seed. Forces `process.env.MINSHUKU_FAKE_LLM = "1"` inside `main()` (read at `createLLMClient` call time, so it covers every simulated day regardless of environment), writes `freshStoryState()` first (never depends on the pre-existing file), then for days 1–3: `await runEpisode()` → `completeEpisode(readStoryState())` → `writeStoryState`. After day 3 it appends the day-4 lesson batch (`grammar.temo-ii`, `vocab.motsu`, all-null SRS fields built by a local `freshLessonItem` helper — same fresh shape as `demoLearner`'s seed, no history hand-typed) and writes the final state. Prints day, summary lines, and per-item SRS values (values come from the state object, not literals).
- **`web/package.json`** — `"seed-demo": "tsx scripts/seed-demo.ts"`; **runner choice: `tsx` added as a web devDependency** (`^4.22.4`, same runner the repo root uses for all CLI scripts; it resolves the `@web/*`/`@engine/*` tsconfig paths out of the box). `npm run seed-demo` works from `web/` with no env vars and no key.
- **`web/fixtures/episode-demo-learner-day3.json` (new)** — recorded against the day-3 plan (`bookshop-quiet-browse`, NPC `bookshop_owner` 2/4/6, active `vocab.fushigi` only, passive `vocab.yakusoku`). 約束 verbatim in the owner's turn 4; 不思議 absent from briefing and all owner lines; the player produces 不思議 in turn 5 ONLY. Continuity prose references day 2's stranger and day 1's festival promise.
- **`web/fixtures/episode-demo-learner-day4.json` (new)** — recorded against the day-4 plan (`minshuku-arrival-with-mom`, NPC `mom` 2/4/6, actives `[grammar.temo-ii, vocab.yakusoku]`, passives `[vocab.motsu, vocab.mado]`). 窓 appears exactly once (mom turn 2) and 持つ exactly once (mom turn 4) → exactly 2 gloss tokens; てもいい and 約束 appear in NO briefing/mom text (checked for substring traps like とてもいい and conjugated 約束した — none). Player: てもいい in turn 3 only, 約束 in turns 5 and 7. The "arrival" frame is authored as mom welcoming the player back for the evening.
- **`web/lib/engine/fixtureClient.ts`** — days 3 and 4 registered in `FIXTURES_BY_DAY`. Day 5 keeps the loud-failure path (verified: JSON 500 naming day 5 and the fixture list).
- **`web/components/episode/StorySoFar.tsx` (new)** — the story-so-far panel, `data-testid="story-so-far"`, renders `summary.split("\n")` as a washi-styled list (same card vocabulary as `DebriefPanel`). Mounted in `EpisodePlayer` between the header and the dialogue, ONLY when `episode.story.summary !== ""` — on fresh day 1 it is not rendered at all (`count() === 0`).
- **`web/components/episode/EpisodePlayer.tsx`** — mounts `StorySoFar` (one conditional line; nothing else changed).
- **`web/components/episode/episodeData.ts`** — `story` schema now keeps `summary: z.string()` (was stripped).
- **`README.md`** — new `## Demo` section (after Quick start) with two fenced shell blocks. Commands are stateless one-liners runnable verbatim from the repo root (`npm --prefix web run …` — verified `--prefix` runs the script with cwd = web/, so state/log paths resolve identically to `cd web && …`). The section states that re-running `seed-demo` resets the demo to day 4.

## Per-turn outcomes for the new fixtures (decision-4 verification, real evaluator)

- **Day 3** (active `vocab.fushigi`): turns 3/5/7 → missed / **produced** / missed → aggregate **`vocab.fushigi → produced`** (exactly one clean production; confirmed by the seeded state's fushigi `{interval: 1, nextReviewAt: 2026-06-04}` — a mastered aggregate would have been interval 4 / 06-07).
- **Day 4** (actives `grammar.temo-ii`, `vocab.yakusoku`): per-turn `(temo-ii, yakusoku)` = turn 3 **(produced, missed)**, turn 5 **(missed, produced)**, turn 7 **(missed, produced)**; `log.itemOutcomes` aggregate **`grammar.temo-ii → produced`**, **`vocab.yakusoku → mastered`** (verified live via `/api/episode` against the seeded state — exact strings from the response).

## Behavior notes for the evaluator

1. Seed confirmed live, twice: C1 shape exact (day 4, pending null, recentContext bookshop-quiet-browse/bookshop, 3 summary lines, 7-item order `[tsumori, mado, ame, fushigi, yakusoku, temo-ii, motsu]`); C2 byte-identical re-run (`cmp` exit 0, also identical via `npm --prefix web run seed-demo` from the root); C3 SRS pins all exact (tsumori 4/2.65/06-05, mado 1/2.5/06-02, ame 4/2.65/06-06, fushigi 1/2.5/06-04, three fresh nulls).
2. Day-4 GET: all C4 pins matched (template, active order `[grammar.temo-ii, vocab.yakusoku]`, items 4 with the pinned surfaces/readings/meanings, summary byte-equal to state, all 3 summary lines verbatim in promptContext, 2 evaluatorResults per player turn, mom lines 持つ×1 窓×1, てもいい/約束 ×0); repeat GET byte-identical under the standing exclusion list; `.reviewItems` byte-identical before vs after GETs.
3. Day-4 POST: C5 all pinned values matched (day 5, 4-line summary with the day-4 result verbatim, learned {mado,motsu}, strengthened produced/mastered, dueTomorrow exactly `[motsu, mado, fushigi, tsumori, temo-ii]`), state pins for yakusoku/temo-ii exact, day-5 GET = JSON 500 naming day 5, re-seed `cmp`-identical to run 1.
4. Browser walkthroughs (Playwright chromium, listeners pre-goto, throwaway install at `/tmp/pw-harness`, script `qa-005.mjs`): **day1 6/6** (C9: /Day 1/, story-so-far count 0, contract-003 shape, zero console errors), **seeded@1440×900 28/28** (C6+C7 in one session: 1 GET total, story-so-far visible pre-interaction with the day-3 line verbatim, 2 gloss tokens, 6 badges, 1 POST 200, all debrief pins incl. visible つもり entry, return-tomorrow /Day 5/, zero pageerrors/console errors/≥400s), **seeded@375×812 34/34** (C10: no horizontal scroll on load or with debrief, story-so-far + all three groups right edge ≤ 376).
5. README flows validated end-to-end on port 3021 (fresh → `.story.day==1`, seeded → `.story.day==4`). One environmental note: the user's long-running `next dev` on port 3000 (PID 84049, not mine, left untouched) makes Next 16 refuse ANY second dev server for this directory even on another PORT — the contract's standing caveat applies; I validated the README's dev-server line via the documented `npm run build && PORT=<free> npm run start` equivalent.
6. `web/package-lock.json` changed (tsx devDependency) — expected.
7. `grep -c "newReviewItem(" web/lib/engine/demoLearner.ts` is **6** (the function *declaration* line plus the 5 seed calls — the file is untouched this round, byte-for-byte; C12's "or equivalent inspection" applies). The file's `M` git status is carried over from contract 004's still-uncommitted work.

## Gate results

`npm run code-check` (repo root) — pass:

```
 Test Files  22 passed (22)
      Tests  101 passed (101)
```

`cd web && npm run lint` — exit 0. `npm run build` — exit 0:

```
┌ ○ /
├ ○ /_not-found
├ ƒ /api/episode
└ ƒ /api/episode/complete
```

## Known issues / cleanup

- Verification servers on 3020/3021 stopped (ports confirmed free); `web/.data/story-state.json` **deleted** (story state left RESET, fresh day 1 on next request). The user's port-3000 dev server was never touched.
- Seed runs appended scene logs under `logs/web/` — expected side effect per the contract, not part of any determinism check.
- Server start for QA: `cd web && env -u GEMINI_API_KEY MINSHUKU_FAKE_LLM=1 npm run dev` — but see note 5: while the user's 3000 dev server is up, use `npm run build && env -u GEMINI_API_KEY MINSHUKU_FAKE_LLM=1 PORT=<free> npm run start` (I used 3020).
