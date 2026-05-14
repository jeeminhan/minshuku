# Backlog

Deferred work, in priority order. Not blocking anything that's been built; queue items here when they come up so they don't get lost.

## Canonical NPC + multi-story architecture (DEFERRED — phase 2)

Agreed 2026-05-08. Four layers: `data/npcs/`, `data/locations/`, `data/stories/<id>/`, plus per-story `relationships.json` overlay. Governing rule: canonical state is monotonic and additive (no character death). Estimated ~25–30 hrs refactor (zod types, extract 12 templates → ~12 NPCs + ~6 locations, package current content as one "minshuku life" story, player state load/save, story router, generator updates, calibration entrypoint).

**Why deferred.** Phase 1 first: ship one story to Tier 1 (8 scenes) on the current architecture to validate the loop. Refactor only after the loop is proven fun. Platform/UGC tiers (schema-as-contract → bundles → author UI → registry → canon governance) come after this refactor.

Full design saved as memory: `canonical-npc-architecture`, `path-1-strategy`, `platform-vision`.

---

## ✅ Domain + register tagging on vocab/grammar (DONE 2026-05-07)

Shipped in 4 phases on 2026-05-07:

- **Phase A** (`72d719b`) — schema + fit logic with graceful degradation
- **Phase B** (`09d0a15`) — tagged all 12 templates with `acceptedDomains`
- **Phase C** (`9d06c8f`) — LLM-enriched all 508 items with `register` + `domain` via `npm run enrich-rd`
- **Phase D** (`3801147`) — wired the gate into active-target template filtering

**Result**: 5-scene review-loop dropped from 11 → 7 findings, score 81.4 → 84.7, bookshop-quiet-browse off the worst-template list. Original tag-coarseness issue resolved. New top issues are item-tag bugs (e.g., `vocab.n3.taiho` eligible for keigo templates) and prompt scaffolding — separate items.

---

## Calibration set for the score

**Problem.** The review-loop score is half deterministic, half qualitative-via-Claude. We measured ±1.4 pt variance, which is acceptable, but we haven't validated that the score *correlates with what a human would judge*.

**Proposed.** Hand-rate 5–10 captured scene runs on a 1–10 rubric (register fit, target naturalness, coherence, synthetic player believability). Store the ratings. Compute correlation with the algorithmic score.

- Correlation > 0.7 → trust the score as a gate signal
- Correlation 0.5–0.7 → trust as a soft signal but require human review for big decisions
- Correlation < 0.5 → reweight or rebuild the score

**Why deferred.** Need ~20 scene runs in `logs/review-reports/` first, so the calibration set is drawn from a representative range.

---

## Nightly automated `scene-review`

**Problem.** Currently `scene-review` is run manually. A nightly cron would surface regressions without active intervention.

**Proposed.** Cron entry:

```
0 3 * * * cd /path/to/hanare && npm run scene-review -- --strict >> logs/cron.log 2>&1
```

`--strict` exits non-zero if the circuit breaker trips (3 consecutive ≥15-pt regressions vs baseline), making the cron alert visible.

**Why deferred.** Skip until the baseline is trusted (5+ manual `scene-review` runs in a row producing stable deltas).

---

## Investigation: missing AI turns

**Problem.** Two earlier review runs flagged `missing_scripted_turn` for turn 4 and turn 6 in bookshop and cafe templates — the LLM dropped specific AI turns mid-generation. Cause unconfirmed; the prompt overload theory (forced passive-item coverage) was the most likely culprit, but the prompt has since been tightened and we haven't verified it's resolved.

**Proposed.** Run `scene-review` 5 times in a row, watch for `missing_scripted_turn` in the audit. If it recurs, instrument the dialogue generator to log the truncation point + token budget at fail time.

**Why deferred.** May already be fixed by the maxTokens bump and prompt rework. Wait for it to recur before spending diagnostic time.

---

## Fix-trial validation pattern

**Problem.** When applying a "known-good" fix, we want to *verify* the score moves correctly. Currently we eyeball the delta. A formal fix-trial pattern would record before/after scores explicitly so improvements are auditable.

**Proposed.** A simple `npm run fix-trial -- --label "markdown-strip"` workflow:

1. Snapshot current `logs/scene-runs.jsonl` + current `logs/review-baseline.json`
2. Run `scene-review`, record before-score
3. (Manual: apply the fix)
4. Run `scene-review` again, record after-score
5. Append `{label, beforeScore, afterScore, delta, timestamp}` to `logs/fix-trials.jsonl`

**Why deferred.** Nice-to-have. Can hand-track for now.

---

## A/B prompt eval harness

**Problem.** When tuning the dialogue generator or synthetic-player prompt, we eyeball whether the change improved things. With LLM stochasticity that's unreliable — a 2-point swing across 5 scenes is easily noise.

**Proposed.** `npm run ab-test -- --variant-a path/to/promptA.ts --variant-b path/to/promptB.ts --scenes 10` runs N scenes with each variant, scores both via the existing review-loop pipeline, and reports:

- Mean score per variant
- Distribution overlap (boxplot or simple summary stats)
- Per-category finding rate per variant
- Verdict: which wins, with rough confidence (e.g., "B wins by 6.2 pts; gap > variance, fairly confident")

Reuses the existing `runScene` + `auditSceneRunLogs` + `scoreReview` + `attribution` modules — the harness just runs two cohorts and diffs them.

**Why deferred.** Premature. The eval system already surfaces concrete content/code fixes (bookshop tag taxonomy, missing scripted turns) — those should land before we need an A/B framework. A/B becomes valuable once we're tuning specific prompts and want a rigorous "did my change help" signal.

**Estimate.** 1–2 hours: a thin orchestrator script + a comparison report renderer.
