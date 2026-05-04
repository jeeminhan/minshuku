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
