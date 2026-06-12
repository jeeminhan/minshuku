interface StorySoFarProps {
  summary: string; // the persisted story summary — one "Day N: …" line per completed day
}

// The story so far (contract 005): the accumulated day lines of the persisted
// summary, shown above today's dialogue so a returning learner (or a demo
// audience) sees what the episode is building on. Rendered ONLY when the
// summary is non-empty — on a fresh day 1 the caller must not mount this at
// all (contract-003's first-load shape stays intact).
export function StorySoFar({ summary }: StorySoFarProps) {
  const lines = summary.split("\n");
  return (
    <section
      data-testid="story-so-far"
      aria-label="The story so far"
      className="mt-8 rounded-sm border border-washi-deep bg-shoji px-5 py-4 shadow-[var(--shadow-card)]"
    >
      <h2 className="font-display text-xs font-semibold tracking-[0.18em] uppercase text-kaki">
        The story so far
        <span lang="ja" className="ml-2 font-normal tracking-normal normal-case text-ink-soft">
          これまでの話
        </span>
      </h2>
      <ol className="mt-2 flex flex-col gap-1.5">
        {lines.map((line) => (
          <li
            key={line}
            className="border-t border-washi-deep/60 pt-1.5 text-sm leading-relaxed text-ink-soft first:border-t-0 first:pt-0"
          >
            {line}
          </li>
        ))}
      </ol>
    </section>
  );
}
