import type { ReviewItem } from "@engine/types";

// Fixed demo learner: every input to runScene is pinned so fixture replay is
// deterministic. recentContext and reviewItems come from the persisted story
// state (contracts 002/004) — on day 1 (fresh seed, nulls) buildScenePlan
// deterministically picks the `cafe-regular-encounter` template with active
// targets grammar.tsumori + vocab.mado; on day 2 the EVOLVED state (day-1
// outcomes applied: tsumori mastered → resting until 06-05, mado produced →
// due again 06-02) with recentContext cafe-regular-encounter/cafe picks
// `late-night-walk-stranger` with active target vocab.ame only. The committed
// fixtures in web/fixtures/ were recorded against exactly those plans.
export const DEMO_NOW = new Date("2026-06-01T09:00:00.000Z");

export const DEMO_PERSONA = "intermediate-n3-foreign-student";

const DAY_MS = 24 * 60 * 60 * 1000;

// Day-keyed demo clock (contract 004): story day N runs at DEMO_NOW plus
// (N−1) whole days, so day 1 is exactly DEMO_NOW (day-1 fixtures unchanged)
// and items reviewed on day N (nextReviewAt ≥ +1 day) can come due on day
// N+1. Used for runScene's `now`, for applying outcomes at completion (the
// completed day's clock), and for the next day's due computation.
export function demoClock(day: number): Date {
  return new Date(DEMO_NOW.getTime() + (day - 1) * DAY_MS);
}

function newReviewItem(itemId: string, itemType: "grammar" | "vocab"): ReviewItem {
  return {
    itemId,
    itemType,
    lastReviewedAt: null,
    nextReviewAt: null, // never reviewed → always due
    ease: 2.5,
    interval: 0,
    lapses: 0,
  };
}

// Same seed as scripts/run-scene.ts defaultSeed() — all items due. Since
// contract 004 this is the FRESH-STATE SEED only: freshStoryState() copies it
// into the persisted state, and every episode runs against the persisted
// (outcome-evolved) items, never this seed directly. Due-item selection
// tie-breaks by stable sort on input order, so the seed order is load-bearing.
export function demoReviewItems(): ReviewItem[] {
  return [
    newReviewItem("grammar.tsumori", "grammar"),
    newReviewItem("vocab.mado", "vocab"),
    newReviewItem("vocab.ame", "vocab"),
    newReviewItem("vocab.fushigi", "vocab"),
    newReviewItem("vocab.yakusoku", "vocab"),
  ];
}
