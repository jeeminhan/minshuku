interface CoachBeatProps {
  kind: "briefing" | "result";
  text: string;
}

// Coach turns are the episode's bookends (log.briefing / log.result) — styled
// as a 手紙 paper note from the coach, visually distinct from dialogue cards.
export function CoachBeat({ kind, text }: CoachBeatProps) {
  return (
    <li
      data-role="coach"
      className="turn-enter rounded-sm border border-kaki/25 bg-kaki-wash px-5 py-4 shadow-[var(--shadow-card)]"
    >
      <p className="mb-1.5 font-display text-xs font-semibold tracking-[0.18em] uppercase text-kaki">
        {kind === "briefing" ? "Coach · the setup" : "Coach · how it went"}
      </p>
      <p className="font-display text-[1.05rem] leading-relaxed text-ink">{text}</p>
    </li>
  );
}
