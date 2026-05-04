import { describe, it, expect } from "vitest";
import { tokenize, containsPattern } from "@/lib/evaluator/conjugation";

describe("conjugation analyzer (kuromoji)", () => {
  it("tokenizes a simple Japanese sentence", async () => {
    const tokens = await tokenize("明日は教会に行くつもりです。");
    expect(tokens.length).toBeGreaterThan(0);
    const words = tokens.map((t) => t.surface_form);
    expect(words).toContain("つもり");
  });

  it("containsPattern returns true when pattern surface appears", async () => {
    expect(await containsPattern("明日、教会に行くつもりです。", "つもり")).toBe(true);
  });

  it("containsPattern returns false when pattern is absent", async () => {
    expect(await containsPattern("明日、教会に行きます。", "つもり")).toBe(false);
  });

  it("does not match when pattern is in romaji or English", async () => {
    expect(await containsPattern("I plan to go.", "つもり")).toBe(false);
  });
});
