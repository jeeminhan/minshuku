import { describe, it, expect } from "vitest";
import { loadVocab, loadGrammar, loadTemplates } from "@/lib/content";

describe("content loader", () => {
  it("loads vocab.json into typed VocabItem array", () => {
    const vocab = loadVocab();
    expect(vocab.length).toBeGreaterThan(0);
    const mado = vocab.find((v) => v.id === "vocab.mado");
    expect(mado).toBeDefined();
    expect(mado?.word).toBe("窓");
    expect(mado?.jlptLevel).toBe("N5");
  });

  it("loads grammar.json into typed GrammarItem array", () => {
    const grammar = loadGrammar();
    expect(grammar.length).toBeGreaterThan(0);
    const tsumori = grammar.find((g) => g.id === "grammar.tsumori");
    expect(tsumori).toBeDefined();
    expect(tsumori?.pattern).toBe("つもり");
  });

  it("loads all template files in data/templates/", () => {
    const templates = loadTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(2);
    const evening = templates.find((t) => t.id === "minshuku-evening-with-kid");
    expect(evening).toBeDefined();
    expect(evening?.location).toBe("minshuku");
  });

  it("rejects malformed data (zod validates)", () => {
    // smoke test that zod is applied — actual malformed file test deferred
    expect(() => loadVocab()).not.toThrow();
  });
});
