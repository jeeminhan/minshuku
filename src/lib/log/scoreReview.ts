// Pure scoring of a review-loop run. No I/O. No LLM calls.
// Takes a deterministic AuditReport plus a list of qualitative findings
// and produces a 0–100 score per run.

import type { AuditReport } from "./auditSceneRunLogs.js";

export interface QualitativeFinding {
  run_id: string;
  category: "architecture" | "prompt" | "data" | "llm-quality";
  severity: "high" | "medium" | "low";
  description: string;
  suggested_fix?: string;
}

export interface RunScore {
  runId: string;
  score: number;
  signals: {
    missingTurns: number;
    activeLeakage: number;
    passiveMisses: number;
    qualHigh: number;
    qualMedium: number;
    qualLow: number;
  };
}

export interface ReviewScore {
  perRun: RunScore[];
  avg: number;
}

export const SCORE_WEIGHTS = {
  missingTurn: 8,
  activeLeakage: 5,
  passiveMiss: 3,
  qualHigh: 5,
  qualMedium: 2,
  qualLow: 0.5,
} as const;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function scoreRuns(
  audit: AuditReport,
  findings: readonly QualitativeFinding[],
  runIds: readonly string[],
): ReviewScore {
  const qualByRun = new Map<string, { high: number; medium: number; low: number }>();
  for (const id of runIds) qualByRun.set(id, { high: 0, medium: 0, low: 0 });
  for (const f of findings) {
    const bucket = qualByRun.get(f.run_id);
    if (bucket) bucket[f.severity]++;
  }

  const perRun: RunScore[] = runIds.map((id) => {
    const auditEntry = audit.results.find((r) => r.id === id);
    let missing = 0,
      leakage = 0,
      passive = 0;
    if (auditEntry) {
      for (const f of auditEntry.findings) {
        if (f.code === "missing_scripted_turn") missing++;
        else if (f.code === "active_target_in_ai_speech") leakage++;
        else if (f.code === "passive_target_missing_from_ai_speech") passive++;
      }
    }
    const qual = qualByRun.get(id) ?? { high: 0, medium: 0, low: 0 };
    let score = 100;
    score -= SCORE_WEIGHTS.missingTurn * missing;
    score -= SCORE_WEIGHTS.activeLeakage * leakage;
    score -= SCORE_WEIGHTS.passiveMiss * passive;
    score -= SCORE_WEIGHTS.qualHigh * qual.high;
    score -= SCORE_WEIGHTS.qualMedium * qual.medium;
    score -= SCORE_WEIGHTS.qualLow * qual.low;
    score = Math.max(0, Math.min(100, score));
    return {
      runId: id,
      score: round1(score),
      signals: {
        missingTurns: missing,
        activeLeakage: leakage,
        passiveMisses: passive,
        qualHigh: qual.high,
        qualMedium: qual.medium,
        qualLow: qual.low,
      },
    };
  });
  const avg = perRun.length === 0 ? 0 : perRun.reduce((s, r) => s + r.score, 0) / perRun.length;
  return { perRun, avg: round1(avg) };
}
