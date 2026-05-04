import { describe, it, expect } from "vitest";
import { pickDueItems } from "@/lib/srs/pickDueItems";
import type { ReviewItem } from "@/lib/types";

const today = new Date("2026-05-04T12:00:00.000Z");

const item = (id: string, nextReviewAt: string | null, lapses = 0): ReviewItem => ({
  itemId: id,
  itemType: "vocab",
  lastReviewedAt: null,
  nextReviewAt,
  ease: 2.5,
  interval: 0,
  lapses,
});

describe("pickDueItems", () => {
  it("returns items whose nextReviewAt is in the past or today", () => {
    const all = [
      item("a", "2026-05-03T00:00:00.000Z"),       // overdue
      item("b", "2026-05-04T00:00:00.000Z"),       // due today
      item("c", "2026-05-10T00:00:00.000Z"),       // future
      item("d", null),                              // never reviewed → due
    ];
    const due = pickDueItems(all, today);
    expect(due.map((i) => i.itemId).sort()).toEqual(["a", "b", "d"]);
  });

  it("orders by overdue magnitude (most overdue first), then by lapses desc", () => {
    const all = [
      item("a", "2026-05-04T00:00:00.000Z", 0),    // due today, 0 lapses
      item("b", "2026-05-01T00:00:00.000Z", 0),    // 3 days overdue
      item("c", "2026-05-04T00:00:00.000Z", 5),    // due today, 5 lapses
    ];
    const due = pickDueItems(all, today);
    expect(due.map((i) => i.itemId)).toEqual(["b", "c", "a"]);
  });

  it("respects maxItems cap", () => {
    const all = [
      item("a", "2026-05-01T00:00:00.000Z"),
      item("b", "2026-05-02T00:00:00.000Z"),
      item("c", "2026-05-03T00:00:00.000Z"),
    ];
    const due = pickDueItems(all, today, { maxItems: 2 });
    expect(due.length).toBe(2);
  });
});
