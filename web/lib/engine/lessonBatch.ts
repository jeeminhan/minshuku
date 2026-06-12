import type { ReviewItem } from "@engine/types";

// The day-4 "today's new lesson" batch, appended fresh at the day-4 boundary
// (never earlier — a fresh grammar item due on day 2 would steal that day's
// grammar slot and invalidate the committed day-2 fixture). Extracted from
// scripts/seed-demo.ts in contract 007 so the file-mode seed script and the
// cookie store's replay share ONE definition: the seeded file state and the
// cookie-derived state must be byte-identical, and a drifted second copy of
// this list is exactly the bug that would break that.
// Fresh items carry no SRS history: same all-null shape as demoLearner's seed.
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

export function day4LessonBatch(): ReviewItem[] {
  return [
    freshLessonItem("grammar.temo-ii", "grammar"),
    freshLessonItem("vocab.motsu", "vocab"),
  ];
}
