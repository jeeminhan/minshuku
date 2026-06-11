import type { EpisodeItem } from "./episodeData";

// One run of NPC line text: either plain prose or an occurrence of a passive
// item's surface form (which the UI wraps in a tappable gloss token). The
// concatenation of segment texts is always exactly the original line —
// wrapping must never alter the visible sentence.
export interface GlossSegment {
  text: string;
  item: EpisodeItem | null;
}

export function segmentLine(text: string, items: EpisodeItem[]): GlossSegment[] {
  const segments: GlossSegment[] = [];
  let rest = text;
  while (rest.length > 0) {
    let matchIndex = -1;
    let matchItem: EpisodeItem | null = null;
    for (const item of items) {
      if (item.surface.length === 0) continue;
      const index = rest.indexOf(item.surface);
      if (index === -1) continue;
      const earlier = matchIndex === -1 || index < matchIndex;
      // Tie-break overlapping surfaces at the same position toward the longer one.
      const longerAtSameSpot =
        index === matchIndex && item.surface.length > (matchItem?.surface.length ?? 0);
      if (earlier || longerAtSameSpot) {
        matchIndex = index;
        matchItem = item;
      }
    }
    if (matchIndex === -1 || matchItem === null) {
      segments.push({ text: rest, item: null });
      break;
    }
    if (matchIndex > 0) {
      segments.push({ text: rest.slice(0, matchIndex), item: null });
    }
    segments.push({ text: matchItem.surface, item: matchItem });
    rest = rest.slice(matchIndex + matchItem.surface.length);
  }
  return segments;
}
