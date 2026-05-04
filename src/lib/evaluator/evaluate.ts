import { checkTargetPresence } from "./ruleCheck";
import type { ItemAssignment, EvaluatorResult } from "../types";

// v0 mapping: target-present → "produced"; target-absent → "missed".
// (Hint-aware "produced_with_help", "mastered" arrive in later plans.)
export async function evaluatePlayerTurn(
  playerText: string,
  activeTargets: ItemAssignment[],
): Promise<EvaluatorResult[]> {
  const results: EvaluatorResult[] = [];
  for (const target of activeTargets) {
    const present = await checkTargetPresence(playerText, target);
    results.push({
      itemId: target.itemId,
      mode: target.mode,
      outcome: present ? "produced" : "missed",
      evidence: {
        targetPresent: present,
        morphologyOk: present, // for v0 these collapse to the same signal
        notes: present ? "rule check: pattern surface found" : "rule check: pattern surface not found",
      },
    });
  }
  return results;
}
