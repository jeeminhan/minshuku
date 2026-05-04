import type { ReviewItem } from "../types";

interface PickOptions {
  maxItems?: number;
}

export function pickDueItems(
  items: ReviewItem[],
  now: Date,
  opts: PickOptions = {},
): ReviewItem[] {
  const nowMs = now.getTime();

  const due = items.filter((it) => {
    if (it.nextReviewAt === null) return true;
    return new Date(it.nextReviewAt).getTime() <= nowMs;
  });

  const scored = due
    .map((it) => {
      const overdueMs = it.nextReviewAt
        ? nowMs - new Date(it.nextReviewAt).getTime()
        : nowMs; // never-reviewed items rank high
      return { item: it, overdueMs };
    })
    .sort((a, b) => {
      if (b.overdueMs !== a.overdueMs) return b.overdueMs - a.overdueMs;
      return b.item.lapses - a.item.lapses;
    });

  const limited = opts.maxItems !== undefined ? scored.slice(0, opts.maxItems) : scored;
  return limited.map((s) => s.item);
}
