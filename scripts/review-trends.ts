// Read all review-loop snapshots and render score + per-template +
// per-item trends across the last N sessions. Snapshots are sidecar
// JSON files written by review-loop.ts as `report-{ts}.json`.
//
// Usage:
//   npm run trends                # window of last 5 sessions
//   npm run trends -- --window 10
//   npm run trends -- --top 20    # show 20 templates / 20 items
//   npm run trends -- --json

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  computeTrends,
  type ItemTrend,
  type ReviewSnapshot,
  type TemplateTrend,
  type TrendDirection,
  type TrendReport,
} from "../src/lib/log/trends.js";

interface CliOptions {
  window: number;
  top: number;
  reportsDir: string;
  json: boolean;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const opts: CliOptions = {
    window: 5,
    top: 10,
    reportsDir: join(process.cwd(), "logs", "review-reports"),
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--window") opts.window = parseIntStrict(argv[++i], "--window");
    else if (a === "--top") opts.top = parseIntStrict(argv[++i], "--top");
    else if (a === "--reports-dir") opts.reportsDir = argv[++i];
    else if (a === "--json") opts.json = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return opts;
}

function parseIntStrict(s: string, name: string): number {
  const n = Number(s);
  if (!Number.isFinite(n) || n < 1) throw new Error(`${name} requires a positive integer`);
  return n;
}

function loadSnapshots(reportsDir: string): ReviewSnapshot[] {
  if (!existsSync(reportsDir)) return [];
  const out: ReviewSnapshot[] = [];
  for (const name of readdirSync(reportsDir)) {
    if (!name.endsWith(".json")) continue;
    const raw = readFileSync(join(reportsDir, name), "utf8");
    try {
      out.push(JSON.parse(raw) as ReviewSnapshot);
    } catch {
      // Skip malformed snapshots silently — trends should not fail
      // because of one corrupt sidecar.
    }
  }
  return out;
}

const ARROW: Record<TrendDirection, string> = {
  regressing: "↑",
  improving: "↓",
  stable: "→",
  new: "*",
};

function pad(s: string, w: number): string {
  return s.length >= w ? s : s + " ".repeat(w - s.length);
}
function rpad(n: number | string, w: number): string {
  const s = String(n);
  return s.length >= w ? s : " ".repeat(w - s.length) + s;
}
function formatSeries(values: number[]): string {
  return values.map((v) => v.toFixed(1)).join(" → ");
}

function renderScore(report: TrendReport): string[] {
  const lines: string[] = ["## Score", ""];
  if (report.score.series.length === 0) {
    lines.push("_no snapshots_");
    return lines;
  }
  const series = report.score.series.map((p) => p.avgScore.toFixed(1)).join(" → ");
  const sign = report.score.delta > 0 ? "+" : "";
  lines.push(
    `${ARROW[report.score.direction]} ${report.score.direction.toUpperCase()}: ${series}  (delta ${sign}${report.score.delta})`,
  );
  return lines;
}

function renderTemplates(rows: TemplateTrend[], top: number): string[] {
  const lines: string[] = ["", "## Templates", ""];
  if (rows.length === 0) {
    lines.push("_no templates_");
    return lines;
  }
  lines.push(pad("template", 36) + pad("dir", 12) + rpad("now", 6) + rpad("delta", 8) + "  series");
  lines.push("-".repeat(110));
  for (const t of rows.slice(0, top)) {
    const series = formatSeries(t.series.map((s) => s.rate));
    const sign = t.delta > 0 ? "+" : "";
    lines.push(
      pad(t.templateId, 36) +
        pad(`${ARROW[t.direction]} ${t.direction}`, 12) +
        rpad(t.currentRate.toFixed(1), 6) +
        rpad(`${sign}${t.delta}`, 8) +
        "  " +
        series,
    );
  }
  return lines;
}

function renderItems(rows: ItemTrend[], top: number): string[] {
  const lines: string[] = ["", "## Items", ""];
  if (rows.length === 0) {
    lines.push("_no items_");
    return lines;
  }
  lines.push(pad("item", 30) + pad("dir", 12) + rpad("now", 6) + rpad("delta", 8) + "  series");
  lines.push("-".repeat(110));
  for (const i of rows.slice(0, top)) {
    const series = formatSeries(i.series.map((s) => s.rate));
    const sign = i.delta > 0 ? "+" : "";
    lines.push(
      pad(i.itemId, 30) +
        pad(`${ARROW[i.direction]} ${i.direction}`, 12) +
        rpad(i.currentRate.toFixed(1), 6) +
        rpad(`${sign}${i.delta}`, 8) +
        "  " +
        series,
    );
  }
  return lines;
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  const snapshots = loadSnapshots(opts.reportsDir);
  if (snapshots.length === 0) {
    console.error(`[trends] no snapshots found in ${opts.reportsDir}`);
    console.error("[trends] run 'npm run review-loop' to generate one");
    process.exit(1);
  }
  const report = computeTrends(snapshots, opts.window);
  if (opts.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return;
  }
  console.log(`# Trend report (window of last ${opts.window} sessions, ${snapshots.length} total)`);
  console.log("");
  console.log(renderScore(report).join("\n"));
  console.log(renderTemplates(report.templates, opts.top).join("\n"));
  console.log(renderItems(report.items, opts.top).join("\n"));
}

main();
