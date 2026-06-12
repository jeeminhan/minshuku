import { TtsClip } from "../audio/TtsClip";

interface CoachBeatProps {
  kind: "briefing" | "result";
  text: string;
  // Drives the pinned TTS src /tts/day<N>-{briefing|result}.m4a.
  day: number;
  // True for a result beat that just revealed (autoplay-on-reveal); the
  // briefing is present on first load, so it never auto-plays.
  autoOnReveal?: boolean;
}

// Coach turns are the episode's bookends (log.briefing / log.result) — styled
// as a 手紙 paper note from the coach, visually distinct from dialogue cards.
export function CoachBeat({ kind, text, day, autoOnReveal = false }: CoachBeatProps) {
  return (
    <li
      data-role="coach"
      className="turn-enter rounded-sm border border-kaki/25 bg-kaki-wash px-5 py-4 shadow-[var(--shadow-card)]"
    >
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="font-display text-xs font-semibold tracking-[0.18em] uppercase text-kaki">
          {kind === "briefing" ? "Coach · the setup" : "Coach · how it went"}
        </p>
        <TtsClip
          src={`/tts/day${day}-${kind}.m4a`}
          label={kind === "briefing" ? "the coach setup" : "the coach wrap-up"}
          autoOnReveal={autoOnReveal}
        />
      </div>
      <p className="font-display text-[1.05rem] leading-relaxed text-ink">{text}</p>
    </li>
  );
}
