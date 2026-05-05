import { describe, it, expect, beforeEach } from "vitest";
import { rmSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { runScene } from "@/lib/runScene";
import { MockLLMClient } from "@/lib/llm/client";
import type { ReviewItem } from "@/lib/types";

const TEST_LOG_DIR = join(process.cwd(), "logs", "test-runScene");

const due: ReviewItem[] = [
  {
    itemId: "grammar.tsumori",
    itemType: "grammar",
    lastReviewedAt: null,
    nextReviewAt: null,
    ease: 2.5,
    interval: 0,
    lapses: 0,
  },
  {
    itemId: "vocab.ame",
    itemType: "vocab",
    lastReviewedAt: null,
    nextReviewAt: null,
    ease: 2.5,
    interval: 0,
    lapses: 0,
  },
  {
    itemId: "vocab.fushigi",
    itemType: "vocab",
    lastReviewedAt: null,
    nextReviewAt: null,
    ease: 2.5,
    interval: 0,
    lapses: 0,
  },
];

const FAKE_DIALOGUE_RESPONSE = JSON.stringify({
  briefing: "Evening at the minshuku — Hiro asks about your plans tomorrow.",
  turns: [
    { turn: 2, speaker: "host_family_kid", text: "明日、何をするつもり？", language: "ja" },
    { turn: 4, speaker: "kid", text: "明日、雨だって。", language: "ja" },
    { turn: 6, speaker: "kid", text: "ちょっと不思議な天気だね。", language: "ja" },
  ],
  result: "Nice scene.",
});

describe("runScene end-to-end (mocked LLM)", () => {
  beforeEach(() => {
    if (existsSync(TEST_LOG_DIR)) rmSync(TEST_LOG_DIR, { recursive: true });
    mkdirSync(TEST_LOG_DIR, { recursive: true });
  });

  it("produces a complete SceneRunLog with template, items, dialogue, and outcomes", async () => {
    const calls: Array<"dialogue" | "player"> = [];
    const mock = new MockLLMClient(({ system }) => {
      // Crude routing: dialogue prompt mentions "dialogue writer", player prompt mentions "role-playing".
      if (system.includes("dialogue writer")) {
        calls.push("dialogue");
        return FAKE_DIALOGUE_RESPONSE;
      }
      calls.push("player");
      return "明日は教会に行くつもりです。";
    });

    const log = await runScene({
      reviewItems: due,
      now: new Date("2026-05-04T12:00:00.000Z"),
      recentContext: { lastTemplateId: null, lastLocation: null },
      llmClient: mock,
      logDir: TEST_LOG_DIR,
      persona: "intermediate-n3-foreign-student",
    });

    expect(log).not.toBeNull();
    expect(log!.templateChosen.id).toBe("minshuku-evening-with-kid");
    expect(log!.activeTargetsChosen.length).toBeGreaterThan(0);
    expect(log!.passiveItemsChosen.length).toBeGreaterThan(0);
    expect(log!.turns.length).toBeGreaterThan(0);
    expect(log!.briefing).toMatch(/minshuku|Hiro/i);
    expect(log!.result).toBeTypeOf("string");
    expect(log!.itemOutcomes.length).toBe(log!.activeTargetsChosen.length);
    // Aggregate produces ONE outcome per active target — not duplicated per player turn.
    const tsumoriOutcomes = log!.itemOutcomes.filter((o) => o.itemId === "grammar.tsumori");
    expect(tsumoriOutcomes.length).toBe(1);
    expect(tsumoriOutcomes[0].outcome).toBe("produced");
    // Per-turn results still attached to player turns.
    const playerTurns = log!.turns.filter((t) => t.speaker === "player");
    expect(
      playerTurns.every((t) => t.evaluatorResults && t.evaluatorResults.length > 0)
    ).toBe(true);
    expect(log!.turns.find((t) => t.turn === 2)?.speaker).toBe("kid");
    expect(calls).toContain("dialogue");
    expect(calls).toContain("player");
  });

  it("returns null when there are no due items", async () => {
    const mock = new MockLLMClient(() => "");
    const log = await runScene({
      reviewItems: [],
      now: new Date("2026-05-04T12:00:00.000Z"),
      recentContext: { lastTemplateId: null, lastLocation: null },
      llmClient: mock,
      logDir: TEST_LOG_DIR,
      persona: "intermediate-n3-foreign-student",
    });
    expect(log).toBeNull();
  });
});
