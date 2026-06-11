import type { DialogueTurn, EpisodeItem } from "./episodeData";
import { OutcomeBadge } from "./OutcomeBadge";

interface PlayerTurnProps {
  turn: DialogueTurn;
  typedText: string;
  itemsById: ReadonlyMap<string, EpisodeItem>;
}

// A revealed player turn: what the player actually typed, the episode's
// recorded line (which is what the inline evaluatorResults grade — shown
// alongside to keep the grading honest), and one outcome badge per result.
export function PlayerTurn({ turn, typedText, itemsById }: PlayerTurnProps) {
  return (
    <li
      data-role="player"
      data-turn={turn.turn}
      className="turn-enter ml-4 rounded-md border border-aizome/20 bg-aizome-wash px-5 py-4 shadow-[var(--shadow-card)] sm:ml-14"
    >
      <p className="mb-1.5 text-xs font-medium tracking-[0.14em] uppercase text-aizome">You</p>
      <p lang="ja" className="text-lg leading-loose break-words">
        {typedText}
      </p>
      <div className="mt-3 rounded-xs border-l-2 border-aizome/50 bg-shoji/70 px-3 py-2">
        <p className="text-[0.7rem] font-medium tracking-[0.14em] uppercase text-ink-soft">
          The scene’s line — what gets graded
        </p>
        <p lang="ja" className="mt-0.5 leading-relaxed break-words">
          {turn.text}
        </p>
      </div>
      {turn.evaluatorResults !== undefined && turn.evaluatorResults.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {turn.evaluatorResults.map((result) => (
            <OutcomeBadge key={result.itemId} result={result} item={itemsById.get(result.itemId)} />
          ))}
        </ul>
      )}
    </li>
  );
}
