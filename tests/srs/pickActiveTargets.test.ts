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
