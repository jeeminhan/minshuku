import { describe, it, expect } from "vitest";
import { filterTemplates } from "@/lib/generator/filterTemplates";
import { loadTemplates } from "@/lib/content";
import type { ItemAssignment } from "@/lib/types";

describe("filterTemplates", () => {
  const templates = loadTemplates();

  it("returns templates whose activeTargetCompatibility includes the active target's id tag", () => {
    const active: ItemAssignment[] = [
      { itemId: "grammar.tsumori", itemType: "grammar", mode: "active" },
    ];
    const filtered = filterTemplates(templates, active);
    expect(filtered.length).toBeGreaterThan(0);
    for (const t of filtered) {
      expect(t.activeTargetCompatibility).toContain("grammar:つもり");
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
