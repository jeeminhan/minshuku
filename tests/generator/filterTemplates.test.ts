import { describe, it, expect } from "vitest";
import { filterTemplates } from "@/lib/generator/filterTemplates";
import { loadTemplates } from "@/lib/content";
import type { ItemAssignment } from "@/lib/types";

describe("filterTemplates", () => {
  const templates = loadTemplates();

  it("returns templates whose activeTargetCompatibility shares at least one tag with the target", () => {
    const active: ItemAssignment[] = [
      { itemId: "grammar.tsumori", itemType: "grammar", mode: "active" },
    ];
    const filtered = filterTemplates(templates, active);
    expect(filtered.length).toBeGreaterThan(0);
    // grammar.tsumori has pattern つもり and scenarioTags [planning, minshuku, weekend, evening].
    // A returned template must share at least one of grammar:つもり or tag:<one of the scenarioTags>.
    const targetTags = [
      "grammar:つもり",
      "tag:planning",
      "tag:minshuku",
      "tag:weekend",
      "tag:evening",
    ];
    for (const t of filtered) {
      const overlap = t.activeTargetCompatibility.some((tag) => targetTags.includes(tag));
      expect(overlap).toBe(true);
    }
  });

  it("returns empty when no template hosts the active target", () => {
    const active: ItemAssignment[] = [
      { itemId: "grammar.unknown", itemType: "grammar", mode: "active" },
    ];
    const filtered = filterTemplates(templates, active);
    expect(filtered).toEqual([]);
  });

  it("matches by item-id-derived tag (e.g., grammar:つもり) by looking up the loaded GrammarItem.pattern", () => {
    // This tests that the filter resolves the item id to its pattern via the loaded grammar.
    const active: ItemAssignment[] = [
      { itemId: "grammar.tsumori", itemType: "grammar", mode: "active" },
    ];
    const filtered = filterTemplates(templates, active);
    expect(filtered.length).toBeGreaterThan(0);
  });
});
