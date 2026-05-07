# minshuku

![minshuku](docs/assets/hero.png)

Text-based Japanese conversation practice. You step into a small Japanese guesthouse (民宿) and run scenes — ordering tea with grandpa, helping with laundry, talking to a kid about their day. The system picks vocab and grammar that are due for review (SRS), generates a scene around them, plays an NPC, and grades your replies on whether you actually used the target items correctly.

## What it does

- **Scene generation** — picks JLPT-tagged vocab/grammar that are due, filters templates that can naturally surface those items, and asks an LLM to write a short dialogue.
- **Conversation loop** — you reply in Japanese; the NPC continues; the rule-based evaluator checks each turn for target usage and conjugation correctness.
- **SRS** — items that you used correctly get spaced further out; items you missed come back sooner.
- **Audit + review** — every scene run is logged to disk; CLI tools render runs as readable transcripts, attribute findings to upstream causes (template / generator / LLM), and trend quality across batches.

## Stack

- TypeScript (ESM, `tsx` for CLI scripts)
- `@google/genai` for dialogue generation
- `kuromoji` for Japanese morphological analysis (used by the conjugation evaluator)
- `zod` for schema validation
- `vitest` for tests

## Content

JLPT-tagged content lives in `data/`:

- **Vocab** — 405 items across N5–N1 (~80 per level)
- **Grammar** — 103 patterns across N5–N1 (~20 per level)
- **Templates** — 12 scene templates: `minshuku-*` (grandpa tea room, laundry, dinner, evening with kid, package delivery, morning with mom, evening talk), plus `cafe-regular-encounter`, `shrine-afternoon-keeper`, `bookshop-quiet-browse`, `station-asking-directions`, `late-night-walk-stranger`

### Data types

Defined in `src/lib/types.ts`. The two dimensions that drive planning beyond JLPT level are **register** (how formal the speech is) and **domain** (what semantic space the item lives in):

```ts
type Register = "casual" | "neutral" | "polite" | "formal" | "literary";

type Domain =
  | "physical" | "emotional" | "abstract" | "social"
  | "temporal" | "commercial" | "ritual";
```

**`VocabItem`** — `id`, `word`, `reading`, `meaning`, `partOfSpeech`, `jlptLevel`, `scenarioTags[]`, `exampleSentences[]`, optional `register`, `domain[]`, `frequencyRank`.

**`GrammarItem`** — `id`, `pattern`, `meaning`, `jlptLevel`, `formation`, `scenarioTags[]`, `exampleSentences[]`, optional `commonMistakes[]`, `register`, `domain[]`.

**`SceneTemplate`** — `id`, `location`, `characters[]`, `scriptedTurns[]`, `microStakeSkeleton`, `registerTag`, `activeTargetCompatibility[]`, `passiveScenarioTags[]`, optional `acceptedDomains[]` / `acceptedRegisters[]`, `allowedNudges[]`, `exitBeat`.

**`ScenePlan`** — what the generator emits: chosen template, characters, filled-in micro-stake, `activeTargets[]` (items the player must produce), `passiveItems[]` (items the NPC surfaces), register tag, scripted turns.

**`SceneRunLog`** — append-only record of one run: generator decisions (`templateCandidates`, `templateChosen`, `activeTargetsConsidered/Chosen`, `passiveItemsChosen`), LLM call (`llmPrompt`, `llmResponse`, latency, cost), execution (`turns[]` with per-turn `evaluatorResults`), and aggregated `itemOutcomes[]`. Outcomes are `missed | recognized | produced_with_help | produced | mastered`.

## Layout

```
data/
  vocab.json, grammar.json     JLPT-tagged content (N5–N1)
  templates/                   12 scene templates
src/lib/
  generator/                   filterTemplates, scoreTemplates,
                               buildScenePlan, pickPassiveItems,
                               registerDomainFit
  llm/                         generateDialogue, syntheticPlayer, client
  evaluator/                   ruleCheck, conjugation, evaluate
  srs/                         intervals, pickDueItems, pickActiveTargets
  log/                         sceneRunLog, renderSceneRunLog,
                               recentContext, scoreReview,
                               auditSceneRunLogs, attribution, trends
scripts/
  run-scene.ts                 Run a single scene interactively
  review-loop.ts               Run N scenes and bundle for review
  render-log.ts                Pretty-print a scene run
  audit-logs.ts                Deterministic audit + review packet
  attribute-findings.ts        Map review findings → upstream causes
  review-trends.ts             Quality dashboard across review sessions
  import-jlpt.ts               Import + enrich JLPT vocab/grammar
```

## Running

```bash
npm install
cp .env.example .env            # add GEMINI_API_KEY
npm run scene                   # play a scene
npm run scene-review            # batch run + review packet (5 scenes, N3)
npm run variance-check          # 5-scene run, no rerun (checks generator variance)
npm run render-log              # pretty-print latest run
npm run audit-logs -- --last=10 --review-prompt
npm run attribute               # attribute review findings to root cause
npm run trends                  # quality trend across recent review sessions
```

## Test suite

21 test files, 101 tests, all under `tests/`:

| Area | Files | What it covers |
|---|---|---|
| `content.test.ts` | 1 | Vocab/grammar JSON shape, JLPT level coverage, no orphan refs |
| `generator/` | 4 | Template filtering by required items, scoring, scene plan assembly, passive-item selection (incl. register/domain fit) |
| `evaluator/` | 3 | Target presence in user turns, conjugation correctness, end-to-end rule-based scoring |
| `llm/` | 2 | Dialogue generation contract (mocked Gemini), synthetic player for offline scene runs |
| `srs/` | 3 | Interval scheduling, due-item picking, active-target selection |
| `log/` | 7 | Scene run log shape, rendering, recent-context windowing, score review, deterministic audit, finding attribution, multi-session trends |
| `integration/` | 1 | End-to-end `runScene` with mocked LLM — full pipeline produces a complete `SceneRunLog` |

```bash
npm test            # vitest run
npm run test:watch  # watch mode
npm run code-check  # typecheck + tests
```

The review-loop pipeline is the higher layer on top of unit tests: scene runs → deterministic audit → review prompt → finding attribution → multi-session trend dashboard. See `docs/testing-workflow.md` for the full flow and `docs/BACKLOG.md` for deferred work (e.g. A/B prompt eval harness).

## Conventions

- Templates live in `data/templates/*.json` and declare which JLPT items they can naturally surface. Multiple templates per setting (`minshuku-*`) keep variety high while still letting the generator filter for due items.
- Scene runs are append-only logs in `logs/`. Never edit a past run — re-run instead.
- The evaluator is rule-based, not LLM-graded. New grammar patterns need both data entries and matching evaluator logic.
- Quality regressions are caught by the review loop → attribution → trends pipeline, not by hand-reading transcripts.
