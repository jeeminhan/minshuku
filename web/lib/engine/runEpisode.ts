import { join } from "node:path";
import { loadTemplates } from "@engine/content";
import { runScene } from "@engine/runScene";
import type { RunSceneResult } from "@engine/runScene";
import type { ItemAssignment, ItemType, RecallMode } from "@engine/types";
import { DEMO_PERSONA, demoClock } from "./demoLearner";
import { createLLMClient } from "./fixtureClient";
import { lookupItemDetails } from "./itemDetails";
import { StoryContextLLMClient } from "./storyContextClient";
import { readStoryState, writeStoryState } from "./storyStore";
import type { PendingOutcome } from "./storyStore";

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
// ItemAssignments carry only ids. Derived purely from static content data,
// so the contract-002 determinism guarantee (byte-identical repeat GETs
// within a day) extends to this field with no extra exclusions.
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
  return assignments.map((assignment) => ({
    ...assignment,
    ...lookupItemDetails(assignment.itemId, assignment.itemType),
  }));
}

// log.itemOutcomes entries carry itemId/mode/outcome; the persisted pending
// outcome additionally needs the itemType (for the debrief's content-pack
// join). Every aggregated outcome belongs to a chosen active target, so the
// join is total — a miss is a bug worth failing loud over.
function pendingOutcomes(
  itemOutcomes: { itemId: string; outcome: PendingOutcome["outcome"] }[],
  activeTargets: ItemAssignment[],
): PendingOutcome[] {
  return itemOutcomes.map((outcome) => {
    const target = activeTargets.find((t) => t.itemId === outcome.itemId);
    if (!target) {
      throw new Error(
        `Aggregated outcome for "${outcome.itemId}" has no matching active target in the scene log`,
      );
    }
    return { itemId: outcome.itemId, itemType: target.itemType, outcome: outcome.outcome };
  });
}

// Server-side bridge: runs one episode for the fixed demo learner against
// the persisted story state — including the persisted (outcome-evolved)
// reviewItems, at the day-keyed demo clock (contract 004). Re-read from disk
// every request (no cache), so deleting web/.data/story-state.json resets to
// day 1 without a restart. A completed run records its result + aggregated
// outcomes + passives as `pending`; the day only advances and the outcomes
// only apply when POST /api/episode/complete folds `pending` in — GET is
// strictly read-only with respect to reviewItems, and repeat GETs within a
// day replay the same deterministic episode and rewrite the same `pending`.
export async function runEpisode(): Promise<EpisodeResult> {
  const state = readStoryState();
  const client = new StoryContextLLMClient(
    createLLMClient(state.day),
    state.day,
    state.summary,
  );
  const result = await runScene({
    reviewItems: state.reviewItems,
    now: demoClock(state.day),
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
        itemOutcomes: pendingOutcomes(result.log.itemOutcomes, result.log.activeTargetsChosen),
        passiveItems: result.log.passiveItemsChosen,
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
