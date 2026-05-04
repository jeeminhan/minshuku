import { describe, it, expect } from "vitest";
import { checkTargetPresence } from "@/lib/evaluator/ruleCheck";
import type { ItemAssignment } from "@/lib/types";

describe("checkTargetPresence", () => {
  it("returns true when grammar pattern surface appears in player text", async () => {
    const target: ItemAssignment = {
      itemId: "grammar.tsumori",
      itemType: "grammar",
      mode: "active",
    };
    const ok = await checkTargetPresence("明日、教会に行くつもりです。", target);
    expect(ok).toBe(true);
  });

  it("returns false when grammar pattern is absent", async () => {
    const target: ItemAssignment = {
      itemId: "grammar.tsumori",
      itemType: "grammar",
      mode: "active",
    };
    const ok = await checkTargetPresence("明日、教会に行きます。", target);
    expect(ok).toBe(false);
  });

  it("returns true when vocab word appears", async () => {
    const target: ItemAssignment = {
      itemId: "vocab.mado",
      itemType: "vocab",
      mode: "active",
    };
    const ok = await checkTargetPresence("窓の外を見て。", target);
    expect(ok).toBe(true);
  });
});
