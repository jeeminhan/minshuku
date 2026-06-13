import { segmentLine } from "../episode/glossSegments";
import type { DialogueTurn, EpisodeItem } from "../episode/episodeData";
import type { HighlightTarget } from "@web/lib/demo/storyline";

interface TourDialogueProps {
  turns: DialogueTurn[];
  // The day's real derived items (actives + passives) — highlight targets are
  // resolved against these so a highlight can only anchor to an actual item.
  items: EpisodeItem[];
  // Authored surfaces to highlight for this beat.
  highlights: HighlightTarget[];
}

function speakerLabel(speaker: string): string {
  return speaker.replace(/_/g, " ");
}

// Read-only narration of a day's dialogue with the beat's due target words
// highlighted. Highlighting reuses the play view's segmentLine (NOT a new
// tokenizer): segmentLine is called with the subset of the day's real items
// whose ids match the beat's authored highlight targets, and each match is
// wrapped in a marked <mark data-tour-highlight data-item-id>. The due words
// surface across BOTH speakers in this engine — the learner produces the active
// targets (つもり/窓/雨/不思議/てもいい land in the player's lines), the NPC speaks
// the passives (持つ in Mom's line) — so highlighting runs over every turn; the
// concatenation of segment texts is always exactly the original line, so the
// visible sentence is never altered.
export function TourDialogue({ turns, items, highlights }: TourDialogueProps) {
  // Anchor the authored surfaces to real episode items by id (a highlight that
  // names an item the day didn't actually use is simply dropped — never a free
  // string match).
  const itemById = new Map(items.map((item) => [item.itemId, item]));
  const targetItems: EpisodeItem[] = highlights
    .map((target) => itemById.get(target.itemId))
    .filter((item): item is EpisodeItem => item !== undefined);

  const ordered = [...turns].sort((a, b) => a.turn - b.turn);

  const renderLine = (text: string) =>
    segmentLine(text, targetItems).map((segment, index) =>
      segment.item ? (
        <mark
          key={index}
          data-tour-highlight
          data-item-id={segment.item.itemId}
          className="rounded-xs bg-kaki-wash px-0.5 font-medium text-kaki-deep underline decoration-kaki decoration-2 underline-offset-4"
        >
          {segment.text}
        </mark>
      ) : (
        <span key={index}>{segment.text}</span>
      ),
    );

  return (
    <ol className="flex flex-col gap-3">
      {ordered.map((turn) =>
        turn.speaker === "player" ? (
          <li
            key={turn.turn}
            data-role="player"
            data-turn={turn.turn}
            className="ml-4 rounded-md border border-aizome-wash bg-aizome-wash/50 px-4 py-3 text-right sm:ml-14"
          >
            <p className="text-[0.68rem] font-medium tracking-[0.14em] text-ink-soft uppercase">
              you
            </p>
            <p lang="ja" className="mt-1 text-base leading-relaxed break-words text-ink">
              {renderLine(turn.text)}
            </p>
          </li>
        ) : (
          <li
            key={turn.turn}
            data-role="npc"
            data-turn={turn.turn}
            className="mr-4 rounded-md border border-washi-deep bg-shoji px-4 py-3 shadow-[var(--shadow-card)] sm:mr-14"
          >
            <p className="text-[0.68rem] font-medium tracking-[0.14em] text-ink-soft uppercase">
              {speakerLabel(turn.speaker)}
            </p>
            <p lang="ja" className="mt-1 text-lg leading-loose break-words">
              {renderLine(turn.text)}
            </p>
          </li>
        ),
      )}
    </ol>
  );
}
