import { useState } from "react";
import { TtsClip } from "../audio/TtsClip";
import type { EpisodeItem } from "./episodeData";
import { GlossToken } from "./GlossToken";
import { segmentLine } from "./glossSegments";

interface NpcTurnProps {
  turn: number;
  speaker: string;
  text: string;
  passiveItems: EpisodeItem[];
  // Drives the pinned TTS src /tts/day<N>-turn<M>.m4a.
  day: number;
  // True when this turn just revealed after a player submission (autoplay).
  autoOnReveal?: boolean;
}

function speakerLabel(speaker: string): string {
  return speaker.replace(/_/g, " ");
}

// One NPC dialogue card: passive items' surface forms become gloss tokens;
// tapped glosses (furigana + English) collect in a tray under the line so the
// sentence text itself stays untouched.
export function NpcTurn({ turn, speaker, text, passiveItems, day, autoOnReveal = false }: NpcTurnProps) {
  const [openItemIds, setOpenItemIds] = useState<readonly string[]>([]);
  const segments = segmentLine(text, passiveItems);
  const openItems = passiveItems.filter((item) => openItemIds.includes(item.itemId));

  const toggleGloss = (itemId: string) => {
    setOpenItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
    );
  };

  return (
    <li
      data-role="npc"
      data-turn={turn}
      className="turn-enter mr-4 rounded-md border border-washi-deep bg-shoji px-5 py-4 shadow-[var(--shadow-card)] sm:mr-14"
    >
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="text-xs font-medium tracking-[0.14em] uppercase text-ink-soft">
          {speakerLabel(speaker)}
        </p>
        <TtsClip
          src={`/tts/day${day}-turn${turn}.m4a`}
          label={`${speakerLabel(speaker)}'s line`}
          autoOnReveal={autoOnReveal}
        />
      </div>
      <p lang="ja" className="text-lg leading-loose break-words">
        {segments.map((segment, index) =>
          segment.item ? (
            <GlossToken
              key={index}
              item={segment.item}
              open={openItemIds.includes(segment.item.itemId)}
              onToggle={toggleGloss}
            />
          ) : (
            <span key={index}>{segment.text}</span>
          ),
        )}
      </p>
      {openItems.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {openItems.map((item) => (
            <li
              key={item.itemId}
              className="rounded-xs border-l-2 border-kaki bg-washi px-3 py-1.5 text-sm"
            >
              <span lang="ja" className="font-medium">
                {item.surface}
              </span>
              {item.reading !== null && (
                <span lang="ja" className="ml-2 text-ink-soft">
                  {item.reading}
                </span>
              )}
              <span className="ml-2 text-ink-soft">— {item.meaning}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
