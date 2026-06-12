"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// Minimal structural types for the Web Speech API (not in the standard DOM lib
// in a portable way). We feature-detect the constructor at runtime and only
// touch these shapes when it exists.
interface SpeechRecognitionResultLike {
  readonly 0: { transcript: string };
  readonly isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Mic access was blocked — type your line instead.",
  "service-not-allowed": "Mic access was blocked — type your line instead.",
  "no-speech": "Didn’t catch that — try again or type your line.",
  network: "Speech service unavailable — type your line instead.",
  aborted: "",
};

function messageForError(code: string): string {
  return ERROR_MESSAGES[code] ?? "Couldn’t use the mic — type your line instead.";
}

export interface SpeechInput {
  // Only true when the constructor exists; the mic button is rendered only then.
  supported: boolean;
  listening: boolean;
  // Short human message after an error (or "" when idle / silent abort).
  status: string;
  start: () => void;
  stop: () => void;
}

interface UseSpeechInputOptions {
  // Called with each finalized transcript chunk so the caller can fill its
  // controlled input draft.
  onTranscript: (text: string) => void;
  lang?: string;
}

// Mic-to-text for the player input. Feature-detected; every recognition error
// lands the button back at idle with a short inline message — never throws,
// never blocks typing.
// Feature detection via useSyncExternalStore: false on the server (so the
// button never renders during SSR — no hydration mismatch), and the real
// detection on the client. The store never changes, so subscribe is a no-op.
const noopSubscribe = (): (() => void) => () => {};
const detectClient = (): boolean => getRecognitionCtor() !== null;
const detectServer = (): boolean => false;

export function useSpeechInput({ onTranscript, lang = "ja-JP" }: UseSpeechInputOptions): SpeechInput {
  const supported = useSyncExternalStore(noopSubscribe, detectClient, detectServer);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Keep the latest callback without re-creating the recognition instance.
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      if (rec) {
        try {
          rec.abort();
        } catch {
          /* already stopped */
        }
      }
    };
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    if (recognitionRef.current) return; // already listening

    let rec: SpeechRecognitionLike;
    try {
      rec = new Ctor();
    } catch {
      setStatus(messageForError("not-allowed"));
      return;
    }
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = false;

    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          const transcript = result[0].transcript.trim();
          if (transcript) onTranscriptRef.current(transcript);
        }
      }
    };
    rec.onerror = (event) => {
      const message = messageForError(event.error);
      if (message) setStatus(message);
      setListening(false);
      recognitionRef.current = null;
    };
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = rec;
    setStatus("");
    setListening(true);
    try {
      rec.start();
    } catch {
      // Calling start twice, or a synchronous platform error.
      setListening(false);
      recognitionRef.current = null;
      setStatus(messageForError("not-allowed"));
    }
  }, [lang]);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.stop();
    } catch {
      /* already stopping */
    }
  }, []);

  return { supported, listening, status, start, stop };
}
