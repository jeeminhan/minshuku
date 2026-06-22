"use client";

import { useSound } from "../audio/SoundProvider";

// The intro-beat "▶ Begin with sound" control. One click does two things:
//  (1) satisfies the SoundProvider's gesture gate — the click dispatches a
//      pointerdown first, which the provider's capture listener catches and
//      flips `gestured` true; no provider change needed.
//  (2) guarantees `soundOn === true` — if a prior session muted, it turns sound
//      back on (it never blindly toggles an already-on tour off).
// Once unlocked (gestured && soundOn) the CTA reflects that state via
// data-unlocked="true" and becomes a quiet "sound on — advance to begin"
// affordance, so subsequent day beats auto-narrate.
export function SoundUnlock() {
  const { soundOn, gestured, toggleSound } = useSound();
  const unlocked = gestured && soundOn;

  const onClick = () => {
    // The click already produced a pointerdown → gesture gate is satisfied.
    // Only flip sound when it is currently off, so an already-on tour stays on.
    if (!soundOn) toggleSound();
  };

  if (unlocked) {
    return (
      <div
        data-testid="sound-unlock"
        data-unlocked="true"
        className="flex flex-wrap items-center gap-2 rounded-full border border-kaki/40 bg-kaki-wash px-4 py-2 text-sm font-medium text-kaki-deep"
      >
        <span aria-hidden className="text-[0.95rem] leading-none">
          ♪
        </span>
        <span>Sound on — advance to begin the tour.</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      data-testid="sound-unlock"
      data-unlocked="false"
      onClick={onClick}
      className="inline-flex items-center gap-2 self-start rounded-full border border-kaki bg-kaki px-5 py-2.5 text-sm font-semibold tracking-[0.04em] text-shoji shadow-[var(--shadow-card)] transition-colors hover:bg-kaki-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kaki/60"
    >
      <span aria-hidden className="text-base leading-none">
        ▶
      </span>
      Begin with sound
    </button>
  );
}
