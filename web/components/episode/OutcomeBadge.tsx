import type { EpisodeItem, Outcome, TurnEvaluatorResult } from "./episodeData";

// The full outcome ladder gets a distinct visual state even though day 1 only
// exercises produced/missed — the enum comes from src/lib/types.ts.
const OUTCOME_STYLES: Record<Outcome, string> = {
  missed: "border-rust/40 bg-rust-wash text-rust",
  recognized: "border-ink-soft/40 bg-sand-wash text-ink-soft",
  produced_with_help: "border-aizome/35 bg-seiji-wash text-aizome",
  produced: "border-moss/50 bg-moss-wash text-moss",
  mastered: "border-gold/50 bg-gold-wash text-gold",
};

const OUTCOME_LABELS: Record<Outcome, string> = {
  missed: "missed",
  recognized: "recognized",
  produced_with_help: "produced with help",
  produced: "produced",
  mastered: "mastered",
};

interface OutcomeBadgeProps {
  result: TurnEvaluatorResult;
  item: EpisodeItem | undefined;
}

export function OutcomeBadge({ result, item }: OutcomeBadgeProps) {
  return (
    <li
      data-outcome={result.outcome}
      className={`inline-flex items-baseline gap-1.5 rounded-full border px-2.5 py-0.5 text-sm ${OUTCOME_STYLES[result.outcome]}`}
    >
      <span lang="ja" className="font-medium">
        {item?.surface ?? result.itemId}
      </span>
      <span className="text-xs">{OUTCOME_LABELS[result.outcome]}</span>
    </li>
  );
}
