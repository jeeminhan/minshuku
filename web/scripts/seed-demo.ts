import { runEpisode } from "../lib/engine/runEpisode";
import {
  completeEpisode,
  freshStoryState,
  readStoryState,
  writeStoryState,
} from "../lib/engine/storyStore";
import type { StoryState } from "../lib/engine/storyStore";
import type { ReviewItem } from "@engine/types";

// Seeded demo learner (contract 005): rebuild web/.data/story-state.json from
// scratch by SIMULATING days 1-3 through the exact modules the API routes
// call — runEpisode() (fixture replay, real runScene + evaluator) and
// completeEpisode() (the real engine SRS update + due computation, via
// storyStore) — then append the day-4 lesson batch and stop at the start of
// day 4. No SRS number in this file is a literal: every interval/ease/
// nextReviewAt in the seeded state is computed by the engine from the
// committed fixtures.
// Re-running the script is the documented reset-to-day-4; two runs produce a
// byte-identical state file.
const SIMULATED_DAYS = 3;

// Today's new lesson batch, appended fresh at the day-4 boundary (never
// earlier — a fresh grammar item due on day 2 would steal that day's grammar
// slot and invalidate the committed day-2 fixture). Fresh items carry no SRS
// history: same all-null shape as demoLearner's seed items.
function freshLessonItem(itemId: string, itemType: ReviewItem["itemType"]): ReviewItem {
  return {
    itemId,
    itemType,
    lastReviewedAt: null,
    nextReviewAt: null, // never reviewed → due today
    ease: 2.5,
    interval: 0,
    lapses: 0,
  };
}

function day4LessonBatch(): ReviewItem[] {
  return [
    freshLessonItem("grammar.temo-ii", "grammar"),
    freshLessonItem("vocab.motsu", "vocab"),
  ];
}

function describeItem(item: ReviewItem): string {
  const next = item.nextReviewAt ?? "(never reviewed — due today)";
  return `  ${item.itemId.padEnd(18)} interval=${item.interval} ease=${item.ease} lapses=${item.lapses} next=${next}`;
}

async function simulateDay(day: number): Promise<void> {
  const episode = await runEpisode();
  if (episode.status !== "completed") {
    throw new Error(`Seed simulation: day ${day} episode skipped — ${episode.message}`);
  }
  const completed = completeEpisode(readStoryState());
  if (!completed) {
    throw new Error(`Seed simulation: nothing pending after day ${day}'s completed episode run`);
  }
  writeStoryState(completed.state);
}

async function main(): Promise<void> {
  // Force fixture replay regardless of environment: the seed must NEVER call
  // live Gemini, even with GEMINI_API_KEY set. createLLMClient reads this at
  // call time, so setting it here covers every simulated day.
  process.env.MINSHUKU_FAKE_LLM = "1";

  // Never depend on the pre-existing state file — rebuild from fresh. That is
  // what makes re-runs byte-identical.
  writeStoryState(freshStoryState());
  for (let day = 1; day <= SIMULATED_DAYS; day += 1) {
    await simulateDay(day);
  }

  const afterDayThree = readStoryState();
  const seeded: StoryState = {
    ...afterDayThree,
    reviewItems: [...afterDayThree.reviewItems, ...day4LessonBatch()],
  };
  writeStoryState(seeded);

  console.log(`Seeded demo learner: day ${seeded.day} (days 1-${SIMULATED_DAYS} simulated through the engine)`);
  console.log("\nStory so far:");
  for (const line of seeded.summary.split("\n")) {
    console.log(`  ${line}`);
  }
  console.log("\nReview items (engine-computed):");
  for (const item of seeded.reviewItems) {
    console.log(describeItem(item));
  }
  console.log("\nRe-run `npm run seed-demo` any time to reset the demo to the start of day 4.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
