import { describe, it, expect } from "vitest";
import {
  tokenize,
  containsPattern,
  normalizePattern,
  patternAlternatives,
} from "@/lib/evaluator/conjugation";

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

describe("normalizePattern", () => {
  it("strips leading wave-dash markers", () => {
    expect(normalizePattern("～間")).toBe("間");
    expect(normalizePattern("~間")).toBe("間");
  });

  it("strips parenthetical optional suffixes (full-width and half-width)", () => {
    expect(normalizePattern("～あげく(に)")).toBe("あげく");
    expect(normalizePattern("～あげく（に）")).toBe("あげく");
  });

  it("leaves bare patterns unchanged", () => {
    expect(normalizePattern("つもり")).toBe("つもり");
    expect(normalizePattern("が早いか")).toBe("が早いか");
  });
});

describe("patternAlternatives", () => {
  it("returns a single-element array for a non-slash pattern", () => {
    expect(patternAlternatives("～間")).toEqual(["間"]);
    expect(patternAlternatives("つもり")).toEqual(["つもり"]);
  });

  it("splits slash alternatives into separate entries", () => {
    expect(patternAlternatives("～やすい/にくい")).toEqual(["やすい", "にくい"]);
    expect(patternAlternatives("～かねる/かねない")).toEqual(["かねる", "かねない"]);
  });

  it("strips leading wave-dashes from each alternative", () => {
    expect(patternAlternatives("～甲斐があって/～甲斐がある")).toEqual([
      "甲斐があって",
      "甲斐がある",
    ]);
  });
});

describe("containsPattern with slash-alternative patterns", () => {
  it("matches the first alternative", async () => {
    expect(await containsPattern("この本は読みやすいです。", "～やすい/にくい")).toBe(true);
  });

  it("matches the second alternative", async () => {
    expect(await containsPattern("この字は読みにくいです。", "～やすい/にくい")).toBe(true);
  });

  it("returns false when neither alternative appears", async () => {
    expect(await containsPattern("普通の文です。", "～やすい/にくい")).toBe(false);
  });
});
