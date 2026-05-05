import { describe, expect, it } from "vitest";
import { auditSceneRunLogs } from "@/lib/log/auditSceneRunLogs";
import type { SceneRunLog } from "@/lib/types";

function baseLog(overrides: Partial<SceneRunLog> = {}): SceneRunLog {
  return {
    id: "run-audit",
    userId: "default",
    templateId: "minshuku-evening-with-kid",
    startedAt: "2026-05-04T12:00:00.000Z",
    endedAt: "2026-05-04T12:01:00.000Z",
    activeTargetsConsidered: [
      { itemId: "vocab.mado", itemType: "vocab", mode: "active" },
    ],
    activeTargetsChosen: [
      { itemId: "vocab.mado", itemType: "vocab", mode: "active" },
    ],
    passiveItemsChosen: [
      { itemId: "vocab.ame", itemType: "vocab", mode: "passive" },
    ],
    templateCandidates: [
      { templateId: "minshuku-evening-with-kid", finalScore: 10, reasons: ["base score 10"] },
    ],
    templateChosen: { id: "minshuku-evening-with-kid", finalScore: 10 },
    threadAction: "standalone",
    beatFired: null,
    llmPrompt: "prompt",
    llmResponse: "response",
    briefing: "Briefing text.",
    result: "Result text.",
    turns: [
      { turn: 2, speaker: "kid", text: "明日、雨だって。" },
      {
        turn: 3,
        speaker: "player",
        text: "窓を見ます。",
        evaluatorResults: [
          {
            itemId: "vocab.mado",
            mode: "active",
            outcome: "produced",
            evidence: { targetPresent: true },
          },
        ],
      },
      { turn: 4, speaker: "kid", text: "雨がやんだらいいね。" },
      {
        turn: 5,
        speaker: "player",
        text: "窓を開けてもいい？",
        evaluatorResults: [
          {
            itemId: "vocab.mado",
            mode: "active",
            outcome: "produced",
            evidence: { targetPresent: true },
          },
        ],
      },
      { turn: 6, speaker: "kid", text: "うん、いいよ。" },
      {
        turn: 7,
        speaker: "player",
        text: "窓の外を見るね。",
        evaluatorResults: [
          {
            itemId: "vocab.mado",
            mode: "active",
            outcome: "produced",
            evidence: { targetPresent: true },
          },
        ],
      },
    ],
    itemOutcomes: [
      {
        itemId: "vocab.mado",
        mode: "active",
        outcome: "produced",
        evidence: { targetPresent: true },
      },
    ],
    ...overrides,
  };
}

describe("auditSceneRunLogs", () => {
  it("passes a complete log with target usage in the expected places", () => {
    const report = auditSceneRunLogs([baseLog()]);

    expect(report.pass).toBe(1);
    expect(report.results[0].findings).toEqual([]);
  });

  it("warns when active targets appear in AI speech and passive targets do not", () => {
    const report = auditSceneRunLogs([
      baseLog({
        activeTargetsChosen: [
          { itemId: "grammar.tsumori", itemType: "grammar", mode: "active" },
        ],
        passiveItemsChosen: [
          { itemId: "vocab.ame", itemType: "vocab", mode: "passive" },
        ],
        turns: [
          { turn: 2, speaker: "kid", text: "明日、何をするつもり？" },
          {
            turn: 3,
            speaker: "player",
            text: "行くつもりです。",
            evaluatorResults: [
              {
                itemId: "grammar.tsumori",
                mode: "active",
                outcome: "produced",
                evidence: { targetPresent: true },
              },
            ],
          },
          { turn: 4, speaker: "kid", text: "それはいいね。" },
          {
            turn: 5,
            speaker: "player",
            text: "行くつもりです。",
            evaluatorResults: [
              {
                itemId: "grammar.tsumori",
                mode: "active",
                outcome: "produced",
                evidence: { targetPresent: true },
              },
            ],
          },
          { turn: 6, speaker: "kid", text: "楽しみだね。" },
          {
            turn: 7,
            speaker: "player",
            text: "行くつもりです。",
            evaluatorResults: [
              {
                itemId: "grammar.tsumori",
                mode: "active",
                outcome: "produced",
                evidence: { targetPresent: true },
              },
            ],
          },
        ],
      }),
    ]);

    expect(report.warn).toBe(1);
    expect(report.results[0].findings.map((f) => f.code)).toContain("active_target_in_ai_speech");
    expect(report.results[0].findings.map((f) => f.code)).toContain("passive_target_missing_from_ai_speech");
  });

  it("fails when a player turn is missing evaluator coverage", () => {
    const report = auditSceneRunLogs([
      baseLog({
        turns: [
          { turn: 2, speaker: "kid", text: "明日、雨だって。" },
          { turn: 3, speaker: "player", text: "窓を見ます。", evaluatorResults: [] },
          { turn: 4, speaker: "kid", text: "雨がやんだらいいね。" },
          { turn: 5, speaker: "player", text: "窓を見ます。", evaluatorResults: [] },
          { turn: 6, speaker: "kid", text: "うん、いいよ。" },
          { turn: 7, speaker: "player", text: "窓を見ます。", evaluatorResults: [] },
        ],
      }),
    ]);

    expect(report.fail).toBe(1);
    expect(report.results[0].findings.map((f) => f.code)).toContain("missing_evaluator_results");
  });

  it("warns but does not crash on legacy logs without passiveItemsChosen", () => {
    const legacy = baseLog() as unknown as Record<string, unknown>;
    delete legacy.passiveItemsChosen;

    const report = auditSceneRunLogs([legacy]);

    expect(report.warn).toBe(1);
    expect(report.results[0].findings.map((f) => f.code)).toContain("missing_passive_targets");
  });

  it("warns when repeated template/location runs have no variety penalty rationale", () => {
    const report = auditSceneRunLogs([
      baseLog({ id: "run-1" }),
      baseLog({ id: "run-2" }),
    ]);

    expect(report.results[1].findings.map((f) => f.code)).toContain("missing_same_template_penalty");
    expect(report.results[1].findings.map((f) => f.code)).toContain("missing_same_location_penalty");
  });
});
