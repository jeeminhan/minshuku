export type CompletionState = "idle" | "pending" | "done";

interface CompletePanelProps {
  state: CompletionState;
  error: string | null;
  onComplete: () => void;
}

// End-of-episode action. After a successful POST the panel is unmounted
// entirely and replaced by the DebriefPanel (contract 004) — the complete
// API 409s on a double-complete, so the UI must never invite a second click.
export function CompletePanel({ state, error, onComplete }: CompletePanelProps) {
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
