import { loadGrammar, loadVocab } from "../content";
import { fitsTemplate, type ItemWithFit } from "./registerDomainFit";
import type { SceneTemplate, ItemAssignment } from "../types";

interface ResolvedTarget {
  full: ItemWithFit | null;
  tags: string[];
}

function resolveTarget(it: ItemAssignment): ResolvedTarget {
  if (it.itemType === "grammar") {
    const found = loadGrammar().find((g) => g.id === it.itemId);
    if (!found) return { full: null, tags: [] };
    return {
      full: found,
      tags: [`grammar:${found.pattern}`, ...found.scenarioTags.map((t) => `tag:${t}`)],
    };
  }
  const found = loadVocab().find((v) => v.id === it.itemId);
  if (!found) return { full: null, tags: [] };
  return {
    full: found,
    tags: [`vocab:${found.word}`, ...found.scenarioTags.map((t) => `tag:${t}`)],
  };
}

// A template is compatible with the active targets when, for every target:
//   1. the target's tags overlap the template's activeTargetCompatibility, AND
//   2. the target's register + domain fit the template (graceful degrade
//      when the item or template hasn't been tagged yet).
export function filterTemplates(
  templates: SceneTemplate[],
  activeTargets: ItemAssignment[],
): SceneTemplate[] {
  if (activeTargets.length === 0) return templates;
  const resolved = activeTargets.map(resolveTarget);
  return templates.filter((tpl) => {
    return resolved.every((r) => {
      const tagOk = r.tags.some((tag) => tpl.activeTargetCompatibility.includes(tag));
      if (!tagOk) return false;
      if (r.full === null) return true; // unknown id — preserve existing behavior
      return fitsTemplate(r.full, tpl);
    });
  });
}
