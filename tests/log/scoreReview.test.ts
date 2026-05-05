import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { auditSceneRunLogs } from "@/lib/log/auditSceneRunLogs";
import {
  scoreRuns,
  SCORE_WEIGHTS,
  type QualitativeFinding,
} from "@/lib/log/scoreReview";

const FIXTURE_DIR = join(__dirname, "..", "fixtures", "scene-runs");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), "utf8"));
}

describe("scoreRuns", () => {
  it("gives a perfect 100 to a run with no audit findings and no qualitative findings", () => {
    const audit = {
      total: 1,
      pass: 1,
      warn: 0,
      fail: 0,
      results: [{ id: "run-clean", status: "pass" as const, findings: [] }],
    };
    const result = scoreRuns(audit, [], ["run-clean"]);
    expect(result.perRun).toHaveLength(1);
    expect(result.perRun[0].score).toBe(100);
    expect(result.avg).toBe(100);
  });

  it("clamps the score to 0 when penalties exceed 100", () => {
    // 13 missing turns × 8 weight = 104 raw penalty. Verifies clamping.
    const findingsArr = Array.from({ length: 13 }, () => ({
      severity: "fail" as const,
      code: "missing_scripted_turn",
      message: "",
    }));
    const audit = {
      total: 1,
      pass: 0,
      warn: 0,
      fail: 1,
      results: [{ id: "run-bad", status: "fail" as const, findings: findingsArr }],
    };
    const result = scoreRuns(audit, [], ["run-bad"]);
    expect(result.perRun[0].score).toBe(0);
  });

  it("applies the documented per-finding weights", () => {
    const audit = {
      total: 1,
      pass: 0,
      warn: 1,
      fail: 0,
      results: [
        {
          id: "run-x",
          status: "warn" as const,
          findings: [
            { severity: "warn" as const, code: "passive_target_missing_from_ai_speech", message: "" },
            { severity: "warn" as const, code: "active_target_in_ai_speech", message: "" },
          ],
        },
      ],
    };
    const findings: QualitativeFinding[] = [
      { run_id: "run-x", category: "prompt", severity: "high", description: "" },
      { run_id: "run-x", category: "prompt", severity: "medium", description: "" },
      { run_id: "run-x", category: "prompt", severity: "low", description: "" },
    ];
    const result = scoreRuns(audit, findings, ["run-x"]);
    // 100 - (1 * passiveMiss=3) - (1 * activeLeakage=5) - (1 * qualHigh=5) - (1 * qualMedium=2) - (1 * qualLow=0.5) = 84.5
    const expected =
      100 -
      SCORE_WEIGHTS.passiveMiss -
      SCORE_WEIGHTS.activeLeakage -
      SCORE_WEIGHTS.qualHigh -
      SCORE_WEIGHTS.qualMedium -
      SCORE_WEIGHTS.qualLow;
    expect(result.perRun[0].score).toBe(expected);
    expect(result.perRun[0].signals).toEqual({
      missingTurns: 0,
      activeLeakage: 1,
      passiveMisses: 1,
      qualHigh: 1,
      qualMedium: 1,
      qualLow: 1,
    });
  });

  it("ignores qualitative findings whose run_id is not in the requested set", () => {
    const audit = {
      total: 1,
      pass: 1,
      warn: 0,
      fail: 0,
      results: [{ id: "run-a", status: "pass" as const, findings: [] }],
    };
    const findings: QualitativeFinding[] = [
      { run_id: "run-b", category: "prompt", severity: "high", description: "" },
    ];
    const result = scoreRuns(audit, findings, ["run-a"]);
    expect(result.perRun[0].score).toBe(100);
  });

  it("averages scores across multiple runs", () => {
    const audit = {
      total: 2,
      pass: 1,
      warn: 1,
      fail: 0,
      results: [
        { id: "run-1", status: "pass" as const, findings: [] },
        {
          id: "run-2",
          status: "warn" as const,
          findings: [
            { severity: "warn" as const, code: "passive_target_missing_from_ai_speech", message: "" },
          ],
        },
      ],
    };
    const result = scoreRuns(audit, [], ["run-1", "run-2"]);
    expect(result.perRun[0].score).toBe(100);
    expect(result.perRun[1].score).toBe(100 - SCORE_WEIGHTS.passiveMiss);
    expect(result.avg).toBe((100 + (100 - SCORE_WEIGHTS.passiveMiss)) / 2);
  });

  it("scores the captured fixture logs deterministically", () => {
    // Regression guard: scoring three real captured logs (no qualitative findings)
    // should produce a stable result. If this test breaks, scoring math or
    // audit logic changed — review intentionally.
    const fixtures = [loadFixture("run-1.json"), loadFixture("run-2.json"), loadFixture("run-3.json")];
    const audit = auditSceneRunLogs(fixtures);
    const ids = audit.results.map((r) => r.id);
    expect(ids).toHaveLength(3);
    const result = scoreRuns(audit, [], ids);
    expect(result.perRun).toHaveLength(3);
    // Each fixture's deterministic score must be within [0, 100].
    for (const r of result.perRun) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
    // The avg of three runs must also be in range.
    expect(result.avg).toBeGreaterThanOrEqual(0);
    expect(result.avg).toBeLessThanOrEqual(100);
    // Snapshot the per-run signal counts so changes to audit logic surface here.
    const signalSummary = result.perRun.map((r) => r.signals);
    expect(signalSummary).toMatchSnapshot();
  });
});
