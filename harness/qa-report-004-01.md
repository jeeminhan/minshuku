# QA Report — contract 004, round 01

| # | Criterion | Verdict | Evidence |
|---|-----------|---------|----------|
| C1 | Day-1 baseline unchanged (regression guard) | PASS | jq filter exits 0; second GET byte-identical after standing exclusions; state file `.reviewItems` in seed order with all `nextReviewAt==null` |
| C2 | Complete returns debrief payload | PASS | HTTP 200; `.day==2`; summary verbatim; learned ids `["vocab.ame","vocab.fushigi","vocab.yakusoku"]`; fushigi literal surface/reading/meaning; strengthened `[{tsumori,mastered},{mado,produced}]`; tsumori surface `つもり`; dueTomorrow `[ame,fushigi,mado,yakusoku]` (tsumori absent) |
| C3 | Persisted SRS state evolved correctly | PASS | tsumori `{interval:4, ease:2.65, lapses:0, nextReviewAt:"2026-06-05T09:00:00.000Z", lastReviewedAt:"2026-06-01T09:00:00.000Z"}`; mado `{interval:1, ease:2.5, nextReviewAt:"2026-06-02T09:00:00.000Z"}`; ame/fushigi/yakusoku all still `{nextReviewAt:null, interval:0, lastReviewedAt:null}`; `.day==2 and .pending==null` |
| C4 | Day-2 selection against evolved state | PASS | template `late-night-walk-stranger`; activeTargets `[vocab.ame]`; 4 items total; passives `{fushigi,mado,yakusoku}`; tsumori absent; 3 player turns with vocab.ame evaluatorResults; at least one produced/mastered outcome; 不思議/窓/約束 in stranger lines |
| C5 | GET never applies outcomes; day-2 determinism | PASS | Two consecutive GETs byte-identical after standing exclusions; `.reviewItems` snapshot diff empty before/after; `.day` stays 2 |
| C6 | Day-2 complete chains; 409 applies nothing; day 3 fails loud | PASS | POST returns HTTP 200 with `.day==3`; summary contains both day-1 and day-2 results verbatim; `vocab.ame` in strengthened; ame interval ≥ 1 with nextReviewAt set; second POST returns HTTP 409 with `.error` containing "episode"; `cmp` confirms state file byte-identical; day-3 GET returns HTTP 500 with `.error` naming fixture and day |
| C7 | Debrief view replaces confirmation (1440×900) | PASS | Exactly 1 POST; `complete-confirmation` visible with non-empty text "お疲れさまでした…"; all 3 group containers visible; learned: 3 items `{vocab.ame,vocab.fushigi,vocab.yakusoku}` with 雨/不思議/約束; strengthened: 2 items with tsumori+mastered badge (bg `rgb(243,230,191)`) and mado+produced badge (bg `rgb(226,234,208)`); due-tomorrow: 4 items `{ame,fushigi,mado,yakusoku}` no tsumori; badge colors differ |
| C8 | Return-tomorrow beat; no day-2 prefetch; clean console | PASS | `return-tomorrow` visible with text "The lanterns go out for tonight. Day 2 opens tomorrow…" matching `/Day 2/`; GET count=1, POST count=1; 0 pageerrors, 0 console errors, 0 responses ≥400 |
| C9 | Debrief responsive at 375 | PASS | All 3 group containers and return-tomorrow visible at 375×812; scrollWidth 375 ≤ innerWidth+1 (375 ≤ 376); all group right edges 355.0 ≤ 376; no horizontal overflow |
| C10 | Gates + hygiene | PASS | `npm run code-check` exits 0 with 101/101 tests; `npm run lint` exits 0; `npm run build` exits 0 (4 routes); `git status --porcelain -- src/lib` empty; `applyOutcome` and `pickDueItems` import lines match only `web/lib/engine/storyStore.ts` importing from `@engine/srs/intervals` and `@engine/srs/pickDueItems` respectively; `grep -c "late-night-walk-stranger" web/fixtures/episode-demo-learner-day2.json` = 1 |

## Verdict: PASS (all 10 criteria)

## Failures
None.

## Out-of-contract findings (not graded)

- The "player-submit" button testid is `player-submit` (not `submit-turn` as might be assumed from prior contracts). This is an internal naming detail, not a contract requirement.
- At 375px, the full episode scroll height is long due to all turns being visible simultaneously. This is expected behavior — the debrief groups remain within viewport width bounds.

## Console errors observed
None across both viewport sessions (1440×900 and 375×812).

## Screenshots

- `/tmp/debrief-1440x900.png` — debrief at 1440×900 showing all three groups + return-tomorrow beat
- `/tmp/debrief-375x812.png` — debrief at 375×812 showing responsive layout without horizontal overflow

## Walkthrough A evidence (curl/jq)

**C1:** `jq -e '.status=="completed" and .story.day==1 and (.items|length)==5 and ([.items[] | select(.mode=="active") | .itemId] | sort) == ["grammar.tsumori","vocab.mado"] and .log.templateId=="cafe-regular-encounter"'` → `true`. Second GET diff with standing exclusions: empty. State file reviewItems check: `true`.

**C2:** POST returns JSON with `{"day":2,"summary":"Day 1: You chatted with the cafe regular…","debrief":{"learned":[…ame,fushigi,yakusoku…],"strengthened":[…{tsumori,mastered},{mado,produced}…],"dueTomorrow":[…ame,fushigi,mado,yakusoku…]}}`. All jq pins exit 0.

**C3:** State file after complete: tsumori `interval=4, ease=2.65, lapses=0, nextReviewAt=2026-06-05T09:00:00.000Z, lastReviewedAt=2026-06-01T09:00:00.000Z`; mado `interval=1, ease=2.5, nextReviewAt=2026-06-02T09:00:00.000Z`; ame/fushigi/yakusoku all untouched; `.day==2 and .pending==null`.

**C4:** Day-2 GET: `late-night-walk-stranger` template; `vocab.ame` only active; 4 items; passives `{fushigi,mado,yakusoku}`; tsumori absent; player turns produce/miss vocab.ame; stranger lines contain all three passive kanji verbatim.

**C5:** Two consecutive GETs byte-identical after exclusions; reviewItems diff empty; day=2 constant.

**C6:** Day-2 POST: `{"day":3,"summary":"Day 1: …\nDay 2: …","debrief":{"strengthened":[{"itemId":"vocab.ame",…,"outcome":"mastered"}],…}}`. HTTP 200. State file shows ame with `interval>=1 and nextReviewAt!=null`. Second POST: HTTP 409 with `{"error":"No pending episode to complete…"}`. `cmp` state file: exit 0. Day-3 GET: HTTP 500 with `{"error":"No committed fixture for story day 3…"}`.
