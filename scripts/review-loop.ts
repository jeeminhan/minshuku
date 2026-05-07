// Run N scenes, run the deterministic audit, then send the rendered logs to
// Gemini for qualitative review. Output a categorized findings report.
//
// Usage:
//   npm run review-loop -- --scenes 5
//   npm run review-loop -- --scenes 10 --level N3
//   npm run review-loop -- --scenes 5 --report /tmp/review.md

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { z } from "zod";
import { auditSceneRunLogs } from "../src/lib/log/auditSceneRunLogs.js";
import { readAllSceneRunLogs } from "../src/lib/log/sceneRunLog.js";
import { loadGrammar, loadVocab } from "../src/lib/content.js";
import {
  scoreRuns,
  type QualitativeFinding,
  type ReviewScore,
  type RunScore,
} from "../src/lib/log/scoreReview.js";
import { attributeFindings, type AttributionReport } from "../src/lib/log/attribution.js";
import type { ReviewSnapshot } from "../src/lib/log/trends.js";
import type { SceneRunLog } from "../src/lib/types.js";

const REPORTS_DIR = join(process.cwd(), "logs", "review-reports");
const LATEST_LINK = join(REPORTS_DIR, "latest.md");
const BASELINE_PATH = join(process.cwd(), "logs", "review-baseline.json");
const HISTORY_LIMIT = 10;
const REGRESSION_DELTA = 15; // points below baseline avg
const REGRESSION_STREAK_LIMIT = 3;

interface CliOptions {
  scenes: number;
  level?: string;
  reportPath: string;
  strict: boolean;
  noRerun: boolean;
}

function parseArgs(argv: readonly string[]): CliOptions {
  let scenes = 5;
  let level: string | undefined;
  // Default: project-internal directory so reports persist across reboots.
  // Override with --report <path> if you want one-off elsewhere.
  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
  let reportPath = join(REPORTS_DIR, `report-${Date.now()}.md`);
  let strict = false;
  let noRerun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--scenes") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n < 1) throw new Error("--scenes requires a positive integer");
      scenes = n;
    } else if (a === "--level") {
      level = argv[++i];
    } else if (a === "--report") {
      reportPath = argv[++i];
    } else if (a === "--strict") {
      strict = true;
    } else if (a === "--no-rerun") {
      noRerun = true;
    }
  }
  return { scenes, level, reportPath, strict, noRerun };
}

function runNpm(args: readonly string[]): { stdout: string; status: number } {
  try {
    const stdout = execFileSync("npm", ["run", ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 32 * 1024 * 1024,
    });
    return { stdout, status: 0 };
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer; status?: number };
    return {
      stdout: (e.stdout?.toString("utf8") ?? "") + (e.stderr?.toString("utf8") ?? ""),
      status: e.status ?? 1,
    };
  }
}

const FindingSchema = z.object({
  run_id: z.string(),
  category: z.enum(["architecture", "prompt", "data", "llm-quality"]),
  severity: z.enum(["high", "medium", "low"]),
  description: z.string(),
  suggested_fix: z.string().optional(),
});

const ReviewSchema = z.object({
  summary: z.string(),
  findings: z.array(FindingSchema),
});

type Review = z.infer<typeof ReviewSchema>;

const REVIEW_SYSTEM = `You are an expert reviewer of a Japanese language-learning app called Hanare.
You will be given a packet containing a deterministic audit and rendered logs from N scene runs. Your job is to identify QUALITATIVE issues the deterministic audit cannot catch.

FOCUS AREAS (assign a category to each finding):
1. architecture — issues with template scoring, item-template compatibility, item selection, etc. (e.g., "two consecutive scenes used items that don't naturally co-occur")
2. prompt — issues with how the dialogue generator or synthetic player are prompted (e.g., "the AI character paraphrased the active target rather than avoiding it entirely")
3. data — issues with template content, item tags, example sentences, or the item-template fit (e.g., "vocab.n3.maku ('curtain/act') was forced into a school-life conversation")
4. llm-quality — generic LLM noise that isn't actionable (e.g., "one sentence had a slightly awkward particle"). Use sparingly; only when a finding is real but cannot be fixed via the above three.

SEVERITY:
- high: blocks a learner's ability to produce or evaluate the active target correctly
- medium: degrades the experience but doesn't block learning
- low: cosmetic / minor

DO NOT flag deterministic issues already in the audit (passive coverage, active leakage by surface match). Focus on:
- register fit (does the AI sound like the role and the registerTag specifies?)
- dialogue coherence (do turns flow as a real conversation?)
- setup quality (did the AI's question actually invite the active target as the natural answer?)
- synthetic player believability (does the player text sound like a real learner of the stated level, or too perfect / too off?)
- target naturalness (does the active target genuinely fit the scene, or feel forced?)
- item-context mismatches (active or passive items that don't fit the scene)

Output strict JSON only:
{
  "summary": "<2-3 sentence overall assessment>",
  "findings": [
    {
      "run_id": "<run-XXXX from packet>",
      "category": "architecture|prompt|data|llm-quality",
      "severity": "high|medium|low",
      "description": "<what went wrong, concrete>",
      "suggested_fix": "<optional one-line concrete fix>"
    }
  ]
}`;

// ---------- circuit breaker ----------

interface BaselineFile {
  history: { timestamp: string; avg: number; level?: string }[];
  consecutiveRegressions: number;
}

function loadBaseline(): BaselineFile {
  if (!existsSync(BASELINE_PATH)) return { history: [], consecutiveRegressions: 0 };
  return JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as BaselineFile;
}

function saveBaseline(b: BaselineFile): void {
  writeFileSync(BASELINE_PATH, JSON.stringify(b, null, 2) + "\n");
}

interface BreakerVerdict {
  baselineAvg: number | null;
  delta: number | null;
  isRegression: boolean;
  consecutiveRegressions: number;
  shouldHalt: boolean;
}

function checkBreaker(
  current: number,
  baseline: BaselineFile,
  level: string | undefined,
): BreakerVerdict {
  const history = baseline.history;
  const baselineAvg =
    history.length === 0 ? null : history.reduce((s, h) => s + h.avg, 0) / history.length;
  const delta = baselineAvg === null ? null : current - baselineAvg;
  const isRegression = delta !== null && delta < -REGRESSION_DELTA;
  const consecutiveRegressions = isRegression
    ? baseline.consecutiveRegressions + 1
    : 0;
  const shouldHalt = consecutiveRegressions >= REGRESSION_STREAK_LIMIT;
  baseline.consecutiveRegressions = consecutiveRegressions;
  baseline.history.push({ timestamp: new Date().toISOString(), avg: current, level });
  if (baseline.history.length > HISTORY_LIMIT) {
    baseline.history = baseline.history.slice(-HISTORY_LIMIT);
  }
  return {
    baselineAvg: baselineAvg === null ? null : Math.round(baselineAvg * 10) / 10,
    delta: delta === null ? null : Math.round(delta * 10) / 10,
    isRegression,
    consecutiveRegressions,
    shouldHalt,
  };
}

interface ItemLookup {
  describe(itemId: string): string;          // "grammar.n3.012 (～おきに — At intervals of)"
  surface(itemId: string): string | null;    // "～おきに" or "ライター"
  enrichText(text: string): string;          // inline-replace any known item id with `id (surface)`
  shortLabel(itemId: string): string;        // "grammar.n3.012 (～おきに)" — no meaning
}

function buildItemLookup(): ItemLookup {
  const grammar = new Map(loadGrammar().map((g) => [g.id, g]));
  const vocab = new Map(loadVocab().map((v) => [v.id, v]));
  const surfaceOf = (id: string): string | null =>
    grammar.get(id)?.pattern ?? vocab.get(id)?.word ?? null;
  // Match every grammar/vocab id we know about. Sorting by length-desc
  // prevents a shorter id from prefix-matching a longer one (e.g. n3.01 vs n3.011).
  const allIds = [...grammar.keys(), ...vocab.keys()].sort((a, b) => b.length - a.length);
  const idPattern = allIds.length === 0
    ? null
    : new RegExp(`\\b(${allIds.map((id) => id.replace(/\./g, "\\.")).join("|")})\\b`, "g");
  return {
    describe(itemId: string): string {
      const g = grammar.get(itemId);
      if (g) return `${itemId} (${g.pattern} — ${g.meaning})`;
      const v = vocab.get(itemId);
      if (v) return `${itemId} (${v.word} — ${v.meaning})`;
      return itemId;
    },
    surface: surfaceOf,
    shortLabel(itemId: string): string {
      const s = surfaceOf(itemId);
      return s ? `${itemId} (${s})` : itemId;
    },
    enrichText(text: string): string {
      if (!idPattern) return text;
      // Avoid double-enriching: skip if the next chars already look like " (surface".
      return text.replace(idPattern, (id, _g, offset, full) => {
        const tail = full.slice(offset + id.length, offset + id.length + 2);
        if (tail.startsWith(" (") || tail.startsWith("(")) return id;
        const s = surfaceOf(id);
        return s ? `${id} (${s})` : id;
      });
    },
  };
}

function renderTranscriptMarkdown(log: SceneRunLog, items: ItemLookup): string {
  const lines: string[] = [];
  lines.push(`### ${log.id}`);
  lines.push("");
  lines.push(`**Template:** \`${log.templateChosen.id}\` &nbsp; **Score:** ${log.templateChosen.finalScore}`);
  lines.push("");
  lines.push("**Active targets:**");
  for (const a of log.activeTargetsChosen) lines.push(`- \`${items.describe(a.itemId)}\``);
  if (log.passiveItemsChosen.length > 0) {
    lines.push("");
    lines.push("**Passive items:**");
    for (const p of log.passiveItemsChosen) lines.push(`- \`${items.describe(p.itemId)}\``);
  }
  lines.push("");
  lines.push(`> **Briefing:** ${log.briefing}`);
  lines.push("");
  lines.push("**Dialogue:**");
  lines.push("");
  for (const t of log.turns) {
    lines.push(`- **[${t.turn}] ${t.speaker}:** ${t.text}`);
    if (t.evaluatorResults && t.evaluatorResults.length > 0) {
      for (const e of t.evaluatorResults) {
        lines.push(`  - _eval_ \`${items.describe(e.itemId)}\` → **${e.outcome}**`);
      }
    }
  }
  lines.push("");
  lines.push(`> **Result:** ${log.result}`);
  if (log.itemOutcomes.length > 0) {
    lines.push("");
    lines.push("**Outcomes:**");
    for (const o of log.itemOutcomes) {
      lines.push(`- \`${items.describe(o.itemId)}\` → **${o.outcome}**`);
    }
  }
  return lines.join("\n");
}

function findingLineWithLink(f: Review["findings"][number], items: ItemLookup): string {
  // GitHub/markdown auto-anchor: "### run-abc" → "#run-abc"
  const desc = items.enrichText(f.description);
  const fix = f.suggested_fix ? items.enrichText(f.suggested_fix) : null;
  return (
    `- **[${f.severity}]** [(${f.run_id})](#${f.run_id}) ${desc}` +
    (fix ? `\n  - _fix:_ ${fix}` : "")
  );
}

const HOW_TO_READ = `> **How to read this report**
>
> 1. **Score** is the headline — 100 is perfect, points come off for missing turns, leakage, missed passives, and qualitative findings. Watch the delta vs baseline.
> 2. **Action items** is the auto-extracted "what to fix first" list, derived from the highest-severity findings.
> 3. **Qualitative findings** is what the LLM reviewer flagged. Categories:
>    - \`architecture\` → generator/scoring logic (\`src/lib/generator/\`)
>    - \`prompt\` → dialogue or synthetic-player prompt (\`src/lib/llm/\`)
>    - \`data\` → template content or item tags (\`public/templates/\`, \`data/*.json\`)
>    - \`llm-quality\` → noise; usually ignore unless recurring
> 4. **Attribution** ranks templates/items by finding rate across this session. \`grammar.n3.009 (rate 1.3)\` means it picked up 1.3 findings per run on average.
> 5. **Auto-detected** is the deterministic audit (no LLM) — these are mechanical issues like missing scripted turns or items that didn't appear.
> 6. **Scene transcripts** at the bottom embeds the full dialogue for every run that had findings — click any \`(run-XXXX)\` link in the findings to jump there.
>
> To see trends across multiple sessions, run \`npm run trends\`.
`;

function buildActionItems(review: Review, attribution: AttributionReport, items: ItemLookup): string {
  const highFindings = review.findings.filter((f) => f.severity === "high");
  const worstTemplate = attribution.templates[0];
  const worstItems = attribution.items.filter((i) => i.totalFindings > 0).slice(0, 3);
  const lines: string[] = [];
  if (highFindings.length === 0 && (!worstTemplate || worstTemplate.totalFindings === 0) && worstItems.length === 0) {
    return "_no action items — clean session_";
  }
  if (highFindings.length > 0) {
    lines.push(`**High-severity findings (${highFindings.length})** — fix these first:`);
    for (const f of highFindings.slice(0, 5)) {
      const desc = items.enrichText(f.description);
      const fix = f.suggested_fix ? items.enrichText(f.suggested_fix) : null;
      lines.push(`- (${f.category}) ${desc}` + (fix ? `\n  - _fix:_ ${fix}` : ""));
    }
    lines.push("");
  }
  if (worstTemplate && worstTemplate.totalFindings > 0) {
    lines.push(
      `**Worst template:** \`${worstTemplate.templateId}\` — ${worstTemplate.totalFindings} findings across ${worstTemplate.runs} run(s) (rate ${worstTemplate.findingRate})`,
    );
  }
  if (worstItems.length > 0) {
    const list = worstItems.map((i) => `\`${items.shortLabel(i.itemId)}\` (rate ${i.findingRate})`).join(", ");
    lines.push(`**Worst items:** ${list}`);
  }
  return lines.join("\n");
}

function renderAttributionMarkdown(report: AttributionReport, topN: number, items: ItemLookup): string {
  if (report.templates.length === 0 && report.items.length === 0) return "_no attribution data_";
  const lines: string[] = [];
  const tplRows = report.templates.slice(0, topN);
  if (tplRows.length > 0) {
    lines.push("**Top templates by finding rate**");
    lines.push("");
    lines.push("| template | runs | findings | rate | arch/prompt/data/llm | warn/fail/H/M/L |");
    lines.push("|---|---:|---:|---:|---|---|");
    for (const t of tplRows) {
      const cat = `${t.byCategory.architecture}/${t.byCategory.prompt}/${t.byCategory.data}/${t.byCategory["llm-quality"]}`;
      const sev = `${t.bySeverity.auditWarn}/${t.bySeverity.auditFail}/${t.bySeverity.qualHigh}/${t.bySeverity.qualMedium}/${t.bySeverity.qualLow}`;
      lines.push(`| \`${t.templateId}\` | ${t.runs} | ${t.totalFindings} | ${t.findingRate} | ${cat} | ${sev} |`);
    }
    lines.push("");
  }
  const itemRows = report.items.filter((i) => i.totalFindings > 0).slice(0, topN);
  if (itemRows.length > 0) {
    lines.push("**Top items by finding rate** (zero-finding items hidden)");
    lines.push("");
    lines.push("| item | type | role | runs | findings | rate | arch/prompt/data/llm | warn/fail/H/M/L |");
    lines.push("|---|---|---|---:|---:|---:|---|---|");
    for (const it of itemRows) {
      const cat = `${it.byCategory.architecture}/${it.byCategory.prompt}/${it.byCategory.data}/${it.byCategory["llm-quality"]}`;
      const sev = `${it.bySeverity.auditWarn}/${it.bySeverity.auditFail}/${it.bySeverity.qualHigh}/${it.bySeverity.qualMedium}/${it.bySeverity.qualLow}`;
      lines.push(`| \`${items.shortLabel(it.itemId)}\` | ${it.itemType} | ${it.role} | ${it.runs} | ${it.totalFindings} | ${it.findingRate} | ${cat} | ${sev} |`);
    }
  }
  return lines.join("\n");
}

function buildReportMarkdown(
  opts: CliOptions,
  auditOut: string,
  review: Review,
  scores: ReviewScore,
  verdict: BreakerVerdict,
  attribution: AttributionReport,
  runs: readonly SceneRunLog[],
): string {
  const items = buildItemLookup();
  const byCat = new Map<string, typeof review.findings>();
  for (const f of review.findings) {
    const list = byCat.get(f.category) ?? [];
    list.push(f);
    byCat.set(f.category, list);
  }
  const sevRank = { high: 0, medium: 1, low: 2 } as const;
  for (const list of byCat.values()) {
    list.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);
  }
  const cats = ["architecture", "prompt", "data", "llm-quality"] as const;
  const sections = cats
    .map((c) => {
      const list = byCat.get(c) ?? [];
      if (list.length === 0) return `### ${c} (0)\n\n_no findings_\n`;
      const lines = list.map((f) => findingLineWithLink(f, items));
      return `### ${c} (${list.length})\n\n${lines.join("\n")}\n`;
    })
    .join("\n");

  // Embed transcripts for every run referenced by at least one finding.
  const flaggedRunIds = new Set(review.findings.map((f) => f.run_id));
  const transcripts = runs
    .filter((r) => flaggedRunIds.has(r.id))
    .map((r) => renderTranscriptMarkdown(r, items))
    .join("\n\n---\n\n");
  const scoreLines = scores.perRun
    .map(
      (r) =>
        `- ${r.runId}: **${r.score}** (missing=${r.signals.missingTurns}, leakage=${r.signals.activeLeakage}, passive_miss=${r.signals.passiveMisses}, qual H/M/L=${r.signals.qualHigh}/${r.signals.qualMedium}/${r.signals.qualLow})`,
    )
    .join("\n");
  const breakerSection = verdict.baselineAvg === null
    ? `_no baseline yet — this run will seed the history._`
    : `- Baseline avg (last ${HISTORY_LIMIT} runs): **${verdict.baselineAvg}**
- Delta vs baseline: **${verdict.delta! >= 0 ? "+" : ""}${verdict.delta}**
- Regression: ${verdict.isRegression ? "YES" : "no"} (consecutive: ${verdict.consecutiveRegressions}/${REGRESSION_STREAK_LIMIT})
- Halt threshold: ${verdict.shouldHalt ? "**TRIGGERED**" : "not reached"}`;
  const counts = { high: 0, medium: 0, low: 0 };
  for (const f of review.findings) counts[f.severity]++;
  return `# Review report

- **Scenes:** ${opts.scenes}
- **Level:** ${opts.level ?? "(unchanged)"}
- **Generated:** ${new Date().toISOString()}
- **Findings:** ${review.findings.length} qualitative (${counts.high} high / ${counts.medium} medium / ${counts.low} low)

${HOW_TO_READ}

---

## Score

**${scores.avg} / 100** (avg across ${scores.perRun.length} runs)

Per-run breakdown — \`missing\` = scripted AI turns that never fired, \`leakage\` = AI said the active target (it shouldn't), \`passive_miss\` = passive items that never appeared in AI speech, \`qual H/M/L\` = qualitative findings by severity.

${scoreLines}

---

## Action items

${buildActionItems(review, attribution, items)}

---

## Circuit breaker

The loop halts if the score drops more than ${REGRESSION_DELTA} points below baseline for ${REGRESSION_STREAK_LIMIT} sessions in a row.

${breakerSection}

---

## Overall summary

${review.summary}

---

## Qualitative findings (${review.findings.length})

LLM-reviewer findings, grouped by category and sorted by severity (high first). Each line carries the \`run-XXXX\` id — pass that to \`npm run render-log -- --id <run-id>\` to see the dialogue.

${sections}

---

## Attribution

Ranks templates and items by **finding rate** (findings per run). High rates mean a template/item is repeatedly causing problems and is a good target for content fixes.

The breakdown columns mean: \`arch/prompt/data/llm\` = qualitative finding category counts, \`warn/fail/H/M/L\` = audit warns/fails plus qualitative high/medium/low.

${renderAttributionMarkdown(attribution, 10, items)}

---

## Auto-detected (deterministic audit)

Mechanical issues caught by code (no LLM involved): missing scripted turns, active-target leakage, passive items that never appeared, missing scoring penalties, and so on.

\`\`\`
${auditOut.trim()}
\`\`\`

---

## Scene transcripts

Embedded dialogue for every run that had at least one finding. Each \`(run-XXXX)\` link in the Action items / Qualitative findings sections jumps here.

${transcripts || "_no flagged runs in this session_"}
`;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.noRerun) {
    console.log(
      `[review-loop] --no-rerun: skipping seed + scene generation, re-reviewing the last ${opts.scenes} runs in logs/scene-runs.jsonl`,
    );
  } else {
    if (opts.level) {
      console.log(`[review-loop] reseeding at level ${opts.level}…`);
      const seed = runNpm(["scene", "--", `--level`, opts.level]);
      if (seed.status !== 0) {
        console.error(seed.stdout);
        throw new Error("reseed failed");
      }
    }

    console.log(`[review-loop] running ${opts.scenes} scenes…`);
    for (let i = 1; i <= opts.scenes; i++) {
      const r = runNpm(["scene"]);
      const ok = r.status === 0;
      const tail = r.stdout.split("\n").slice(-3).join(" ").slice(0, 120);
      console.log(`  [${i}/${opts.scenes}] ${ok ? "ok" : "FAIL"}  ${tail}`);
    }
  }

  console.log(`[review-loop] running deterministic audit…`);
  const audit = runNpm(["audit-logs", "--", `--last=${opts.scenes}`]);
  const auditOut = audit.stdout.split("\n").filter((l) => !l.startsWith(">")).join("\n");

  // Read the same audit programmatically so we have structured signals to score.
  const allLogs = readAllSceneRunLogs();
  const lastN = allLogs.slice(-opts.scenes);
  const auditReport = auditSceneRunLogs(lastN as unknown[]);
  const lastNRunIds = auditReport.results.map((r) => r.id);

  console.log(`[review-loop] generating review packet…`);
  const packet = runNpm(["audit-logs", "--", `--last=${opts.scenes}`, "--review-prompt"]);
  const packetMd = packet.stdout.split("\n").filter((l) => !l.startsWith(">")).join("\n");

  if (packetMd.trim().length < 50) {
    throw new Error(`review packet looks empty: ${packetMd.slice(0, 200)}`);
  }

  console.log(`[review-loop] sending to local 'claude -p' (no API key, uses your CLI session)…`);
  const fullPrompt = `${REVIEW_SYSTEM}\n\n---\n\nPacket follows:\n\n${packetMd}\n\n---\n\nReturn ONLY the JSON object described above. No prose, no code fences.`;
  const result = spawnSync("claude", ["-p"], {
    input: fullPrompt,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`claude -p failed (status ${result.status}):\n${result.stderr}`);
  }
  const raw = result.stdout.trim();
  // Extract first JSON object — claude -p sometimes adds preamble even when asked not to.
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`No JSON object found in claude output. First 400 chars:\n${raw.slice(0, 400)}`);
  }
  let review: Review;
  try {
    review = ReviewSchema.parse(JSON.parse(match[0]));
  } catch (err) {
    throw new Error(
      `Could not parse claude response as ReviewSchema. First 400 chars:\n${match[0].slice(0, 400)}`,
    );
  }

  const scores = scoreRuns(auditReport, review.findings as QualitativeFinding[], lastNRunIds);
  const baseline = loadBaseline();
  const verdict = checkBreaker(scores.avg, baseline, opts.level);
  saveBaseline(baseline);

  const attribution = attributeFindings(
    lastN,
    auditReport,
    review.findings as QualitativeFinding[],
  );
  const md = buildReportMarkdown(opts, auditOut, review, scores, verdict, attribution, lastN);
  writeFileSync(opts.reportPath, md);
  // Sidecar JSON snapshot — feeds the trends CLI without re-parsing markdown.
  if (opts.reportPath.endsWith(".md")) {
    const snapshot: ReviewSnapshot = {
      timestamp: new Date().toISOString(),
      scenes: opts.scenes,
      level: opts.level,
      avgScore: scores.avg,
      qualitativeFindingCount: review.findings.length,
      attribution,
    };
    const sidecarPath = opts.reportPath.replace(/\.md$/, ".json");
    writeFileSync(sidecarPath, JSON.stringify(snapshot, null, 2) + "\n");
  }
  // If the report ended up in our default reports directory, also refresh
  // the "latest.md" symlink so you can always cat logs/review-reports/latest.md.
  if (opts.reportPath.startsWith(REPORTS_DIR)) {
    if (existsSync(LATEST_LINK)) {
      try {
        unlinkSync(LATEST_LINK);
      } catch {
        // ignore — race with concurrent runs is unlikely here
      }
    }
    try {
      const target = relative(REPORTS_DIR, opts.reportPath);
      symlinkSync(target, LATEST_LINK);
    } catch {
      // symlinks may fail on some filesystems; the timestamped report is still there.
    }
  }
  console.log(`\n[review-loop] report written to ${opts.reportPath}`);
  if (opts.reportPath.startsWith(REPORTS_DIR)) {
    console.log(`[review-loop] symlink: logs/review-reports/latest.md`);
  }
  console.log(`\nscore: ${scores.avg}/100 across ${scores.perRun.length} runs`);
  if (verdict.baselineAvg !== null) {
    const sign = verdict.delta! >= 0 ? "+" : "";
    console.log(
      `baseline: ${verdict.baselineAvg} (delta ${sign}${verdict.delta}, regressions ${verdict.consecutiveRegressions}/${REGRESSION_STREAK_LIMIT})`,
    );
  } else {
    console.log(`baseline: (none yet — seeding)`);
  }
  console.log(`findings: ${review.findings.length}`);
  const counts = { high: 0, medium: 0, low: 0 };
  for (const f of review.findings) counts[f.severity]++;
  console.log(`  high: ${counts.high}, medium: ${counts.medium}, low: ${counts.low}`);

  if (verdict.shouldHalt) {
    console.error(
      `\n[circuit breaker] HALTED: ${REGRESSION_STREAK_LIMIT} consecutive regressions of >${REGRESSION_DELTA} points below baseline.`,
    );
    if (opts.strict) process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
