import { loadGrammar, loadTemplates, loadVocab } from "../content";
import type { ItemAssignment, SceneRunLog, SceneTemplate } from "../types";

export type AuditSeverity = "warn" | "fail";
export type AuditStatus = "pass" | "warn" | "fail";

export interface AuditFinding {
  severity: AuditSeverity;
  code: string;
  message: string;
  turn?: number;
}

export interface AuditRunResult {
  id: string;
  status: AuditStatus;
  findings: AuditFinding[];
}

export interface AuditReport {
  total: number;
  pass: number;
  warn: number;
  fail: number;
  results: AuditRunResult[];
}

interface AuditContext {
  templates: SceneTemplate[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assignmentSurface(assignment: ItemAssignment): string | null {
  if (assignment.itemType === "grammar") {
    const grammar = loadGrammar().find((g) => g.id === assignment.itemId);
    return grammar?.pattern ?? null;
  }

  const vocab = loadVocab().find((v) => v.id === assignment.itemId);
  return vocab?.word ?? null;
}

function containsSurface(text: string, surface: string | null): boolean {
  return surface !== null && text.includes(surface);
}

function aiTurns(log: SceneRunLog): SceneRunLog["turns"] {
  return log.turns.filter((t) => t.speaker !== "player" && t.speaker !== "coach");
}

function playerTurns(log: SceneRunLog): SceneRunLog["turns"] {
  return log.turns.filter((t) => t.speaker === "player");
}

function statusFromFindings(findings: AuditFinding[]): AuditStatus {
  if (findings.some((f) => f.severity === "fail")) return "fail";
  if (findings.some((f) => f.severity === "warn")) return "warn";
  return "pass";
}

function add(
  findings: AuditFinding[],
  severity: AuditSeverity,
  code: string,
  message: string,
  turn?: number,
): void {
  findings.push({ severity, code, message, ...(turn !== undefined ? { turn } : {}) });
}

function auditShape(input: unknown, index: number): SceneRunLog | AuditRunResult {
  const fallbackId = `entry-${index + 1}`;
  if (!isObject(input)) {
    return {
      id: fallbackId,
      status: "fail",
      findings: [
        {
          severity: "fail",
          code: "malformed_log",
          message: "Log entry is not an object.",
        },
      ],
    };
  }

  const id = hasText(input.id) ? input.id : fallbackId;
  const findings: AuditFinding[] = [];

  if (hasText(input.__parseError)) {
    return {
      id,
      status: "fail",
      findings: [
        {
          severity: "fail",
          code: "malformed_json",
          message: `Log entry could not be parsed as JSON: ${input.__parseError}`,
        },
      ],
    };
  }

  if (!hasText(input.id)) add(findings, "fail", "missing_id", "Log is missing id.");
  if (!Array.isArray(input.turns)) add(findings, "fail", "missing_turns", "Log is missing turns array.");
  if (!Array.isArray(input.activeTargetsChosen)) {
    add(findings, "fail", "missing_active_targets", "Log is missing activeTargetsChosen array.");
  }
  if (!Array.isArray(input.passiveItemsChosen)) {
    add(findings, "warn", "missing_passive_targets", "Log is missing passiveItemsChosen array.");
  }
  if (!Array.isArray(input.templateCandidates)) {
    add(findings, "fail", "missing_template_candidates", "Log is missing templateCandidates array.");
  }
  if (!isObject(input.templateChosen)) {
    add(findings, "fail", "missing_template_chosen", "Log is missing templateChosen object.");
  }

  if (findings.some((f) => f.severity === "fail")) {
    return { id, status: "fail", findings };
  }

  return {
    ...input,
    passiveItemsChosen: Array.isArray(input.passiveItemsChosen) ? input.passiveItemsChosen : [],
    __auditShapeFindings: findings,
  } as unknown as SceneRunLog;
}

function auditRun(
  log: SceneRunLog,
  ctx: AuditContext,
  previousLog: SceneRunLog | null,
): AuditRunResult {
  const findings: AuditFinding[] = [
    ...(((log as unknown as { __auditShapeFindings?: AuditFinding[] }).__auditShapeFindings) ?? []),
  ];
  const template = ctx.templates.find((t) => t.id === log.templateChosen.id || t.id === log.templateId);

  if (!hasText(log.llmPrompt)) add(findings, "fail", "missing_llm_prompt", "llmPrompt is missing or empty.");
  if (!hasText(log.llmResponse)) add(findings, "fail", "missing_llm_response", "llmResponse is missing or empty.");
  if (log.activeTargetsChosen.length === 0) {
    add(findings, "fail", "no_active_targets", "No active targets were chosen.");
  }
  if (log.templateCandidates.length === 0) {
    add(findings, "fail", "no_template_candidates", "No template candidate rationale was logged.");
  }
  if (log.turns.length === 0) add(findings, "fail", "no_turns", "No dialogue turns were logged.");
  if (playerTurns(log).length === 0) add(findings, "fail", "no_player_turns", "No player turns were logged.");

  for (const turn of playerTurns(log)) {
    if (!turn.evaluatorResults || turn.evaluatorResults.length === 0) {
      add(findings, "fail", "missing_evaluator_results", "Player turn has no evaluator results.", turn.turn);
      continue;
    }

    for (const active of log.activeTargetsChosen) {
      const evaluated = turn.evaluatorResults.some((result) => result.itemId === active.itemId);
      if (!evaluated) {
        add(
          findings,
          "fail",
          "active_target_not_evaluated",
          `Active target ${active.itemId} was not evaluated on player turn ${turn.turn}.`,
          turn.turn,
        );
      }
    }
  }

  for (const active of log.activeTargetsChosen) {
    const surface = assignmentSurface(active);
    for (const turn of aiTurns(log)) {
      if (containsSurface(turn.text, surface)) {
        add(
          findings,
          "warn",
          "active_target_in_ai_speech",
          `Active target ${active.itemId} appeared in AI speech.`,
          turn.turn,
        );
      }
    }
  }

  for (const passive of log.passiveItemsChosen) {
    const surface = assignmentSurface(passive);
    const appeared = aiTurns(log).some((turn) => containsSurface(turn.text, surface));
    if (!appeared) {
      add(
        findings,
        "warn",
        "passive_target_missing_from_ai_speech",
        `Passive target ${passive.itemId} did not appear in AI speech.`,
      );
    }
  }

  if (template) {
    const expectedAiTurns = template.scriptedTurns.filter(
      (turn) => turn.speaker !== "coach" && turn.speaker !== "player",
    );
    for (const expected of expectedAiTurns) {
      const actual = log.turns.find((turn) => turn.turn === expected.turn);
      if (!actual) {
        add(
          findings,
          "fail",
          "missing_scripted_turn",
          `Expected scripted turn ${expected.turn} (${expected.speaker}) is missing.`,
          expected.turn,
        );
        continue;
      }
      if (actual.speaker !== expected.speaker) {
        add(
          findings,
          "warn",
          "unexpected_speaker",
          `Expected speaker ${expected.speaker}, got ${actual.speaker}.`,
          expected.turn,
        );
      }
    }
  } else {
    add(findings, "warn", "unknown_template", `Template ${log.templateChosen.id} was not found in content.`);
  }

  if (previousLog) {
    const sameTemplate = previousLog.templateChosen.id === log.templateChosen.id;
    const previousTemplate = ctx.templates.find((t) => t.id === previousLog.templateChosen.id);
    const sameLocation = previousTemplate && template && previousTemplate.location === template.location;
    const chosenCandidate = log.templateCandidates.find((c) => c.templateId === log.templateChosen.id);
    const reasons = chosenCandidate?.reasons.join("\n") ?? "";

    if (sameTemplate && !reasons.includes("same template")) {
      add(
        findings,
        "warn",
        "missing_same_template_penalty",
        "Run repeated the previous template but chosen candidate rationale has no same-template penalty.",
      );
    }
    if (sameLocation && !reasons.includes("same location")) {
      add(
        findings,
        "warn",
        "missing_same_location_penalty",
        "Run repeated the previous location but chosen candidate rationale has no same-location penalty.",
      );
    }
  }

  return {
    id: log.id,
    status: statusFromFindings(findings),
    findings,
  };
}

export function auditSceneRunLogs(inputs: unknown[]): AuditReport {
  const templates = loadTemplates();
  const results: AuditRunResult[] = [];
  let previousValidLog: SceneRunLog | null = null;

  for (const [index, input] of inputs.entries()) {
    const shaped = auditShape(input, index);
    if ("status" in shaped) {
      results.push(shaped);
      continue;
    }

    results.push(auditRun(shaped, { templates }, previousValidLog));
    previousValidLog = shaped;
  }

  return {
    total: results.length,
    pass: results.filter((r) => r.status === "pass").length,
    warn: results.filter((r) => r.status === "warn").length,
    fail: results.filter((r) => r.status === "fail").length,
    results,
  };
}
