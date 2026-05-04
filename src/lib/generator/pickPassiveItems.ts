import { loadGrammar, loadVocab } from "../content";
import type {
  ReviewItem,
  SceneTemplate,
  ItemAssignment,
} from "../types";

const DEFAULT_PASSIVE_COUNT = 3;

function tagsForReviewItem(it: ReviewItem): string[] {
  if (it.itemType === "grammar") {
    const found = loadGrammar().find((g) => g.id === it.itemId);
    return found?.scenarioTags ?? [];
  }
  const found = loadVocab().find((v) => v.id === it.itemId);
  return found?.scenarioTags ?? [];
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
  const candidates = due.filter((d) => !activeIds.has(d.itemId));

  const ranked = candidates
    .map((c) => ({
      item: c,
      overlap: overlapCount(tagsForReviewItem(c), template.passiveScenarioTags),
    }))
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, count);

  return ranked.map((r) => ({
    itemId: r.item.itemId,
    itemType: r.item.itemType,
    mode: "passive" as const,
  }));
}
