"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSound } from "./SoundProvider";

interface TtsClipProps {
  // Pinned static src, e.g. /tts/day1-turn2.m4a — derived purely from day+turn.
  src: string;
  // Accessible-name fragment, e.g. "cafe regular's line" or "the coach setup".
  label: string;
  // When this turn/beat is freshly revealed, the provider may autoplay it once
  // (sound on + after a prior gesture). EpisodePlayer passes true only on the
  // initial mount of a newly revealed line.
  autoOnReveal?: boolean;
}

// Per-line play/pause control over a lazy <audio>. At most one clip sounds at a
// time (the provider pauses the others). Autoplay-on-reveal fires once, only
// when sound is on and the user has already gestured.
export function TtsClip({ src, label, autoOnReveal = false }: TtsClipProps) {
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
      // Autoplay/policy rejection — fail quiet, button returns to idle.
      setPlaying(false);
    });
  }, [notifyPlaying]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      if (!soundOn) return; // off = manual play is a no-op; nothing may sound
      startPlayback();
    } else {
      el.pause();
    }
  }, [soundOn, startPlayback]);

  // Autoplay-on-reveal: fire exactly once per clip, on/after the reveal, when
  // sound is on and a prior gesture has unlocked audio.
  useEffect(() => {
    if (!autoOnReveal || autoplayedRef.current) return;
    if (!soundOn || !gestured) return;
    autoplayedRef.current = true;
    startPlayback();
  }, [autoOnReveal, soundOn, gestured, startPlayback]);

  return (
    <>
      <button
        type="button"
        data-testid="tts-toggle"
        aria-pressed={playing}
        data-state={playing ? "playing" : "idle"}
        onClick={toggle}
        title={playing ? `Pause ${label}` : `Play ${label}`}
        className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-kaki/35 bg-shoji px-2.5 py-1 text-[0.72rem] font-medium tracking-[0.08em] uppercase text-kaki transition-colors hover:border-kaki hover:bg-kaki-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kaki/60"
      >
        <span aria-hidden className="text-[0.85rem] leading-none">
          {playing ? "❚❚" : "▶"}
        </span>
        <span>{playing ? "Pause" : "Play"}</span>
        <span className="sr-only">{` ${label}`}</span>
      </button>
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </>
  );
}
