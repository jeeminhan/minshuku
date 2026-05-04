import { loadGrammar, loadVocab } from "../content";
import type { SceneTemplate, ItemAssignment } from "../types";

// Build the set of compatibility tags an active-target item carries.
// For grammar: "grammar:<pattern>" plus all scenarioTags.
// For vocab:   "vocab:<word>" plus all scenarioTags.
function tagsForItem(it: ItemAssignment): string[] {
  if (it.itemType === "grammar") {
    const all = loadGrammar();
    const found = all.find((g) => g.id === it.itemId);
    if (!found) return [];
    return [
      `grammar:${found.pattern}`,
      ...found.scenarioTags.map((t) => `tag:${t}`),
    ];
  } else {
    const all = loadVocab();
    const found = all.find((v) => v.id === it.itemId);
    if (!found) return [];
    return [
      `vocab:${found.word}`,
      ...found.scenarioTags.map((t) => `tag:${t}`),
    ];
  }
}

// A template is compatible with the active targets if EVERY active target
// has at least one tag matching the template's activeTargetCompatibility.
export function filterTemplates(
  templates: SceneTemplate[],
  activeTargets: ItemAssignment[],
): SceneTemplate[] {
  if (activeTargets.length === 0) return templates;

  return templates.filter((tpl) => {
    return activeTargets.every((target) => {
      const tags = tagsForItem(target);
      return tags.some((tag) => tpl.activeTargetCompatibility.includes(tag));
    });
  });
}
