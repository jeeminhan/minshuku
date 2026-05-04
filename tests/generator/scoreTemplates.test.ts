import { describe, it, expect } from "vitest";
import { scoreTemplates } from "@/lib/generator/scoreTemplates";
import { loadTemplates } from "@/lib/content";

describe("scoreTemplates", () => {
  const templates = loadTemplates();

  it("returns one rationale per template", () => {
    const scored = scoreTemplates(templates, { lastTemplateId: null, lastLocation: null });
    expect(scored.length).toBe(templates.length);
    for (const r of scored) {
      expect(r.templateId).toBeDefined();
      expect(typeof r.finalScore).toBe("number");
      expect(Array.isArray(r.reasons)).toBe(true);
    }
  });

  it("penalizes templates that match the most recent run", () => {
    const lastId = templates[0].id;
    const scored = scoreTemplates(templates, {
      lastTemplateId: lastId,
      lastLocation: templates[0].location,
    });
    const recent = scored.find((r) => r.templateId === lastId);
    const other = scored.find((r) => r.templateId !== lastId);
    expect(recent).toBeDefined();
    expect(other).toBeDefined();
    expect(other!.finalScore).toBeGreaterThan(recent!.finalScore);
  });

  it("rationales include human-readable reasons", () => {
    const scored = scoreTemplates(templates, { lastTemplateId: templates[0].id, lastLocation: null });
    const recent = scored.find((r) => r.templateId === templates[0].id);
    expect(recent?.reasons.some((r) => r.toLowerCase().includes("recent"))).toBe(true);
  });
});
