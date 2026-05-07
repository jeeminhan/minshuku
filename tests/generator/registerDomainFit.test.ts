import { describe, it, expect } from "vitest";
import {
  acceptedRegisters,
  domainFits,
  fitsTemplate,
  registerFits,
} from "@/lib/generator/registerDomainFit";
import type { SceneTemplate, VocabItem } from "@/lib/types";

function tpl(overrides: Partial<SceneTemplate> = {}): SceneTemplate {
  return {
    id: "t",
    location: "test",
    characters: [],
    scriptedTurns: [],
    microStakeSkeleton: "",
    registerTag: "polite",
    activeTargetCompatibility: [],
    passiveScenarioTags: [],
    allowedNudges: [],
    exitBeat: "",
    ...overrides,
  };
}

function vocab(overrides: Partial<VocabItem> = {}): VocabItem {
  return {
    id: "v",
    word: "x",
    reading: "x",
    meaning: "",
    partOfSpeech: "noun",
    jlptLevel: "N3",
    scenarioTags: [],
    exampleSentences: [],
    ...overrides,
  };
}

describe("registerDomainFit", () => {
  it("acceptedRegisters defaults from registerTag when not declared", () => {
    expect(acceptedRegisters(tpl({ registerTag: "casual" }))).toEqual(["casual", "neutral"]);
    expect(acceptedRegisters(tpl({ registerTag: "keigo" }))).toEqual(["polite", "formal"]);
  });

  it("acceptedRegisters honors explicit override", () => {
    expect(
      acceptedRegisters(tpl({ registerTag: "casual", acceptedRegisters: ["formal"] })),
    ).toEqual(["formal"]);
  });

  it("registerFits returns true when item has no register (graceful degradation)", () => {
    expect(registerFits(vocab(), tpl({ registerTag: "casual" }))).toBe(true);
  });

  it("registerFits passes when item.register is in template's accepted set", () => {
    expect(registerFits(vocab({ register: "polite" }), tpl({ registerTag: "polite" }))).toBe(true);
  });

  it("registerFits fails when item.register is outside template's accepted set", () => {
    expect(registerFits(vocab({ register: "casual" }), tpl({ registerTag: "keigo" }))).toBe(false);
  });

  it("domainFits returns true when item has no domain (graceful degradation)", () => {
    expect(domainFits(vocab(), tpl({ acceptedDomains: ["physical"] }))).toBe(true);
  });

  it("domainFits returns true when template has no acceptedDomains (graceful degradation)", () => {
    expect(domainFits(vocab({ domain: ["physical"] }), tpl())).toBe(true);
  });

  it("domainFits passes when item shares at least one domain", () => {
    expect(
      domainFits(vocab({ domain: ["physical", "social"] }), tpl({ acceptedDomains: ["social", "ritual"] })),
    ).toBe(true);
  });

  it("domainFits fails when item and template share no domain", () => {
    expect(
      domainFits(vocab({ domain: ["physical"] }), tpl({ acceptedDomains: ["ritual"] })),
    ).toBe(false);
  });

  it("fitsTemplate combines register + domain (both must pass)", () => {
    const t = tpl({ registerTag: "polite", acceptedDomains: ["social"] });
    expect(fitsTemplate(vocab({ register: "polite", domain: ["social"] }), t)).toBe(true);
    expect(fitsTemplate(vocab({ register: "casual", domain: ["social"] }), t)).toBe(false);
    expect(fitsTemplate(vocab({ register: "polite", domain: ["physical"] }), t)).toBe(false);
  });
});
