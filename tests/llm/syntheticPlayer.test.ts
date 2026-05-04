import { describe, it, expect } from "vitest";
import { syntheticPlayerTurn } from "@/lib/llm/syntheticPlayer";
import { MockLLMClient } from "@/lib/llm/client";
import type { DialogueLine, ScenePlan } from "@/lib/types";

const plan: ScenePlan = {
  templateId: "minshuku-evening-with-kid",
  location: "minshuku",
  characters: [{ id: "kid", role: "host_family_kid" }],
  microStake: "Evening at the minshuku; the kid asks about plans.",
  activeTargets: [{ itemId: "grammar.tsumori", itemType: "grammar", mode: "active" }],
  passiveItems: [],
  registerTag: "casual",
  scriptedTurns: [],
};

const conversation: DialogueLine[] = [
  { turn: 2, speaker: "kid", text: "明日、何をするつもり？", language: "ja" },
];

describe("syntheticPlayerTurn", () => {
  it("returns a player utterance using the active target", async () => {
    const mock = new MockLLMClient(() => "明日は教会に行くつもりです。");
    const out = await syntheticPlayerTurn({
      plan,
      conversationSoFar: conversation,
      turnNumber: 3,
      persona: "intermediate-n3-foreign-student",
      client: mock,
    });
    expect(out.text).toContain("つもり");
    expect(out.language).toBe("ja");
    expect(out.turn).toBe(3);
    expect(out.speaker).toBe("player");
  });

  it("includes the persona description in the prompt", async () => {
    let capturedUser = "";
    const mock = new MockLLMClient(({ user }) => {
      capturedUser = user;
      return "OK.";
    });
    await syntheticPlayerTurn({
      plan,
      conversationSoFar: conversation,
      turnNumber: 3,
      persona: "intermediate-n3-foreign-student",
      client: mock,
    });
    expect(capturedUser).toContain("intermediate-n3-foreign-student");
  });
});
