import type { EpisodeItem } from "./episodeData";

interface GlossTokenProps {
  item: EpisodeItem;
  open: boolean;
  onToggle: (itemId: string) => void;
}

// A passive item's surface form inside an NPC line, wrapped in a tappable,
// keyboard-focusable button. Only the surface text lives inside the sentence;
// the revealed reading + gloss render in the NpcTurn tray below the line, so
// wrapping never alters the visible sentence text.
export function GlossToken({ item, open, onToggle }: GlossTokenProps) {
  return (
    <button
      type="button"
      lang="ja"
      data-token-item={item.itemId}
      aria-pressed={open}
      onClick={() => onToggle(item.itemId)}
      className="inline cursor-pointer rounded-xs px-0.5 text-kaki-deep underline decoration-kaki decoration-dotted decoration-2 underline-offset-4 transition-colors hover:bg-kaki-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kaki"
    >
      {item.surface}
    </button>
  );
}
