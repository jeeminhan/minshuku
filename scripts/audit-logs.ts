import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { auditSceneRunLogs, type AuditReport, type AuditRunResult } from "../src/lib/log/auditSceneRunLogs.js";
import { renderSceneRunLog } from "../src/lib/log/renderSceneRunLog.js";
import type { SceneRunLog } from "../src/lib/types.js";

interface CliOptions {
  id: string | null;
  last: number | null;
  json: boolean;
  reviewPrompt: boolean;
  failOnIssues: boolean;
}

interface ParsedEntry {
  log: unknown;
  raw: string;
}

const LOG_PATH = join(process.cwd(), "logs", "scene-runs.jsonl");

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    id: null,
    last: null,
    json: false,
    reviewPrompt: false,
    failOnIssues: false,
  };

  for (const arg of argv) {
    if (arg.startsWith("--id=")) opts.id = arg.slice("--id=".length);
    else if (arg.startsWith("--last=")) opts.last = Number(arg.slice("--last=".length));
    else if (arg === "--json") opts.json = true;
    else if (arg === "--review-prompt") opts.reviewPrompt = true;
    else if (arg === "--fail-on-issues") opts.failOnIssues = true;
    else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (opts.last !== null && (!Number.isInteger(opts.last) || opts.last <= 0)) {
    throw new Error("--last must be a positive integer");
  }

  return opts;
}

function readEntries(): ParsedEntry[] {
  if (!existsSync(LOG_PATH)) return [];
  return readFileSync(LOG_PATH, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => {
      try {
        return { log: JSON.parse(line), raw: line };
      } catch (error) {
        return {
          log: {
            id: `line-${index + 1}`,
            turns: [],
            activeTargetsChosen: [],
            passiveItemsChosen: [],
            templateCandidates: [],
            templateChosen: {},
            llmPrompt: "",
            llmResponse: "",
            __parseError: error instanceof Error ? error.message : String(error),
          },
          raw: line,
        };
      }
    });
}

function selectEntries(entries: ParsedEntry[], opts: CliOptions): ParsedEntry[] {
  let selected = entries;

  if (opts.id) {
    selected = selected.filter((entry) => {
      const maybeLog = entry.log as Partial<SceneRunLog>;
      return maybeLog.id === opts.id;
    });
  }

  if (opts.last !== null) {
    selected = selected.slice(-opts.last);
  }

  return selected;
}

function renderReport(report: AuditReport): string {
  const lines: string[] = [];
  lines.push(`Audit: ${report.total} run(s), ${report.pass} pass, ${report.warn} warn, ${report.fail} fail`);

  for (const result of report.results) {
    lines.push("");
    lines.push(`${result.id}  ${result.status.toUpperCase()}`);
    if (result.findings.length === 0) {
      lines.push("  - no findings");
      continue;
    }

    for (const finding of result.findings) {
      const turn = finding.turn !== undefined ? ` turn=${finding.turn}` : "";
      lines.push(`  - ${finding.severity.toUpperCase()} ${finding.code}${turn}: ${finding.message}`);
    }
  }

  return lines.join("\n");
}

function renderReviewPrompt(report: AuditReport, logs: SceneRunLog[]): string {
  const lines: string[] = [];
  lines.push("# Hanare Scene Log Review");
  lines.push("");
  lines.push("You are reviewing Hanare text-mode Japanese tutoring scene logs for product quality.");
  lines.push("The audit below is deterministic and local; it did not call Gemini or any other LLM.");
  lines.push("Use it as a first pass, then inspect the rendered logs for dialogue coherence, target setup, evaluator false positives/negatives, and awkward Japanese.");
  lines.push("");
  lines.push("## Deterministic Audit");
  lines.push("");
  lines.push("```text");
  lines.push(renderReport(report));
  lines.push("```");
  lines.push("");
  lines.push("## Rendered Logs");
  for (const log of logs) {
    lines.push("");
    lines.push("```text");
    lines.push(renderSceneRunLog(log));
    lines.push("```");
  }

  return lines.join("\n");
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  const entries = selectEntries(readEntries(), opts);

  if (entries.length === 0) {
    console.log(opts.id ? `No logs found for id=${opts.id}` : "No scene runs logged yet.");
    return;
  }

  const logs = entries.map((entry) => entry.log);
  const report = auditSceneRunLogs(logs);

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (opts.reviewPrompt) {
    const validLogs = logs.filter((log): log is SceneRunLog => {
      return typeof (log as Partial<SceneRunLog>).id === "string" && Array.isArray((log as Partial<SceneRunLog>).turns);
    });
    console.log(renderReviewPrompt(report, validLogs));
  } else {
    console.log(renderReport(report));
  }

  if (opts.failOnIssues && (report.warn > 0 || report.fail > 0)) {
    process.exitCode = 1;
  }
}

main();
