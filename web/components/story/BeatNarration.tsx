"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSound } from "../audio/SoundProvider";

interface BeatNarrationProps {
  // Pinned static src for the day's NPC voice line, e.g. /tts/day1-turn2.m4a.
  src: string;
  // Accessible-name fragment, e.g. "the café regular's line".
  label: string;
}

// Per-day-beat auto-narration of the NPC voice clip. Mounts a lazy <audio>
// (preload="none"), registers it with the SoundProvider so it stays
// single-active (notifyPlaying pauses every other clip), and auto-plays once on
// mount when sound is unlocked (soundOn && gestured). Because TourBeatCard is
// keyed by beat.id, navigating to a day beat mounts this fresh — so the
// autoplay fires exactly once per beat activation, the same "freshly revealed →
// play once" pattern the play view uses. Surfaces a live "🔊 reading…"
// indicator while playing and a manual replay control. Reuses the contract-008
// audio primitives without modifying TtsClip's exported behavior.
export function BeatNarration({ src, label }: BeatNarrationProps) {
  const { soundOn, gestured, registerClip, notifyPlaying } = useSound();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const autoplayedRef = useRef(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    return registerClip(el);
  }, [registerClip]);

  const startPlayback = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    notifyPlaying(el);
    void el.play().catch(() => {
      // Autoplay/policy rejection — fail quiet, indicator returns to idle.
      setPlaying(false);
    });
  }, [notifyPlaying]);

  const replay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!soundOn) return; // muted = replay is a no-op; nothing may sound
    el.currentTime = 0;
    startPlayback();
  }, [soundOn, startPlayback]);

  // Auto-narrate once when this beat mounts with sound unlocked.
  useEffect(() => {
    if (autoplayedRef.current) return;
    if (!soundOn || !gestured) return;
    autoplayedRef.current = true;
    startPlayback();
  }, [soundOn, gestured, startPlayback]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-kaki/30 bg-kaki-wash/60 px-4 py-3">
      <p className="text-sm text-ink">
        <span className="font-medium">In their voice</span> — {label}.
      </p>
      <button
        type="button"
        data-testid="replay-clip"
        data-state={playing ? "playing" : "idle"}
        aria-pressed={playing}
        onClick={replay}
        title={`Replay ${label}`}
        className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-kaki/35 bg-shoji px-2.5 py-1 text-[0.72rem] font-medium tracking-[0.08em] text-kaki uppercase transition-colors hover:border-kaki hover:bg-kaki-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kaki/60"
      >
        <span aria-hidden className="text-[0.85rem] leading-none">
          ↻
        </span>
        <span>Replay</span>
        <span className="sr-only">{` ${label}`}</span>
      </button>
      {playing && (
        <span
          data-testid="reading-indicator"
          role="status"
          className="inline-flex items-center gap-1.5 text-[0.72rem] font-medium tracking-[0.08em] text-kaki-deep uppercase"
        >
          <span aria-hidden className="text-[0.9rem] leading-none">
            🔊
          </span>
          reading…
        </span>
      )}
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}
