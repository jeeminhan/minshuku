import { describe, expect, it } from "vitest";
import { renderSceneRunLog } from "@/lib/log/renderSceneRunLog";
import type { SceneRunLog } from "@/lib/types";

const sample: SceneRunLog = {
  id: "run-render",
  userId: "default",
  templateId: "minshuku-evening-with-kid",
  startedAt: "2026-05-04T12:00:00.000Z",
  endedAt: "2026-05-04T12:01:00.000Z",
  activeTargetsConsidered: [],
  activeTargetsChosen: [{ itemId: "grammar.tsumori", itemType: "grammar", mode: "active" }],
  passiveItemsChosen: [{ itemId: "vocab.ame", itemType: "vocab", mode: "passive" }],
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
      text: "行くつもりです。",
      evaluatorResults: [
        {
          itemId: "grammar.tsumori",
          mode: "active",
          outcome: "produced",
          evidence: { notes: "rule check: pattern surface found" },
        },
      ],
    },
  ],
  itemOutcomes: [
    {
      itemId: "grammar.tsumori",
      mode: "active",
      outcome: "produced",
      evidence: { targetPresent: true },
    },
  ],
};

describe("renderSceneRunLog", () => {
  it("renders item assignments, dialogue, and evaluator outcomes", () => {
    const rendered = renderSceneRunLog(sample);

    expect(rendered).toContain("Scene Run: run-render");
    expect(rendered).toContain("[active]  grammar.tsumori");
    expect(rendered).toContain("[passive] vocab.ame");
    expect(rendered).toContain("eval: grammar.tsumori -> produced");
  });
});
