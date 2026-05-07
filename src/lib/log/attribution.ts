// Pure attribution of review findings to templates and items.
// No I/O. Given run logs, deterministic audit results, and qualitative
// findings, ranks templates and items by finding rate so content-level
// problems become visible across runs.

import type { AuditFinding, AuditReport } from "./auditSceneRunLogs.js";
import type { QualitativeFinding } from "./scoreReview.js";
import type { ItemAssignment, SceneRunLog } from "../types.js";

export type FindingCategory = QualitativeFinding["category"];
export type FindingSeverity = QualitativeFinding["severity"];

// Audit codes whose message names a specific itemId. Anything else is
// treated as template-level (missing turns, scoring rationale, etc.).
const ITEM_LEVEL_CODES = new Set<string>([
  "active_target_in_ai_speech",
  "passive_target_missing_from_ai_speech",
  "active_target_not_evaluated",
]);

export type ItemRole = "active" | "passive";

export interface CategoryBreakdown {
  architecture: number;
  prompt: number;
  data: number;
  "llm-quality": number;
}

export interface SeverityBreakdown {
  // Audit findings have severity warn/fail; qualitative findings have high/medium/low.
  // We surface both axes so the report can reason about either.
  auditWarn: number;
  auditFail: number;
  qualHigh: number;
  qualMedium: number;
  qualLow: number;
}

export interface TemplateAttribution {
  templateId: string;
  runs: number;
  totalFindings: number;
  findingRate: number; // findings per run, rounded to 1 decimal
  byCategory: CategoryBreakdown;
  bySeverity: SeverityBreakdown;
}

export interface ItemAttribution {
  itemId: string;
  itemType: ItemAssignment["itemType"];
  // An item can appear as both active and passive across runs; we track
  // its dominant role. If split, "active" wins (it's the primary signal).
  role: ItemRole;
  runs: number;
  totalFindings: number;
  findingRate: number;
  byCategory: CategoryBreakdown;
  bySeverity: SeverityBreakdown;
}

export interface AttributionReport {
  templates: TemplateAttribution[];
  items: ItemAttribution[];
}

interface MutableBreakdown {
  category: CategoryBreakdown;
  severity: SeverityBreakdown;
  total: number;
}

function emptyBreakdown(): MutableBreakdown {
  return {
    total: 0,
    category: { architecture: 0, prompt: 0, data: 0, "llm-quality": 0 },
    severity: { auditWarn: 0, auditFail: 0, qualHigh: 0, qualMedium: 0, qualLow: 0 },
  };
}

function addAudit(b: MutableBreakdown, finding: AuditFinding): void {
  b.total++;
  if (finding.severity === "warn") b.severity.auditWarn++;
  else if (finding.severity === "fail") b.severity.auditFail++;
}

function addQual(b: MutableBreakdown, finding: QualitativeFinding): void {
  b.total++;
  b.category[finding.category]++;
  if (finding.severity === "high") b.severity.qualHigh++;
  else if (finding.severity === "medium") b.severity.qualMedium++;
  else b.severity.qualLow++;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Given the run's items and an audit finding's message, return the itemIds
// the message mentions. Robust against message-format changes: we just
// scan known itemIds for substring presence.
function itemsMentionedIn(message: string, items: readonly ItemAssignment[]): ItemAssignment[] {
  return items.filter((it) => message.includes(it.itemId));
}

export function attributeFindings(
  logs: readonly SceneRunLog[],
  audit: AuditReport,
  qualitative: readonly QualitativeFinding[],
): AttributionReport {
  const logById = new Map<string, SceneRunLog>();
  for (const log of logs) logById.set(log.id, log);

  const templateBuckets = new Map<string, MutableBreakdown>();
  const templateRuns = new Map<string, Set<string>>();
  const itemBuckets = new Map<string, MutableBreakdown>();
  const itemMeta = new Map<string, { itemType: ItemAssignment["itemType"]; activeRuns: Set<string>; passiveRuns: Set<string> }>();

  // Seed run-coverage from the logs. Findings only inflate counts; runs is
  // independent so a clean run still counts in the denominator.
  for (const log of logs) {
    const tid = log.templateId || log.templateChosen?.id;
    if (tid) {
      if (!templateRuns.has(tid)) templateRuns.set(tid, new Set());
      templateRuns.get(tid)!.add(log.id);
      if (!templateBuckets.has(tid)) templateBuckets.set(tid, emptyBreakdown());
    }
    for (const it of log.activeTargetsChosen ?? []) {
      if (!itemMeta.has(it.itemId)) {
        itemMeta.set(it.itemId, { itemType: it.itemType, activeRuns: new Set(), passiveRuns: new Set() });
      }
      itemMeta.get(it.itemId)!.activeRuns.add(log.id);
      if (!itemBuckets.has(it.itemId)) itemBuckets.set(it.itemId, emptyBreakdown());
    }
    for (const it of log.passiveItemsChosen ?? []) {
      if (!itemMeta.has(it.itemId)) {
        itemMeta.set(it.itemId, { itemType: it.itemType, activeRuns: new Set(), passiveRuns: new Set() });
      }
      itemMeta.get(it.itemId)!.passiveRuns.add(log.id);
      if (!itemBuckets.has(it.itemId)) itemBuckets.set(it.itemId, emptyBreakdown());
    }
  }

  // Deterministic audit findings.
  for (const result of audit.results) {
    const log = logById.get(result.id);
    if (!log) continue;
    const tid = log.templateId || log.templateChosen?.id;
    const allItems = [...(log.activeTargetsChosen ?? []), ...(log.passiveItemsChosen ?? [])];

    for (const finding of result.findings) {
      const isItemLevel = ITEM_LEVEL_CODES.has(finding.code);
      const mentioned = isItemLevel ? itemsMentionedIn(finding.message, allItems) : [];

      if (mentioned.length > 0) {
        for (const it of mentioned) {
          const bucket = itemBuckets.get(it.itemId) ?? emptyBreakdown();
          addAudit(bucket, finding);
          itemBuckets.set(it.itemId, bucket);
        }
      } else if (tid) {
        // Template-level finding (or item-level we couldn't resolve).
        const bucket = templateBuckets.get(tid) ?? emptyBreakdown();
        addAudit(bucket, finding);
        templateBuckets.set(tid, bucket);
      }
    }
  }

  // Qualitative findings only carry run_id. Attribute to the run's
  // template and to every active item — that's where prompt/data
  // concerns most plausibly originate. Passive items are background
  // and not held responsible for register/coherence issues.
  for (const f of qualitative) {
    const log = logById.get(f.run_id);
    if (!log) continue;
    const tid = log.templateId || log.templateChosen?.id;
    if (tid) {
      const bucket = templateBuckets.get(tid) ?? emptyBreakdown();
      addQual(bucket, f);
      templateBuckets.set(tid, bucket);
    }
    for (const it of log.activeTargetsChosen ?? []) {
      const bucket = itemBuckets.get(it.itemId) ?? emptyBreakdown();
      addQual(bucket, f);
      itemBuckets.set(it.itemId, bucket);
    }
  }

  const templates: TemplateAttribution[] = Array.from(templateBuckets.entries()).map(([tid, b]) => {
    const runs = templateRuns.get(tid)?.size ?? 0;
    return {
      templateId: tid,
      runs,
      totalFindings: b.total,
      findingRate: runs === 0 ? 0 : round1(b.total / runs),
      byCategory: b.category,
      bySeverity: b.severity,
    };
  });

  const items: ItemAttribution[] = Array.from(itemBuckets.entries()).map(([itemId, b]) => {
    const meta = itemMeta.get(itemId)!;
    const activeCount = meta.activeRuns.size;
    const passiveCount = meta.passiveRuns.size;
    const role: ItemRole = activeCount >= passiveCount ? "active" : "passive";
    const runs = activeCount + passiveCount;
    return {
      itemId,
      itemType: meta.itemType,
      role,
      runs,
      totalFindings: b.total,
      findingRate: runs === 0 ? 0 : round1(b.total / runs),
      byCategory: b.category,
      bySeverity: b.severity,
    };
  });

  // Sort: highest finding rate first, ties broken by total findings,
  // then alphabetically for stability.
  const sortFn = <T extends { findingRate: number; totalFindings: number; }>(a: T, b: T, name: (x: T) => string) =>
    b.findingRate - a.findingRate || b.totalFindings - a.totalFindings || name(a).localeCompare(name(b));
  templates.sort((a, b) => sortFn(a, b, (x) => x.templateId));
  items.sort((a, b) => sortFn(a, b, (x) => x.itemId));

  return { templates, items };
}
