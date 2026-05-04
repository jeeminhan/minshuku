import { describe, it, expect } from "vitest";
import { pickPassiveItems } from "@/lib/generator/pickPassiveItems";
import { loadTemplates } from "@/lib/content";
import type { ReviewItem, ItemAssignment } from "@/lib/types";

const item = (id: string, type: "vocab" | "grammar"): ReviewItem => ({
  itemId: id,
  itemType: type,
  lastReviewedAt: null,
  nextReviewAt: null,
  ease: 2.5,
  interval: 0,
  lapses: 0,
});

describe("pickPassiveItems", () => {
  const templates = loadTemplates();
  const evening = templates.find((t) => t.id === "minshuku-evening-with-kid")!;

  it("picks up to 3 passive items by default", () => {
    const due = [
      item("vocab.mado", "vocab"),
      item("vocab.ame", "vocab"),
      item("vocab.fushigi", "vocab"),
      item("vocab.yakusoku", "vocab"),
    ];
    const active: ItemAssignment[] = [
      { itemId: "grammar.tsumori", itemType: "grammar", mode: "active" },
    ];
    const passive = pickPassiveItems(due, evening, active);
    expect(passive.length).toBeLessThanOrEqual(3);
    expect(passive.length).toBeGreaterThan(0);
    expect(passive.every((p) => p.mode === "passive")).toBe(true);
  });

  it("does not include items already chosen as active", () => {
    const due = [
      item("vocab.mado", "vocab"),
      item("grammar.tsumori", "grammar"),
    ];
    const active: ItemAssignment[] = [
      { itemId: "grammar.tsumori", itemType: "grammar", mode: "active" },
    ];
    const passive = pickPassiveItems(due, evening, active);
    expect(passive.find((p) => p.itemId === "grammar.tsumori")).toBeUndefined();
  });

  it("prefers items whose scenarioTags intersect the template's passiveScenarioTags", () => {
    // evening template has passive tags: evening, weather, minshuku, planning
    const due = [
      item("vocab.ame", "vocab"),       // tags: weather, evening, morning -> 2 overlaps
      item("vocab.motsu", "vocab"),     // tags: minshuku, everyday -> 1 overlap
    ];
    const active: ItemAssignment[] = [];
    const passive = pickPassiveItems(due, evening, active);
    expect(passive[0].itemId).toBe("vocab.ame");
  });
});
