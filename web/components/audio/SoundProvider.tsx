"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

// Global audio coordination for the episode: the on/off toggle (persisted in
// localStorage), the "has the user gestured yet?" gate that browsers require
// before any audio may play, and a single-active-clip registry so starting one
// <audio> pauses every other.

const STORAGE_KEY = "minshuku:sound";

type SoundValue = "on" | "off";

interface SoundContextValue {
  // Sound on/off. Off = ambience paused, no autoplay, nothing may sound.
  soundOn: boolean;
  toggleSound: () => void;
  // True once the user has made any real in-page gesture. Browsers block
  // audio.play() before this; we also gate ambience + autoplay on it.
  gestured: boolean;
  // Register an <audio> so the provider can pause every other clip when one
  // starts, and stop all of them when sound is switched off. Returns an
  // unregister cleanup.
  registerClip: (el: HTMLAudioElement) => () => void;
  // Called by a clip the instant it begins playing; pauses all the others.
  notifyPlaying: (el: HTMLAudioElement) => void;
}

const SoundContext = createContext<SoundContextValue | null>(null);

function readStoredSound(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) as SoundValue | null;
    if (raw === "off") return false;
    return true; // default ON (missing or "on")
  } catch {
    return true;
  }
}

// `soundOn` is read through useSyncExternalStore so localStorage is the single
// source of truth (default ON server-side for stable hydration). The toggle
// writes storage and dispatches a custom event that the store subscribes to.
const SOUND_EVENT = "minshuku:sound-change";

function subscribeSound(onChange: () => void): () => void {
  window.addEventListener(SOUND_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SOUND_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const soundOn = useSyncExternalStore(subscribeSound, readStoredSound, () => true);
  const [gestured, setGestured] = useState(false);
  const clipsRef = useRef<Set<HTMLAudioElement>>(new Set());

  // Mark the first real gesture anywhere on the page. capture:true so we see it
  // before stopPropagation handlers; pointerdown/keydown cover click + keyboard.
  useEffect(() => {
    if (gestured) return;
    const onGesture = () => setGestured(true);
    window.addEventListener("pointerdown", onGesture, { capture: true });
    window.addEventListener("keydown", onGesture, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", onGesture, { capture: true });
      window.removeEventListener("keydown", onGesture, { capture: true });
    };
  }, [gestured]);

  const toggleSound = useCallback(() => {
    const next = !readStoredSound();
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      /* storage unavailable — toggle is a no-op without persistence */
    }
    window.dispatchEvent(new Event(SOUND_EVENT));
  }, []);

  // When sound goes off, stop every registered clip immediately.
  useEffect(() => {
    if (soundOn) return;
    for (const el of clipsRef.current) {
      if (!el.paused) el.pause();
    }
  }, [soundOn]);

  const registerClip = useCallback((el: HTMLAudioElement) => {
    clipsRef.current.add(el);
    return () => {
      clipsRef.current.delete(el);
    };
  }, []);

  const notifyPlaying = useCallback((el: HTMLAudioElement) => {
    for (const other of clipsRef.current) {
      if (other !== el && !other.paused) other.pause();
    }
  }, []);

  const value = useMemo<SoundContextValue>(
    () => ({ soundOn, toggleSound, gestured, registerClip, notifyPlaying }),
    [soundOn, toggleSound, gestured, registerClip, notifyPlaying],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound(): SoundContextValue {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error("useSound must be used within a SoundProvider");
  return ctx;
}
