# Testing Workflow

Use this workflow to check whether the system is working correctly. Run the cheap deterministic checks first, then use live scene runs to inspect LLM behavior.

## Cheatsheet

Three named workflows. Tell Claude "run code-check" / "run scene-review" / "run variance-check" or run them yourself:

| Name | Command | What it does | Speed | Cost |
|---|---|---|---|---|
| **code-check** | `npm run code-check` | typecheck + vitest. Fast deterministic floor. | seconds | free |
| **scene-review** | `npm run scene-review` | 5 scenes at N3 + audit + Claude qualitative review. Writes report to `logs/review-reports/latest.md`. | 3–5 min | claude session |
| **variance-check** | `npm run variance-check` | re-reviews the existing last 5 scene logs without generating new ones. Measures reviewer noise floor. | ~30 sec | claude session |

**When to use which:**
- After **any code change** → `code-check`
- After **prompt / template / item edits** → `code-check`, then `scene-review`, read `logs/review-reports/latest.md`
- When **suspicious of a score change** → `variance-check` twice; if score wobbles <3 pts the change is real signal

Override flags by calling `npm run review-loop -- ...` directly (e.g. different `--level`, `--scenes`, `--report`, `--strict`).


## 1. Static Baseline

Run these first:

```sh
npm run typecheck
npm test
```

If either command fails, fix that before judging scene quality. These checks cover the deterministic parts of the system: SRS picking, template scoring, evaluator rules, log writing, and mocked scene integration.

## 2. Focused Regression Tests

When changing one subsystem, run the matching test area:

```sh
npm test -- tests/evaluator
npm test -- tests/generator
npm test -- tests/srs
npm test -- tests/integration
```

For grammar and vocab detection issues, start with:

```sh
npm test -- tests/evaluator
```

## 3. Seed SRS State by JLPT Level

`npm run scene` writes `logs/srs-state.json` on first run. By default it seeds a small hand-picked set. To seed every item in `data/vocab.json` and `data/grammar.json` matching one or more JLPT levels:

```sh
npm run scene -- --level N2
npm run scene -- --level N3,N2
```

Notes:

- `--level` matches exactly. To include lower levels too, list them: `--level N5,N4,N3,N2`.
- If `logs/srs-state.json` already exists, passing `--level` re-seeds it. Pass `--reseed` (without `--level`) to reset to the default hand-picked seed.
- Levels are case-insensitive (`n2` works); valid values are `N5`, `N4`, `N3`, `N2`, `N1`.
- The flag only controls the initial seed — once items are scheduled, normal SRS picking takes over on subsequent runs.

## 4. Live Scene Smoke Batch

After deterministic tests pass, run multiple real scenes:

```sh
for i in {1..10}; do
  echo "=== scene $i ==="
  npm run scene || break
done
```

Increase the batch to 25 or 50 once the system is stable.

Each live scene appends a run to:

```text
logs/scene-runs.jsonl
```

## 5. Inspect Saved Logs

Render the latest saved run:

```sh
npm run render-log
```

Render a specific run by id:

```sh
npm run render-log -- --id=run-5d3849c9
```

Count total saved runs:

```sh
wc -l logs/scene-runs.jsonl
```

## 6. Audit Saved Logs

Run the deterministic log audit over all saved runs:

```sh
npm run audit-logs
```

Audit only the latest 10 runs:

```sh
npm run audit-logs -- --last=10
```

Audit one run:

```sh
npm run audit-logs -- --id=run-5d3849c9
```

The audit is local and rule-based. It does not call Gemini, Claude, Codex, or any other LLM. It checks log completeness, target placement, evaluator coverage, scripted turn coverage, and recent-template/location scoring rationale.

For CI-style behavior, fail the command on warnings or failures:

```sh
npm run audit-logs -- --last=10 --fail-on-issues
```

To ask Claude CLI or Codex CLI for a second-pass qualitative review, generate a review packet:

```sh
npm run audit-logs -- --last=10 --review-prompt > /tmp/hanare-log-review.md
```

Then pass `/tmp/hanare-log-review.md` to the CLI reviewer you want to use. The packet contains the deterministic audit plus rendered logs; the external reviewer should judge things the rule audit cannot, like dialogue coherence, awkward Japanese, unnatural target setup, and evaluator false positives.

## 7. Review Checklist

For each rendered live run, check:

- Did it choose a reasonable template for the active items?
- Did the briefing naturally set up the grammar and vocab?
- Did the player actually use the target correctly, not just trigger a surface match?
- Did the evaluator agree with what a human would mark?
- Are there false positives, such as accepting casual `見るつもり` when the target is specifically `見るつもりです`?
- Is the dialogue coherent across turns?
- Are outcomes aggregated once per active item?

## 8. Automated Review Loop

For qualitative evaluation that the deterministic audit cannot catch (register fit, dialogue coherence, item-context mismatches, synthetic player believability), use the review loop. It runs scenes, audits them, and sends a packet to your local `claude -p` session for a structured review.

```sh
# Run 5 scenes seeded at N3, full review:
npm run review-loop -- --scenes 5 --level N3

# Run 10 scenes without reseeding (use existing srs-state.json):
npm run review-loop -- --scenes 10

# Custom report path:
npm run review-loop -- --scenes 5 --level N2 --report /tmp/n2-review.md

# Strict mode: exit non-zero if the circuit breaker trips:
npm run review-loop -- --scenes 5 --level N3 --strict
```

The loop:

1. Optionally reseeds `logs/srs-state.json` to all items at the requested level.
2. Runs N scenes, appending to `logs/scene-runs.jsonl`.
3. Runs the deterministic audit on the last N runs.
4. Sends a review packet (audit + rendered logs) to `claude -p` with a structured rubric.
5. Computes a 0–100 score per run, plus a rolling baseline in `logs/review-baseline.json`.
6. Trips a circuit breaker if 3 consecutive runs drop more than 15 points below the baseline average.
7. Writes a categorized markdown report (default: `/tmp/review-report-<timestamp>.md`).

### Variance testing with `--no-rerun`

To check how stable the qualitative score is, re-review the same logs without generating new scenes:

```sh
# First, generate logs once:
npm run review-loop -- --scenes 5 --level N3

# Then re-review the same logs to measure noise:
npm run review-loop -- --scenes 5 --no-rerun
npm run review-loop -- --scenes 5 --no-rerun
```

`--no-rerun` skips the seed and scene-generation steps. Two re-reviews of identical logs should produce scores within ~3 points of each other; that's the qualitative noise floor of the LLM reviewer. Score deltas smaller than that are noise; deltas larger than ~7 points are real signal.

### Score weights

Each run starts at 100 and is penalized:

| Signal | Weight |
|---|---|
| Missing scripted AI turn | -8 |
| Active target leaked into AI speech | -5 |
| High-severity qualitative finding | -5 |
| Passive item missing from AI speech | -3 |
| Medium-severity qualitative finding | -2 |
| Low-severity qualitative finding | -0.5 |

Scoring math is unit-tested against captured fixtures in `tests/log/scoreReview.test.ts` — that's the layer that lives in `npm test` and prevents regressions in the scoring code itself.

### Workflow tiers

| Layer | Runs | Speed | Cost |
|---|---|---|---|
| `npm test` | every commit | seconds | free (no LLM) |
| `npm run review-loop -- --no-rerun` | manual / pre-PR | ~30s | small claude usage |
| `npm run review-loop` (full) | manual / nightly | 3–5 min | meaningful claude usage |

Do not wire the full review loop into `npm test`. Keep `npm test` deterministic and fast.

## 9. Failure Categories

When something looks wrong, classify it before fixing it:

```text
template selection issue
dialogue generation issue
synthetic player issue
evaluator false positive
evaluator false negative
lesson target wording issue
log/rendering issue
```

For example, accepting `見るつもり` for a target that requires `見るつもりです` is either an `evaluator false positive` or a `lesson target wording issue`, depending on whether casual `つもり` should count.

## Recommended Routine

Use this loop during development:

```text
typecheck -> full tests -> 10 live scenes -> inspect logs -> fix one failure category -> repeat
```
