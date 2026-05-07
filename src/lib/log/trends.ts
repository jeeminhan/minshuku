// Pure trend analysis over a series of review-loop snapshots.
// Each snapshot represents one review-loop run (N scenes). Sorted
// chronologically, the trends module surfaces score movement and
// per-template/per-item rate movement so you can see whether a fix
// actually moved the needle.

import type { AttributionReport, ItemAttribution, TemplateAttribution } from "./attribution.js";

// Persisted alongside each review-loop run as `report-{ts}.json`.
// Keep the schema small and stable: future fields go at the bottom
// with optional types so old snapshots stay readable.
export interface ReviewSnapshot {
  timestamp: string;       // ISO 8601
  scenes: number;
  level?: string;
  avgScore: number;
  qualitativeFindingCount: number;
  attribution: AttributionReport;
}

export type TrendDirection = "improving" | "regressing" | "stable" | "new";

export interface ScorePoint {
  timestamp: string;
  avgScore: number;
}

export interface ScoreTrend {
  series: ScorePoint[];
  // Compares the last `windowLength` scores: positive delta = improving.
  delta: number;
  direction: TrendDirection;
}

export interface EntityTrendPoint {
  timestamp: string;
  rate: number;
  totalFindings: number;
  runs: number;
}

export interface TemplateTrend {
  templateId: string;
  series: EntityTrendPoint[];
  currentRate: number;
  delta: number;        // currentRate - earliestRateInWindow
  direction: TrendDirection;
}

export interface ItemTrend {
  itemId: string;
  series: EntityTrendPoint[];
  currentRate: number;
  delta: number;
  direction: TrendDirection;
}

export interface TrendReport {
  windowLength: number;
  score: ScoreTrend;
  templates: TemplateTrend[];
  items: ItemTrend[];
}

// Treat a delta below this magnitude as "stable" — review-loop scoring
// has run-to-run variance; smaller swings aren't signal.
const STABLE_EPSILON_RATE = 0.2;
const STABLE_EPSILON_SCORE = 2;

function classify(delta: number, hasHistory: boolean, epsilon: number, scoreLike: boolean): TrendDirection {
  if (!hasHistory) return "new";
  if (Math.abs(delta) < epsilon) return "stable";
  // For score, positive delta = improving. For rate, positive delta = regressing.
  if (scoreLike) return delta > 0 ? "improving" : "regressing";
  return delta > 0 ? "regressing" : "improving";
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeTrends(
  snapshotsIn: readonly ReviewSnapshot[],
  windowLength = 5,
): TrendReport {
  const snapshots = [...snapshotsIn].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const window = snapshots.slice(-windowLength);

  // ---- score ----
  const scoreSeries: ScorePoint[] = window.map((s) => ({ timestamp: s.timestamp, avgScore: s.avgScore }));
  const scoreDelta =
    scoreSeries.length < 2 ? 0 : round1(scoreSeries[scoreSeries.length - 1].avgScore - scoreSeries[0].avgScore);
  const scoreTrend: ScoreTrend = {
    series: scoreSeries,
    delta: scoreDelta,
    direction: classify(scoreDelta, scoreSeries.length >= 2, STABLE_EPSILON_SCORE, true),
  };

  // ---- per-template + per-item series ----
  const tplSeriesById = new Map<string, EntityTrendPoint[]>();
  const itemSeriesById = new Map<string, EntityTrendPoint[]>();

  for (const snap of window) {
    pushSeries(tplSeriesById, snap, snap.attribution.templates, (t: TemplateAttribution) => t.templateId);
    pushSeries(itemSeriesById, snap, snap.attribution.items, (i: ItemAttribution) => i.itemId);
  }

  const templates: TemplateTrend[] = Array.from(tplSeriesById.entries()).map(([templateId, series]) => {
    const currentRate = series[series.length - 1].rate;
    const delta = series.length < 2 ? 0 : round1(currentRate - series[0].rate);
    return {
      templateId,
      series,
      currentRate,
      delta,
      direction: classify(delta, series.length >= 2, STABLE_EPSILON_RATE, false),
    };
  });

  const items: ItemTrend[] = Array.from(itemSeriesById.entries()).map(([itemId, series]) => {
    const currentRate = series[series.length - 1].rate;
    const delta = series.length < 2 ? 0 : round1(currentRate - series[0].rate);
    return {
      itemId,
      series,
      currentRate,
      delta,
      direction: classify(delta, series.length >= 2, STABLE_EPSILON_RATE, false),
    };
  });

  // Sort: regressing first (worst delta), then by current rate, then alphabetically.
  const dirRank: Record<TrendDirection, number> = { regressing: 0, new: 1, stable: 2, improving: 3 };
  const sortFn = <T extends { direction: TrendDirection; delta: number; currentRate: number }>(
    a: T,
    b: T,
    name: (x: T) => string,
  ) =>
    dirRank[a.direction] - dirRank[b.direction] ||
    b.delta - a.delta ||
    b.currentRate - a.currentRate ||
    name(a).localeCompare(name(b));
  templates.sort((a, b) => sortFn(a, b, (x) => x.templateId));
  items.sort((a, b) => sortFn(a, b, (x) => x.itemId));

  return { windowLength, score: scoreTrend, templates, items };
}

function pushSeries<T>(
  map: Map<string, EntityTrendPoint[]>,
  snap: ReviewSnapshot,
  entities: readonly T[],
  idOf: (e: T) => string,
): void {
  // For each known entity in this snapshot, append a point. Entities
  // that aren't in this snapshot get no point — gaps mean "wasn't
  // selected this session", not "fixed".
  for (const e of entities) {
    const id = idOf(e);
    const list = map.get(id) ?? [];
    const ent = e as unknown as { runs: number; totalFindings: number; findingRate: number };
    list.push({
      timestamp: snap.timestamp,
      rate: ent.findingRate,
      totalFindings: ent.totalFindings,
      runs: ent.runs,
    });
    map.set(id, list);
  }
}
