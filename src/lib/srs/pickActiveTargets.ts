import type { ReviewItem, ItemAssignment } from "../types";

// Pick 1-2 active targets from due items.
// Hard rule from spec §5: never more than 2 active targets per scene.
// Heuristic: prefer 1 grammar (the lesson focus), optionally 1 vocab.
export function pickActiveTargets(due: ReviewItem[]): ItemAssignment[] {
  if (due.length === 0) return [];

  const grammar = due.filter((i) => i.itemType === "grammar");
  const vocab = due.filter((i) => i.itemType === "vocab");

  const targets: ItemAssignment[] = [];

  if (grammar.length > 0) {
    targets.push({
      itemId: grammar[0].itemId,
      itemType: "grammar",
      mode: "active",
    });
  }

  // Add an active vocab target only if there's at least one vocab and we don't yet have 2.
  if (vocab.length > 0 && targets.length < 2) {
    targets.push({
      itemId: vocab[0].itemId,
      itemType: "vocab",
      mode: "active",
    });
  }

  // If no grammar was available, the lone vocab is the active target.
  if (targets.length === 0 && vocab.length > 0) {
    targets.push({
      itemId: vocab[0].itemId,
      itemType: "vocab",
      mode: "active",
    });
  }

  return targets;
}
