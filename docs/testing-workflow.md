# Testing Workflow

Use this workflow to check whether the system is working correctly. Run the cheap deterministic checks first, then use live scene runs to inspect LLM behavior.

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

## 3. Live Scene Smoke Batch

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

## 4. Inspect Saved Logs

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

## 5. Audit Saved Logs

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

## 6. Review Checklist

For each rendered live run, check:

- Did it choose a reasonable template for the active items?
- Did the briefing naturally set up the grammar and vocab?
- Did the player actually use the target correctly, not just trigger a surface match?
- Did the evaluator agree with what a human would mark?
- Are there false positives, such as accepting casual `見るつもり` when the target is specifically `見るつもりです`?
- Is the dialogue coherent across turns?
- Are outcomes aggregated once per active item?

## 7. Failure Categories

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
