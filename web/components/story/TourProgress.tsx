"use client";

import type { StoryBeat } from "@web/lib/demo/storyline";

interface TourProgressProps {
  beats: readonly StoryBeat[];
  current: number;
  onJump: (index: number) => void;
}

// The seven-step progress indicator: Intro · Day 1 · Day 2 · Day 3 · Day 4 ·
// Built · Outro. Exactly one pip is the current step (aria-current="step" +
// data-active="true"). Pips are buttons, so a presenter can jump directly;
// Next/Back move the active marker too.
export function TourProgress({ beats, current, onJump }: TourProgressProps) {
  return (
    <nav
      data-testid="tour-progress"
      aria-label="Tour progress"
      className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2"
    >
      {beats.map((beat, index) => {
        const active = index === current;
        return (
          <button
            key={beat.id}
            type="button"
            data-step={beat.id}
            data-active={active}
            aria-current={active ? "step" : undefined}
            aria-label={`Go to ${beat.pipLabel}`}
            onClick={() => onJump(index)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-medium tracking-[0.08em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kaki/60 ${
              active
                ? "border-kaki bg-kaki-wash text-kaki-deep"
                : "border-washi-deep bg-shoji text-ink-soft hover:border-kaki/50 hover:text-kaki"
            }`}
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${active ? "bg-kaki" : "bg-ink-soft/40"}`}
            />
            {beat.pipLabel}
          </button>
        );
      })}
    </nav>
  );
}
