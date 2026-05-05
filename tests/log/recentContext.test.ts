import { describe, expect, it } from "vitest";
import { recentContextFromLogs } from "@/lib/log/recentContext";
import type { SceneRunLog, SceneTemplate } from "@/lib/types";

const template: SceneTemplate = {
  id: "minshuku-evening-with-kid",
  location: "minshuku",
  characters: [{ id: "kid", role: "host_family_kid" }],
  scriptedTurns: [],
  microStakeSkeleton: "Evening at the minshuku.",
  registerTag: "casual",
  activeTargetCompatibility: [],
  passiveScenarioTags: [],
  allowedNudges: [],
  exitBeat: "Good night.",
};

const log: SceneRunLog = {
  id: "run-ctx",
  userId: "default",
  templateId: "minshuku-evening-with-kid",
  startedAt: "2026-05-04T12:00:00.000Z",
  endedAt: "2026-05-04T12:01:00.000Z",
  activeTargetsConsidered: [],
  activeTargetsChosen: [],
  passiveItemsChosen: [],
  templateCandidates: [],
  templateChosen: { id: "minshuku-evening-with-kid", finalScore: 10 },
  threadAction: "standalone",
  beatFired: null,
  llmPrompt: "prompt",
  llmResponse: "response",
  briefing: "briefing",
  result: "result",
  turns: [],
  itemOutcomes: [],
};

describe("recentContextFromLogs", () => {
  it("returns null context when there are no prior logs", () => {
    expect(recentContextFromLogs([], [template])).toEqual({
      lastTemplateId: null,
      lastLocation: null,
    });
  });

  it("derives last template and location from the latest log", () => {
    expect(recentContextFromLogs([log], [template])).toEqual({
      lastTemplateId: "minshuku-evening-with-kid",
      lastLocation: "minshuku",
    });
  });
});
