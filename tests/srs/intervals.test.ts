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
