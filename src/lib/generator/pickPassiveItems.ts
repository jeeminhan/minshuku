import { loadGrammar, loadVocab } from "../content";
import { fitsTemplate, type ItemWithFit } from "./registerDomainFit";
import type {
  ReviewItem,
  SceneTemplate,
  ItemAssignment,
} from "../types";

const DEFAULT_PASSIVE_COUNT = 3;

function lookupItem(it: ReviewItem): ItemWithFit | null {
  if (it.itemType === "grammar") {
    return loadGrammar().find((g) => g.id === it.itemId) ?? null;
  }
  return loadVocab().find((v) => v.id === it.itemId) ?? null;
}

function overlapCount(a: string[], b: string[]): number {
  const setB = new Set(b);
  return a.filter((x) => setB.has(x)).length;
}

export function pickPassiveItems(
  due: ReviewItem[],
  template: SceneTemplate,
  active: ItemAssignment[],
  count: number = DEFAULT_PASSIVE_COUNT,
): ItemAssignment[] {
  const activeIds = new Set(active.map((a) => a.itemId));
  const candidates = due
    .filter((d) => !activeIds.has(d.itemId))
    .map((d) => ({ item: d, full: lookupItem(d) }))
    // Drop candidates whose register/domain don't fit. Items missing from
    // the content registry pass through (treated as untagged → graceful);
    // tagged items must satisfy register + domain.
    .filter((c) => c.full === null || fitsTemplate(c.full, template));

  const ranked = candidates
    .map((c) => ({
      item: c.item,
      overlap: overlapCount(c.full?.scenarioTags ?? [], template.passiveScenarioTags),
    }))
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, count);

  return ranked.map((r) => ({
    itemId: r.item.itemId,
    itemType: r.item.itemType,
    mode: "passive" as const,
  }));
}
