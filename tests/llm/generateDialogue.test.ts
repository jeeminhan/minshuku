import { describe, it, expect } from "vitest";
import { generateDialogue } from "@/lib/llm/generateDialogue";
import { MockLLMClient } from "@/lib/llm/client";
import type { ScenePlan } from "@/lib/types";

const samplePlan: ScenePlan = {
  templateId: "minshuku-evening-with-kid",
  location: "minshuku",
  characters: [{ id: "kid", role: "host_family_kid" }],
  microStake: "Evening; the kid is curious about your plans.",
  activeTargets: [{ itemId: "grammar.tsumori", itemType: "grammar", mode: "active" }],
  passiveItems: [
    { itemId: "vocab.ame", itemType: "vocab", mode: "passive" },
    { itemId: "vocab.fushigi", itemType: "vocab", mode: "passive" },
  ],
  registerTag: "casual",
  scriptedTurns: [
    { turn: 1, speaker: "coach" },
    { turn: 2, speaker: "kid" },
    { turn: 3, speaker: "player" },
    { turn: 4, speaker: "kid" },
    { turn: 5, speaker: "player" },
    { turn: 6, speaker: "kid" },
    { turn: 7, speaker: "player" },
    { turn: 8, speaker: "coach" },
  ],
};

const FAKE_RESPONSE = JSON.stringify({
  briefing: "You're at the minshuku, evening. Hiro is curious about your plans tomorrow.",
  turns: [
    { turn: 2, speaker: "kid", text: "明日、何をするつもり？", language: "ja" },
    { turn: 4, speaker: "kid", text: "明日、雨だって。", language: "ja" },
    { turn: 6, speaker: "kid", text: "ちょっと不思議な天気だね。", language: "ja" },
  ],
  result: "Nice scene. つもり came through.",
});

describe("generateDialogue", () => {
  it("calls the LLM and returns parsed dialogue lines", async () => {
    const mock = new MockLLMClient(() => FAKE_RESPONSE);
    const out = await generateDialogue(samplePlan, mock);
    expect(out.briefing).toContain("minshuku");
    expect(out.turns.length).toBeGreaterThan(0);
    expect(out.turns[0].language).toBe("ja");
    expect(out.rawPrompt).toContain("つもり");
    expect(out.rawResponse).toBe(FAKE_RESPONSE);
  });

  it("throws when the LLM response is not valid JSON", async () => {
    const mock = new MockLLMClient(() => "not-json-at-all");
    await expect(generateDialogue(samplePlan, mock)).rejects.toThrow();
  });

  it("strips markdown fences from the LLM response before parsing", async () => {
    const fenced = "```json\n" + FAKE_RESPONSE + "\n```";
    const mock = new MockLLMClient(() => fenced);
    const out = await generateDialogue(samplePlan, mock);
    expect(out.briefing).toContain("minshuku");
    expect(out.turns.length).toBeGreaterThan(0);
  });

  it("requests structured JSON output from the LLM client", async () => {
    let capturedResponseMimeType: string | undefined;
    let capturedResponseSchema: unknown;
    const mock = new MockLLMClient((args) => {
      capturedResponseMimeType = args.responseMimeType;
      capturedResponseSchema = args.responseSchema;
      return FAKE_RESPONSE;
    });

    await generateDialogue(samplePlan, mock);

    expect(capturedResponseMimeType).toBe("application/json");
    expect(capturedResponseSchema).toBeDefined();
  });
});
