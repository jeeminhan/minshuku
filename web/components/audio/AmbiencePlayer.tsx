"use client";

import { useEffect, useRef } from "react";
import { useSound } from "./SoundProvider";

interface AmbiencePlayerProps {
  // Per-scene looping bed, e.g. /audio/cafe-regular-encounter.m4a — mapped from
  // the episode's log.templateId.
  src: string;
}

const AMBIENCE_VOLUME = 0.25; // quiet bed, like the voices-tour loop

// One looping ambience track for the current scene. Never starts before a user
// gesture (browser policy + explicit gating); plays only while sound is on.
export function AmbiencePlayer({ src }: AmbiencePlayerProps) {
  const { soundOn, gestured } = useSound();
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = AMBIENCE_VOLUME;

    if (soundOn && gestured) {
      if (el.paused) {
        void el.play().catch(() => {
          /* policy rejection — stays paused, no error surfaced */
        });
      }
    } else if (!el.paused) {
      el.pause();
    }
  }, [soundOn, gestured]);

  return <audio ref={audioRef} data-testid="ambience" src={src} loop preload="none" />;
}
