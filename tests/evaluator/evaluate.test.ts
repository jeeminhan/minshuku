import { describe, it, expect } from "vitest";
import { evaluatePlayerTurn } from "@/lib/evaluator/evaluate";
import type { ItemAssignment } from "@/lib/types";

const active: ItemAssignment = {
  itemId: "grammar.tsumori",
  itemType: "grammar",
  mode: "active",
};

describe("evaluatePlayerTurn", () => {
  it("returns 'produced' when active target is present", async () => {
    const results = await evaluatePlayerTurn(
      "明日、教会に行くつもりです。",
      [active],
    );
    expect(results.length).toBe(1);
    expect(results[0].outcome).toBe("produced");
    expect(results[0].evidence.targetPresent).toBe(true);
  });

  it("returns 'missed' when active target is absent", async () => {
    const results = await evaluatePlayerTurn(
      "明日、教会に行きます。",
      [active],
    );
    expect(results[0].outcome).toBe("missed");
    expect(results[0].evidence.targetPresent).toBe(false);
  });

  it("returns one EvaluatorResult per active target", async () => {
    const second: ItemAssignment = {
      itemId: "vocab.mado",
      itemType: "vocab",
      mode: "active",
    };
    const results = await evaluatePlayerTurn(
      "窓のそばで考えるつもりです。",
      [active, second],
    );
    expect(results.length).toBe(2);
    expect(results.every((r) => r.outcome === "produced")).toBe(true);
  });

  it("returns 'produced_with_help' when target also appeared in priorContext", async () => {
    // Mirrors the LLM-flagged case: AI used つもり in its setup turn, then the
    // player echoed it. The surface is present, but the player was scaffolded.
    const results = await evaluatePlayerTurn(
      "明日、教会に行くつもりです。",
      [active],
      { priorContext: "Setup: ask about plans. AI turn: 何をするつもりですか？" },
    );
    expect(results[0].outcome).toBe("produced_with_help");
    expect(results[0].evidence.targetPresent).toBe(true);
  });

  it("returns 'produced' when priorContext does not contain the target", async () => {
    const results = await evaluatePlayerTurn(
      "明日、教会に行くつもりです。",
      [active],
      { priorContext: "AI turn: 明日は何の予定ですか？" },
    );
    expect(results[0].outcome).toBe("produced");
  });

  it("returns 'missed' regardless of priorContext when target is absent in player text", async () => {
    const results = await evaluatePlayerTurn(
      "明日、教会に行きます。",
      [active],
      { priorContext: "AI turn: 何をするつもりですか？" },
    );
    expect(results[0].outcome).toBe("missed");
  });
});
