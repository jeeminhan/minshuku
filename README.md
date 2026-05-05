# minshuku

Text-based Japanese conversation practice. You step into a small Japanese guesthouse (民宿) and run scenes — ordering tea with grandpa, helping with laundry, talking to a kid about their day. The system picks vocab and grammar that are due for review (SRS), generates a scene around them, plays an NPC, and grades your replies on whether you actually used the target items correctly.

## What it does

- **Scene generation** — picks JLPT-tagged vocab/grammar that are due, filters templates that can naturally surface those items, and asks an LLM to write a short dialogue.
- **Conversation loop** — you reply in Japanese; the NPC continues; the rule-based evaluator checks each turn for target usage and conjugation correctness.
- **SRS** — items that you used correctly get spaced further out; items you missed come back sooner.
- **Audit + review** — every scene run is logged to disk; CLI tools render runs as readable transcripts and bundle batches for external review.

## Stack

- TypeScript (ESM, `tsx` for CLI scripts)
- `@google/genai` for dialogue generation
- `kuromoji` for Japanese morphological analysis (used by the conjugation evaluator)
- `zod` for schema validation
- `vitest` for tests

## Layout

```
data/
  vocab.json, grammar.json     JLPT-tagged content (N5–N1)
  templates/                   Scene templates (minshuku-*, cafe-*, shrine-*, etc.)
src/lib/
  generator/                   Template filtering, scoring, scene plan
  llm/                         Dialogue generation + synthetic player
  evaluator/                   Rule-based checks (target presence, conjugation)
  srs/                         Spaced repetition scheduling
  log/                         Scene run logs, rendering, audit
scripts/
  run-scene.ts                 Run a single scene interactively
  review-loop.ts               Run N scenes and bundle for review
  render-log.ts                Pretty-print a scene run
  audit-logs.ts                Deterministic audit + review packet
  import-jlpt.ts               Import + enrich JLPT vocab/grammar
```

## Running

```bash
npm install
cp .env.example .env            # add GEMINI_API_KEY
npm run scene                   # play a scene
npm run scene-review            # batch run + review packet (5 scenes, N3)
npm run render-log              # pretty-print latest run
npm run audit-logs -- --last=10 --review-prompt
```

## Test suite

19 test files, 75 tests, all under `tests/`:

| Area | Files | What it covers |
|---|---|---|
| `content.test.ts` | 1 | Vocab/grammar JSON shape, JLPT level coverage, no orphan refs |
| `generator/` | 4 | Template filtering by required items, scoring, scene plan assembly, passive-item selection |
| `evaluator/` | 3 | Target presence in user turns, conjugation correctness, rule-based scoring |
| `llm/` | 2 | Dialogue generation contract (mocked Gemini), synthetic player for offline scene runs |
| `srs/` | 3 | Interval scheduling, due-item picking, active-target selection |
| `log/` | 5 | Scene run log shape, rendering, recent-context windowing, score review, deterministic audit |
| `integration/` | 1 | End-to-end `runScene` with mocked LLM — full pipeline produces a complete `SceneRunLog` |

```bash
npm test            # vitest run
npm run test:watch  # watch mode
npm run code-check  # typecheck + tests
```

## Conventions

- Templates live in `data/templates/*.json` and declare which JLPT items they can naturally surface. Multiple templates per setting (`minshuku-*`) keep variety high while still letting the generator filter for due items.
- Scene runs are append-only logs in `logs/`. Never edit a past run — re-run instead.
- The evaluator is rule-based, not LLM-graded. New grammar patterns need both data entries and matching evaluator logic.
