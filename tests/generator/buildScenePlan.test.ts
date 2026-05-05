import { describe, it, expect } from "vitest";
import { buildScenePlan } from "@/lib/generator/buildScenePlan";
import type { ReviewItem } from "@/lib/types";

const today = new Date("2026-05-04T12:00:00.000Z");

const item = (id: string, type: "vocab" | "grammar"): ReviewItem => ({
  itemId: id,
  itemType: type,
  lastReviewedAt: null,
  nextReviewAt: null,
  ease: 2.5,
  interval: 0,
  lapses: 0,
});

describe("buildScenePlan", () => {
  it("returns a complete ScenePlan when there are due items and a compatible template", () => {
    const due = [
      item("grammar.tsumori", "grammar"),
      item("vocab.mado", "vocab"),
      item("vocab.ame", "vocab"),
      item("vocab.yakusoku", "vocab"),
    ];
    const result = buildScenePlan(due, today, {
      lastTemplateId: null,
      lastLocation: null,
    });
    expect(result).not.toBeNull();
    expect(result!.plan.activeTargets.length).toBeGreaterThan(0);
    expect(result!.plan.passiveItems.length).toBeGreaterThan(0);
    expect(result!.plan.microStake).toContain("minshuku");
    expect(result!.candidatesScored.length).toBeGreaterThan(0);
  });

  it("returns null when no template can host the active targets", () => {
    const due = [item("grammar.unknown", "grammar")];
    const result = buildScenePlan(due, today, {
      lastTemplateId: null,
      lastLocation: null,
    });
    // unknown grammar id has no compatible template
    expect(result).toBeNull();
  });

  it("promotes the next due item when the most urgent active target has no template", () => {
    const due = [
      item("grammar.unknown", "grammar"),
      item("grammar.tsumori", "grammar"),
      item("vocab.ame", "vocab"),
    ];

    const result = buildScenePlan(due, today, {
      lastTemplateId: null,
      lastLocation: null,
    });

    expect(result).not.toBeNull();
    expect(result!.plan.activeTargets).toEqual([
      { itemId: "grammar.tsumori", itemType: "grammar", mode: "active" },
    ]);
    expect(result!.plan.passiveItems.some((p) => p.itemId === "grammar.unknown")).toBe(true);
    expect(result!.activeConsidered.some((a) => a.itemId === "grammar.unknown")).toBe(true);
  });

  it("can actively host seeded grammar.dakara", () => {
    const result = buildScenePlan([item("grammar.dakara", "grammar")], today, {
      lastTemplateId: null,
      lastLocation: null,
    });

    expect(result).not.toBeNull();
    expect(result!.plan.activeTargets).toEqual([
      { itemId: "grammar.dakara", itemType: "grammar", mode: "active" },
    ]);
  });

  it("returns null when there are no due items", () => {
    const result = buildScenePlan([], today, {
      lastTemplateId: null,
      lastLocation: null,
    });
    expect(result).toBeNull();
  });
});
