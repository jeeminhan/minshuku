import { join } from "node:path";
import { loadGrammar, loadTemplates, loadVocab } from "@engine/content";
import { runScene } from "@engine/runScene";
import type { RunSceneResult } from "@engine/runScene";
import type { ItemAssignment, ItemType, RecallMode } from "@engine/types";
import { DEMO_NOW, DEMO_PERSONA, demoReviewItems } from "./demoLearner";
import { createLLMClient } from "./fixtureClient";
import { StoryContextLLMClient } from "./storyContextClient";
import { readStoryState, writeStoryState } from "./storyStore";

// Next runs with cwd = web/ (HARNESS.md: `cd web && npm run dev`), so the
// repo-level logs/ directory is one level up. Passed explicitly — never rely
// on the engine's cwd default, which would write into web/logs.
const WEB_LOG_DIR = join(process.cwd(), "..", "logs", "web");

// Story fields surfaced alongside the engine result (contract 002):
// day/summary are the persisted state TODAY'S generation ran against;
// promptContext is the exact story-so-far block injected into the
// dialogue-generation prompt ("" on day 1, when nothing is injected).
export interface EpisodeStory {
  day: number;
  summary: string;
  promptContext: string;
}

// Episode item joined against the content packs (contract 003): the UI needs
// surface/reading/meaning for gloss tokens and outcome badges, but the log's
// ItemAssignments carry only ids. surface = VocabItem.word | GrammarItem.pattern;
// reading is null for grammar (GrammarItem has no reading). Derived purely from
// static content data, so the contract-002 determinism guarantee (byte-identical
// repeat GETs within a day) extends to this field with no extra exclusions.
export interface EpisodeItem {
  itemId: string;
  itemType: ItemType;
  mode: RecallMode;
  surface: string;
  reading: string | null;
  meaning: string;
}

export type EpisodeResult = RunSceneResult & {
  story: EpisodeStory;
  items: EpisodeItem[];
};

function templateLocation(templateId: string): string | null {
  return loadTemplates().find((t) => t.id === templateId)?.location ?? null;
}

function joinItems(assignments: ItemAssignment[]): EpisodeItem[] {
  const vocab = loadVocab();
  const grammar = loadGrammar();
  return assignments.map((assignment) => {
    if (assignment.itemType === "vocab") {
      const item = vocab.find((v) => v.id === assignment.itemId);
      if (!item) {
        throw new Error(
          `Episode references unknown vocab item "${assignment.itemId}" — not in data/vocab.json`,
        );
      }
      return { ...assignment, surface: item.word, reading: item.reading, meaning: item.meaning };
    }
    const item = grammar.find((g) => g.id === assignment.itemId);
    if (!item) {
      throw new Error(
        `Episode references unknown grammar item "${assignment.itemId}" — not in data/grammar.json`,
      );
    }
    return { ...assignment, surface: item.pattern, reading: null, meaning: item.meaning };
  });
}

// Server-side bridge: runs one episode for the fixed demo learner against
// the persisted story state. Re-read from disk every request (no cache), so
// deleting web/.data/story-state.json resets to day 1 without a restart.
// A completed run records its result as `pending`; the day only advances
// when POST /api/episode/complete folds `pending` into the summary — repeat
// GETs within a day replay the same deterministic episode and rewrite the
// same `pending`. SRS state evolution between days is contract 004 — every
// day replays the same fresh seed.
export async function runEpisode(): Promise<EpisodeResult> {
  const state = readStoryState();
  const client = new StoryContextLLMClient(
    createLLMClient(state.day),
    state.day,
    state.summary,
  );
  const result = await runScene({
    reviewItems: demoReviewItems(),
    now: DEMO_NOW,
    recentContext: { ...state.recentContext },
    llmClient: client,
    logDir: WEB_LOG_DIR,
    persona: DEMO_PERSONA,
    userId: "demo-learner",
  });
  if (result.status === "completed") {
    writeStoryState({
      ...state,
      pending: {
        day: state.day,
        result: result.log.result,
        templateId: result.log.templateId,
        location: templateLocation(result.log.templateId),
      },
    });
  }
  return {
    ...result,
    story: {
      day: state.day,
      summary: state.summary,
      promptContext: client.promptContext,
    },
    items:
      result.status === "completed"
        ? joinItems([...result.log.activeTargetsChosen, ...result.log.passiveItemsChosen])
        : [],
  };
}
