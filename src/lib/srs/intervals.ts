import type { ReviewItem, Outcome } from "../types";

// Outcome → SRS grade mapping (per spec §17 Minimum scoring rubric for v0.1).
type Grade = "Again" | "Hard" | "Good" | "Easy";

function gradeFor(outcome: Outcome): Grade {
  switch (outcome) {
    case "missed":
      return "Again";
    case "recognized":
      return "Good"; // passive recognition → treated as Good in v0
    case "produced_with_help":
      return "Hard";
    case "produced":
      return "Good";
    case "mastered":
      return "Easy";
  }
}

// Simplified SM2-style interval update.
function nextInterval(current: number, ease: number, grade: Grade): number {
  if (grade === "Again") return 0;
  if (current === 0) return grade === "Easy" ? 4 : 1;
  if (grade === "Hard") return Math.max(1, Math.round(current * 1.2));
  if (grade === "Good") return Math.round(current * ease);
  return Math.round(current * ease * 1.3); // Easy
}

function nextEase(current: number, grade: Grade): number {
  if (grade === "Again") return Math.max(1.3, current - 0.2);
  if (grade === "Hard") return Math.max(1.3, current - 0.15);
  if (grade === "Good") return current;
  return current + 0.15; // Easy
}

export function applyOutcome(
  item: ReviewItem,
  outcome: Outcome,
  now: Date,
): ReviewItem {
  const grade = gradeFor(outcome);
  const interval = nextInterval(item.interval, item.ease, grade);
  const ease = nextEase(item.ease, grade);
  const lapses = grade === "Again" ? item.lapses + 1 : item.lapses;
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + interval);
  return {
    ...item,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: next.toISOString(),
    interval,
    ease,
    lapses,
  };
}
