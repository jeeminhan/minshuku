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

function assignmentForItem(item: ReviewItem): ItemAssignment {
  return {
    itemId: item.itemId,
    itemType: item.itemType,
    mode: "active",
  };
}

function pushUniqueAttempt(
  attempts: ItemAssignment[][],
  seen: Set<string>,
  attempt: ItemAssignment[],
): void {
  const key = attempt.map((a) => `${a.itemType}:${a.itemId}`).join("|");
  if (seen.has(key)) return;
  seen.add(key);
  attempts.push(attempt);
}

function activeTargetAttempts(due: ReviewItem[]): ItemAssignment[][] {
  const attempts: ItemAssignment[][] = [];
  const seen = new Set<string>();

  const firstChoice = pickActiveTargets(due);
  if (firstChoice.length > 0) {
    pushUniqueAttempt(attempts, seen, firstChoice);
  }

  for (const item of due) {
    pushUniqueAttempt(attempts, seen, [assignmentForItem(item)]);
  }

  return attempts;
}

export function buildScenePlan(
  reviewItems: ReviewItem[],
  now: Date,
  ctx: RecentContext,
): ScenePlanResult | null {
  const due = pickDueItems(reviewItems, now);
  if (due.length === 0) return null;

  const allTemplates = loadTemplates();
  const considered: ItemAssignment[] = [];
  let active: ItemAssignment[] | null = null;
  let compatible: ReturnType<typeof filterTemplates> = [];

  for (const attempt of activeTargetAttempts(due)) {
    considered.push(...attempt);
    const matches = filterTemplates(allTemplates, attempt);
    if (matches.length > 0) {
      active = attempt;
      compatible = matches;
      break;
    }
  }

  if (!active || compatible.length === 0) return null;

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
    activeConsidered: considered,
  };
}
