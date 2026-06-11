import type { ReviewItem } from "@engine/types";

// Fixed demo learner for contract 001: every input to runScene is pinned so
// fixture replay is deterministic. With this seed, `now`, and empty recent
// context, buildScenePlan deterministically picks the
// `cafe-regular-encounter` template with active targets grammar.tsumori +
// vocab.mado — the committed fixture in web/fixtures/ was recorded against
// exactly that plan.
export const DEMO_NOW = new Date("2026-06-01T09:00:00.000Z");

export const DEMO_PERSONA = "intermediate-n3-foreign-student";

export const DEMO_RECENT_CONTEXT = {
  lastTemplateId: null,
  lastLocation: null,
} as const;

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

// Same seed as scripts/run-scene.ts defaultSeed() — all items due.
export function demoReviewItems(): ReviewItem[] {
  return [
    newReviewItem("grammar.tsumori", "grammar"),
    newReviewItem("vocab.mado", "vocab"),
    newReviewItem("vocab.ame", "vocab"),
    newReviewItem("vocab.fushigi", "vocab"),
    newReviewItem("vocab.yakusoku", "vocab"),
  ];
}
