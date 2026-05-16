"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  scene,
  SCENE_TITLE,
  SCENE_SUBTITLE,
  SCENE_BRIEFING,
  NPC_NAME,
  type GuidanceLevel,
  type PlayerTurn,
  type NpcLine,
} from "@/lib/scene";

export type Mode = "voice" | "visual-novel" | "choice";

const MODE_LABEL: Record<Mode, string> = {
  voice: "Voice",
  "visual-novel": "Visual novel",
  choice: "Choice",
};

export function ScenePlayer({ mode }: { mode: Mode }) {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [guidance, setGuidance] = useState<GuidanceLevel>("targets");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const current = scene[step];
  const finished = step >= scene.length;

  const playAudio = useCallback((src: string) => {
    if (!audioRef.current) return;
    audioRef.current.src = src;
    audioRef.current.play().catch(() => {
      /* autoplay blocked until interaction — harmless */
    });
  }, []);

  // When we land on an NPC line, play it.
  useEffect(() => {
    if (!started || finished) return;
    if (current?.kind === "npc") playAudio(current.audio);
  }, [started, step, current, finished, playAudio]);

  const advance = () => setStep((s) => s + 1);
  const restart = () => {
    setStep(0);
    setStarted(false);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10">
      <audio ref={audioRef} className="hidden" />

      <header className="flex items-center justify-between border-b border-[color:var(--rule)] pb-4">
        <Link
          href="/"
          className="text-sm text-[color:var(--accent)] hover:underline"
        >
          ← Back
        </Link>
        <span className="rounded-full border border-[color:var(--rule)] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-[color:var(--muted)]">
          {MODE_LABEL[mode]} mode
        </span>
      </header>

      {!started ? (
        <StartCard onBegin={() => setStarted(true)} />
      ) : finished ? (
        <EndCard mode={mode} onRestart={restart} />
      ) : (
        <div className="flex flex-1 flex-col py-8">
          <SceneStage mode={mode} step={current} guidance={guidance} />
          <div className="mt-auto">
            {current?.kind === "player" && (
              <GuidanceToggle value={guidance} onChange={setGuidance} />
            )}
            <Interaction
              mode={mode}
              step={current}
              guidance={guidance}
              onAdvance={advance}
              onReplayAudio={() =>
                current?.kind === "npc" && playAudio(current.audio)
              }
            />
          </div>
        </div>
      )}
    </main>
  );
}

function StartCard({ onBegin }: { onBegin: () => void }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center py-16 text-center">
      <p className="font-serif text-xs tracking-[0.22em] uppercase text-[color:var(--muted)]">
        {SCENE_SUBTITLE}
      </p>
      <h1 className="mt-4 font-serif text-4xl text-[color:var(--foreground)]">
        {SCENE_TITLE}
      </h1>
      <p className="mt-6 max-w-md text-base leading-relaxed text-[color:var(--foreground)]/75">
        {SCENE_BRIEFING}
      </p>
      <p className="mt-4 text-xs text-[color:var(--muted)]">
        A four-turn taste. The conversation is on rails — this is about the
        feel, not a full session.
      </p>
      <button
        onClick={onBegin}
        className="mt-10 rounded-full bg-[color:var(--accent)] px-8 py-3 text-sm font-medium tracking-wide text-[color:var(--background)] transition-colors hover:opacity-90"
      >
        Begin
      </button>
    </section>
  );
}

function SceneStage({
  mode,
  step,
  guidance,
}: {
  mode: Mode;
  step: NpcLine | PlayerTurn;
  guidance: GuidanceLevel;
}) {
  if (mode === "visual-novel") {
    return <VisualNovelStage step={step} />;
  }

  // voice + choice share a simpler stage
  if (step.kind === "npc") {
    return (
      <section>
        <p className="font-serif text-xs tracking-[0.22em] uppercase text-[color:var(--muted)]">
          {step.speaker}
        </p>
        <p className="mt-4 font-serif text-2xl leading-relaxed text-[color:var(--foreground)]">
          {step.ja}
        </p>
        <p className="mt-3 text-sm text-[color:var(--muted)]">{step.en}</p>
      </section>
    );
  }

  return (
    <section>
      <p className="font-serif text-xs tracking-[0.22em] uppercase text-[color:var(--muted)]">
        Your turn
      </p>
      <p className="mt-4 font-serif text-xl text-[color:var(--foreground)]">
        {step.prompt}
      </p>
      <GuidanceBody step={step} guidance={guidance} />
    </section>
  );
}

function VisualNovelStage({ step }: { step: NpcLine | PlayerTurn }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[color:var(--rule)]">
      <div className="relative aspect-[16/10] bg-[color:var(--surface)]">
        <RoomBackdrop />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
          <HostPortrait />
        </div>
      </div>
      <div className="bg-[color:var(--foreground)] p-6 text-[color:var(--background)]">
        {step.kind === "npc" ? (
          <>
            <p className="font-serif text-xs tracking-[0.2em] uppercase text-[color:var(--background)]/60">
              {step.speaker}
            </p>
            <p className="mt-3 font-serif text-xl leading-relaxed">
              {step.ja}
            </p>
            <p className="mt-2 text-sm text-[color:var(--background)]/70">
              {step.en}
            </p>
          </>
        ) : (
          <>
            <p className="font-serif text-xs tracking-[0.2em] uppercase text-[color:var(--background)]/60">
              Your turn
            </p>
            <p className="mt-3 font-serif text-lg">{step.prompt}</p>
          </>
        )}
      </div>
    </section>
  );
}

function GuidanceToggle({
  value,
  onChange,
}: {
  value: GuidanceLevel;
  onChange: (g: GuidanceLevel) => void;
}) {
  const opts: { id: GuidanceLevel; label: string }[] = [
    { id: "open", label: "Open" },
    { id: "targets", label: "Targets shown" },
    { id: "step", label: "Step-by-step" },
  ];
  return (
    <div className="mb-4">
      <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
        How much help?
      </p>
      <div className="inline-flex rounded-full border border-[color:var(--rule)] bg-[color:var(--surface)]/50 p-1">
        {opts.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              value === o.id
                ? "bg-[color:var(--accent)] text-[color:var(--background)]"
                : "text-[color:var(--foreground)]/70 hover:text-[color:var(--foreground)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function GuidanceBody({
  step,
  guidance,
}: {
  step: PlayerTurn;
  guidance: GuidanceLevel;
}) {
  if (guidance === "open") {
    return (
      <p className="mt-4 text-sm italic text-[color:var(--muted)]">
        {step.guidance.open}
      </p>
    );
  }
  if (guidance === "targets") {
    return (
      <div className="mt-4">
        <p className="text-xs uppercase tracking-[0.15em] text-[color:var(--muted)]">
          Try using
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {step.guidance.targets.map((t) => (
            <li
              key={t}
              className="rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--surface)]/60 px-3 py-1 text-sm text-[color:var(--foreground)]/85"
            >
              {t}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-lg border border-[color:var(--accent)]/40 bg-[color:var(--surface)]/60 p-4">
      <p className="text-xs uppercase tracking-[0.15em] text-[color:var(--muted)]">
        Try saying
      </p>
      <p className="mt-2 font-serif text-lg text-[color:var(--foreground)]">
        {step.guidance.step.ja}
      </p>
      <p className="mt-1 text-sm text-[color:var(--muted)]">
        {step.guidance.step.en}
      </p>
    </div>
  );
}

function Interaction({
  mode,
  step,
  guidance,
  onAdvance,
  onReplayAudio,
}: {
  mode: Mode;
  step: NpcLine | PlayerTurn;
  guidance: GuidanceLevel;
  onAdvance: () => void;
  onReplayAudio: () => void;
}) {
  if (step.kind === "npc") {
    return (
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={onReplayAudio}
          className="rounded-full border border-[color:var(--rule)] px-4 py-2 text-sm text-[color:var(--foreground)]/70 transition-colors hover:border-[color:var(--accent)]"
        >
          ▶ Replay audio
        </button>
        <button
          onClick={onAdvance}
          className="rounded-full bg-[color:var(--accent)] px-6 py-2 text-sm font-medium text-[color:var(--background)] transition-colors hover:opacity-90"
        >
          Continue →
        </button>
      </div>
    );
  }

  if (mode === "choice") {
    return <ChoiceInput step={step} onAdvance={onAdvance} />;
  }
  if (mode === "voice") {
    return <VoiceInput step={step} guidance={guidance} onAdvance={onAdvance} />;
  }
  return <TypedInput onAdvance={onAdvance} />;
}

function ChoiceInput({
  step,
  onAdvance,
}: {
  step: PlayerTurn;
  onAdvance: () => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);

  if (picked !== null) {
    const c = step.choices[picked];
    return (
      <div className="mt-6">
        <div
          className={`rounded-lg border p-4 ${
            c.good
              ? "border-[color:var(--accent)]/50 bg-[color:var(--surface)]"
              : "border-[color:var(--rule)] bg-[color:var(--surface)]/40"
          }`}
        >
          <p className="font-serif text-lg text-[color:var(--foreground)]">
            {c.ja}
          </p>
          <p className="mt-1 text-sm text-[color:var(--muted)]">{c.en}</p>
          <p className="mt-3 text-sm text-[color:var(--foreground)]/75">
            {c.good ? "✓ " : "→ "}
            {c.note}
          </p>
        </div>
        <button
          onClick={onAdvance}
          className="mt-4 rounded-full bg-[color:var(--accent)] px-6 py-2 text-sm font-medium text-[color:var(--background)] transition-colors hover:opacity-90"
        >
          Continue →
        </button>
      </div>
    );
  }

  return (
    <ul className="mt-6 space-y-3">
      {step.choices.map((c, i) => (
        <li key={c.ja}>
          <button
            onClick={() => setPicked(i)}
            className="w-full rounded-lg border border-[color:var(--rule)] bg-[color:var(--surface)]/40 p-4 text-left transition-colors hover:border-[color:var(--accent)] hover:bg-[color:var(--surface)]"
          >
            <p className="font-serif text-lg text-[color:var(--foreground)]">
              {c.ja}
            </p>
            <p className="mt-1 text-sm text-[color:var(--muted)]">{c.en}</p>
          </button>
        </li>
      ))}
    </ul>
  );
}

function VoiceInput({
  step,
  guidance,
  onAdvance,
}: {
  step: PlayerTurn;
  guidance: GuidanceLevel;
  onAdvance: () => void;
}) {
  const [state, setState] = useState<"idle" | "listening" | "heard">("idle");
  const [heard, setHeard] = useState("");

  const listen = () => {
    setState("listening");
    const SR =
      (window as unknown as {
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        SpeechRecognition?: new () => SpeechRecognitionLike;
      }).webkitSpeechRecognition ||
      (window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionLike;
      }).SpeechRecognition;

    if (!SR) {
      // No browser STT — simulate after a beat so the feel still lands.
      setTimeout(() => {
        setHeard(
          guidance === "step" ? step.guidance.step.ja : "（your spoken reply）",
        );
        setState("heard");
      }, 1200);
      return;
    }

    const rec = new SR();
    rec.lang = "ja-JP";
    rec.interimResults = false;
    rec.onresult = (e: SpeechRecognitionEventLike) => {
      setHeard(e.results[0][0].transcript);
      setState("heard");
    };
    rec.onerror = () => {
      setHeard("（couldn't hear — that's okay, this is just a taste）");
      setState("heard");
    };
    rec.onend = () => setState((s) => (s === "listening" ? "idle" : s));
    rec.start();
  };

  if (state === "heard") {
    return (
      <div className="mt-6">
        <p className="text-xs uppercase tracking-[0.15em] text-[color:var(--muted)]">
          Heard
        </p>
        <p className="mt-2 font-serif text-xl text-[color:var(--foreground)]">
          {heard}
        </p>
        <button
          onClick={onAdvance}
          className="mt-5 rounded-full bg-[color:var(--accent)] px-6 py-2 text-sm font-medium text-[color:var(--background)] transition-colors hover:opacity-90"
        >
          Continue →
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col items-start gap-3">
      <button
        onClick={listen}
        disabled={state === "listening"}
        className="flex items-center gap-3 rounded-full bg-[color:var(--accent)] px-6 py-3 text-sm font-medium text-[color:var(--background)] transition-colors hover:opacity-90 disabled:opacity-70"
      >
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full bg-[color:var(--background)] ${
            state === "listening" ? "animate-pulse" : ""
          }`}
        />
        {state === "listening" ? "Listening…" : "Hold the conversation — speak"}
      </button>
      <button
        onClick={onAdvance}
        className="text-xs text-[color:var(--muted)] underline hover:text-[color:var(--foreground)]"
      >
        skip — just show me the next line
      </button>
    </div>
  );
}

function TypedInput({ onAdvance }: { onAdvance: () => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="mt-6">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        placeholder="Type your reply in Japanese…"
        className="w-full resize-none rounded-lg border border-[color:var(--rule)] bg-[color:var(--background)] p-4 font-serif text-lg text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
      />
      <button
        onClick={onAdvance}
        className="mt-3 rounded-full bg-[color:var(--accent)] px-6 py-2 text-sm font-medium text-[color:var(--background)] transition-colors hover:opacity-90"
      >
        Send →
      </button>
    </div>
  );
}

function EndCard({
  mode,
  onRestart,
}: {
  mode: Mode;
  onRestart: () => void;
}) {
  const others: Mode[] = (["voice", "visual-novel", "choice"] as Mode[]).filter(
    (m) => m !== mode,
  );
  return (
    <section className="flex flex-1 flex-col items-center justify-center py-16 text-center">
      <p className="font-serif text-xs tracking-[0.22em] uppercase text-[color:var(--muted)]">
        End of the taste
      </p>
      <h2 className="mt-4 font-serif text-3xl text-[color:var(--foreground)]">
        That&apos;s a four-turn slice.
      </h2>
      <p className="mt-5 max-w-md text-base leading-relaxed text-[color:var(--foreground)]/75">
        In the real thing, {NPC_NAME} responds to what you actually said,
        the engine tracks what you used, and tomorrow&apos;s scene picks up
        from here.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onRestart}
          className="rounded-full border border-[color:var(--rule)] px-6 py-2.5 text-sm text-[color:var(--foreground)]/80 transition-colors hover:border-[color:var(--accent)]"
        >
          Replay
        </button>
        {others.map((m) => (
          <Link
            key={m}
            href={`/${m}`}
            className="rounded-full border border-[color:var(--rule)] px-6 py-2.5 text-sm text-[color:var(--foreground)]/80 transition-colors hover:border-[color:var(--accent)]"
          >
            Try {MODE_LABEL[m]}
          </Link>
        ))}
        <Link
          href="/feedback"
          className="rounded-full bg-[color:var(--accent)] px-6 py-2.5 text-sm font-medium text-[color:var(--background)] transition-colors hover:opacity-90"
        >
          Leave feedback
        </Link>
      </div>
    </section>
  );
}

function RoomBackdrop() {
  return (
    <svg
      viewBox="0 0 480 300"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="480" height="300" fill="#f0e6cf" />
      <rect y="210" width="480" height="90" fill="#d9c9a3" />
      {/* shoji panels */}
      <g stroke="#b9a979" strokeWidth="2" fill="#fbf7ee">
        <rect x="40" y="60" width="110" height="150" />
        <rect x="185" y="60" width="110" height="150" />
        <rect x="330" y="60" width="110" height="150" />
      </g>
      <g stroke="#cdbd8f" strokeWidth="1.5">
        <line x1="95" y1="60" x2="95" y2="210" />
        <line x1="40" y1="135" x2="150" y2="135" />
        <line x1="240" y1="60" x2="240" y2="210" />
        <line x1="185" y1="135" x2="295" y2="135" />
        <line x1="385" y1="60" x2="385" y2="210" />
        <line x1="330" y1="135" x2="440" y2="135" />
      </g>
    </svg>
  );
}

function HostPortrait() {
  return (
    <svg
      viewBox="0 0 160 200"
      className="h-44 w-auto sm:h-52"
      aria-hidden="true"
    >
      {/* body / apron */}
      <path
        d="M40 200 Q40 120 80 110 Q120 120 120 200 Z"
        fill="#7c8a6b"
      />
      <path d="M64 120 H96 V200 H64 Z" fill="#e9e0c8" opacity="0.85" />
      {/* neck */}
      <rect x="72" y="96" width="16" height="20" fill="#e8c4a0" />
      {/* head */}
      <ellipse cx="80" cy="74" rx="26" ry="29" fill="#f0cda6" />
      {/* hair */}
      <path
        d="M52 74 Q50 38 80 36 Q110 38 108 74 Q108 58 96 50 Q88 64 64 56 Q56 62 52 74 Z"
        fill="#2b2118"
      />
      <path d="M52 72 Q54 96 58 104 L62 86 Z" fill="#2b2118" />
      <path d="M108 72 Q106 96 102 104 L98 86 Z" fill="#2b2118" />
      {/* face */}
      <circle cx="71" cy="74" r="2.4" fill="#2b2118" />
      <circle cx="89" cy="74" r="2.4" fill="#2b2118" />
      <path
        d="M73 86 Q80 91 87 86"
        stroke="#b5715a"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: (e: SpeechRecognitionEventLike) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
}

interface SpeechRecognitionEventLike {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}
