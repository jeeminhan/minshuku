"use client";

import { useCallback, useEffect, useState } from "react";
import { SoundProvider } from "../audio/SoundProvider";
import { SoundToggle } from "../audio/SoundToggle";
import type { StoryBeat } from "@web/lib/demo/storyline";
import type { TourDay } from "@web/lib/demo/storyTour";
import { TourBeatCard } from "./TourBeatCard";
import { TourProgress } from "./TourProgress";

interface StoryTourViewProps {
  beats: readonly StoryBeat[];
  // The derived per-day data, in day order (days 1–4).
  days: TourDay[];
  // Image-slot basenames whose real .webp exists on disk (server-detected) —
  // only these mount an <img>; every other slot shows its washi placeholder
  // alone, so an empty public/story/ fires zero image 404s.
  presentImageSlots: string[];
}

// The client tour island: one beat visible at a time, Next/Back + arrow-key
// navigation, the six-step progress indicator, and the global sound toggle.
// Wraps everything in the existing SoundProvider so beat-4's Mom TTS is
// gesture-gated and respects the global mute exactly as the play view does.
export function StoryTourView({ beats, days, presentImageSlots }: StoryTourViewProps) {
  return (
    <SoundProvider>
      <TourBody beats={beats} days={days} presentImageSlots={presentImageSlots} />
    </SoundProvider>
  );
}

function TourBody({ beats, days, presentImageSlots }: StoryTourViewProps) {
  const [index, setIndex] = useState(0);
  const last = beats.length - 1;

  const goNext = useCallback(() => {
    setIndex((prev) => Math.min(prev + 1, last));
  }, [last]);

  const goBack = useCallback(() => {
    setIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const jump = useCallback(
    (target: number) => {
      setIndex(Math.max(0, Math.min(target, last)));
    },
    [last],
  );

  // Arrow-key navigation on the document — ignored when focus is in a text
  // field (none exist on the tour, but guard anyway so a presenter typing
  // somewhere never loses a keystroke).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goBack();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [goNext, goBack]);

  const beat = beats[index];
  const day = beat.day !== null ? (days.find((d) => d.day === beat.day) ?? null) : null;
  const atStart = index === 0;
  const atEnd = index === last;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[820px] flex-col px-5 pt-8 pb-28 sm:pt-12">
      <header className="flex items-center justify-between gap-3 border-b border-washi-deep pb-5">
        <p className="text-sm font-medium tracking-[0.28em] text-kaki">
          <span lang="ja">民宿</span> THE STORY TOUR
        </p>
        <SoundToggle />
      </header>

      <div className="mt-5">
        <TourProgress beats={beats} current={index} onJump={jump} />
      </div>

      <main className="mt-8 flex-1">
        <TourBeatCard
          key={beat.id}
          beat={beat}
          day={day}
          hasImage={presentImageSlots.includes(beat.imageSlot)}
        />
      </main>

      <nav
        aria-label="Tour navigation"
        className="mt-10 flex items-center justify-between gap-3 border-t border-washi-deep pt-5"
      >
        <button
          type="button"
          data-testid="tour-back"
          onClick={goBack}
          disabled={atStart}
          className="inline-flex items-center gap-1.5 rounded-full border border-washi-deep bg-shoji px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-kaki/50 hover:text-kaki focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kaki/60 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-washi-deep disabled:hover:text-ink-soft"
        >
          <span aria-hidden>←</span> Back
        </button>
        <p className="text-xs tracking-[0.1em] text-ink-soft uppercase">
          {index + 1} / {beats.length}
        </p>
        <button
          type="button"
          data-testid="tour-next"
          onClick={goNext}
          disabled={atEnd}
          className="inline-flex items-center gap-1.5 rounded-full border border-kaki bg-kaki-wash px-4 py-2 text-sm font-medium text-kaki-deep transition-colors hover:bg-kaki hover:text-shoji focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kaki/60 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-kaki-wash disabled:hover:text-kaki-deep"
        >
          Next <span aria-hidden>→</span>
        </button>
      </nav>
    </div>
  );
}
