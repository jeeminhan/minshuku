# minshuku

![minshuku](docs/assets/hero.png)

Text-based Japanese conversation practice. Step into a small guesthouse (民宿), run a scene with grandpa or the kid, and get graded on whether you actually used the target vocab and grammar correctly.

---

## How it works

1. **SRS picks what's due** — vocab and grammar items you need to review next.
2. **Generator picks a scene** — filters templates that can naturally host those items.
3. **LLM writes the dialogue** — short scene with an NPC, scripted turns.
4. **You reply in Japanese** — the NPC continues; you keep going.
5. **Evaluator grades each turn** — rule-based, checks target presence and conjugation.
6. **SRS updates** — correct items space out, missed items come back sooner.

Every run is logged to disk for audit and review.

---

## Quick start

```bash
npm install
cp .env.example .env            # add GEMINI_API_KEY
npm run scene                   # play one scene
```

Other useful commands:

| Command | What it does |
|---|---|
| `npm run scene` | Play a single scene interactively |
| `npm run scene-review` | Batch 5 N3 scenes + review packet |
| `npm run variance-check` | 5 scenes, no rerun — checks generator variance |
| `npm run render-log` | Pretty-print the latest run |
| `npm run audit-logs -- --last=10 --review-prompt` | Deterministic audit + review prompt |
| `npm run attribute` | Map review findings to upstream causes |
| `npm run trends` | Quality dashboard across recent sessions |

---

## Stack

- **TypeScript** — ESM, `tsx` for CLI scripts
- **`@google/genai`** — dialogue generation
- **`kuromoji`** — Japanese morphology (drives the conjugation evaluator)
- **`zod`** — schema validation
- **`vitest`** — tests

---

## Content

JLPT-tagged content lives in `data/`:

| Kind | Count | Spread |
|---|---|---|
| Vocab | 405 | ~80 per level (N5–N1) |
| Grammar | 103 | ~20 per level (N5–N1) |
| Templates | 12 | see below |

**Templates** — `minshuku-*` (grandpa tea room, laundry, dinner, evening with kid, package delivery, morning with mom, evening talk), plus `cafe-regular-encounter`, `shrine-afternoon-keeper`, `bookshop-quiet-browse`, `station-asking-directions`, `late-night-walk-stranger`.

---

## Data types

Defined in `src/lib/types.ts`. Beyond JLPT level, two dimensions drive planning:

```ts
type Register = "casual" | "neutral" | "polite" | "formal" | "literary";

type Domain =
  | "physical" | "emotional" | "abstract" | "social"
  | "temporal" | "commercial" | "ritual";
```

- **Register** — how formal the speech is.
- **Domain** — what semantic space the item lives in.

### Items

**`VocabItem`**
- core: `id`, `word`, `reading`, `meaning`, `partOfSpeech`, `jlptLevel`
- tagging: `scenarioTags[]`, `exampleSentences[]`
- optional: `register`, `domain[]`, `frequencyRank`

**`GrammarItem`**
- core: `id`, `pattern`, `meaning`, `jlptLevel`, `formation`
- tagging: `scenarioTags[]`, `exampleSentences[]`
- optional: `commonMistakes[]`, `register`, `domain[]`

### Scenes

**`SceneTemplate`** — what a scene-shape can host: `location`, `characters[]`, `scriptedTurns[]`, `microStakeSkeleton`, `registerTag`, `activeTargetCompatibility[]`, `passiveScenarioTags[]`, optional `acceptedDomains[]` / `acceptedRegisters[]`, `allowedNudges[]`, `exitBeat`.

**`ScenePlan`** — what the generator emits for one run: chosen template, filled-in micro-stake, `activeTargets[]` (items the player must produce), `passiveItems[]` (items the NPC surfaces), register tag, scripted turns.

### Outcomes

**`SceneRunLog`** — append-only record of one run, captured in three sections:

- **Generator decisions** — `templateCandidates`, `templateChosen`, `activeTargetsConsidered/Chosen`, `passiveItemsChosen`
- **LLM call** — `llmPrompt`, `llmResponse`, latency, cost
- **Execution** — `turns[]` with per-turn `evaluatorResults`, plus aggregated `itemOutcomes[]`

Per-item outcome ladder: `missed → recognized → produced_with_help → produced → mastered`.

---

## Layout

```
data/
  vocab.json, grammar.json     JLPT-tagged content (N5–N1)
  templates/                   12 scene templates

src/lib/
  generator/   filterTemplates, scoreTemplates, buildScenePlan,
               pickPassiveItems, registerDomainFit
  llm/         generateDialogue, syntheticPlayer, client
  evaluator/   ruleCheck, conjugation, evaluate
  srs/         intervals, pickDueItems, pickActiveTargets
  log/         sceneRunLog, renderSceneRunLog, recentContext,
               scoreReview, auditSceneRunLogs, attribution, trends

scripts/
  run-scene.ts            Play a scene interactively
  review-loop.ts          Run N scenes and bundle for review
  render-log.ts           Pretty-print a scene run
  audit-logs.ts           Deterministic audit + review packet
  attribute-findings.ts   Map review findings → upstream causes
  review-trends.ts        Quality dashboard across review sessions
  import-jlpt.ts          Import + enrich JLPT vocab/grammar
```

---

## Testing

Testing an LLM-driven app is different from testing a normal app. Most of the system is deterministic (SRS, template scoring, conjugation rules, log writing) — but the part that produces user-facing output is a model, and models drift. The architecture has two layers because no single layer can catch both kinds of bugs.

### The problem

- **Code regressions** — a refactor breaks template scoring, an evaluator rule starts mismatching `つもり`, the SRS interval math drifts. These are cheap to catch with unit tests.
- **Quality regressions** — the LLM starts writing stilted dialogue, a template picks an item that doesn't fit its register, the synthetic player stops sounding like a learner. Unit tests can't see these. Hand-reading transcripts works once and then stops happening.

So we run two layers, with very different speed/cost profiles, and don't pretend one replaces the other.

### Layer 1 — Deterministic tests (`npm test`)

21 files, 101 tests. Runs in seconds, no LLM calls, free. This is the floor: it gates every commit and proves the code-shaped parts of the system still work.

| Area | Files | What it covers |
|---|---|---|
| `content` | 1 | JSON shape, JLPT coverage, no orphan refs |
| `generator/` | 4 | Filtering, scoring, scene plan, passive selection (incl. register/domain fit) |
| `evaluator/` | 3 | Target presence, conjugation, end-to-end scoring |
| `llm/` | 2 | Dialogue generation contract (mocked), synthetic player |
| `srs/` | 3 | Intervals, due-item picking, active-target selection |
| `log/` | 7 | Run logs, rendering, context windowing, score review, audit, attribution, trends |
| `integration/` | 1 | End-to-end `runScene` with mocked LLM |

```bash
npm test            # vitest run
npm run test:watch  # watch mode
npm run code-check  # typecheck + tests
```

The integration test mocks the LLM — it proves the pipeline wires up correctly, not that the LLM produces good output. That's what Layer 2 is for.

### Layer 2 — Review loop (qualitative regression)

The review loop runs real scenes through the real LLM and grades them. It exists because:

> Code can pass every unit test and still produce dialogue that no human would call good Japanese.

Pipeline:

```
scene runs  →  deterministic audit  →  Claude review (rubric)
            →  finding attribution  →  multi-session trends
```

1. **Scene runs** — generate N scenes against the live LLM, log everything.
2. **Deterministic audit** — rule-based checks: log completeness, target placement, evaluator coverage, scoring rationale. Cheap, no LLM.
3. **Claude review** — sends the audit + rendered transcripts to a local `claude -p` session with a structured rubric. Produces a 0–100 score per run plus categorized findings.
4. **Attribution** — maps each finding to its upstream cause: template, generator, LLM, or evaluator. Tells you *where* to fix, not just *what* broke.
5. **Trends** — tracks score and finding categories across sessions in `logs/review-baseline.json`. Trips a circuit breaker if 3 consecutive runs drop >15 points below baseline.

Commands:

```bash
npm run scene-review     # 5 scenes at N3, full review (~3–5 min)
npm run variance-check   # re-review existing logs, no new scenes
npm run trends           # dashboard across recent sessions
npm run attribute        # finding → root cause map
```

### Variance testing

LLM-graded output is noisy. The same logs reviewed twice won't get the exact same score. So before treating a score change as a real regression, you run `variance-check` to measure the noise floor — typically ~3 points. Score deltas under that are noise; deltas over ~7 points are real signal.

This matters because without it, every prompt tweak looks like an improvement or a regression depending on the dice roll. Variance-check forces honesty.

### Why both layers

| Question | Answered by |
|---|---|
| Did I break the code? | Layer 1 (`npm test`) |
| Did I break quality? | Layer 2 (`scene-review`) |
| Is the score change real or noise? | `variance-check` |
| Where is the regression coming from? | `attribute` |
| Is quality drifting over time? | `trends` |

Layer 1 is the gate. Layer 2 is the radar. Neither replaces the other.

For full operational details — flags, scoring weights, failure categories, recommended routines — see `docs/testing-workflow.md`. Deferred work (e.g. A/B prompt eval harness) lives in `docs/BACKLOG.md`.

---

## Conventions

- **Templates** declare which JLPT items they can naturally surface. Multiple templates per setting (`minshuku-*`) keep variety high while still letting the generator filter for due items.
- **Logs are append-only** in `logs/`. Never edit a past run — re-run instead.
- **The evaluator is rule-based**, not LLM-graded. New grammar patterns need both data entries and matching evaluator logic.
- **Quality regressions** are caught by the review-loop pipeline, not by hand-reading transcripts.
