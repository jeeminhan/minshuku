import { loadTemplates } from "../content";
import { pickActiveTargets } from "../srs/pickActiveTargets";
import { pickDueItems } from "../srs/pickDueItems";
import { filterTemplates } from "./filterTemplates";
import { scoreTemplates, pickBestTemplate } from "./scoreTemplates";
import { pickPassiveItems } from "./pickPassiveItems";
import type {
  ReviewItem,
  ScenePlan,
  TemplateScoringRationale,
  ItemAssignment,
} from "../types";

interface RecentContext {
  lastTemplateId: string | null;
  lastLocation: string | null;
}

export interface ScenePlanResult {
  plan: ScenePlan;
  candidatesScored: TemplateScoringRationale[];
  activeConsidered: ItemAssignment[];
}

export function buildScenePlan(
  reviewItems: ReviewItem[],
  now: Date,
  ctx: RecentContext,
): ScenePlanResult | null {
  const due = pickDueItems(reviewItems, now);
  if (due.length === 0) return null;

  const active = pickActiveTargets(due);
  if (active.length === 0) return null;

  const allTemplates = loadTemplates();
  const compatible = filterTemplates(allTemplates, active);
  if (compatible.length === 0) return null;

  const scored = scoreTemplates(compatible, ctx);
  const best = pickBestTemplate(scored);
  if (!best) return null;

  const template = compatible.find((t) => t.id === best.templateId)!;
  const passive = pickPassiveItems(due, template, active);

  // For v0, microStake is just the skeleton. (LLM dialogue gen will further instantiate it.)
  const microStake = template.microStakeSkeleton;

  const plan: ScenePlan = {
    templateId: template.id,
    location: template.location,
    characters: template.characters,
    microStake,
    activeTargets: active,
    passiveItems: passive,
    registerTag: template.registerTag,
    scriptedTurns: template.scriptedTurns,
  };

  return {
    plan,
    candidatesScored: scored,
    activeConsidered: active,
  };
}
