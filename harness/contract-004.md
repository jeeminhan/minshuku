# Contract 004 — Debrief + SRS update + return-tomorrow beat

Backlog item: End-of-episode debrief screen: learned (new passives met) / strengthened (dues produced) / due tomorrow. SRS intervals update from aggregated outcomes. Closing beat invites tomorrow's episode.

## The design problem this contract resolves (read before building)

Today the demo learner's `ReviewItem[]` is a fixed seed (`web/lib/engine/demoLearner.ts` — every day replays the same fresh state) and `POST /api/episode/complete` only advances `day` + `summary`. This contract makes completion **apply the episode's aggregated outcomes** (`log.itemOutcomes`) to a **persisted** learner state, so day 2's due-item selection runs the real engine SRS against evolved state. Three decisions are baked in; do not relitigate them:

1. **The apply path is the engine's, imported — never reimplemented.** `applyOutcome` from `src/lib/srs/intervals.ts`, applied exactly the way `scripts/run-scene.ts` does (`applySceneOutcomes`, lines 108–118): one `applyOutcome` per item that has an entry in `log.itemOutcomes`; **items with no outcome are left untouched**. Passives therefore get NO SRS update on completion — that is the engine precedent (only active targets are evaluated/aggregated), and the day-2 ground truth below depends on it.
2. **The demo clock advances one day per story day.** Day N's `now` = `DEMO_NOW + (N−1) × 24h` (a `demoClock(day)` style helper in `web/lib/engine/`, exact name documented in `generator-state.md`). Used for `runScene`'s `now` (so `pickDueItems`/`buildScenePlan` see the right date), for `applyOutcome` at completion (apply at the *completed* day's clock), and for computing the next day's dues (at the *next* day's clock). Without this, day-1's reviewed items (`nextReviewAt` ≥ +1 day) can never come due again and "due tomorrow" is meaningless. Day 1's clock stays exactly `DEMO_NOW` (2026-06-01T09:00:00Z), so the day-1 fixture, plan, and all contract-001/002/003 day-1 pins are unchanged.
3. **Fixture coherence: the day-2 fixture is RE-AUTHORED against the evolved state.** The committed `episode-demo-learner-day2.json` was recorded against the *fresh* seed (actives `grammar.tsumori`+`vocab.mado`, template `minshuku-arrival-with-mom`). Under evolved state that plan is impossible: day-1 outcomes aggregate to `grammar.tsumori → mastered` (produced unprompted in turns 3+7) and `vocab.mado → produced` (turn 5), so after completion tsumori's interval is 4 (due 06-05, not due day 2) and mado's is 1 (due exactly on day 2). Pinning the seed to keep the old fixture (the alternative resolution) is mathematically impossible — a `mastered` outcome always pushes the item ≥ 4 days out, so tsumori cannot be an active target on day 2 once outcomes apply. Replaying the old fixture against the new plan would also be silently incoherent (dialogue targeting items the SRS no longer chose). So the day-2 fixture must be re-authored to match the evolved-state plan, which was computed by running the actual engine (`applyOutcome` → `pickDueItems` → `buildScenePlan`) against the evolved items at the day-2 clock with day-1's `recentContext` (`cafe-regular-encounter`/`cafe`):

   **Day-2 evolved-state ground truth (engine-verified, deterministic):**
   - Evolved items after day-1 complete (applied at 2026-06-01T09:00:00Z): `grammar.tsumori` `{interval: 4, ease: 2.65, lapses: 0, nextReviewAt: "2026-06-05T09:00:00.000Z", lastReviewedAt: "2026-06-01T09:00:00.000Z"}`; `vocab.mado` `{interval: 1, ease: 2.5, nextReviewAt: "2026-06-02T09:00:00.000Z"}`; `vocab.ame`/`vocab.fushigi`/`vocab.yakusoku` untouched (`nextReviewAt: null`, `interval: 0`, `lastReviewedAt: null`).
   - Day-2 dues (clock 2026-06-02T09:00:00Z): `vocab.ame`, `vocab.fushigi`, `vocab.yakusoku`, `vocab.mado` — **tsumori not due** (resting until 06-05: the SRS is visibly working).
   - Day-2 plan: template **`late-night-walk-stranger`** (location `town_outskirts`, NPC `stranger`, NPC turns 2/4/6, player turns 3/5/7), active targets exactly `[vocab.ame]`, passives exactly `{vocab.fushigi, vocab.mado, vocab.yakusoku}` — note 窓, produced yesterday, returns as a passive.
   - This ground truth assumes the persisted `reviewItems` preserve the seed order (`tsumori, mado, ame, fushigi, yakusoku` — `pickDueItems`' tie-break is stable-sort on input order). Persist them in seed order.

Scope (what changes, which files):

- **`web/lib/engine/storyStore.ts`** — extend `StoryState` with `reviewItems: ReviewItem[]` (fresh state seeds them from `demoReviewItems()`, in seed order) and extend `pending` with the data completion needs: the day's aggregated `itemOutcomes` (itemId/itemType/outcome) and its `passiveItems` (the `ItemAssignment`s). Completion logic (extend `foldPendingIntoStory` or a pure sibling) additionally maps `reviewItems` through the engine's `applyOutcome` at the completed day's clock and returns the debrief data. Schema stays Zod-validated; a pre-004 state file will fail the schema and produce the existing loud "corrupt — delete to reset" error, which is acceptable (the reset command is the documented migration).
- **`web/lib/engine/demoLearner.ts`** — add the day-keyed clock helper; `demoReviewItems()` becomes the fresh-state seed only (no longer read per-request by `runEpisode`).
- **`web/lib/engine/runEpisode.ts`** — run `runScene` with `reviewItems: state.reviewItems` and `now: clock(state.day)`; record `itemOutcomes` + `passiveItemsChosen` into `pending`. GET stays strictly read-only with respect to `reviewItems` — outcomes apply on POST complete, never on GET.
- **`web/app/api/episode/complete/route.ts`** — response keeps `{ day, summary }` exactly (contract-002 C2/C7 stay green) and ADDS `debrief`: `{ learned, strengthened, dueTomorrow }`. `learned` = the completed day's passive items; `strengthened` = entries of the day's `itemOutcomes` whose outcome is `produced_with_help | produced | mastered`, each carrying its `outcome` (missed/recognized actives appear in neither group — they resurface via dueTomorrow); `dueTomorrow` = `pickDueItems(evolvedItems, clock(newDay))` (engine import). Every debrief entry is joined with `surface`/`reading`/`meaning` the same way as the contract-003 `items` field. 409 semantics unchanged — and a 409 must not write state (no double-apply).
- **`web/fixtures/episode-demo-learner-day2.json`** — re-authored against the ground-truth plan above: 4 responses (1 `generateDialogue` with NPC `stranger` turns 2/4/6, then 3 synthetic player turns 3/5/7); the three passive surfaces 不思議 / 窓 / 約束 appear verbatim in NPC lines (gloss machinery + scene coherence); 雨 appears in at least one player line so `vocab.ame` aggregates to a production outcome (`produced` or `mastered` — verify the aggregate with the real evaluator and document it in `generator-state.md`); dialogue references day 1 in prose (continuity is for the demo audience — no criterion judges the prose).
- **Debrief UI** — `web/app/page.tsx` + new component file(s) under the existing episode components directory (named in `generator-state.md`): on successful complete, the C6 confirmation from contract 003 is replaced by the debrief view — three groups + a return-tomorrow closing beat (a day-N+1 teaser line, e.g. inviting tomorrow's episode). The debrief root (or a visible element within it) keeps `data-testid="complete-confirmation"` with non-empty text so contract-003 C6 stays green. The debrief must NOT fetch the next day's episode (no second GET — it would write day-2 `pending` prematurely; the teaser is text, not data).
- **Required selector vocabulary** (criteria depend on these exact attributes, extending contract 003's): `data-debrief-group="learned" | "strengthened" | "due-tomorrow"` on each group container; `data-item-id="<itemId>"` on each debrief entry; `data-outcome="<enum value>"` on (or inside) each strengthened entry, reusing the contract-003 badge vocabulary; `data-testid="return-tomorrow"` on the closing beat; `data-testid="complete-confirmation"` retained as above.

Out of scope:
- Any edit to files under `src/lib` (engine read-only, as always — all SRS math via imports).
- SRS scheduling for passive exposure (no `recognized` grades for passives — engine precedent, decision 1).
- Day-3 fixture; multi-day seeded history with realistic intervals (contract 005 — it builds on this state mechanism).
- Browser playthrough of day 2 (day-2 correctness is asserted via curl; the browser walkthrough is day 1 + debrief).
- Grading the player's typed text; changing the progressive-reveal model (contract 003 decisions stand).
- Polish/768px/full responsive pass (006); live-mode QA — fixture mode only, as always.

## How the evaluator runs this

Fixture mode only, no key (same as contracts 002/003):

```sh
rm -f /Users/jeeminhan/Code/minshuku/web/.data/story-state.json
cd /Users/jeeminhan/Code/minshuku/web && env -u GEMINI_API_KEY MINSHUKU_FAKE_LLM=1 npm run dev
```

Carried-over caveats: read the actual port from startup output (3000 may be taken); Next 16 refuses a second dev server for the same directory — reuse the running one or use `npm run build && env -u GEMINI_API_KEY MINSHUKU_FAKE_LLM=1 PORT=3010 npm run start`. A state file written before this contract fails loud as corrupt — the reset command above is the fix. Leave the state file deleted when done.

The criteria are two ordered walkthroughs. **Walkthrough A (curl, C1–C6):** reset → GET day 1 (`tee /tmp/day1.json`) → POST complete (`tee /tmp/complete1.json`) → state-file checks → GET day 2 (`tee /tmp/day2.json`) → repeat-GET determinism → POST complete day 2 → 409 → GET day 3. **Walkthrough B (browser, C7–C9):** reset, then the contract-003 day-1 playthrough (briefing → submit non-empty text for player turns 3/5/7 → final coach beat) at 1440×900 with `page.on("request"/"console"/"pageerror"/"response")` listeners registered before `goto`, then click `complete-episode`; repeat at 375×812 after another reset. State chain: each criterion's precondition is the previous criterion's end state.

Day-1 ground truth (committed fixture, verified): aggregated `log.itemOutcomes` = `grammar.tsumori → mastered`, `vocab.mado → produced`; passives met = `vocab.ame` (雨/あめ/rain), `vocab.fushigi` (不思議/ふしぎ/mysterious; strange), `vocab.yakusoku` (約束/やくそく/promise). Day-2 ground truth: the evolved-state block above.

## Criteria (each must be mechanically checkable)

- [ ] C1: **Day-1 baseline unchanged (regression guard).** After reset, `curl -s http://localhost:<port>/api/episode | tee /tmp/day1.json | jq -e '.status=="completed" and .story.day==1 and (.items|length)==5 and ([.items[] | select(.mode=="active") | .itemId] | sort) == ["grammar.tsumori","vocab.mado"] and .log.templateId=="cafe-regular-encounter"'` exits 0, and a second GET is byte-identical after `jq 'del(.log.id, .log.startedAt, .log.endedAt, .log.llmLatencyMs)'` (the standing exclusion list — no new exclusions allowed). The persisted state file now contains `.reviewItems` and `jq -e '[.reviewItems[].itemId] == ["grammar.tsumori","vocab.mado","vocab.ame","vocab.fushigi","vocab.yakusoku"] and ([.reviewItems[].nextReviewAt] | all(. == null))' web/.data/story-state.json` exits 0 (seed order, nothing applied by GET).
- [ ] C2: **Complete returns the debrief payload.** `curl -s -X POST http://localhost:<port>/api/episode/complete | tee /tmp/complete1.json` returns HTTP 200 and `jq -e` confirms ALL of: `.day==2`; `.summary` contains `jq -r '.log.result' /tmp/day1.json` verbatim (`grep -F`); `[.debrief.learned[].itemId] | sort` equals `["vocab.ame","vocab.fushigi","vocab.yakusoku"]`; the learned entry for `vocab.fushigi` has `.surface=="不思議" and .reading=="ふしぎ" and .meaning=="mysterious; strange"`; `[.debrief.strengthened[] | {itemId, outcome}] | sort_by(.itemId)` equals `[{"itemId":"grammar.tsumori","outcome":"mastered"},{"itemId":"vocab.mado","outcome":"produced"}]`; the strengthened entry for `grammar.tsumori` has `.surface=="つもり"`; `[.debrief.dueTomorrow[].itemId] | sort` equals `["vocab.ame","vocab.fushigi","vocab.mado","vocab.yakusoku"]` (tsumori absent — it is resting until 06-05).
- [ ] C3: **Persisted SRS state evolved in the right directions.** `jq -e` against `/Users/jeeminhan/Code/minshuku/web/.data/story-state.json`: the `grammar.tsumori` entry of `.reviewItems` has `.interval==4 and .ease==2.65 and .lapses==0 and .nextReviewAt=="2026-06-05T09:00:00.000Z" and .lastReviewedAt=="2026-06-01T09:00:00.000Z"` (interval grew 0→4 for the mastered item); the `vocab.mado` entry has `.interval==1 and .ease==2.5 and .nextReviewAt=="2026-06-02T09:00:00.000Z"` (interval grew 0→1 for the produced item); each of `vocab.ame`, `vocab.fushigi`, `vocab.yakusoku` still has `.nextReviewAt==null and .interval==0 and .lastReviewedAt==null` (passives untouched — decision 1); and `.day==2 and .pending==null`.
- [ ] C4: **Day-2 selection runs against evolved state, coherent with the re-authored fixture.** `curl -s http://localhost:<port>/api/episode | tee /tmp/day2.json | jq -e` confirms: `.status=="completed" and .story.day==2`; `.log.templateId=="late-night-walk-stranger"`; `[.log.activeTargetsChosen[].itemId] == ["vocab.ame"]`; `(.items|length)==4` with active itemId set exactly `["vocab.ame"]` and passive itemId set (sorted) exactly `["vocab.fushigi","vocab.mado","vocab.yakusoku"]`; `[.items[].itemId] | index("grammar.tsumori") == null`; every player turn (`.log.turns[] | select(.speaker=="player")` — exactly 3, turns 3/5/7) has exactly 1 `evaluatorResults` entry with `.itemId=="vocab.ame"` and an outcome in `["missed","recognized","produced_with_help","produced","mastered"]`; at least one of those outcomes is `produced` or `mastered` (雨 is actually exercised); each NPC turn text set (turns 2/4/6, speaker `stranger`) collectively contains 不思議, 窓, and 約束 verbatim.
- [ ] C5: **GET never applies outcomes; day-2 determinism holds.** Save `jq '.reviewItems' web/.data/story-state.json` before and after two further consecutive GETs of `/api/episode`: the two GET bodies are byte-identical after the standing exclusion list, and the before/after `.reviewItems` snapshots are byte-identical (`diff` empty) — repeat GETs rewrite at most `pending`, never the learner state, and `.day` stays 2.
- [ ] C6: **Day-2 complete chains; 409 applies nothing; day 3 fails loud.** `curl -s -X POST .../api/episode/complete | tee /tmp/complete2.json` returns 200 with `.day==3`, `.summary` containing both `jq -r '.log.result' /tmp/day1.json` and `jq -r '.log.result' /tmp/day2.json` verbatim, and `[.debrief.strengthened[].itemId] | index("vocab.ame") != null`; the state file's `vocab.ame` entry now has `.interval>=1 and .nextReviewAt!=null` (interval grew for the newly produced item). Copy the state file aside, then an immediate second POST returns HTTP 409 with JSON `.error` containing `episode`, and the state file is byte-identical to the copy (`cmp` exits 0 — no write, no double-apply). Then `curl -si .../api/episode` returns a 5xx JSON body whose `.error` is non-empty and mentions the fixture or day (no day-3 fixture — contract-002 C8 behavior preserved).
- [ ] C7: **Debrief view replaces the confirmation (browser, 1440×900).** After reset + the full day-1 playthrough, clicking `complete-episode` fires exactly one `POST /api/episode/complete` (HTTP 200) and, without navigation/reload: `[data-testid="complete-confirmation"]` is visible with non-empty text; all three `[data-debrief-group]` containers (`learned`, `strengthened`, `due-tomorrow`) are visible; `[data-debrief-group="learned"] [data-item-id]` count is exactly 3 with values `vocab.ame`/`vocab.fushigi`/`vocab.yakusoku` and visible text containing 雨, 不思議, and 約束; `[data-debrief-group="strengthened"] [data-item-id]` count is exactly 2 — the `grammar.tsumori` entry contains visible text つもり and an element with `data-outcome="mastered"`, the `vocab.mado` entry contains 窓 and `data-outcome="produced"`; `[data-debrief-group="due-tomorrow"] [data-item-id]` count is exactly 4 with itemId set `{vocab.ame, vocab.fushigi, vocab.mado, vocab.yakusoku}` and NO `[data-item-id="grammar.tsumori"]` inside it; the computed `background-color` (or `border-color`, per the contract-003 C4 fallback rule) of the `mastered` badge differs from the `produced` badge.
- [ ] C8: **Return-tomorrow beat; no day-2 prefetch; clean console.** `[data-testid="return-tomorrow"]` is visible and its text matches `/Day 2/` (the day-N+1 teaser); across the entire C7–C8 session the request count to `GET /api/episode` is exactly 1 (the debrief never fetches tomorrow's episode) and to `POST /api/episode/complete` exactly 1; zero `pageerror` events, zero console messages of type `error`, zero responses with status ≥ 400.
- [ ] C9: **Debrief responsive at 375.** Reset the state file, repeat the playthrough + complete at viewport **375×812**: the three `[data-debrief-group]` containers and `[data-testid="return-tomorrow"]` are visible (scrolling allowed); `document.documentElement.scrollWidth <= window.innerWidth + 1` with the debrief shown; every `[data-debrief-group]` bounding-box right edge ≤ 376.
- [ ] C10: **Gates + hygiene.** At repo root `npm run code-check` exits 0 with all 101 engine tests passing; `cd web && npm run lint && npm run build` both exit 0; `git status --porcelain -- src/lib` is empty; `grep -rn "applyOutcome" /Users/jeeminhan/Code/minshuku/web/lib /Users/jeeminhan/Code/minshuku/web/app` matches at least once and every matching file imports it from the engine's `srs/intervals` module (no SM2 reimplementation in web — same check for `pickDueItems`); `grep -c "late-night-walk-stranger" /Users/jeeminhan/Code/minshuku/web/fixtures/episode-demo-learner-day2.json` ≥ 1 (the fixture was re-authored against the evolved plan).

## Evaluator execution notes

- All jq pins in C2/C3/C4 use exact values computed by running the real engine functions (`applyOutcome`, `pickDueItems`, `buildScenePlan`) against the day-1 fixture's verified aggregated outcomes — they are deterministic, not estimates. If C4's template differs, the generator changed the clock model, the seed order, or applied grades to passives; that is a FAIL of the corresponding decision, not a pin to relax.
- `.ease==2.65` in C3 is safe for jq equality: the stored value and the literal parse to the same IEEE double (`2.5 + 0.15`, round-tripped through `JSON.stringify`).
- C6's state-file copy/compare: `cp web/.data/story-state.json /tmp/state-before-409.json` then `cmp` after the second POST.
- For C7/C8 reuse the contract-003 walkthrough mechanics (listeners before `goto`, non-empty text per player turn). Do not tap gloss tokens or re-assert 003 criteria — they are covered by 003's QA; this walkthrough only needs to reach the complete action.
- C9's reset happens while the dev server runs — the store re-reads per request, no restart needed.
- Leave `web/.data/story-state.json` deleted at the end.

## Evaluator review

**Verdict: ACCEPTED**

### Engine simulation spot-check

**Pin 1 — `grammar.tsumori → mastered` produces `interval=4, ease=2.65, nextReviewAt=2026-06-05T09:00:00.000Z`.**

Verified by tracing `applyOutcome` directly against `src/lib/srs/intervals.ts`:
- Input: `interval=0, ease=2.5` + outcome `mastered` → grade `Easy`
- `nextInterval(0, 2.5, "Easy")`: `current === 0` branch returns `4` (grade is Easy) — correct.
- `nextEase(2.5, "Easy")`: returns `2.5 + 0.15 = 2.65` — correct. IEEE double equality `2.65 === 2.65` confirmed in Node.js (contract note about jq safety is accurate).
- `now.setUTCDate(1 + 4) = June 5` → `nextReviewAt = "2026-06-05T09:00:00.000Z"` — correct.
- `lapses` stays 0 (grade ≠ Again) — correct.

All C3 pins for `grammar.tsumori` match exactly.

**Pin 2 — day-2 plan is `late-night-walk-stranger`, active `vocab.ame`.**

Full engine simulation run:
1. `pickDueItems` at `2026-06-02T09:00:00Z` against evolved state: tsumori (`nextReviewAt=2026-06-05`) filtered out; ame/fushigi/yakusoku (`nextReviewAt=null`) score overdueMs=nowMs; mado (`nextReviewAt=2026-06-02T09:00:00Z`) scores overdueMs=0. Sorted: `[ame, fushigi, yakusoku, mado]` (stable, seed order for tied nulls). Confirmed `grammar.tsumori` absent.
2. `pickActiveTargets(due)`: no grammar in due → first vocab = `vocab.ame` → `[vocab.ame]` only. Confirmed C4's `[.log.activeTargetsChosen[].itemId] == ["vocab.ame"]`.
3. `filterTemplates` for `tag:weather` (vocab.ame has scenarioTag `weather`): `cafe-regular-encounter`, `late-night-walk-stranger`, `minshuku-laundry-help` all pass register+domain fit; `shrine-afternoon-keeper` fails (register `polite`/`formal` rejects `neutral`).
4. `scoreTemplates` with `lastTemplateId=cafe-regular-encounter, lastLocation=cafe`: cafe gets −5−2=3; late-night-walk-stranger gets 10; minshuku-laundry-help gets 10. Tie at 10. `pickBestTemplate` uses stable sort: `late-night-walk-stranger` appears first in the filtered array (alphabetical filesystem order puts it before `minshuku-laundry-help`). Winner confirmed.
5. `pickPassiveItems(due, template, [vocab.ame])`: candidates = `[fushigi, yakusoku, mado]` (from due order); overlap with template's passiveScenarioTags `[soft-magical, feelings, weather, nature]`: fushigi=1 (soft-magical), yakusoku=0, mado=1 (weather). Stable sort descending → `[fushigi(1), mado(1), yakusoku(0)]`; top-3 = all three. Passives = `{vocab.fushigi, vocab.mado, vocab.yakusoku}`. Confirmed.

Template scripted turns verified: coach(1), stranger(2,4,6), player(3,5,7), coach(8) — matches contract's "NPC turns 2/4/6, player turns 3/5/7".

### Issues found and dispositions

**Issue A — Template tie-break has an implicit assumption (not blocking).**

`late-night-walk-stranger` wins its tie with `minshuku-laundry-help` because `readdirSync` returns alphabetical order on HFS+/APFS (macOS) and Linux ext4. This is filesystem-dependent, not guaranteed by the engine spec. The contract's evaluator note says "if C4's template differs, the generator changed the clock model, the seed order, or applied grades to passives; that is a FAIL of the corresponding decision, not a pin to relax." This framing slightly elides the tie-break source. In practice this is safe: the dev machine is macOS, the CI/QA machine is the same host, and the template cache is loaded once per process — the evaluation is reproducible. No revision required; flagging for the build round's awareness.

**Issue B — C6 `vocab.ame` outcome open-ended (by design, correctly documented).**

C6 checks `[.debrief.strengthened[].itemId] | index("vocab.ame") != null` but does not pin the specific outcome — this is intentional (the contract notes the outcome must be verified against the real evaluator and documented in generator-state.md). The fixture requirement states `雨 appears in at least one player line so vocab.ame aggregates to produced or mastered`. This is a build-time obligation, not an evaluator relaxation. The criterion as written is mechanically checkable (presence check + `interval>=1`). Acceptable.

**Issue C — C5 phrasing "rewrite at most `pending`" is slightly ambiguous but testable.**

The criterion says "repeat GETs rewrite at most `pending`, never the learner state" — `pending` may or may not be rewritten by a GET (the GET populates pending if absent). The testable assertion is the `.reviewItems` snapshot and byte-identical GET bodies — both are precisely specified. No revision needed.

**Issue D — `data-testid="complete-confirmation"` retained on the debrief root (C7).**

The contract says the debrief root (or a visible element within it) keeps `data-testid="complete-confirmation"` with non-empty text so contract-003 C6 stays green. This is an additive constraint on the debrief component, clearly stated. Testable as written.

### Criteria quality assessment

All 10 criteria are mechanically checkable without judgment calls:
- C1–C6: exact jq filter strings, `cmp` for byte-identity, HTTP status codes.
- C7: explicit selector vocabulary, exact counts, visible-text substring checks, computed color inequality.
- C8: exact request counts, regex on text content, zero-error console checks.
- C9: explicit viewport, scrollWidth bound, bounding-box right-edge numeric check.
- C10: exit codes, grep counts, import path verification.

No vague criteria ("looks good", "works well") present. itemIds pinned throughout. The selector vocabulary (`data-debrief-group`, `data-item-id`, `data-outcome`, `data-testid`) is fully specified in the scope section and referenced consistently in the criteria. The day-2 fixture re-authoring obligations are precise (4 responses, NPC speakers, surfaces verbatim, production requirement for vocab.ame).

### Summary

Both named pins (tsumori interval/nextReviewAt and day-2 template/active-target) are confirmed correct by direct engine code trace. The day-2 fixture requirements are stated with sufficient precision. Debrief-group criteria are pinned by exact itemIds. The demo-clock decision is testable (`DEMO_NOW + (N−1)×24h` with day-1 baseline `2026-06-01T09:00:00Z`) and its interaction with contract-002/003 determinism is explicitly addressed (GET stays read-only, no new exclusions, day-1 pins unchanged). No criteria need revision.
