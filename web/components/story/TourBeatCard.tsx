"use client";

import { TtsClip } from "../audio/TtsClip";
import type { CompleteResponse } from "../episode/episodeData";
import { KNOWLEDGE_LADDER } from "@web/lib/demo/storyline";
import type { StoryBeat } from "@web/lib/demo/storyline";
import type { TourDay } from "@web/lib/demo/storyTour";
import { SceneImage } from "./SceneImage";
import { TourDialogue } from "./TourDialogue";

interface TourBeatCardProps {
  beat: StoryBeat;
  // The derived day data for a `day` beat; null for intro/outro.
  day: TourDay | null;
  // Whether a real .webp exists for this beat's slot (server-detected) — when
  // false the SceneImage shows its placeholder alone and mounts no <img>.
  hasImage: boolean;
}

// One visible chapter card: scene image slot, narrative copy, the day's
// highlighted dialogue, the under-the-hood callout, and the knowledge delta.
// Beat 4 plays Mom's voiced line; beat 5 renders the knowledge ladder.
export function TourBeatCard({ beat, day, hasImage }: TourBeatCardProps) {
  return (
    <article
      data-testid="tour-beat"
      data-beat={beat.id}
      className="turn-enter flex w-full flex-col gap-6"
    >
      <header className="flex flex-col gap-1.5">
        {beat.kind === "day" && (
          <p className="text-xs font-medium tracking-[0.2em] text-kaki uppercase">
            Day {beat.day}
          </p>
        )}
        <h2 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
          {beat.title}
          <span lang="ja" className="ml-3 align-middle text-lg font-normal text-ink-soft sm:text-xl">
            {beat.titleJa}
          </span>
        </h2>
      </header>

      <SceneImage slot={beat.imageSlot} caption={beat.imageCaption} hasImage={hasImage} />

      <div className="flex flex-col gap-2.5">
        {beat.narrative.map((line, index) => (
          <p key={index} className="text-base leading-relaxed text-ink sm:text-lg">
            {line}
          </p>
        ))}
      </div>

      {beat.kind === "day" && day !== null && (
        <>
          <section aria-label={`Day ${beat.day} dialogue`} className="flex flex-col gap-3">
            <h3 className="font-display text-xs font-semibold tracking-[0.18em] text-kaki uppercase">
              The scene
            </h3>
            <TourDialogue turns={day.turns} items={day.items} highlights={beat.highlights} />
          </section>

          {/* Beat 4: Mom speaks in her own voice — reuse the contract-008 TtsClip
              (preload="none", gesture-gated, single-active via SoundProvider). */}
          {beat.id === "day-4" && (
            <div
              data-testid="mom-voice"
              className="flex flex-wrap items-center gap-3 rounded-md border border-kaki/30 bg-kaki-wash/60 px-4 py-3"
            >
              <p className="text-sm text-ink">
                <span className="font-medium">Mom’s welcome</span> — hear her line.
              </p>
              <TtsClip src="/tts/day4-turn2.m4a" label="Mom’s welcome at the door" />
            </div>
          )}
        </>
      )}

      {beat.callout.length > 0 && (
        <aside
          data-testid="tour-callout"
          className="rounded-md border-l-2 border-aizome bg-aizome-wash/70 px-5 py-4"
        >
          <p className="font-display text-xs font-semibold tracking-[0.18em] text-aizome uppercase">
            Under the hood
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {beat.callout.map((line, index) => (
              <p key={index} className="text-sm leading-relaxed text-ink">
                {line}
              </p>
            ))}
          </div>
        </aside>
      )}

      {beat.kind === "day" && day !== null && (
        <KnowledgeDelta debrief={day.debrief} day={beat.day ?? day.day} />
      )}

      {beat.kind === "outro" && <KnowledgeLadder />}

      {beat.presenterNote !== null && (
        <p
          data-testid="tour-presenter-note"
          className="border-t border-washi-deep pt-3 text-sm leading-relaxed text-ink-soft italic"
        >
          <span className="mr-1 not-italic">🎙</span>
          {beat.presenterNote}
        </p>
      )}
    </article>
  );
}

interface KnowledgeDeltaProps {
  debrief: CompleteResponse["debrief"];
  day: number;
}

// The day's knowledge change — learned / strengthened / due-tomorrow — rendered
// from the derived debrief (the same data the play view's DebriefPanel shows).
function KnowledgeDelta({ debrief, day }: KnowledgeDeltaProps) {
  return (
    <section
      data-testid="tour-knowledge"
      aria-label={`Day ${day} knowledge change`}
      className="grid gap-3 sm:grid-cols-3"
    >
      <DeltaGroup title="Learned" titleJa="出会った" entries={debrief.learned} empty="—" />
      <DeltaGroup
        title="Strengthened"
        titleJa="強くなった"
        entries={debrief.strengthened}
        empty="—"
      />
      <DeltaGroup
        title="Due tomorrow"
        titleJa="明日"
        entries={debrief.dueTomorrow}
        empty="resting"
      />
    </section>
  );
}

interface DeltaEntry {
  itemId: string;
  surface: string;
  meaning: string;
}

interface DeltaGroupProps {
  title: string;
  titleJa: string;
  entries: DeltaEntry[];
  empty: string;
}

function DeltaGroup({ title, titleJa, entries, empty }: DeltaGroupProps) {
  return (
    <div className="rounded-md border border-washi-deep bg-shoji px-4 py-3 shadow-[var(--shadow-card)]">
      <h4 className="font-display text-[0.7rem] font-semibold tracking-[0.16em] text-kaki uppercase">
        {title}
        <span lang="ja" className="ml-1.5 font-normal tracking-normal normal-case text-ink-soft">
          {titleJa}
        </span>
      </h4>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {entries.map((entry) => (
            <li key={entry.itemId} data-item-id={entry.itemId} className="text-sm">
              <span lang="ja" className="font-display font-medium text-ink">
                {entry.surface}
              </span>
              <span className="ml-1.5 text-ink-soft">{entry.meaning}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// The outro's in-app knowledge ladder (the default render for beat 5 — the
// image slot is optional there per the contract).
function KnowledgeLadder() {
  return (
    <section data-testid="knowledge-ladder" aria-label="Knowledge ladder" className="flex flex-col gap-2">
      <h3 className="font-display text-xs font-semibold tracking-[0.18em] text-kaki uppercase">
        The ladder every word climbs
      </h3>
      <ol className="flex flex-col gap-1.5">
        {KNOWLEDGE_LADDER.map((rung, index) => (
          <li
            key={rung.label}
            className="flex items-baseline gap-3 rounded-md border border-washi-deep bg-shoji px-4 py-2.5 shadow-[var(--shadow-card)]"
            style={{ marginLeft: `${index * 1.1}rem` }}
          >
            <span className="font-display text-sm font-semibold text-kaki-deep">{rung.label}</span>
            <span className="text-sm text-ink-soft">{rung.note}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
