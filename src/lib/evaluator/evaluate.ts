import { checkTargetPresence } from "./ruleCheck";
import type { ItemAssignment, EvaluatorResult } from "../types";

export interface EvaluateOptions {
  // AI text (briefing + AI turns) shown to the player before this turn.
  // When provided, targets that appear in both player text AND priorContext
  // are scored as `produced_with_help` rather than `produced` — the AI
  // scaffolded the answer rather than letting the learner produce it
  // unprompted.
  priorContext?: string;
}

// v1: distinguishes unprompted production from echoed/scaffolded production.
//   - target absent in player                          → "missed"
//   - target present in player, also in priorContext   → "produced_with_help"
//   - target present in player, NOT in priorContext    → "produced"
// "mastered" / "recognized" are aggregate-level signals; this function
// returns per-turn results only.
export async function evaluatePlayerTurn(
  playerText: string,
  activeTargets: ItemAssignment[],
  options: EvaluateOptions = {},
): Promise<EvaluatorResult[]> {
  const results: EvaluatorResult[] = [];
  const priorContext = options.priorContext ?? "";
  for (const target of activeTargets) {
    const present = await checkTargetPresence(playerText, target);
    let inPrior = false;
    if (present && priorContext.length > 0) {
      inPrior = await checkTargetPresence(priorContext, target);
    }
    let outcome: EvaluatorResult["outcome"];
    let notes: string;
    if (!present) {
      outcome = "missed";
      notes = "rule check: pattern surface not found in player text";
    } else if (inPrior) {
      outcome = "produced_with_help";
      notes = "rule check: pattern surface found, but also appeared in prior AI context (scaffolded)";
    } else {
      outcome = "produced";
      notes = "rule check: pattern surface found, no AI scaffolding detected";
    }
    results.push({
      itemId: target.itemId,
      mode: target.mode,
      outcome,
      evidence: {
        targetPresent: present,
        morphologyOk: present, // morphology check still v0 — separate task
        notes,
      },
    });
  }
  return results;
}
