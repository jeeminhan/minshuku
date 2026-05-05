# Backlog

Deferred work, in priority order. Not blocking anything that's been built; queue items here when they come up so they don't get lost.

## Domain + register tagging on vocab/grammar

**Problem.** Every item has `scenarioTags` (a bag of tags about *where the word might come up*), but two dimensions are invisible to the planner:

- **Register** — is this word casual, neutral, polite, formal, or literary?
- **Domain** — does this word belong to physical, emotional, abstract, social, temporal, commercial, or ritual semantic space?

Without these, the planner forces words into incompatible templates. Examples the review loop has caught:

- `清潔` ("physically clean") got dropped into a bookshop chat about a "clean novel feeling" — wrong domain (physical → emotional/aesthetic).
- `願う` ("wish/hope" — formal/written) got forced into a casual cafe chat — wrong register.

**Proposed schema additions.**

`VocabItem` and `GrammarItem`:

```ts
register: "casual" | "neutral" | "polite" | "formal" | "literary";
domain: ("physical" | "emotional" | "abstract" | "social" | "temporal" | "commercial" | "ritual")[];
```

`SceneTemplate`:

```ts
acceptedDomains: string[];        // domains that fit this scene-shape
acceptedRegisters?: string[];     // optional override; defaults derived from registerTag
```

**Filter logic.** In `src/lib/generator/filterTemplates.ts`, two new gates after the existing tag check:

1. `template.acceptedRegisters` (or default: registers compatible with `template.registerTag`) must include `item.register`
2. At least one `item.domain` must overlap with `template.acceptedDomains`

**Work involved.**

- Schema migration: extend zod schemas in `src/lib/content.ts`, add fields to types
- Re-tag all 508 items: probably an LLM-assisted import similar to the original enrichment, run once
- Add `acceptedDomains` (and optional `acceptedRegisters`) to all 12 templates
- Update `filterTemplates` with the new gates + tests
- Update `pickActiveTargets` / `pickPassiveItems` if they need awareness

**Estimate.** 1–2 hours of focused work plus the LLM enrichment pass for re-tagging.

**Why deferred.** Real architectural work; not urgent until the review loop keeps flagging item-context mismatches as a top finding pattern.

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
