"use client";

import { useSound } from "./SoundProvider";

// The episode's single mute control: toggles ambience + voices + autoplay,
// persisted in localStorage (minshuku:sound) by the provider.
export function SoundToggle() {
  const { soundOn, toggleSound } = useSound();

  return (
    <button
      type="button"
      data-testid="sound-toggle"
      aria-pressed={soundOn}
      onClick={toggleSound}
      title={soundOn ? "Mute the scene" : "Unmute the scene"}
      className="inline-flex items-center gap-1.5 rounded-full border border-washi-deep bg-shoji px-3 py-1.5 text-xs font-medium tracking-[0.1em] uppercase text-ink-soft transition-colors hover:border-kaki/50 hover:text-kaki focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kaki/60"
    >
      <span aria-hidden className="text-[0.95rem] leading-none">
        {soundOn ? "♪" : "✕"}
      </span>
      <span>{soundOn ? "Sound on" : "Sound off"}</span>
    </button>
  );
}
