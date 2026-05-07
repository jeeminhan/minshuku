import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { VocabItem, GrammarItem, SceneTemplate } from "./types";

const JlptLevel = z.enum(["N5", "N4", "N3", "N2", "N1"]);
const Register = z.enum(["casual", "neutral", "polite", "formal", "literary"]);
const Domain = z.enum([
  "physical",
  "emotional",
  "abstract",
  "social",
  "temporal",
  "commercial",
  "ritual",
]);

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
  register: Register.optional(),
  domain: z.array(Domain).optional(),
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
  register: Register.optional(),
  domain: z.array(Domain).optional(),
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
  acceptedDomains: z.array(Domain).optional(),
  acceptedRegisters: z.array(Register).optional(),
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

let vocabCache: VocabItem[] | null = null;
let grammarCache: GrammarItem[] | null = null;
let templatesCache: SceneTemplate[] | null = null;

export function loadVocab(): VocabItem[] {
  if (vocabCache) return vocabCache;
  const raw = readFileSync(join(DATA_DIR, "vocab.json"), "utf8");
  const parsed = JSON.parse(raw);
  vocabCache = z.array(VocabItemSchema).parse(parsed) as VocabItem[];
  return vocabCache;
}

export function loadGrammar(): GrammarItem[] {
  if (grammarCache) return grammarCache;
  const raw = readFileSync(join(DATA_DIR, "grammar.json"), "utf8");
  const parsed = JSON.parse(raw);
  grammarCache = z.array(GrammarItemSchema).parse(parsed) as GrammarItem[];
  return grammarCache;
}

export function loadTemplates(): SceneTemplate[] {
  if (templatesCache) return templatesCache;
  const dir = join(DATA_DIR, "templates");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  templatesCache = files.map((f) => {
    const raw = readFileSync(join(dir, f), "utf8");
    const parsed = JSON.parse(raw);
    return SceneTemplateSchema.parse(parsed) as SceneTemplate;
  });
  return templatesCache;
}
