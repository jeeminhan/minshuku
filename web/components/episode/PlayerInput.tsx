import { useState } from "react";

interface PlayerInputProps {
  turnNumber: number;
  onSubmit: (text: string) => void;
}

// Free-text gate for the next player turn. An empty (or whitespace-only)
// submission reveals nothing — the player must say something to advance.
// The field is cleared after each accepted submission.
export function PlayerInput({ turnNumber, onSubmit }: PlayerInputProps) {
  const [draft, setDraft] = useState("");
  const [showHint, setShowHint] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (trimmed === "") {
      setShowHint(true);
      return;
    }
    onSubmit(trimmed);
    setDraft("");
    setShowHint(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7">
      <label
        htmlFor="player-input"
        className="mb-2 block text-xs font-medium tracking-[0.14em] uppercase text-ink-soft"
      >
        Turn {turnNumber} — your line
      </label>
      <div className="flex gap-2">
        <input
          id="player-input"
          data-testid="player-input"
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          lang="ja"
          autoComplete="off"
          enterKeyHint="send"
          placeholder="ここに日本語で…"
          className="min-w-0 flex-1 rounded-sm border border-ink-soft/40 bg-shoji px-3.5 py-2.5 text-lg text-ink shadow-[var(--shadow-card)] transition-colors placeholder:text-ink-soft/60 focus:border-kaki focus:outline-2 focus:outline-offset-1 focus:outline-kaki/50"
        />
        <button
          type="submit"
          data-testid="player-submit"
          className="shrink-0 cursor-pointer rounded-sm bg-kaki px-5 py-2.5 font-display font-semibold text-shoji transition-colors hover:bg-kaki-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kaki active:translate-y-px"
        >
          Speak
        </button>
      </div>
      {showHint && (
        <p role="status" className="mt-2 text-sm text-kaki-deep">
          Say something — even a guess moves the scene along.
        </p>
      )}
    </form>
  );
}
