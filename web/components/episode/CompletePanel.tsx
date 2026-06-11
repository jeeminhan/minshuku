export type CompletionState = "idle" | "pending" | "done";

interface CompletePanelProps {
  state: CompletionState;
  error: string | null;
  nextDay: number | null;
  onComplete: () => void;
}

// End-of-episode action. After a successful POST the button is removed
// entirely and replaced by the confirmation — the complete API 409s on a
// double-complete, so the UI must never invite a second click.
export function CompletePanel({ state, error, nextDay, onComplete }: CompletePanelProps) {
  if (state === "done") {
    return (
      <div
        data-testid="complete-confirmation"
        className="mt-9 rounded-sm border border-moss/40 bg-moss-wash px-5 py-5 text-center shadow-[var(--shadow-card)]"
      >
        <p className="font-display text-lg text-ink">
          <span lang="ja">お疲れさまでした。</span> Today’s episode is in the book.
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {nextDay !== null
            ? `The story picks up on Day ${nextDay} — see you tomorrow.`
            : "See you tomorrow."}
        </p>
      </div>
    );
  }
  return (
    <div className="mt-9 text-center">
      <button
        type="button"
        data-testid="complete-episode"
        onClick={onComplete}
        disabled={state === "pending"}
        className="cursor-pointer rounded-sm bg-kaki px-7 py-3 font-display text-lg font-semibold text-shoji shadow-[var(--shadow-card)] transition-colors hover:bg-kaki-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kaki active:translate-y-px disabled:cursor-default disabled:opacity-60"
      >
        {state === "pending" ? "Closing the day…" : "Complete today’s episode"}
      </button>
      {error !== null && (
        <p role="alert" className="mt-2 text-sm text-rust">
          {error}
        </p>
      )}
    </div>
  );
}
