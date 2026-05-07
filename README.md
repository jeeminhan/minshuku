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

Two layers: fast unit/integration tests, and a slower review-loop pipeline that catches quality regressions.

### Unit + integration

21 files, 101 tests under `tests/`:

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

### Review loop

The higher layer on top of unit tests:

```
scene runs → deterministic audit → review prompt
          → finding attribution → multi-session trends
```

See `docs/testing-workflow.md` for the full flow, `docs/BACKLOG.md` for deferred work (e.g. A/B prompt eval harness).

---

## Conventions

- **Templates** declare which JLPT items they can naturally surface. Multiple templates per setting (`minshuku-*`) keep variety high while still letting the generator filter for due items.
- **Logs are append-only** in `logs/`. Never edit a past run — re-run instead.
- **The evaluator is rule-based**, not LLM-graded. New grammar patterns need both data entries and matching evaluator logic.
- **Quality regressions** are caught by the review-loop pipeline, not by hand-reading transcripts.
