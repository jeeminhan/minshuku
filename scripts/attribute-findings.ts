// Aggregate review findings across the last N scene runs and rank
// templates + items by finding rate. Surfaces content-level problems
// that single-run reports hide.
//
// Usage:
//   npm run attribute -- --last 20
//   npm run attribute -- --last 20 --json

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { auditSceneRunLogs } from "../src/lib/log/auditSceneRunLogs.js";
import { attributeFindings, type AttributionReport } from "../src/lib/log/attribution.js";
import { readAllSceneRunLogs } from "../src/lib/log/sceneRunLog.js";
import type { QualitativeFinding } from "../src/lib/log/scoreReview.js";

interface CliOptions {
  last: number;
  json: boolean;
  reportsDir: string;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const opts: CliOptions = {
    last: 20,
    json: false,
    reportsDir: join(process.cwd(), "logs", "review-reports"),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--last") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n < 1) throw new Error("--last requires a positive integer");
      opts.last = n;
    } else if (a === "--json") {
      opts.json = true;
    } else if (a === "--reports-dir") {
      opts.reportsDir = argv[++i];
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  return opts;
}

// Parses qualitative findings out of all `*.md` files in the reports dir.
// The markdown format is fixed by review-loop.ts buildReportMarkdown:
//   ### {category} ({n})
//   - **[{severity}]** ({run_id}) {description}
//     - _fix:_ {suggested_fix}
const CATEGORY_HEADER = /^###\s+(architecture|prompt|data|llm-quality)\s+\(\d+\)/;
// Matches both legacy `(run-XXXX)` and new `[(run-XXXX)](#run-XXXX)` link forms.
const FINDING_LINE = /^-\s+\*\*\[(high|medium|low)\]\*\*\s+\[?\(([^)]+)\)\]?(?:\(#[^)]+\))?\s+(.*)$/;

export function parseFindingsFromReport(markdown: string): QualitativeFinding[] {
  const findings: QualitativeFinding[] = [];
  let currentCategory: QualitativeFinding["category"] | null = null;
  for (const line of markdown.split("\n")) {
    const cat = line.match(CATEGORY_HEADER);
    if (cat) {
      currentCategory = cat[1] as QualitativeFinding["category"];
      continue;
    }
    if (!currentCategory) continue;
    const f = line.match(FINDING_LINE);
    if (f) {
      findings.push({
        run_id: f[2],
        category: currentCategory,
        severity: f[1] as QualitativeFinding["severity"],
        description: f[3],
      });
    }
  }
  return findings;
}

function loadAllQualitative(reportsDir: string): QualitativeFinding[] {
  if (!existsSync(reportsDir)) return [];
  const all: QualitativeFinding[] = [];
  for (const name of readdirSync(reportsDir)) {
    if (!name.endsWith(".md")) continue;
    if (name === "latest.md") continue; // symlink, avoid double-count
    const md = readFileSync(join(reportsDir, name), "utf8");
    all.push(...parseFindingsFromReport(md));
  }
  return all;
}

function pad(s: string, w: number): string {
  return s.length >= w ? s : s + " ".repeat(w - s.length);
}

function rpad(n: number | string, w: number): string {
  const s = String(n);
  return s.length >= w ? s : " ".repeat(w - s.length) + s;
}

function renderTables(report: AttributionReport): string {
  const lines: string[] = [];
  lines.push("# Attribution");
  lines.push("");
  lines.push("## Templates (worst first)");
  lines.push("");
  if (report.templates.length === 0) {
    lines.push("_no templates_");
  } else {
    lines.push(
      pad("templateId", 32) +
        rpad("runs", 5) +
        rpad("findings", 10) +
        rpad("rate", 7) +
        "  arch/prompt/data/llm  warn/fail/H/M/L",
    );
    lines.push("-".repeat(110));
    for (const t of report.templates) {
      const cat = `${t.byCategory.architecture}/${t.byCategory.prompt}/${t.byCategory.data}/${t.byCategory["llm-quality"]}`;
      const sev = `${t.bySeverity.auditWarn}/${t.bySeverity.auditFail}/${t.bySeverity.qualHigh}/${t.bySeverity.qualMedium}/${t.bySeverity.qualLow}`;
      lines.push(
        pad(t.templateId, 32) +
          rpad(t.runs, 5) +
          rpad(t.totalFindings, 10) +
          rpad(t.findingRate, 7) +
          "  " +
          pad(cat, 22) +
          sev,
      );
    }
  }
  lines.push("");
  lines.push("## Items (worst first)");
  lines.push("");
  if (report.items.length === 0) {
    lines.push("_no items_");
  } else {
    lines.push(
      pad("itemId", 28) +
        pad("type", 8) +
        pad("role", 8) +
        rpad("runs", 5) +
        rpad("findings", 10) +
        rpad("rate", 7) +
        "  arch/prompt/data/llm  warn/fail/H/M/L",
    );
    lines.push("-".repeat(120));
    for (const it of report.items) {
      const cat = `${it.byCategory.architecture}/${it.byCategory.prompt}/${it.byCategory.data}/${it.byCategory["llm-quality"]}`;
      const sev = `${it.bySeverity.auditWarn}/${it.bySeverity.auditFail}/${it.bySeverity.qualHigh}/${it.bySeverity.qualMedium}/${it.bySeverity.qualLow}`;
      lines.push(
        pad(it.itemId, 28) +
          pad(it.itemType, 8) +
          pad(it.role, 8) +
          rpad(it.runs, 5) +
          rpad(it.totalFindings, 10) +
          rpad(it.findingRate, 7) +
          "  " +
          pad(cat, 22) +
          sev,
      );
    }
  }
  return lines.join("\n");
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  const allLogs = readAllSceneRunLogs();
  const lastN = allLogs.slice(-opts.last);
  if (lastN.length === 0) {
    console.error("[attribute] no scene runs found in logs/scene-runs.jsonl");
    process.exit(1);
  }
  const audit = auditSceneRunLogs(lastN as unknown[]);
  const runIds = new Set(lastN.map((l) => l.id));
  const allQual = loadAllQualitative(opts.reportsDir);
  const qual = allQual.filter((f) => runIds.has(f.run_id));
  const report = attributeFindings(lastN, audit, qual);

  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return;
  }
  console.log(`[attribute] runs: ${lastN.length}  qualitative findings matched: ${qual.length}`);
  console.log(renderTables(report));
}

main();
