import { describe, it, expect } from "vitest";
import { computeTrends, type ReviewSnapshot } from "@/lib/log/trends";
import type { AttributionReport, TemplateAttribution, ItemAttribution } from "@/lib/log/attribution";

function emptyCat() {
  return { architecture: 0, prompt: 0, data: 0, "llm-quality": 0 };
}
function emptySev() {
  return { auditWarn: 0, auditFail: 0, qualHigh: 0, qualMedium: 0, qualLow: 0 };
}
function tpl(id: string, runs: number, findings: number, rate: number): TemplateAttribution {
  return { templateId: id, runs, totalFindings: findings, findingRate: rate, byCategory: emptyCat(), bySeverity: emptySev() };
}
function item(id: string, runs: number, findings: number, rate: number): ItemAttribution {
  return { itemId: id, itemType: "vocab", role: "active", runs, totalFindings: findings, findingRate: rate, byCategory: emptyCat(), bySeverity: emptySev() };
}
function snap(ts: string, score: number, attribution: AttributionReport): ReviewSnapshot {
  return { timestamp: ts, scenes: 5, avgScore: score, qualitativeFindingCount: 0, attribution };
}

describe("computeTrends", () => {
  it("treats a single snapshot as 'new' for everything", () => {
    const s = snap("2026-05-01T00:00:00Z", 90, {
      templates: [tpl("t-cafe", 5, 5, 1.0)],
      items: [item("vocab.x", 5, 5, 1.0)],
    });
    const r = computeTrends([s]);
    expect(r.score.direction).toBe("new");
    expect(r.templates[0].direction).toBe("new");
    expect(r.items[0].direction).toBe("new");
  });

  it("classifies improving/regressing/stable based on first vs last point in window", () => {
    const a = snap("2026-05-01T00:00:00Z", 80, {
      templates: [tpl("t-up", 5, 5, 1.0), tpl("t-down", 5, 10, 2.0), tpl("t-same", 5, 5, 1.0)],
      items: [],
    });
    const b = snap("2026-05-02T00:00:00Z", 90, {
      templates: [tpl("t-up", 5, 10, 2.0), tpl("t-down", 5, 2, 0.4), tpl("t-same", 5, 5, 1.05)],
      items: [],
    });
    const r = computeTrends([a, b]);
    const byId = new Map(r.templates.map((t) => [t.templateId, t]));
    expect(byId.get("t-up")!.direction).toBe("regressing");
    expect(byId.get("t-up")!.delta).toBe(1.0);
    expect(byId.get("t-down")!.direction).toBe("improving");
    expect(byId.get("t-down")!.delta).toBe(-1.6);
    expect(byId.get("t-same")!.direction).toBe("stable");
    // Score went 80 → 90, that's improving.
    expect(r.score.direction).toBe("improving");
    expect(r.score.delta).toBe(10);
  });

  it("ignores snapshots outside the window", () => {
    const rates = [0, 1, 2, 3, 4, 5, 6];
    const snaps: ReviewSnapshot[] = rates.map((rate, i) =>
      snap(
        `2026-05-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
        70 + i,
        { templates: [tpl("t", 5, 0, rate)], items: [] },
      ),
    );
    const r = computeTrends(snaps, 3);
    expect(r.templates[0].series.map((p) => p.rate)).toEqual([4, 5, 6]);
    expect(r.templates[0].delta).toBe(2);
    expect(r.templates[0].direction).toBe("regressing");
  });

  it("sorts regressing entities first, then by largest positive delta", () => {
    const a = snap("2026-05-01T00:00:00Z", 90, {
      templates: [tpl("t-bad", 5, 0, 0.1), tpl("t-worse", 5, 0, 0.5), tpl("t-good", 5, 0, 1.0)],
      items: [],
    });
    const b = snap("2026-05-02T00:00:00Z", 90, {
      templates: [tpl("t-bad", 5, 5, 1.0), tpl("t-worse", 5, 10, 2.0), tpl("t-good", 5, 0, 0.2)],
      items: [],
    });
    const r = computeTrends([a, b]);
    expect(r.templates.map((t) => t.templateId)).toEqual(["t-worse", "t-bad", "t-good"]);
    expect(r.templates[0].direction).toBe("regressing");
    expect(r.templates[2].direction).toBe("improving");
  });

  it("sorts snapshots chronologically even if input is shuffled", () => {
    const a = snap("2026-05-03T00:00:00Z", 95, { templates: [], items: [] });
    const b = snap("2026-05-01T00:00:00Z", 80, { templates: [], items: [] });
    const c = snap("2026-05-02T00:00:00Z", 88, { templates: [], items: [] });
    const r = computeTrends([a, b, c]);
    expect(r.score.series.map((p) => p.avgScore)).toEqual([80, 88, 95]);
    expect(r.score.direction).toBe("improving");
  });

  it("includes entities that only appear in some snapshots without filling gaps", () => {
    const a = snap("2026-05-01T00:00:00Z", 90, {
      templates: [tpl("t-a", 5, 0, 0.5)],
      items: [],
    });
    const b = snap("2026-05-02T00:00:00Z", 90, {
      templates: [tpl("t-b", 5, 0, 0.3)],
      items: [],
    });
    const r = computeTrends([a, b]);
    const tA = r.templates.find((t) => t.templateId === "t-a")!;
    const tB = r.templates.find((t) => t.templateId === "t-b")!;
    expect(tA.series).toHaveLength(1);
    expect(tA.direction).toBe("new");
    expect(tB.series).toHaveLength(1);
    expect(tB.direction).toBe("new");
  });
});
