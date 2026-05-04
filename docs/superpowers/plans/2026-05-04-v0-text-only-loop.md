# Hanare v0 — Text-Only Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A CLI command that runs one full scene end-to-end in text mode — exercising SRS → template selection → LLM dialogue generation → synthetic player → rule-based evaluator → structured `SceneRunLog`. No audio, no UI, no onboarding.

**Architecture:** Plain Node.js + TypeScript project (no Next.js yet — v0 is CLI only; Next.js arrives in a later plan when the Scene Replay viewer needs a UI). All content (vocab, grammar, scene templates) lives as JSON files. SRS state and run logs are JSON/JSONL on disk. LLM calls go directly through the Anthropic SDK. Synthetic player is an LLM persona. Evaluator is rule-based only (target-presence + conjugation via kuromoji); LLM judge layer arrives in a later plan.

**Tech Stack:** Node.js 20+, TypeScript 5+, npm, Vitest (testing), tsx (TS runtime for CLI scripts), `@anthropic-ai/sdk` (LLM client), `kuromoji` (JP morphological analyzer), `zod` (runtime JSON validation), `dotenv` (env vars).

**Repository:** `/Users/jeeminhan/Code/hanare`. Currently contains only `.git`, `.gitignore`, `.superpowers/` (gitignored), and `docs/`.

**Spec reference:** `docs/superpowers/specs/2026-05-04-foundational-design.md`. Especially §6 (Scene), §9 (Variety mechanism), §15 (Data model), §16 (Generation pipeline), §17 (Evaluator), §20 (Testing strategy), §24 (Build order).

**Done condition** (from spec §24): a developer can run `npm run scene` once, see a full scene transcript with assigned items and rule-based evaluator outcomes printed to terminal, and inspect a JSONL `SceneRunLog` file capturing every generator decision.

---

## File Structure

This is the file tree this plan produces. Each file has one focused responsibility.

```
hanare/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
├── .gitignore
├── data/
│   ├── vocab.json
│   ├── grammar.json
│   └── templates/
│       ├── minshuku-evening-with-kid.json
│       └── minshuku-morning-with-mom.json
├── src/
│   └── lib/
│       ├── types.ts                     # All shared TS types
│       ├── content.ts                   # Loaders for vocab/grammar/templates
│       ├── srs/
│       │   ├── intervals.ts             # Interval/ease/lapse update math
│       │   ├── pickDueItems.ts          # Pick today's due items
│       │   └── pickActiveTargets.ts     # Pick 1-2 active targets from due
│       ├── generator/
│       │   ├── filterTemplates.ts       # Filter by active-target compatibility
│       │   ├── scoreTemplates.ts        # Score candidates for variety
│       │   ├── pickPassiveItems.ts      # Pick passive items to fit chosen template
│       │   └── buildScenePlan.ts        # Combine into a structured scene plan
│       ├── llm/
│       │   ├── client.ts                # Anthropic SDK wrapper
│       │   ├── generateDialogue.ts      # Turn scene plan into dialogue script
│       │   └── syntheticPlayer.ts       # LLM persona that responds as a player
│       ├── evaluator/
│       │   ├── conjugation.ts           # kuromoji-backed morphology check
│       │   ├── ruleCheck.ts             # Target-presence rule
│       │   └── evaluate.ts              # Orchestrate per-turn evaluation
│       ├── log/
│       │   └── sceneRunLog.ts           # JSONL writer for SceneRunLog
│       └── runScene.ts                  # Top-level orchestrator (one full scene)
├── scripts/
│   ├── run-scene.ts                     # CLI: runs one scene end-to-end
│   └── render-log.ts                    # CLI: pretty-prints a SceneRunLog
├── tests/
│   ├── srs/
│   │   ├── intervals.test.ts
│   │   ├── pickDueItems.test.ts
│   │   └── pickActiveTargets.test.ts
│   ├── generator/
│   │   ├── filterTemplates.test.ts
│   │   ├── scoreTemplates.test.ts
│   │   ├── pickPassiveItems.test.ts
│   │   └── buildScenePlan.test.ts
│   ├── evaluator/
│   │   ├── conjugation.test.ts
│   │   ├── ruleCheck.test.ts
│   │   └── evaluate.test.ts
│   ├── content.test.ts
│   ├── log/sceneRunLog.test.ts
│   └── integration/runScene.test.ts     # End-to-end with mocked LLM
└── logs/                                 # SceneRunLog output dir (gitignored)
```

---

## Task 1: Scaffold the Node + TypeScript project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "hanare",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "scene": "tsx scripts/run-scene.ts",
    "render-log": "tsx scripts/render-log.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "isolatedModules": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "scripts/**/*", "tests/**/*"],
  "exclude": ["node_modules", "logs"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
```

- [ ] **Step 4: Create `.env.example`**

```
ANTHROPIC_API_KEY=
```

- [ ] **Step 5: Update `.gitignore`** — add Node, env, and logs entries

```
.superpowers/
node_modules/
logs/
.env
.env.local
*.log
.DS_Store
```

- [ ] **Step 6: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .env.example .gitignore
git commit -m "chore: scaffold node/typescript project for v0"
```

---

## Task 2: Install core dependencies

**Files:**
- Modify: `package.json`
- Create: `package-lock.json` (auto-generated)

- [ ] **Step 1: Install runtime deps**

Run:
```bash
npm install @anthropic-ai/sdk kuromoji zod dotenv
```

Expected: `package.json` now has `dependencies`. `node_modules/` populated.

- [ ] **Step 2: Install dev deps**

Run:
```bash
npm install --save-dev typescript tsx vitest @types/node @types/kuromoji
```

Expected: `package.json` has `devDependencies` populated.

- [ ] **Step 3: Verify versions**

Run:
```bash
npm list --depth=0
```

Expected: prints all top-level deps with no `UNMET` errors.

- [ ] **Step 4: Verify TypeScript compiles**

Run:
```bash
npm run typecheck
```

Expected: no errors (no source files yet, so typecheck passes trivially).

- [ ] **Step 5: Verify Vitest runs**

Run:
```bash
npm test
```

Expected: "No test files found" — Vitest exits cleanly.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install runtime + dev dependencies"
```

---

## Task 3: Define core TypeScript types

**Files:**
- Create: `src/lib/types.ts`
- Test: `tests/content.test.ts` (covered in Task 7 — types alone are not tested)

- [ ] **Step 1: Create `src/lib/types.ts`**

```typescript
// Core domain types for Hanare v0.
// Mirrors the data model in docs/superpowers/specs/2026-05-04-foundational-design.md §15.
// Optional fields not used in v0 are commented out for forward compatibility.

export type ItemType = "vocab" | "grammar";

export interface VocabItem {
  id: string;
  word: string;          // e.g., "窓"
  reading: string;       // e.g., "まど"
  meaning: string;       // English gloss
  partOfSpeech: string;  // e.g., "noun"
  jlptLevel: "N5" | "N4" | "N3" | "N2" | "N1";
  frequencyRank?: number;
  scenarioTags: string[];
  exampleSentences: string[];
}

export interface GrammarItem {
  id: string;
  pattern: string;       // e.g., "つもり"
  meaning: string;       // English gloss
  jlptLevel: "N5" | "N4" | "N3" | "N2" | "N1";
  formation: string;     // e.g., "Verb dictionary form + つもりです"
  scenarioTags: string[];
  exampleSentences: string[];
  commonMistakes?: string[];
}

export interface CharacterRef {
  id: string;            // e.g., "kid", "mom", "shrine_keeper"
  role: string;          // e.g., "host_family_kid"
  voiceConfig?: string;  // TTS voice ID, unused in v0
}

export interface ScriptedTurn {
  turn: number;
  speaker: "coach" | "player" | string; // string = character id
}

export interface SceneTemplate {
  id: string;
  location: string;
  characters: CharacterRef[];
  scriptedTurns: ScriptedTurn[];
  microStakeSkeleton: string;
  registerTag: "casual" | "polite" | "elder" | "keigo";
  // Items the template can host as the active target. e.g., ["grammar:つもり", "tag:planning"].
  activeTargetCompatibility: string[];
  // Tags drawn on for passive items. e.g., ["evening", "weather"].
  passiveScenarioTags: string[];
  allowedNudges: string[];
  exitBeat: string;
  flags?: {
    mysteryPorous?: boolean;
    opensThread?: boolean;
    requiresOpenThread?: boolean;
  };
}

export interface ReviewItem {
  itemId: string;
  itemType: ItemType;
  lastReviewedAt: string | null;  // ISO date
  nextReviewAt: string | null;    // ISO date
  ease: number;                    // SM2-ish ease factor
  interval: number;                // days
  lapses: number;
}

export type RecallMode = "active" | "passive";
export type Outcome =
  | "missed"
  | "recognized"
  | "produced_with_help"
  | "produced"
  | "mastered";

export interface ItemAssignment {
  itemId: string;
  itemType: ItemType;
  mode: RecallMode;
}

export interface ScenePlan {
  templateId: string;
  location: string;
  characters: CharacterRef[];
  microStake: string;            // filled-in version of the skeleton
  activeTargets: ItemAssignment[];
  passiveItems: ItemAssignment[];
  registerTag: SceneTemplate["registerTag"];
  scriptedTurns: ScriptedTurn[];
}

export interface DialogueLine {
  turn: number;
  speaker: "coach" | "player" | string;
  text: string;     // for v0, this is the LLM-generated text (player turns are placeholder until synthetic player runs)
  language: "ja" | "en";
}

export interface EvaluatorResult {
  itemId: string;
  mode: RecallMode;
  outcome: Outcome;
  evidence: {
    targetPresent?: boolean;
    morphologyOk?: boolean;
    sttConfidence?: number;       // not used in v0 (no STT), kept for forward compat
    lowConfidence?: boolean;
    notes?: string;
  };
}

export interface TemplateScoringRationale {
  templateId: string;
  finalScore: number;
  reasons: string[];
}

export interface SceneRunLog {
  id: string;                     // run-uuid
  userId: string;                 // "default" for v0 single-user mode
  templateId: string;
  startedAt: string;
  endedAt: string;

  // generator decisions
  activeTargetsConsidered: ItemAssignment[];
  activeTargetsChosen: ItemAssignment[];
  templateCandidates: TemplateScoringRationale[];
  templateChosen: { id: string; finalScore: number };

  // narrative state — empty in v0 (threads + beats arrive in later plans)
  threadAction: "standalone";
  beatFired: null;

  // generation
  llmPrompt: string;
  llmResponse: string;
  llmCost?: number;
  llmLatencyMs?: number;

  // execution
  briefing: string;               // English coach text from generateDialogue
  result: string;                 // English coach text from generateDialogue
  turns: Array<{
    turn: number;
    speaker: string;
    text: string;
    evaluatorResults?: EvaluatorResult[];  // present only on player turns
  }>;

  // outcomes — aggregated per active item (best outcome across all player turns)
  itemOutcomes: EvaluatorResult[];
}
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): define core domain types"
```

---

## Task 4: Author seed vocabulary content

**Files:**
- Create: `data/vocab.json`

- [ ] **Step 1: Create `data/vocab.json`**

```json
[
  {
    "id": "vocab.mado",
    "word": "窓",
    "reading": "まど",
    "meaning": "window",
    "partOfSpeech": "noun",
    "jlptLevel": "N5",
    "frequencyRank": 720,
    "scenarioTags": ["minshuku", "evening", "weather"],
    "exampleSentences": [
      "窓の外を見てください。",
      "窓の近くの席でもいいですか？"
    ]
  },
  {
    "id": "vocab.yakusoku",
    "word": "約束",
    "reading": "やくそく",
    "meaning": "promise",
    "partOfSpeech": "noun",
    "jlptLevel": "N4",
    "frequencyRank": 1100,
    "scenarioTags": ["minshuku", "planning"],
    "exampleSentences": [
      "明日の約束、覚えてる？",
      "約束ね。"
    ]
  },
  {
    "id": "vocab.fushigi",
    "word": "不思議",
    "reading": "ふしぎ",
    "meaning": "mysterious; strange",
    "partOfSpeech": "na-adjective",
    "jlptLevel": "N3",
    "frequencyRank": 2500,
    "scenarioTags": ["minshuku", "evening", "soft-magical"],
    "exampleSentences": [
      "ちょっと不思議なんだけど。",
      "不思議な話を聞いた。"
    ]
  },
  {
    "id": "vocab.ame",
    "word": "雨",
    "reading": "あめ",
    "meaning": "rain",
    "partOfSpeech": "noun",
    "jlptLevel": "N5",
    "frequencyRank": 600,
    "scenarioTags": ["weather", "evening", "morning"],
    "exampleSentences": [
      "明日、雨だって。",
      "雨が降ってる。"
    ]
  },
  {
    "id": "vocab.motsu",
    "word": "持つ",
    "reading": "もつ",
    "meaning": "to hold; to have",
    "partOfSpeech": "godan-verb",
    "jlptLevel": "N5",
    "frequencyRank": 250,
    "scenarioTags": ["minshuku", "everyday"],
    "exampleSentences": [
      "傘を持って行く。",
      "誰が持ってる？"
    ]
  }
]
```

- [ ] **Step 2: Validate it parses as JSON**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('data/vocab.json','utf8'))"
```

Expected: no output (parse succeeds silently).

- [ ] **Step 3: Commit**

```bash
git add data/vocab.json
git commit -m "data(content): seed 5 vocab items for v0"
```

---

## Task 5: Author seed grammar content

**Files:**
- Create: `data/grammar.json`

- [ ] **Step 1: Create `data/grammar.json`**

```json
[
  {
    "id": "grammar.tsumori",
    "pattern": "つもり",
    "meaning": "intend to / plan to do something",
    "jlptLevel": "N3",
    "formation": "Verb dictionary form + つもりです",
    "scenarioTags": ["planning", "minshuku", "weekend", "evening"],
    "exampleSentences": [
      "明日、教会に行くつもりです。",
      "週末は何をするつもり？"
    ],
    "commonMistakes": [
      "Using past-tense verb (e.g., 行ったつもり) — that means 'pretended to', not 'plan to'."
    ]
  },
  {
    "id": "grammar.temo-ii",
    "pattern": "てもいい",
    "meaning": "may / it's OK to",
    "jlptLevel": "N4",
    "formation": "Verb te-form + もいい(です/ですか)",
    "scenarioTags": ["minshuku", "permission"],
    "exampleSentences": [
      "見てもいいですか？",
      "ここで待ってもいい？"
    ]
  },
  {
    "id": "grammar.dakara",
    "pattern": "から",
    "meaning": "because / so",
    "jlptLevel": "N5",
    "formation": "Reason から conclusion",
    "scenarioTags": ["minshuku", "everyday"],
    "exampleSentences": [
      "雨だから、傘を持って行く。",
      "寒いから、窓を閉めよう。"
    ]
  }
]
```

- [ ] **Step 2: Validate JSON**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('data/grammar.json','utf8'))"
```

Expected: silent (parse succeeds).

- [ ] **Step 3: Commit**

```bash
git add data/grammar.json
git commit -m "data(content): seed 3 grammar items for v0"
```

---

## Task 6: Author two scene templates

**Files:**
- Create: `data/templates/minshuku-evening-with-kid.json`
- Create: `data/templates/minshuku-morning-with-mom.json`

- [ ] **Step 1: Create `data/templates/minshuku-evening-with-kid.json`**

```json
{
  "id": "minshuku-evening-with-kid",
  "location": "minshuku",
  "characters": [
    { "id": "kid", "role": "host_family_kid", "voiceConfig": "ja-young-casual" }
  ],
  "scriptedTurns": [
    { "turn": 1, "speaker": "coach" },
    { "turn": 2, "speaker": "kid" },
    { "turn": 3, "speaker": "player" },
    { "turn": 4, "speaker": "kid" },
    { "turn": 5, "speaker": "player" },
    { "turn": 6, "speaker": "kid" },
    { "turn": 7, "speaker": "player" },
    { "turn": 8, "speaker": "coach" }
  ],
  "microStakeSkeleton": "It's evening at the minshuku. Hiro (the host family kid) is curious about your plans for tomorrow. He's been thinking about the weather and wonders if you'll go out.",
  "registerTag": "casual",
  "activeTargetCompatibility": [
    "grammar:つもり",
    "tag:planning",
    "tag:weekend",
    "tag:evening"
  ],
  "passiveScenarioTags": ["evening", "weather", "minshuku", "planning"],
  "allowedNudges": [
    "If the player doesn't reach for the active target, the kid asks a follow-up question that invites it naturally."
  ],
  "exitBeat": "The kid says good night and mentions he's looking forward to tomorrow."
}
```

- [ ] **Step 2: Create `data/templates/minshuku-morning-with-mom.json`**

```json
{
  "id": "minshuku-morning-with-mom",
  "location": "minshuku",
  "characters": [
    { "id": "mom", "role": "host_family_mom", "voiceConfig": "ja-warm-female" }
  ],
  "scriptedTurns": [
    { "turn": 1, "speaker": "coach" },
    { "turn": 2, "speaker": "mom" },
    { "turn": 3, "speaker": "player" },
    { "turn": 4, "speaker": "mom" },
    { "turn": 5, "speaker": "player" },
    { "turn": 6, "speaker": "mom" },
    { "turn": 7, "speaker": "player" },
    { "turn": 8, "speaker": "coach" }
  ],
  "microStakeSkeleton": "It's morning at the minshuku. Mom is making breakfast and asks gently about how you slept and what you're up to today.",
  "registerTag": "polite",
  "activeTargetCompatibility": [
    "grammar:つもり",
    "grammar:てもいい",
    "tag:planning",
    "tag:permission",
    "tag:morning"
  ],
  "passiveScenarioTags": ["morning", "weather", "minshuku", "everyday"],
  "allowedNudges": [
    "If the player doesn't reach for the active target, mom rephrases warmly."
  ],
  "exitBeat": "Mom wishes you a good day and reminds you about lunch."
}
```

- [ ] **Step 3: Validate both JSON files**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('data/templates/minshuku-evening-with-kid.json','utf8')); JSON.parse(require('fs').readFileSync('data/templates/minshuku-morning-with-mom.json','utf8'))"
```

Expected: silent (both parse).

- [ ] **Step 4: Commit**

```bash
git add data/templates/
git commit -m "data(content): author 2 minshuku scene templates"
```

---

## Task 7: Content loader (read JSON, validate with zod)

**Files:**
- Create: `src/lib/content.ts`
- Test: `tests/content.test.ts`

- [ ] **Step 1: Write the failing test — `tests/content.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { loadVocab, loadGrammar, loadTemplates } from "@/lib/content";

describe("content loader", () => {
  it("loads vocab.json into typed VocabItem array", () => {
    const vocab = loadVocab();
    expect(vocab.length).toBeGreaterThan(0);
    const mado = vocab.find((v) => v.id === "vocab.mado");
    expect(mado).toBeDefined();
    expect(mado?.word).toBe("窓");
    expect(mado?.jlptLevel).toBe("N5");
  });

  it("loads grammar.json into typed GrammarItem array", () => {
    const grammar = loadGrammar();
    expect(grammar.length).toBeGreaterThan(0);
    const tsumori = grammar.find((g) => g.id === "grammar.tsumori");
    expect(tsumori).toBeDefined();
    expect(tsumori?.pattern).toBe("つもり");
  });

  it("loads all template files in data/templates/", () => {
    const templates = loadTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(2);
    const evening = templates.find((t) => t.id === "minshuku-evening-with-kid");
    expect(evening).toBeDefined();
    expect(evening?.location).toBe("minshuku");
  });

  it("rejects malformed data (zod validates)", () => {
    // smoke test that zod is applied — actual malformed file test deferred
    expect(() => loadVocab()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test (it should fail because content.ts doesn't exist)**

Run: `npm test -- tests/content.test.ts`
Expected: FAIL with "Cannot find module '@/lib/content'".

- [ ] **Step 3: Create `src/lib/content.ts`**

```typescript
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { VocabItem, GrammarItem, SceneTemplate } from "./types";

const JlptLevel = z.enum(["N5", "N4", "N3", "N2", "N1"]);

const VocabItemSchema = z.object({
  id: z.string(),
  word: z.string(),
  reading: z.string(),
  meaning: z.string(),
  partOfSpeech: z.string(),
  jlptLevel: JlptLevel,
  frequencyRank: z.number().optional(),
  scenarioTags: z.array(z.string()),
  exampleSentences: z.array(z.string()),
});

const GrammarItemSchema = z.object({
  id: z.string(),
  pattern: z.string(),
  meaning: z.string(),
  jlptLevel: JlptLevel,
  formation: z.string(),
  scenarioTags: z.array(z.string()),
  exampleSentences: z.array(z.string()),
  commonMistakes: z.array(z.string()).optional(),
});

const SceneTemplateSchema = z.object({
  id: z.string(),
  location: z.string(),
  characters: z.array(
    z.object({
      id: z.string(),
      role: z.string(),
      voiceConfig: z.string().optional(),
    }),
  ),
  scriptedTurns: z.array(
    z.object({
      turn: z.number(),
      speaker: z.string(),
    }),
  ),
  microStakeSkeleton: z.string(),
  registerTag: z.enum(["casual", "polite", "elder", "keigo"]),
  activeTargetCompatibility: z.array(z.string()),
  passiveScenarioTags: z.array(z.string()),
  allowedNudges: z.array(z.string()),
  exitBeat: z.string(),
  flags: z
    .object({
      mysteryPorous: z.boolean().optional(),
      opensThread: z.boolean().optional(),
      requiresOpenThread: z.boolean().optional(),
    })
    .optional(),
});

const DATA_DIR = join(process.cwd(), "data");

export function loadVocab(): VocabItem[] {
  const raw = readFileSync(join(DATA_DIR, "vocab.json"), "utf8");
  const parsed = JSON.parse(raw);
  return z.array(VocabItemSchema).parse(parsed) as VocabItem[];
}

export function loadGrammar(): GrammarItem[] {
  const raw = readFileSync(join(DATA_DIR, "grammar.json"), "utf8");
  const parsed = JSON.parse(raw);
  return z.array(GrammarItemSchema).parse(parsed) as GrammarItem[];
}

export function loadTemplates(): SceneTemplate[] {
  const dir = join(DATA_DIR, "templates");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  return files.map((f) => {
    const raw = readFileSync(join(dir, f), "utf8");
    const parsed = JSON.parse(raw);
    return SceneTemplateSchema.parse(parsed) as SceneTemplate;
  });
}
```

- [ ] **Step 4: Run the test (should pass)**

Run: `npm test -- tests/content.test.ts`
Expected: 4/4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/content.ts tests/content.test.ts
git commit -m "feat(content): zod-validated loaders for vocab/grammar/templates"
```

---

## Task 8: SRS interval & ease updates

**Files:**
- Create: `src/lib/srs/intervals.ts`
- Test: `tests/srs/intervals.test.ts`

- [ ] **Step 1: Write the failing test — `tests/srs/intervals.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { applyOutcome } from "@/lib/srs/intervals";
import type { ReviewItem, Outcome } from "@/lib/types";

const baseItem: ReviewItem = {
  itemId: "vocab.mado",
  itemType: "vocab",
  lastReviewedAt: null,
  nextReviewAt: null,
  ease: 2.5,
  interval: 0,
  lapses: 0,
};

describe("SRS intervals.applyOutcome", () => {
  it("first-time produced moves item from interval 0 to interval 1", () => {
    const updated = applyOutcome(baseItem, "produced", new Date("2026-05-04"));
    expect(updated.interval).toBe(1);
    expect(updated.nextReviewAt).toBe("2026-05-05T00:00:00.000Z");
    expect(updated.lapses).toBe(0);
  });

  it("missed resets interval to 0 and increments lapses", () => {
    const stable: ReviewItem = { ...baseItem, interval: 7, ease: 2.5 };
    const updated = applyOutcome(stable, "missed", new Date("2026-05-04"));
    expect(updated.interval).toBe(0);
    expect(updated.lapses).toBe(1);
    expect(updated.ease).toBeLessThan(2.5);
  });

  it("mastered increases interval and ease", () => {
    const stable: ReviewItem = { ...baseItem, interval: 3, ease: 2.5 };
    const updated = applyOutcome(stable, "mastered", new Date("2026-05-04"));
    expect(updated.interval).toBeGreaterThan(3);
    expect(updated.ease).toBeGreaterThan(2.5);
  });

  it("recognized treats passive items as a Good", () => {
    const stable: ReviewItem = { ...baseItem, interval: 3 };
    const updated = applyOutcome(stable, "recognized", new Date("2026-05-04"));
    expect(updated.interval).toBeGreaterThan(3);
  });

  it("produced_with_help is graded Hard (smaller growth than produced)", () => {
    const stable: ReviewItem = { ...baseItem, interval: 3 };
    const help = applyOutcome(stable, "produced_with_help", new Date("2026-05-04"));
    const clean = applyOutcome(stable, "produced", new Date("2026-05-04"));
    expect(help.interval).toBeLessThan(clean.interval);
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `npm test -- tests/srs/intervals.test.ts`
Expected: FAIL with "Cannot find module '@/lib/srs/intervals'".

- [ ] **Step 3: Create `src/lib/srs/intervals.ts`**

```typescript
import type { ReviewItem, Outcome } from "../types";

// Outcome → SRS grade mapping (per spec §17 Minimum scoring rubric for v0.1).
type Grade = "Again" | "Hard" | "Good" | "Easy";

function gradeFor(outcome: Outcome): Grade {
  switch (outcome) {
    case "missed":
      return "Again";
    case "recognized":
      return "Good"; // passive recognition → treated as Good in v0
    case "produced_with_help":
      return "Hard";
    case "produced":
      return "Good";
    case "mastered":
      return "Easy";
  }
}

// Simplified SM2-style interval update.
function nextInterval(current: number, ease: number, grade: Grade): number {
  if (grade === "Again") return 0;
  if (current === 0) return grade === "Easy" ? 4 : 1;
  if (grade === "Hard") return Math.max(1, Math.round(current * 1.2));
  if (grade === "Good") return Math.round(current * ease);
  return Math.round(current * ease * 1.3); // Easy
}

function nextEase(current: number, grade: Grade): number {
  if (grade === "Again") return Math.max(1.3, current - 0.2);
  if (grade === "Hard") return Math.max(1.3, current - 0.15);
  if (grade === "Good") return current;
  return current + 0.15; // Easy
}

export function applyOutcome(
  item: ReviewItem,
  outcome: Outcome,
  now: Date,
): ReviewItem {
  const grade = gradeFor(outcome);
  const interval = nextInterval(item.interval, item.ease, grade);
  const ease = nextEase(item.ease, grade);
  const lapses = grade === "Again" ? item.lapses + 1 : item.lapses;
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + interval);
  return {
    ...item,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: next.toISOString(),
    interval,
    ease,
    lapses,
  };
}
```

- [ ] **Step 4: Run the test (should pass)**

Run: `npm test -- tests/srs/intervals.test.ts`
Expected: 5/5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/srs/intervals.ts tests/srs/intervals.test.ts
git commit -m "feat(srs): outcome→grade→interval/ease updates"
```

---

## Task 9: SRS due-items picker

**Files:**
- Create: `src/lib/srs/pickDueItems.ts`
- Test: `tests/srs/pickDueItems.test.ts`

- [ ] **Step 1: Write the failing test — `tests/srs/pickDueItems.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { pickDueItems } from "@/lib/srs/pickDueItems";
import type { ReviewItem } from "@/lib/types";

const today = new Date("2026-05-04T12:00:00.000Z");

const item = (id: string, nextReviewAt: string | null, lapses = 0): ReviewItem => ({
  itemId: id,
  itemType: "vocab",
  lastReviewedAt: null,
  nextReviewAt,
  ease: 2.5,
  interval: 0,
  lapses,
});

describe("pickDueItems", () => {
  it("returns items whose nextReviewAt is in the past or today", () => {
    const all = [
      item("a", "2026-05-03T00:00:00.000Z"),       // overdue
      item("b", "2026-05-04T00:00:00.000Z"),       // due today
      item("c", "2026-05-10T00:00:00.000Z"),       // future
      item("d", null),                              // never reviewed → due
    ];
    const due = pickDueItems(all, today);
    expect(due.map((i) => i.itemId).sort()).toEqual(["a", "b", "d"]);
  });

  it("orders by overdue magnitude (most overdue first), then by lapses desc", () => {
    const all = [
      item("a", "2026-05-04T00:00:00.000Z", 0),    // due today, 0 lapses
      item("b", "2026-05-01T00:00:00.000Z", 0),    // 3 days overdue
      item("c", "2026-05-04T00:00:00.000Z", 5),    // due today, 5 lapses
    ];
    const due = pickDueItems(all, today);
    expect(due.map((i) => i.itemId)).toEqual(["b", "c", "a"]);
  });

  it("respects maxItems cap", () => {
    const all = [
      item("a", "2026-05-01T00:00:00.000Z"),
      item("b", "2026-05-02T00:00:00.000Z"),
      item("c", "2026-05-03T00:00:00.000Z"),
    ];
    const due = pickDueItems(all, today, { maxItems: 2 });
    expect(due.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `npm test -- tests/srs/pickDueItems.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/lib/srs/pickDueItems.ts`**

```typescript
import type { ReviewItem } from "../types";

interface PickOptions {
  maxItems?: number;
}

export function pickDueItems(
  items: ReviewItem[],
  now: Date,
  opts: PickOptions = {},
): ReviewItem[] {
  const nowMs = now.getTime();

  const due = items.filter((it) => {
    if (it.nextReviewAt === null) return true;
    return new Date(it.nextReviewAt).getTime() <= nowMs;
  });

  const scored = due
    .map((it) => {
      const overdueMs = it.nextReviewAt
        ? nowMs - new Date(it.nextReviewAt).getTime()
        : nowMs; // never-reviewed items rank high
      return { item: it, overdueMs };
    })
    .sort((a, b) => {
      if (b.overdueMs !== a.overdueMs) return b.overdueMs - a.overdueMs;
      return b.item.lapses - a.item.lapses;
    });

  const limited = opts.maxItems !== undefined ? scored.slice(0, opts.maxItems) : scored;
  return limited.map((s) => s.item);
}
```

- [ ] **Step 4: Run the test (should pass)**

Run: `npm test -- tests/srs/pickDueItems.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/srs/pickDueItems.ts tests/srs/pickDueItems.test.ts
git commit -m "feat(srs): due-items picker ranked by overdue magnitude"
```

---

## Task 10: SRS active-target picker

**Files:**
- Create: `src/lib/srs/pickActiveTargets.ts`
- Test: `tests/srs/pickActiveTargets.test.ts`

- [ ] **Step 1: Write the failing test — `tests/srs/pickActiveTargets.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { pickActiveTargets } from "@/lib/srs/pickActiveTargets";
import type { ReviewItem } from "@/lib/types";

const item = (id: string, type: "vocab" | "grammar", lapses = 0): ReviewItem => ({
  itemId: id,
  itemType: type,
  lastReviewedAt: null,
  nextReviewAt: null,
  ease: 2.5,
  interval: 0,
  lapses,
});

describe("pickActiveTargets", () => {
  it("picks 1 active target when input is small", () => {
    const due = [item("vocab.mado", "vocab"), item("vocab.ame", "vocab")];
    const targets = pickActiveTargets(due);
    expect(targets.length).toBeGreaterThanOrEqual(1);
    expect(targets.length).toBeLessThanOrEqual(2);
  });

  it("prefers grammar items as the primary active target when present", () => {
    const due = [
      item("vocab.mado", "vocab"),
      item("grammar.tsumori", "grammar"),
      item("vocab.ame", "vocab"),
    ];
    const targets = pickActiveTargets(due);
    expect(targets[0].itemId).toBe("grammar.tsumori");
    expect(targets[0].mode).toBe("active");
  });

  it("picks at most 2 active targets total", () => {
    const due = [
      item("grammar.tsumori", "grammar"),
      item("grammar.temo-ii", "grammar"),
      item("vocab.mado", "vocab"),
      item("vocab.ame", "vocab"),
    ];
    const targets = pickActiveTargets(due);
    expect(targets.length).toBeLessThanOrEqual(2);
  });

  it("returns empty when input is empty", () => {
    expect(pickActiveTargets([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `npm test -- tests/srs/pickActiveTargets.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/lib/srs/pickActiveTargets.ts`**

```typescript
import type { ReviewItem, ItemAssignment } from "../types";

// Pick 1-2 active targets from due items.
// Hard rule from spec §5: never more than 2 active targets per scene.
// Heuristic: prefer 1 grammar (the lesson focus), optionally 1 vocab.
export function pickActiveTargets(due: ReviewItem[]): ItemAssignment[] {
  if (due.length === 0) return [];

  const grammar = due.filter((i) => i.itemType === "grammar");
  const vocab = due.filter((i) => i.itemType === "vocab");

  const targets: ItemAssignment[] = [];

  if (grammar.length > 0) {
    targets.push({
      itemId: grammar[0].itemId,
      itemType: "grammar",
      mode: "active",
    });
  }

  // Add an active vocab target only if there's at least one vocab and we don't yet have 2.
  if (vocab.length > 0 && targets.length < 2) {
    targets.push({
      itemId: vocab[0].itemId,
      itemType: "vocab",
      mode: "active",
    });
  }

  // If no grammar was available, the lone vocab is the active target.
  if (targets.length === 0 && vocab.length > 0) {
    targets.push({
      itemId: vocab[0].itemId,
      itemType: "vocab",
      mode: "active",
    });
  }

  return targets;
}
```

- [ ] **Step 4: Run the test (should pass)**

Run: `npm test -- tests/srs/pickActiveTargets.test.ts`
Expected: 4/4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/srs/pickActiveTargets.ts tests/srs/pickActiveTargets.test.ts
git commit -m "feat(srs): active-target picker (≤2 per scene, prefer grammar)"
```

---

## Task 11: Template filter (active-target compatibility)

**Files:**
- Create: `src/lib/generator/filterTemplates.ts`
- Test: `tests/generator/filterTemplates.test.ts`

- [ ] **Step 1: Write the failing test — `tests/generator/filterTemplates.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { filterTemplates } from "@/lib/generator/filterTemplates";
import { loadTemplates } from "@/lib/content";
import type { ItemAssignment } from "@/lib/types";

describe("filterTemplates", () => {
  const templates = loadTemplates();

  it("returns templates whose activeTargetCompatibility includes the active target's id tag", () => {
    const active: ItemAssignment[] = [
      { itemId: "grammar.tsumori", itemType: "grammar", mode: "active" },
    ];
    const filtered = filterTemplates(templates, active);
    expect(filtered.length).toBeGreaterThan(0);
    for (const t of filtered) {
      expect(t.activeTargetCompatibility).toContain("grammar:つもり");
    }
  });

  it("returns empty when no template hosts the active target", () => {
    const active: ItemAssignment[] = [
      { itemId: "grammar.unknown", itemType: "grammar", mode: "active" },
    ];
    const filtered = filterTemplates(templates, active);
    expect(filtered).toEqual([]);
  });

  it("matches by item-id-derived tag (e.g., grammar:つもり) by looking up the loaded GrammarItem.pattern", () => {
    // This tests that the filter resolves the item id to its pattern via the loaded grammar.
    const active: ItemAssignment[] = [
      { itemId: "grammar.tsumori", itemType: "grammar", mode: "active" },
    ];
    const filtered = filterTemplates(templates, active);
    expect(filtered.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `npm test -- tests/generator/filterTemplates.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/lib/generator/filterTemplates.ts`**

```typescript
import { loadGrammar, loadVocab } from "../content";
import type { SceneTemplate, ItemAssignment } from "../types";

// Build the set of compatibility tags an active-target item carries.
// For grammar: "grammar:<pattern>" plus all scenarioTags.
// For vocab:   "vocab:<word>" plus all scenarioTags.
function tagsForItem(it: ItemAssignment): string[] {
  if (it.itemType === "grammar") {
    const all = loadGrammar();
    const found = all.find((g) => g.id === it.itemId);
    if (!found) return [];
    return [
      `grammar:${found.pattern}`,
      ...found.scenarioTags.map((t) => `tag:${t}`),
    ];
  } else {
    const all = loadVocab();
    const found = all.find((v) => v.id === it.itemId);
    if (!found) return [];
    return [
      `vocab:${found.word}`,
      ...found.scenarioTags.map((t) => `tag:${t}`),
    ];
  }
}

// A template is compatible with the active targets if EVERY active target
// has at least one tag matching the template's activeTargetCompatibility.
export function filterTemplates(
  templates: SceneTemplate[],
  activeTargets: ItemAssignment[],
): SceneTemplate[] {
  if (activeTargets.length === 0) return templates;

  return templates.filter((tpl) => {
    return activeTargets.every((target) => {
      const tags = tagsForItem(target);
      return tags.some((tag) => tpl.activeTargetCompatibility.includes(tag));
    });
  });
}
```

- [ ] **Step 4: Run the test (should pass)**

Run: `npm test -- tests/generator/filterTemplates.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/generator/filterTemplates.ts tests/generator/filterTemplates.test.ts
git commit -m "feat(generator): filter templates by active-target compatibility"
```

---

## Task 12: Template scorer (variety preference)

**Files:**
- Create: `src/lib/generator/scoreTemplates.ts`
- Test: `tests/generator/scoreTemplates.test.ts`

- [ ] **Step 1: Write the failing test — `tests/generator/scoreTemplates.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { scoreTemplates } from "@/lib/generator/scoreTemplates";
import { loadTemplates } from "@/lib/content";

describe("scoreTemplates", () => {
  const templates = loadTemplates();

  it("returns one rationale per template", () => {
    const scored = scoreTemplates(templates, { lastTemplateId: null, lastLocation: null });
    expect(scored.length).toBe(templates.length);
    for (const r of scored) {
      expect(r.templateId).toBeDefined();
      expect(typeof r.finalScore).toBe("number");
      expect(Array.isArray(r.reasons)).toBe(true);
    }
  });

  it("penalizes templates that match the most recent run", () => {
    const lastId = templates[0].id;
    const scored = scoreTemplates(templates, {
      lastTemplateId: lastId,
      lastLocation: templates[0].location,
    });
    const recent = scored.find((r) => r.templateId === lastId);
    const other = scored.find((r) => r.templateId !== lastId);
    expect(recent).toBeDefined();
    expect(other).toBeDefined();
    expect(other!.finalScore).toBeGreaterThan(recent!.finalScore);
  });

  it("rationales include human-readable reasons", () => {
    const scored = scoreTemplates(templates, { lastTemplateId: templates[0].id, lastLocation: null });
    const recent = scored.find((r) => r.templateId === templates[0].id);
    expect(recent?.reasons.some((r) => r.toLowerCase().includes("recent"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `npm test -- tests/generator/scoreTemplates.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/lib/generator/scoreTemplates.ts`**

```typescript
import type { SceneTemplate, TemplateScoringRationale } from "../types";

interface ScoringContext {
  lastTemplateId: string | null;
  lastLocation: string | null;
}

// For v0, scoring is intentionally minimal:
//   - base score 10
//   - -5 if this template ran most recently
//   - -2 if this template's location matches the most recent location
// (v1 will add thread-advancer preference, beat compatibility, etc.)
export function scoreTemplates(
  templates: SceneTemplate[],
  ctx: ScoringContext,
): TemplateScoringRationale[] {
  return templates.map((tpl) => {
    let score = 10;
    const reasons: string[] = ["base score 10"];

    if (ctx.lastTemplateId === tpl.id) {
      score -= 5;
      reasons.push("-5: same template as most recent run");
    }
    if (ctx.lastLocation && ctx.lastLocation === tpl.location) {
      score -= 2;
      reasons.push("-2: same location as most recent run");
    }

    return { templateId: tpl.id, finalScore: score, reasons };
  });
}

export function pickBestTemplate(
  scored: TemplateScoringRationale[],
): TemplateScoringRationale | null {
  if (scored.length === 0) return null;
  return [...scored].sort((a, b) => b.finalScore - a.finalScore)[0];
}
```

- [ ] **Step 4: Run the test (should pass)**

Run: `npm test -- tests/generator/scoreTemplates.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/generator/scoreTemplates.ts tests/generator/scoreTemplates.test.ts
git commit -m "feat(generator): score templates with variety penalties"
```

---

## Task 13: Passive items picker

**Files:**
- Create: `src/lib/generator/pickPassiveItems.ts`
- Test: `tests/generator/pickPassiveItems.test.ts`

- [ ] **Step 1: Write the failing test — `tests/generator/pickPassiveItems.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { pickPassiveItems } from "@/lib/generator/pickPassiveItems";
import { loadTemplates } from "@/lib/content";
import type { ReviewItem, ItemAssignment } from "@/lib/types";

const item = (id: string, type: "vocab" | "grammar"): ReviewItem => ({
  itemId: id,
  itemType: type,
  lastReviewedAt: null,
  nextReviewAt: null,
  ease: 2.5,
  interval: 0,
  lapses: 0,
});

describe("pickPassiveItems", () => {
  const templates = loadTemplates();
  const evening = templates.find((t) => t.id === "minshuku-evening-with-kid")!;

  it("picks up to 3 passive items by default", () => {
    const due = [
      item("vocab.mado", "vocab"),
      item("vocab.ame", "vocab"),
      item("vocab.fushigi", "vocab"),
      item("vocab.yakusoku", "vocab"),
    ];
    const active: ItemAssignment[] = [
      { itemId: "grammar.tsumori", itemType: "grammar", mode: "active" },
    ];
    const passive = pickPassiveItems(due, evening, active);
    expect(passive.length).toBeLessThanOrEqual(3);
    expect(passive.length).toBeGreaterThan(0);
    expect(passive.every((p) => p.mode === "passive")).toBe(true);
  });

  it("does not include items already chosen as active", () => {
    const due = [
      item("vocab.mado", "vocab"),
      item("grammar.tsumori", "grammar"),
    ];
    const active: ItemAssignment[] = [
      { itemId: "grammar.tsumori", itemType: "grammar", mode: "active" },
    ];
    const passive = pickPassiveItems(due, evening, active);
    expect(passive.find((p) => p.itemId === "grammar.tsumori")).toBeUndefined();
  });

  it("prefers items whose scenarioTags intersect the template's passiveScenarioTags", () => {
    // evening template has passive tags: evening, weather, minshuku, planning
    const due = [
      item("vocab.ame", "vocab"),       // tags: weather, evening, morning -> 2 overlaps
      item("vocab.motsu", "vocab"),     // tags: minshuku, everyday -> 1 overlap
    ];
    const active: ItemAssignment[] = [];
    const passive = pickPassiveItems(due, evening, active);
    expect(passive[0].itemId).toBe("vocab.ame");
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `npm test -- tests/generator/pickPassiveItems.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/lib/generator/pickPassiveItems.ts`**

```typescript
import { loadGrammar, loadVocab } from "../content";
import type {
  ReviewItem,
  SceneTemplate,
  ItemAssignment,
} from "../types";

const DEFAULT_PASSIVE_COUNT = 3;

function tagsForReviewItem(it: ReviewItem): string[] {
  if (it.itemType === "grammar") {
    const found = loadGrammar().find((g) => g.id === it.itemId);
    return found?.scenarioTags ?? [];
  }
  const found = loadVocab().find((v) => v.id === it.itemId);
  return found?.scenarioTags ?? [];
}

function overlapCount(a: string[], b: string[]): number {
  const setB = new Set(b);
  return a.filter((x) => setB.has(x)).length;
}

export function pickPassiveItems(
  due: ReviewItem[],
  template: SceneTemplate,
  active: ItemAssignment[],
  count: number = DEFAULT_PASSIVE_COUNT,
): ItemAssignment[] {
  const activeIds = new Set(active.map((a) => a.itemId));
  const candidates = due.filter((d) => !activeIds.has(d.itemId));

  const ranked = candidates
    .map((c) => ({
      item: c,
      overlap: overlapCount(tagsForReviewItem(c), template.passiveScenarioTags),
    }))
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, count);

  return ranked.map((r) => ({
    itemId: r.item.itemId,
    itemType: r.item.itemType,
    mode: "passive" as const,
  }));
}
```

- [ ] **Step 4: Run the test (should pass)**

Run: `npm test -- tests/generator/pickPassiveItems.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/generator/pickPassiveItems.ts tests/generator/pickPassiveItems.test.ts
git commit -m "feat(generator): pick passive items ranked by tag overlap with template"
```

---

## Task 14: Scene plan builder

**Files:**
- Create: `src/lib/generator/buildScenePlan.ts`
- Test: `tests/generator/buildScenePlan.test.ts`

- [ ] **Step 1: Write the failing test — `tests/generator/buildScenePlan.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { buildScenePlan } from "@/lib/generator/buildScenePlan";
import type { ReviewItem } from "@/lib/types";

const today = new Date("2026-05-04T12:00:00.000Z");

const item = (id: string, type: "vocab" | "grammar"): ReviewItem => ({
  itemId: id,
  itemType: type,
  lastReviewedAt: null,
  nextReviewAt: null,
  ease: 2.5,
  interval: 0,
  lapses: 0,
});

describe("buildScenePlan", () => {
  it("returns a complete ScenePlan when there are due items and a compatible template", () => {
    const due = [
      item("grammar.tsumori", "grammar"),
      item("vocab.mado", "vocab"),
      item("vocab.ame", "vocab"),
      item("vocab.yakusoku", "vocab"),
    ];
    const result = buildScenePlan(due, today, {
      lastTemplateId: null,
      lastLocation: null,
    });
    expect(result).not.toBeNull();
    expect(result!.plan.activeTargets.length).toBeGreaterThan(0);
    expect(result!.plan.passiveItems.length).toBeGreaterThan(0);
    expect(result!.plan.microStake).toContain("minshuku");
    expect(result!.candidatesScored.length).toBeGreaterThan(0);
  });

  it("returns null when no template can host the active targets", () => {
    const due = [item("grammar.unknown", "grammar")];
    const result = buildScenePlan(due, today, {
      lastTemplateId: null,
      lastLocation: null,
    });
    // unknown grammar id has no compatible template
    expect(result).toBeNull();
  });

  it("returns null when there are no due items", () => {
    const result = buildScenePlan([], today, {
      lastTemplateId: null,
      lastLocation: null,
    });
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `npm test -- tests/generator/buildScenePlan.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/lib/generator/buildScenePlan.ts`**

```typescript
import { loadTemplates } from "../content";
import { pickActiveTargets } from "../srs/pickActiveTargets";
import { pickDueItems } from "../srs/pickDueItems";
import { filterTemplates } from "./filterTemplates";
import { scoreTemplates, pickBestTemplate } from "./scoreTemplates";
import { pickPassiveItems } from "./pickPassiveItems";
import type {
  ReviewItem,
  ScenePlan,
  TemplateScoringRationale,
  ItemAssignment,
} from "../types";

interface RecentContext {
  lastTemplateId: string | null;
  lastLocation: string | null;
}

export interface ScenePlanResult {
  plan: ScenePlan;
  candidatesScored: TemplateScoringRationale[];
  activeConsidered: ItemAssignment[];
}

export function buildScenePlan(
  reviewItems: ReviewItem[],
  now: Date,
  ctx: RecentContext,
): ScenePlanResult | null {
  const due = pickDueItems(reviewItems, now);
  if (due.length === 0) return null;

  const active = pickActiveTargets(due);
  if (active.length === 0) return null;

  const allTemplates = loadTemplates();
  const compatible = filterTemplates(allTemplates, active);
  if (compatible.length === 0) return null;

  const scored = scoreTemplates(compatible, ctx);
  const best = pickBestTemplate(scored);
  if (!best) return null;

  const template = compatible.find((t) => t.id === best.templateId)!;
  const passive = pickPassiveItems(due, template, active);

  // For v0, microStake is just the skeleton. (LLM dialogue gen will further instantiate it.)
  const microStake = template.microStakeSkeleton;

  const plan: ScenePlan = {
    templateId: template.id,
    location: template.location,
    characters: template.characters,
    microStake,
    activeTargets: active,
    passiveItems: passive,
    registerTag: template.registerTag,
    scriptedTurns: template.scriptedTurns,
  };

  return {
    plan,
    candidatesScored: scored,
    activeConsidered: active,
  };
}
```

- [ ] **Step 4: Run the test (should pass)**

Run: `npm test -- tests/generator/buildScenePlan.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/generator/buildScenePlan.ts tests/generator/buildScenePlan.test.ts
git commit -m "feat(generator): build full scene plan from due items + recent context"
```

---

## Task 15: LLM client wrapper (Anthropic SDK)

**Files:**
- Create: `src/lib/llm/client.ts`

(No tests for the bare client — it's a thin wrapper around the SDK. Behavior is exercised via Tasks 16/17 with mocked clients.)

- [ ] **Step 1: Create `src/lib/llm/client.ts`**

```typescript
import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

export interface LLMClient {
  complete(args: {
    system: string;
    user: string;
    model?: string;
    maxTokens?: number;
  }): Promise<{ text: string; latencyMs: number }>;
}

export class AnthropicClient implements LLMClient {
  private client: Anthropic;
  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error("ANTHROPIC_API_KEY is required (set it in .env or pass to constructor)");
    }
    this.client = new Anthropic({ apiKey: key });
  }

  async complete(args: {
    system: string;
    user: string;
    model?: string;
    maxTokens?: number;
  }): Promise<{ text: string; latencyMs: number }> {
    const start = Date.now();
    const response = await this.client.messages.create({
      model: args.model ?? "claude-sonnet-4-6",
      max_tokens: args.maxTokens ?? 2048,
      system: args.system,
      messages: [{ role: "user", content: args.user }],
    });
    const latencyMs = Date.now() - start;

    // Extract first text block.
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("LLM returned no text content");
    }

    return { text: textBlock.text, latencyMs };
  }
}

// Mock client for tests — drop-in replacement.
export class MockLLMClient implements LLMClient {
  constructor(private responder: (args: { system: string; user: string }) => string) {}
  async complete(args: { system: string; user: string }) {
    return { text: this.responder(args), latencyMs: 0 };
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/llm/client.ts
git commit -m "feat(llm): Anthropic SDK client wrapper + mock for tests"
```

---

## Task 16: Dialogue generator

**Files:**
- Create: `src/lib/llm/generateDialogue.ts`
- Test: `tests/llm/generateDialogue.test.ts`

- [ ] **Step 1: Write the failing test — `tests/llm/generateDialogue.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { generateDialogue } from "@/lib/llm/generateDialogue";
import { MockLLMClient } from "@/lib/llm/client";
import type { ScenePlan } from "@/lib/types";

const samplePlan: ScenePlan = {
  templateId: "minshuku-evening-with-kid",
  location: "minshuku",
  characters: [{ id: "kid", role: "host_family_kid" }],
  microStake: "Evening; the kid is curious about your plans.",
  activeTargets: [{ itemId: "grammar.tsumori", itemType: "grammar", mode: "active" }],
  passiveItems: [
    { itemId: "vocab.ame", itemType: "vocab", mode: "passive" },
    { itemId: "vocab.fushigi", itemType: "vocab", mode: "passive" },
  ],
  registerTag: "casual",
  scriptedTurns: [
    { turn: 1, speaker: "coach" },
    { turn: 2, speaker: "kid" },
    { turn: 3, speaker: "player" },
    { turn: 4, speaker: "kid" },
    { turn: 5, speaker: "player" },
    { turn: 6, speaker: "kid" },
    { turn: 7, speaker: "player" },
    { turn: 8, speaker: "coach" },
  ],
};

const FAKE_RESPONSE = JSON.stringify({
  briefing: "You're at the minshuku, evening. Hiro is curious about your plans tomorrow.",
  turns: [
    { turn: 2, speaker: "kid", text: "明日、何をするつもり？", language: "ja" },
    { turn: 4, speaker: "kid", text: "明日、雨だって。", language: "ja" },
    { turn: 6, speaker: "kid", text: "ちょっと不思議な天気だね。", language: "ja" },
  ],
  result: "Nice scene. つもり came through.",
});

describe("generateDialogue", () => {
  it("calls the LLM and returns parsed dialogue lines", async () => {
    const mock = new MockLLMClient(() => FAKE_RESPONSE);
    const out = await generateDialogue(samplePlan, mock);
    expect(out.briefing).toContain("minshuku");
    expect(out.turns.length).toBeGreaterThan(0);
    expect(out.turns[0].language).toBe("ja");
    expect(out.rawPrompt).toContain("つもり");
    expect(out.rawResponse).toBe(FAKE_RESPONSE);
  });

  it("throws when the LLM response is not valid JSON", async () => {
    const mock = new MockLLMClient(() => "not-json-at-all");
    await expect(generateDialogue(samplePlan, mock)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `npm test -- tests/llm/generateDialogue.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/lib/llm/generateDialogue.ts`**

```typescript
import { z } from "zod";
import { loadGrammar, loadVocab } from "../content";
import type { LLMClient } from "./client";
import type { ScenePlan, DialogueLine } from "../types";

const ResponseSchema = z.object({
  briefing: z.string(),
  turns: z.array(
    z.object({
      turn: z.number(),
      speaker: z.string(),
      text: z.string(),
      language: z.enum(["ja", "en"]),
    }),
  ),
  result: z.string(),
});

export interface GeneratedDialogue {
  briefing: string;
  turns: DialogueLine[];
  result: string;
  rawPrompt: string;
  rawResponse: string;
  latencyMs: number;
}

function describeItem(it: ScenePlan["activeTargets"][number] | ScenePlan["passiveItems"][number]): string {
  if (it.itemType === "grammar") {
    const found = loadGrammar().find((g) => g.id === it.itemId);
    if (!found) return it.itemId;
    return `${found.pattern} (${found.meaning}) — formation: ${found.formation}`;
  }
  const found = loadVocab().find((v) => v.id === it.itemId);
  if (!found) return it.itemId;
  return `${found.word} (${found.reading}, ${found.meaning})`;
}

function buildPrompt(plan: ScenePlan): { system: string; user: string } {
  const charList = plan.characters.map((c) => `${c.id} (${c.role})`).join(", ");
  const active = plan.activeTargets.map(describeItem).join("\n  - ");
  const passive = plan.passiveItems.map(describeItem).join("\n  - ");

  // Only the AI-character turns are filled by the LLM. Player turns are placeholders
  // that the synthetic player will fill in Task 17.
  const aiTurns = plan.scriptedTurns
    .filter((t) => t.speaker !== "player" && t.speaker !== "coach")
    .map((t) => `  - turn ${t.turn} (${t.speaker})`)
    .join("\n");

  const system = `You are the dialogue writer for Hanare, a hands-free Japanese learning app set in a soft-magical countryside town.
Your job: given a structured scene plan, produce the briefing (English), the AI character lines (Japanese), and the result line (English).

Rules:
- Briefing and result are in English. AI character lines are in Japanese.
- AI character lines must be appropriate for the register (${plan.registerTag}) and natural for the speaker.
- The AI must use the passive items NATURALLY in its own speech (don't force them).
- The AI must NOT use the active target — that's the player's job. The AI should set up situations where the active target is the natural response.
- Each AI turn is one short utterance.
- Output strict JSON only, no prose outside the JSON.`;

  const user = `Scene plan:
- Location: ${plan.location}
- Characters: ${charList}
- Micro-stake: ${plan.microStake}
- Register: ${plan.registerTag}
- Active target (player must produce): ${active || "none"}
- Passive items (AI uses naturally): ${passive || "none"}
- AI character turns to fill:
${aiTurns}

Output JSON shape:
{
  "briefing": "<English briefing, ~1-2 sentences naming location, character, today's stake, and the active target>",
  "turns": [
    { "turn": <number>, "speaker": "<character_id>", "text": "<Japanese line>", "language": "ja" }
  ],
  "result": "<English result line, ~1 sentence summarizing what happened (placeholder — will be replaced by evaluator-driven summary later)>"
}`;

  return { system, user };
}

export async function generateDialogue(
  plan: ScenePlan,
  client: LLMClient,
): Promise<GeneratedDialogue> {
  const { system, user } = buildPrompt(plan);
  const { text, latencyMs } = await client.complete({ system, user });

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`LLM returned non-JSON response: ${text.slice(0, 200)}`);
  }

  const validated = ResponseSchema.parse(parsed);
  return {
    briefing: validated.briefing,
    turns: validated.turns as DialogueLine[],
    result: validated.result,
    rawPrompt: `SYSTEM:\n${system}\n\nUSER:\n${user}`,
    rawResponse: text,
    latencyMs,
  };
}
```

- [ ] **Step 4: Run the test (should pass)**

Run: `npm test -- tests/llm/generateDialogue.test.ts`
Expected: 2/2 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/llm/generateDialogue.ts tests/llm/generateDialogue.test.ts
git commit -m "feat(llm): generate AI dialogue from scene plan"
```

---

## Task 17: Synthetic player (LLM persona)

**Files:**
- Create: `src/lib/llm/syntheticPlayer.ts`
- Test: `tests/llm/syntheticPlayer.test.ts`

- [ ] **Step 1: Write the failing test — `tests/llm/syntheticPlayer.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { syntheticPlayerTurn } from "@/lib/llm/syntheticPlayer";
import { MockLLMClient } from "@/lib/llm/client";
import type { DialogueLine, ScenePlan } from "@/lib/types";

const plan: ScenePlan = {
  templateId: "minshuku-evening-with-kid",
  location: "minshuku",
  characters: [{ id: "kid", role: "host_family_kid" }],
  microStake: "Evening at the minshuku; the kid asks about plans.",
  activeTargets: [{ itemId: "grammar.tsumori", itemType: "grammar", mode: "active" }],
  passiveItems: [],
  registerTag: "casual",
  scriptedTurns: [],
};

const conversation: DialogueLine[] = [
  { turn: 2, speaker: "kid", text: "明日、何をするつもり？", language: "ja" },
];

describe("syntheticPlayerTurn", () => {
  it("returns a player utterance using the active target", async () => {
    const mock = new MockLLMClient(() => "明日は教会に行くつもりです。");
    const out = await syntheticPlayerTurn({
      plan,
      conversationSoFar: conversation,
      turnNumber: 3,
      persona: "intermediate-n3-foreign-student",
      client: mock,
    });
    expect(out.text).toContain("つもり");
    expect(out.language).toBe("ja");
    expect(out.turn).toBe(3);
    expect(out.speaker).toBe("player");
  });

  it("includes the persona description in the prompt", async () => {
    let capturedUser = "";
    const mock = new MockLLMClient(({ user }) => {
      capturedUser = user;
      return "OK.";
    });
    await syntheticPlayerTurn({
      plan,
      conversationSoFar: conversation,
      turnNumber: 3,
      persona: "intermediate-n3-foreign-student",
      client: mock,
    });
    expect(capturedUser).toContain("intermediate-n3-foreign-student");
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `npm test -- tests/llm/syntheticPlayer.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/lib/llm/syntheticPlayer.ts`**

```typescript
import { loadGrammar, loadVocab } from "../content";
import type { LLMClient } from "./client";
import type { DialogueLine, ScenePlan } from "../types";

export interface SyntheticPlayerArgs {
  plan: ScenePlan;
  conversationSoFar: DialogueLine[];
  turnNumber: number;
  persona: string;            // free-text persona, e.g., "intermediate-n3-foreign-student"
  client: LLMClient;
}

const PERSONA_DESCRIPTIONS: Record<string, string> = {
  "intermediate-n3-foreign-student":
    "An N3-level Japanese learner from abroad, ~6 months in Japan, comfortable with casual register but occasionally drops particles, prefers shorter sentences than native speakers, pronunciation passable.",
  "perfect-n3":
    "A clean N3-level learner who responds correctly and naturally to prompts at their level.",
};

function describeActiveTargets(plan: ScenePlan): string {
  return plan.activeTargets
    .map((t) => {
      if (t.itemType === "grammar") {
        const g = loadGrammar().find((x) => x.id === t.itemId);
        return g ? `${g.pattern} (${g.meaning})` : t.itemId;
      }
      const v = loadVocab().find((x) => x.id === t.itemId);
      return v ? `${v.word} (${v.meaning})` : t.itemId;
    })
    .join(", ");
}

export async function syntheticPlayerTurn(
  args: SyntheticPlayerArgs,
): Promise<DialogueLine> {
  const personaDesc =
    PERSONA_DESCRIPTIONS[args.persona] ??
    `A Japanese learner described as: "${args.persona}". Respond naturally for that level.`;

  const conv = args.conversationSoFar
    .map((line) => `[${line.speaker}] ${line.text}`)
    .join("\n");

  const activeDesc = describeActiveTargets(args.plan);

  const system = `You are role-playing as a Japanese-language learner in a hands-free practice scene.

Persona: ${personaDesc}

Constraints:
- Reply in Japanese only (one short utterance, 1-2 sentences max).
- Try to use the active target naturally if it fits: ${activeDesc}.
- Do not break character; do not explain in English.
- Output the Japanese text only, no quotes, no prefixes.`;

  const user = `Persona: ${args.persona}
Scene location: ${args.plan.location}
Micro-stake: ${args.plan.microStake}
Conversation so far:
${conv}

It is now turn ${args.turnNumber} (your turn). Respond as the learner.`;

  const { text } = await args.client.complete({ system, user });

  return {
    turn: args.turnNumber,
    speaker: "player",
    text: text.trim(),
    language: "ja",
  };
}
```

- [ ] **Step 4: Run the test (should pass)**

Run: `npm test -- tests/llm/syntheticPlayer.test.ts`
Expected: 2/2 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/llm/syntheticPlayer.ts tests/llm/syntheticPlayer.test.ts
git commit -m "feat(llm): synthetic player as LLM persona"
```

---

## Task 18: Conjugation analyzer (kuromoji)

**Files:**
- Create: `src/lib/evaluator/conjugation.ts`
- Test: `tests/evaluator/conjugation.test.ts`

- [ ] **Step 1: Write the failing test — `tests/evaluator/conjugation.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { tokenize, containsPattern } from "@/lib/evaluator/conjugation";

describe("conjugation analyzer (kuromoji)", () => {
  it("tokenizes a simple Japanese sentence", async () => {
    const tokens = await tokenize("明日は教会に行くつもりです。");
    expect(tokens.length).toBeGreaterThan(0);
    const words = tokens.map((t) => t.surface_form);
    expect(words).toContain("つもり");
  });

  it("containsPattern returns true when pattern surface appears", async () => {
    expect(await containsPattern("明日、教会に行くつもりです。", "つもり")).toBe(true);
  });

  it("containsPattern returns false when pattern is absent", async () => {
    expect(await containsPattern("明日、教会に行きます。", "つもり")).toBe(false);
  });

  it("does not match when pattern is in romaji or English", async () => {
    expect(await containsPattern("I plan to go.", "つもり")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `npm test -- tests/evaluator/conjugation.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/lib/evaluator/conjugation.ts`**

```typescript
import kuromoji from "kuromoji";
import { join } from "node:path";

export interface KuromojiToken {
  word_id: number;
  word_type: string;
  word_position: number;
  surface_form: string;
  pos: string;
  pos_detail_1: string;
  pos_detail_2: string;
  pos_detail_3: string;
  conjugated_type: string;
  conjugated_form: string;
  basic_form: string;
  reading: string;
  pronunciation: string;
}

let tokenizerPromise: Promise<kuromoji.Tokenizer<KuromojiToken>> | null = null;

function getTokenizer(): Promise<kuromoji.Tokenizer<KuromojiToken>> {
  if (tokenizerPromise) return tokenizerPromise;
  // kuromoji ships its dictionary inside node_modules.
  const dicPath = join(
    process.cwd(),
    "node_modules",
    "kuromoji",
    "dict",
  );
  tokenizerPromise = new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath }).build((err, tokenizer) => {
      if (err) return reject(err);
      resolve(tokenizer);
    });
  });
  return tokenizerPromise;
}

export async function tokenize(text: string): Promise<KuromojiToken[]> {
  const t = await getTokenizer();
  return t.tokenize(text) as unknown as KuromojiToken[];
}

// Simplest v0 pattern check: does the tokenized output contain a token
// whose surface_form OR basic_form equals the pattern?
export async function containsPattern(text: string, pattern: string): Promise<boolean> {
  const tokens = await tokenize(text);
  return tokens.some(
    (t) => t.surface_form === pattern || t.basic_form === pattern,
  );
}
```

- [ ] **Step 4: Run the test (should pass)**

Run: `npm test -- tests/evaluator/conjugation.test.ts`
Expected: 4/4 PASS.

(Note: first run may take longer because kuromoji loads its dictionary; subsequent runs are cached in-memory per process.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/evaluator/conjugation.ts tests/evaluator/conjugation.test.ts
git commit -m "feat(evaluator): kuromoji-backed tokenize + containsPattern"
```

---

## Task 19: Target-presence rule check

**Files:**
- Create: `src/lib/evaluator/ruleCheck.ts`
- Test: `tests/evaluator/ruleCheck.test.ts`

- [ ] **Step 1: Write the failing test — `tests/evaluator/ruleCheck.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { checkTargetPresence } from "@/lib/evaluator/ruleCheck";
import type { ItemAssignment } from "@/lib/types";

describe("checkTargetPresence", () => {
  it("returns true when grammar pattern surface appears in player text", async () => {
    const target: ItemAssignment = {
      itemId: "grammar.tsumori",
      itemType: "grammar",
      mode: "active",
    };
    const ok = await checkTargetPresence("明日、教会に行くつもりです。", target);
    expect(ok).toBe(true);
  });

  it("returns false when grammar pattern is absent", async () => {
    const target: ItemAssignment = {
      itemId: "grammar.tsumori",
      itemType: "grammar",
      mode: "active",
    };
    const ok = await checkTargetPresence("明日、教会に行きます。", target);
    expect(ok).toBe(false);
  });

  it("returns true when vocab word appears", async () => {
    const target: ItemAssignment = {
      itemId: "vocab.mado",
      itemType: "vocab",
      mode: "active",
    };
    const ok = await checkTargetPresence("窓の外を見て。", target);
    expect(ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `npm test -- tests/evaluator/ruleCheck.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/lib/evaluator/ruleCheck.ts`**

```typescript
import { loadGrammar, loadVocab } from "../content";
import { containsPattern } from "./conjugation";
import type { ItemAssignment } from "../types";

export async function checkTargetPresence(
  playerText: string,
  target: ItemAssignment,
): Promise<boolean> {
  if (target.itemType === "grammar") {
    const g = loadGrammar().find((x) => x.id === target.itemId);
    if (!g) return false;
    return await containsPattern(playerText, g.pattern);
  } else {
    const v = loadVocab().find((x) => x.id === target.itemId);
    if (!v) return false;
    return await containsPattern(playerText, v.word);
  }
}
```

- [ ] **Step 4: Run the test (should pass)**

Run: `npm test -- tests/evaluator/ruleCheck.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/evaluator/ruleCheck.ts tests/evaluator/ruleCheck.test.ts
git commit -m "feat(evaluator): target-presence rule check"
```

---

## Task 20: Per-turn evaluator orchestration

**Files:**
- Create: `src/lib/evaluator/evaluate.ts`
- Test: `tests/evaluator/evaluate.test.ts`

- [ ] **Step 1: Write the failing test — `tests/evaluator/evaluate.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { evaluatePlayerTurn } from "@/lib/evaluator/evaluate";
import type { ItemAssignment } from "@/lib/types";

const active: ItemAssignment = {
  itemId: "grammar.tsumori",
  itemType: "grammar",
  mode: "active",
};

describe("evaluatePlayerTurn", () => {
  it("returns 'produced' when active target is present", async () => {
    const results = await evaluatePlayerTurn(
      "明日、教会に行くつもりです。",
      [active],
    );
    expect(results.length).toBe(1);
    expect(results[0].outcome).toBe("produced");
    expect(results[0].evidence.targetPresent).toBe(true);
  });

  it("returns 'missed' when active target is absent", async () => {
    const results = await evaluatePlayerTurn(
      "明日、教会に行きます。",
      [active],
    );
    expect(results[0].outcome).toBe("missed");
    expect(results[0].evidence.targetPresent).toBe(false);
  });

  it("returns one EvaluatorResult per active target", async () => {
    const second: ItemAssignment = {
      itemId: "vocab.mado",
      itemType: "vocab",
      mode: "active",
    };
    const results = await evaluatePlayerTurn(
      "窓のそばで考えるつもりです。",
      [active, second],
    );
    expect(results.length).toBe(2);
    expect(results.every((r) => r.outcome === "produced")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `npm test -- tests/evaluator/evaluate.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/lib/evaluator/evaluate.ts`**

```typescript
import { checkTargetPresence } from "./ruleCheck";
import type { ItemAssignment, EvaluatorResult } from "../types";

// v0 mapping: target-present → "produced"; target-absent → "missed".
// (Hint-aware "produced_with_help", "mastered" arrive in later plans.)
export async function evaluatePlayerTurn(
  playerText: string,
  activeTargets: ItemAssignment[],
): Promise<EvaluatorResult[]> {
  const results: EvaluatorResult[] = [];
  for (const target of activeTargets) {
    const present = await checkTargetPresence(playerText, target);
    results.push({
      itemId: target.itemId,
      mode: target.mode,
      outcome: present ? "produced" : "missed",
      evidence: {
        targetPresent: present,
        morphologyOk: present, // for v0 these collapse to the same signal
        notes: present ? "rule check: pattern surface found" : "rule check: pattern surface not found",
      },
    });
  }
  return results;
}
```

- [ ] **Step 4: Run the test (should pass)**

Run: `npm test -- tests/evaluator/evaluate.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/evaluator/evaluate.ts tests/evaluator/evaluate.test.ts
git commit -m "feat(evaluator): per-turn orchestration (rule-based v0)"
```

---

## Task 21: SceneRunLog writer (JSONL append)

**Files:**
- Create: `src/lib/log/sceneRunLog.ts`
- Test: `tests/log/sceneRunLog.test.ts`

- [ ] **Step 1: Write the failing test — `tests/log/sceneRunLog.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { rmSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { writeSceneRunLog, readAllSceneRunLogs } from "@/lib/log/sceneRunLog";
import type { SceneRunLog } from "@/lib/types";

const TEST_DIR = join(process.cwd(), "logs", "test-tmp");

const sample: SceneRunLog = {
  id: "run-001",
  userId: "default",
  templateId: "minshuku-evening-with-kid",
  startedAt: "2026-05-04T12:00:00.000Z",
  endedAt: "2026-05-04T12:05:00.000Z",
  activeTargetsConsidered: [],
  activeTargetsChosen: [],
  templateCandidates: [],
  templateChosen: { id: "minshuku-evening-with-kid", finalScore: 10 },
  threadAction: "standalone",
  beatFired: null,
  llmPrompt: "...",
  llmResponse: "...",
  briefing: "Evening at the minshuku.",
  result: "Nice scene.",
  turns: [],
  itemOutcomes: [],
};

describe("sceneRunLog writer", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });
  });

  it("appends one line per write to the JSONL file", () => {
    writeSceneRunLog(sample, TEST_DIR);
    writeSceneRunLog({ ...sample, id: "run-002" }, TEST_DIR);
    const content = readFileSync(join(TEST_DIR, "scene-runs.jsonl"), "utf8");
    const lines = content.trim().split("\n");
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).id).toBe("run-001");
    expect(JSON.parse(lines[1]).id).toBe("run-002");
  });

  it("readAllSceneRunLogs returns parsed entries", () => {
    writeSceneRunLog(sample, TEST_DIR);
    const all = readAllSceneRunLogs(TEST_DIR);
    expect(all.length).toBe(1);
    expect(all[0].id).toBe("run-001");
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `npm test -- tests/log/sceneRunLog.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/lib/log/sceneRunLog.ts`**

```typescript
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SceneRunLog } from "../types";

const DEFAULT_DIR = join(process.cwd(), "logs");
const FILENAME = "scene-runs.jsonl";

export function writeSceneRunLog(log: SceneRunLog, dir: string = DEFAULT_DIR): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path = join(dir, FILENAME);
  appendFileSync(path, JSON.stringify(log) + "\n", "utf8");
}

export function readAllSceneRunLogs(dir: string = DEFAULT_DIR): SceneRunLog[] {
  const path = join(dir, FILENAME);
  if (!existsSync(path)) return [];
  const content = readFileSync(path, "utf8");
  return content
    .trim()
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as SceneRunLog);
}
```

- [ ] **Step 4: Run the test (should pass)**

Run: `npm test -- tests/log/sceneRunLog.test.ts`
Expected: 2/2 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/log/sceneRunLog.ts tests/log/sceneRunLog.test.ts
git commit -m "feat(log): JSONL writer + reader for SceneRunLog"
```

---

## Task 22: Top-level scene runner (orchestrator)

**Files:**
- Create: `src/lib/runScene.ts`
- Test: `tests/integration/runScene.test.ts`

- [ ] **Step 1: Write the failing test — `tests/integration/runScene.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { rmSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { runScene } from "@/lib/runScene";
import { MockLLMClient } from "@/lib/llm/client";
import type { ReviewItem } from "@/lib/types";

const TEST_LOG_DIR = join(process.cwd(), "logs", "test-runScene");

const due: ReviewItem[] = [
  {
    itemId: "grammar.tsumori",
    itemType: "grammar",
    lastReviewedAt: null,
    nextReviewAt: null,
    ease: 2.5,
    interval: 0,
    lapses: 0,
  },
  {
    itemId: "vocab.ame",
    itemType: "vocab",
    lastReviewedAt: null,
    nextReviewAt: null,
    ease: 2.5,
    interval: 0,
    lapses: 0,
  },
  {
    itemId: "vocab.fushigi",
    itemType: "vocab",
    lastReviewedAt: null,
    nextReviewAt: null,
    ease: 2.5,
    interval: 0,
    lapses: 0,
  },
];

const FAKE_DIALOGUE_RESPONSE = JSON.stringify({
  briefing: "Evening at the minshuku — Hiro asks about your plans tomorrow.",
  turns: [
    { turn: 2, speaker: "kid", text: "明日、何をするつもり？", language: "ja" },
    { turn: 4, speaker: "kid", text: "明日、雨だって。", language: "ja" },
    { turn: 6, speaker: "kid", text: "ちょっと不思議な天気だね。", language: "ja" },
  ],
  result: "Nice scene.",
});

describe("runScene end-to-end (mocked LLM)", () => {
  beforeEach(() => {
    if (existsSync(TEST_LOG_DIR)) rmSync(TEST_LOG_DIR, { recursive: true });
    mkdirSync(TEST_LOG_DIR, { recursive: true });
  });

  it("produces a complete SceneRunLog with template, items, dialogue, and outcomes", async () => {
    const calls: Array<"dialogue" | "player"> = [];
    const mock = new MockLLMClient(({ system }) => {
      // Crude routing: dialogue prompt mentions "dialogue writer", player prompt mentions "role-playing".
      if (system.includes("dialogue writer")) {
        calls.push("dialogue");
        return FAKE_DIALOGUE_RESPONSE;
      }
      calls.push("player");
      return "明日は教会に行くつもりです。";
    });

    const log = await runScene({
      reviewItems: due,
      now: new Date("2026-05-04T12:00:00.000Z"),
      recentContext: { lastTemplateId: null, lastLocation: null },
      llmClient: mock,
      logDir: TEST_LOG_DIR,
      persona: "intermediate-n3-foreign-student",
    });

    expect(log).not.toBeNull();
    expect(log!.templateChosen.id).toBe("minshuku-evening-with-kid");
    expect(log!.activeTargetsChosen.length).toBeGreaterThan(0);
    expect(log!.turns.length).toBeGreaterThan(0);
    expect(log!.briefing).toMatch(/minshuku|Hiro/i);
    expect(log!.result).toBeTypeOf("string");
    expect(log!.itemOutcomes.length).toBe(log!.activeTargetsChosen.length);
    // Aggregate produces ONE outcome per active target — not duplicated per player turn.
    const tsumoriOutcomes = log!.itemOutcomes.filter((o) => o.itemId === "grammar.tsumori");
    expect(tsumoriOutcomes.length).toBe(1);
    expect(tsumoriOutcomes[0].outcome).toBe("produced");
    // Per-turn results still attached to player turns.
    const playerTurns = log!.turns.filter((t) => t.speaker === "player");
    expect(playerTurns.every((t) => t.evaluatorResults && t.evaluatorResults.length > 0)).toBe(true);
    expect(calls).toContain("dialogue");
    expect(calls).toContain("player");
  });

  it("returns null when there are no due items", async () => {
    const mock = new MockLLMClient(() => "");
    const log = await runScene({
      reviewItems: [],
      now: new Date("2026-05-04T12:00:00.000Z"),
      recentContext: { lastTemplateId: null, lastLocation: null },
      llmClient: mock,
      logDir: TEST_LOG_DIR,
      persona: "intermediate-n3-foreign-student",
    });
    expect(log).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `npm test -- tests/integration/runScene.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/lib/runScene.ts`**

```typescript
import { randomUUID } from "node:crypto";
import { buildScenePlan } from "./generator/buildScenePlan";
import { generateDialogue } from "./llm/generateDialogue";
import { syntheticPlayerTurn } from "./llm/syntheticPlayer";
import { evaluatePlayerTurn } from "./evaluator/evaluate";
import { writeSceneRunLog } from "./log/sceneRunLog";
import type { LLMClient } from "./llm/client";
import type {
  ReviewItem,
  SceneRunLog,
  DialogueLine,
  EvaluatorResult,
} from "./types";

export interface RunSceneArgs {
  reviewItems: ReviewItem[];
  now: Date;
  recentContext: { lastTemplateId: string | null; lastLocation: string | null };
  llmClient: LLMClient;
  logDir?: string;
  persona: string;
  userId?: string;
}

// Aggregate per-turn results into one outcome per active target.
// Order of preference: produced > recognized > produced_with_help > missed.
// (v0 only emits "produced" or "missed", but the comparator handles future v1 outcomes.)
function aggregateOutcomes(
  perTurnResults: EvaluatorResult[][],
  activeTargets: { itemId: string; itemType: "vocab" | "grammar"; mode: "active" | "passive" }[],
): EvaluatorResult[] {
  const RANK: Record<EvaluatorResult["outcome"], number> = {
    mastered: 5,
    produced: 4,
    produced_with_help: 3,
    recognized: 2,
    missed: 1,
  };
  const aggregated: EvaluatorResult[] = [];
  for (const target of activeTargets) {
    const flat = perTurnResults.flat().filter((r) => r.itemId === target.itemId);
    if (flat.length === 0) continue;
    const best = flat.reduce((a, b) => (RANK[b.outcome] > RANK[a.outcome] ? b : a));
    aggregated.push(best);
  }
  return aggregated;
}

export async function runScene(args: RunSceneArgs): Promise<SceneRunLog | null> {
  const built = buildScenePlan(args.reviewItems, args.now, args.recentContext);
  if (!built) return null;

  const startedAt = new Date().toISOString();
  const dialogue = await generateDialogue(built.plan, args.llmClient);

  // Index AI character lines by turn number for stitching.
  const turnsByNumber = new Map<number, DialogueLine>();
  for (const t of dialogue.turns) turnsByNumber.set(t.turn, t);

  const conversation: DialogueLine[] = [];
  // Per-turn evaluator results so we can both attach to the right turn AND aggregate later.
  const perTurnResults = new Map<number, EvaluatorResult[]>();

  for (const t of built.plan.scriptedTurns) {
    if (t.speaker === "coach") {
      // Coach turns are bookends — briefing/result come from generateDialogue, not the conversation array.
      continue;
    }

    if (t.speaker === "player") {
      const playerLine = await syntheticPlayerTurn({
        plan: built.plan,
        conversationSoFar: conversation,
        turnNumber: t.turn,
        persona: args.persona,
        client: args.llmClient,
      });
      conversation.push(playerLine);

      const evalResults = await evaluatePlayerTurn(playerLine.text, built.plan.activeTargets);
      perTurnResults.set(playerLine.turn, evalResults);
      continue;
    }

    // Otherwise it's an AI character — pull the line generated upfront.
    const aiLine = turnsByNumber.get(t.turn);
    if (aiLine) conversation.push(aiLine);
  }

  const itemOutcomes = aggregateOutcomes(
    Array.from(perTurnResults.values()),
    built.plan.activeTargets,
  );

  const endedAt = new Date().toISOString();

  const log: SceneRunLog = {
    id: `run-${randomUUID().slice(0, 8)}`,
    userId: args.userId ?? "default",
    templateId: built.plan.templateId,
    startedAt,
    endedAt,
    activeTargetsConsidered: built.activeConsidered,
    activeTargetsChosen: built.plan.activeTargets,
    templateCandidates: built.candidatesScored,
    templateChosen: {
      id: built.plan.templateId,
      finalScore:
        built.candidatesScored.find((c) => c.templateId === built.plan.templateId)
          ?.finalScore ?? 0,
    },
    threadAction: "standalone",
    beatFired: null,
    llmPrompt: dialogue.rawPrompt,
    llmResponse: dialogue.rawResponse,
    llmLatencyMs: dialogue.latencyMs,
    briefing: dialogue.briefing,
    result: dialogue.result,
    turns: conversation.map((line) => ({
      turn: line.turn,
      speaker: line.speaker,
      text: line.text,
      evaluatorResults:
        line.speaker === "player" ? perTurnResults.get(line.turn) : undefined,
    })),
    itemOutcomes,
  };

  writeSceneRunLog(log, args.logDir);
  return log;
}
```

- [ ] **Step 4: Run the test (should pass)**

Run: `npm test -- tests/integration/runScene.test.ts`
Expected: 2/2 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/runScene.ts tests/integration/runScene.test.ts
git commit -m "feat(runScene): top-level scene orchestrator with mocked-LLM integration test"
```

---

## Task 23: CLI entry — `npm run scene`

**Files:**
- Create: `scripts/run-scene.ts`

(No automated test for the CLI shell — it's a thin wrapper. The behavior is exercised by Task 22's integration test.)

- [ ] **Step 1: Create `scripts/run-scene.ts`**

```typescript
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AnthropicClient } from "../src/lib/llm/client.js";
import { runScene } from "../src/lib/runScene.js";
import type { ReviewItem, SceneRunLog } from "../src/lib/types.js";

const STATE_PATH = join(process.cwd(), "logs", "srs-state.json");

function loadOrInitState(): ReviewItem[] {
  if (existsSync(STATE_PATH)) {
    const raw = readFileSync(STATE_PATH, "utf8");
    return JSON.parse(raw) as ReviewItem[];
  }
  // First run: seed with one of each item due immediately.
  const seed: ReviewItem[] = [
    { itemId: "grammar.tsumori", itemType: "grammar", lastReviewedAt: null, nextReviewAt: null, ease: 2.5, interval: 0, lapses: 0 },
    { itemId: "vocab.mado",      itemType: "vocab",   lastReviewedAt: null, nextReviewAt: null, ease: 2.5, interval: 0, lapses: 0 },
    { itemId: "vocab.ame",       itemType: "vocab",   lastReviewedAt: null, nextReviewAt: null, ease: 2.5, interval: 0, lapses: 0 },
    { itemId: "vocab.fushigi",   itemType: "vocab",   lastReviewedAt: null, nextReviewAt: null, ease: 2.5, interval: 0, lapses: 0 },
    { itemId: "vocab.yakusoku",  itemType: "vocab",   lastReviewedAt: null, nextReviewAt: null, ease: 2.5, interval: 0, lapses: 0 },
  ];
  writeFileSync(STATE_PATH, JSON.stringify(seed, null, 2));
  return seed;
}

async function main(): Promise<void> {
  const items = loadOrInitState();
  const client = new AnthropicClient();
  const log = await runScene({
    reviewItems: items,
    now: new Date(),
    recentContext: { lastTemplateId: null, lastLocation: null },
    llmClient: client,
    persona: "intermediate-n3-foreign-student",
  });

  if (!log) {
    console.log("No due items — nothing to run.");
    return;
  }

  console.log(`Scene run complete. id=${log.id}`);
  console.log(`Template: ${log.templateChosen.id}`);
  console.log(`Active: ${log.activeTargetsChosen.map((a) => a.itemId).join(", ")}`);
  console.log(`Turns: ${log.turns.length}`);
  console.log(`Outcomes: ${log.itemOutcomes.map((o) => `${o.itemId}=${o.outcome}`).join(", ")}`);
  console.log(`Log appended to logs/scene-runs.jsonl`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify the CLI typechecks**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/run-scene.ts
git commit -m "feat(cli): npm run scene — runs one full scene end-to-end"
```

---

## Task 24: Text-mode renderer — `npm run render-log`

**Files:**
- Create: `scripts/render-log.ts`

- [ ] **Step 1: Create `scripts/render-log.ts`**

```typescript
import { readAllSceneRunLogs } from "../src/lib/log/sceneRunLog.js";

function main(): void {
  const args = process.argv.slice(2);
  const idArg = args.find((a) => a.startsWith("--id="));
  const targetId = idArg ? idArg.slice("--id=".length) : null;

  const all = readAllSceneRunLogs();
  if (all.length === 0) {
    console.log("No scene runs logged yet.");
    return;
  }

  const log = targetId ? all.find((l) => l.id === targetId) : all[all.length - 1];
  if (!log) {
    console.log(targetId ? `No log found for id=${targetId}` : "No log found.");
    return;
  }

  console.log("=".repeat(60));
  console.log(`Scene Run: ${log.id}`);
  console.log(`Template:  ${log.templateChosen.id}  (score ${log.templateChosen.finalScore})`);
  console.log(`Started:   ${log.startedAt}`);
  console.log(`Ended:     ${log.endedAt}`);
  console.log("-".repeat(60));
  console.log("Briefing (coach):");
  console.log(`  ${log.briefing}`);
  console.log("-".repeat(60));
  console.log("Item assignments:");
  for (const a of log.activeTargetsChosen) console.log(`  [active]  ${a.itemId}`);
  console.log("-".repeat(60));
  console.log("Template candidates:");
  for (const c of log.templateCandidates) {
    console.log(`  ${c.templateId}  score=${c.finalScore}`);
    for (const r of c.reasons) console.log(`     • ${r}`);
  }
  console.log("-".repeat(60));
  console.log("Dialogue:");
  for (const t of log.turns) {
    console.log(`  [${t.turn}] ${t.speaker}: ${t.text}`);
    if (t.evaluatorResults) {
      for (const e of t.evaluatorResults) {
        console.log(`         eval: ${e.itemId} → ${e.outcome}  (${e.evidence.notes ?? ""})`);
      }
    }
  }
  console.log("-".repeat(60));
  console.log("Result (coach):");
  console.log(`  ${log.result}`);
  console.log("-".repeat(60));
  console.log("Outcomes:");
  for (const o of log.itemOutcomes) {
    console.log(`  ${o.itemId}  ${o.mode}  ${o.outcome}`);
  }
  console.log("=".repeat(60));
}

main();
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/render-log.ts
git commit -m "feat(cli): npm run render-log — pretty-print latest or specific scene run"
```

---

## Task 25: Run a real scene end-to-end and inspect the log

This task is a manual verification step — no test code, just running the CLI against a real LLM and confirming everything works.

**Files:**
- Create: `.env` (local only, gitignored)
- Verify: `logs/scene-runs.jsonl`

- [ ] **Step 1: Configure `.env`**

Create `.env` (NOT committed — it's in `.gitignore`):

```
ANTHROPIC_API_KEY=sk-ant-...your-real-key...
```

- [ ] **Step 2: Run the scene**

Run: `npm run scene`
Expected:
- Console prints run id, template, active items, turn count, outcomes, and "Log appended to logs/scene-runs.jsonl"
- A new line is appended to `logs/scene-runs.jsonl`
- No errors

- [ ] **Step 3: Render the log**

Run: `npm run render-log`
Expected: a readable transcript like:

```
============================================================
Scene Run: run-xxxxxxxx
Template:  minshuku-evening-with-kid  (score 10)
Started:   2026-05-04T...
Ended:     2026-05-04T...
------------------------------------------------------------
Item assignments:
  [active]  grammar.tsumori
  [active]  vocab.mado
------------------------------------------------------------
Template candidates:
  minshuku-evening-with-kid  score=10
     • base score 10
  minshuku-morning-with-mom  score=10
     • base score 10
------------------------------------------------------------
Dialogue:
  [2] kid: 明日、何をするつもり？
  [3] player: 明日は教会に行くつもりです。
         eval: grammar.tsumori → produced  (rule check: pattern surface found)
  ...
============================================================
```

- [ ] **Step 4: Inspect the raw JSONL**

Run: `cat logs/scene-runs.jsonl | tail -1 | python3 -m json.tool`
Expected: a complete `SceneRunLog` JSON with all fields populated (template choice rationale, item assignments, full turns, evaluator outcomes, llmPrompt, llmResponse).

- [ ] **Step 5: Verify the test suite still passes**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 6: Commit anything that changed**

```bash
git status
# If any committable files changed (e.g., updated docs), commit them.
# .env is gitignored and must not be committed.
```

If nothing committable changed, this task simply produces a successful manual verification — no commit needed.

---

## Done condition

The v0 milestone is complete when **all of the following are true**:

1. `npm test` exits 0 with all suites passing.
2. `npm run typecheck` exits 0.
3. `npm run scene` runs end-to-end against the real Anthropic API and writes a valid `SceneRunLog` to `logs/scene-runs.jsonl`.
4. `npm run render-log` prints a readable transcript of the latest run with: template choice, item assignments, dialogue, and per-target evaluator outcomes.
5. The `SceneRunLog` JSON contains full generator decisions (template candidates with rationale, active/passive item assignments, llmPrompt, llmResponse, per-turn results).

Per spec §24 v0 milestone: "complete when a developer can run one command, see a full scene transcript with assigned items and evaluator outcomes, and inspect the structured log." All four items above map directly to that condition.

---

## Out of scope for this plan (deferred to later plans)

- Audio: TTS, STT, audio cues, ambient music
- UI: Next.js scaffold, story-frame scene mode, briefing card, result card
- Threads (per-character/per-location narrative state)
- Mystery beats (layered insertion model)
- Multi-AI scenes (template-level support already exists, but no multi-character v0 templates authored)
- LLM judge (rubric + holistic single-call judge — rule-based evaluator only in v0)
- AI judge golden set + CI integration
- Scene Replay viewer (web UI on top of `SceneRunLog`)
- Time-injection / fast-forward simulator
- Onboarding flow (settle-in interview + discovery scenes)
- Sampled-production judging
- Lesson phase content (only drill + roleplay are exercised here)
- Quiz phase implementation (rubric exists but no quiz turns are in v0 templates)
- Cadence: stacking scenes, "you're caught up", add-lesson option
