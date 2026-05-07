import { describe, it, expect } from "vitest";
import { attributeFindings } from "@/lib/log/attribution";
import type { AuditReport } from "@/lib/log/auditSceneRunLogs";
import type { QualitativeFinding } from "@/lib/log/scoreReview";
import type { SceneRunLog } from "@/lib/types";

function mkLog(overrides: Partial<SceneRunLog> & { id: string; templateId: string }): SceneRunLog {
  return {
    userId: "default",
    startedAt: "",
    endedAt: "",
    activeTargetsConsidered: [],
    activeTargetsChosen: [],
    passiveItemsChosen: [],
    templateCandidates: [],
    templateChosen: { id: overrides.templateId, finalScore: 0 },
    threadAction: "standalone",
    beatFired: null,
    llmPrompt: "",
    llmResponse: "",
    briefing: "",
    result: "",
    turns: [],
    itemOutcomes: [],
    ...overrides,
  } as SceneRunLog;
}

describe("attributeFindings", () => {
  it("counts runs even with zero findings", () => {
    const logs = [mkLog({ id: "r1", templateId: "t-cafe" })];
    const audit: AuditReport = { total: 1, pass: 1, warn: 0, fail: 0, results: [{ id: "r1", status: "pass", findings: [] }] };
    const report = attributeFindings(logs, audit, []);
    expect(report.templates).toHaveLength(1);
    expect(report.templates[0]).toMatchObject({ templateId: "t-cafe", runs: 1, totalFindings: 0, findingRate: 0 });
  });

  it("attributes item-level audit findings to the named item", () => {
    const logs = [
      mkLog({
        id: "r1",
        templateId: "t-cafe",
        activeTargetsChosen: [{ itemId: "vocab.n3.maku", itemType: "vocab", mode: "active" }],
        passiveItemsChosen: [{ itemId: "vocab.n3.cha", itemType: "vocab", mode: "passive" }],
      }),
    ];
    const audit: AuditReport = {
      total: 1, pass: 0, warn: 1, fail: 0,
      results: [{
        id: "r1",
        status: "warn",
        findings: [
          { severity: "warn", code: "active_target_in_ai_speech", message: "Active target vocab.n3.maku appeared in AI speech." },
          { severity: "warn", code: "passive_target_missing_from_ai_speech", message: "Passive target vocab.n3.cha did not appear in AI speech." },
        ],
      }],
    };
    const report = attributeFindings(logs, audit, []);
    const maku = report.items.find((i) => i.itemId === "vocab.n3.maku")!;
    const cha = report.items.find((i) => i.itemId === "vocab.n3.cha")!;
    expect(maku.totalFindings).toBe(1);
    expect(maku.bySeverity.auditWarn).toBe(1);
    expect(maku.role).toBe("active");
    expect(cha.totalFindings).toBe(1);
    expect(cha.role).toBe("passive");
    // Template should not absorb findings that resolved to items.
    expect(report.templates[0].totalFindings).toBe(0);
  });

  it("attributes template-level audit findings to the template", () => {
    const logs = [mkLog({ id: "r1", templateId: "t-cafe" })];
    const audit: AuditReport = {
      total: 1, pass: 0, warn: 0, fail: 1,
      results: [{
        id: "r1",
        status: "fail",
        findings: [
          { severity: "fail", code: "missing_scripted_turn", message: "Expected scripted turn 2 (npc) is missing.", turn: 2 },
          { severity: "warn", code: "missing_same_template_penalty", message: "Run repeated the previous template..." },
        ],
      }],
    };
    const report = attributeFindings(logs, audit, []);
    expect(report.templates[0].totalFindings).toBe(2);
    expect(report.templates[0].bySeverity).toMatchObject({ auditFail: 1, auditWarn: 1 });
  });

  it("attributes qualitative findings to the run's template and active items only", () => {
    const logs = [
      mkLog({
        id: "r1",
        templateId: "t-cafe",
        activeTargetsChosen: [{ itemId: "vocab.n3.maku", itemType: "vocab", mode: "active" }],
        passiveItemsChosen: [{ itemId: "vocab.n3.cha", itemType: "vocab", mode: "passive" }],
      }),
    ];
    const audit: AuditReport = { total: 1, pass: 1, warn: 0, fail: 0, results: [{ id: "r1", status: "pass", findings: [] }] };
    const qual: QualitativeFinding[] = [
      { run_id: "r1", category: "data", severity: "high", description: "maku doesn't fit cafe scene" },
    ];
    const report = attributeFindings(logs, audit, qual);
    expect(report.templates[0].byCategory.data).toBe(1);
    expect(report.templates[0].bySeverity.qualHigh).toBe(1);
    const maku = report.items.find((i) => i.itemId === "vocab.n3.maku")!;
    const cha = report.items.find((i) => i.itemId === "vocab.n3.cha")!;
    expect(maku.byCategory.data).toBe(1);
    expect(maku.bySeverity.qualHigh).toBe(1);
    // Passive item should NOT inherit qualitative findings.
    expect(cha.totalFindings).toBe(0);
  });

  it("ranks templates by finding rate, ties by total then name", () => {
    const logs = [
      mkLog({ id: "r1", templateId: "t-bad" }),
      mkLog({ id: "r2", templateId: "t-bad" }),
      mkLog({ id: "r3", templateId: "t-meh" }),
      mkLog({ id: "r4", templateId: "t-clean" }),
    ];
    const audit: AuditReport = {
      total: 4, pass: 1, warn: 0, fail: 3,
      results: [
        { id: "r1", status: "fail", findings: [
          { severity: "fail", code: "missing_scripted_turn", message: "" },
          { severity: "fail", code: "missing_scripted_turn", message: "" },
        ] },
        { id: "r2", status: "fail", findings: [
          { severity: "fail", code: "missing_scripted_turn", message: "" },
        ] },
        { id: "r3", status: "fail", findings: [
          { severity: "fail", code: "missing_scripted_turn", message: "" },
        ] },
        { id: "r4", status: "pass", findings: [] },
      ],
    };
    const report = attributeFindings(logs, audit, []);
    expect(report.templates.map((t) => t.templateId)).toEqual(["t-bad", "t-meh", "t-clean"]);
    expect(report.templates[0].findingRate).toBe(1.5);
    expect(report.templates[1].findingRate).toBe(1);
    expect(report.templates[2].findingRate).toBe(0);
  });

  it("ignores qualitative findings whose run_id is unknown", () => {
    const logs = [mkLog({ id: "r1", templateId: "t-cafe" })];
    const audit: AuditReport = { total: 1, pass: 1, warn: 0, fail: 0, results: [{ id: "r1", status: "pass", findings: [] }] };
    const qual: QualitativeFinding[] = [
      { run_id: "r-unknown", category: "prompt", severity: "high", description: "" },
    ];
    const report = attributeFindings(logs, audit, qual);
    expect(report.templates[0].totalFindings).toBe(0);
  });

  it("treats an item appearing in both roles as active when active count ties or wins", () => {
    const logs = [
      mkLog({
        id: "r1", templateId: "t-cafe",
        activeTargetsChosen: [{ itemId: "vocab.x", itemType: "vocab", mode: "active" }],
      }),
      mkLog({
        id: "r2", templateId: "t-cafe",
        passiveItemsChosen: [{ itemId: "vocab.x", itemType: "vocab", mode: "passive" }],
      }),
    ];
    const audit: AuditReport = {
      total: 2, pass: 2, warn: 0, fail: 0,
      results: [
        { id: "r1", status: "pass", findings: [] },
        { id: "r2", status: "pass", findings: [] },
      ],
    };
    const report = attributeFindings(logs, audit, []);
    const item = report.items.find((i) => i.itemId === "vocab.x")!;
    expect(item.role).toBe("active");
    expect(item.runs).toBe(2);
  });
});
