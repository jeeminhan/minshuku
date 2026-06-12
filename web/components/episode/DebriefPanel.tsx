import type { CompleteResponse, DebriefEntry, StrengthenedEntry } from "./episodeData";
import { OUTCOME_LABELS, OUTCOME_STYLES } from "./OutcomeBadge";

interface DebriefPanelProps {
  debrief: CompleteResponse;
}

// End-of-day debrief (contract 004): replaces the bare completion
// confirmation with what the episode actually did for the learner — new
// passives met, actives produced (with their outcome badges), and the items
// the SRS will weave into tomorrow's scene — plus the return-tomorrow beat.
// Pure display of the POST response: it never fetches the next episode.
export function DebriefPanel({ debrief }: DebriefPanelProps) {
  return (
    <section aria-label="Tonight’s debrief" className="mt-9">
      <div
        data-testid="complete-confirmation"
        className="rounded-sm border border-moss/40 bg-moss-wash px-5 py-5 text-center shadow-[var(--shadow-card)]"
      >
        <p className="font-display text-lg text-ink">
          <span lang="ja">お疲れさまでした。</span> Today’s episode is in the book.
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          Here is what tonight’s conversation did for you.
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-4">
        <DebriefGroup
          group="learned"
          titleJa="出会った言葉"
          title="Learned tonight"
          note="New words you met in the flow of the scene — no flashcards, just the story."
        >
          {debrief.debrief.learned.map((entry) => (
            <EntryRow key={entry.itemId} entry={entry} />
          ))}
        </DebriefGroup>
        <DebriefGroup
          group="strengthened"
          titleJa="強くなった言葉"
          title="Strengthened"
          note="You produced these yourself, so their next review moves further out."
        >
          {debrief.debrief.strengthened.map((entry) => (
            <EntryRow key={entry.itemId} entry={entry} outcome={entry.outcome} />
          ))}
        </DebriefGroup>
        <DebriefGroup
          group="due-tomorrow"
          titleJa="明日の言葉"
          title="Due tomorrow"
          note="Tomorrow’s scene will be built around these."
        >
          {debrief.debrief.dueTomorrow.map((entry) => (
            <EntryRow key={entry.itemId} entry={entry} />
          ))}
        </DebriefGroup>
      </div>
      <div
        data-testid="return-tomorrow"
        className="mt-6 rounded-sm border border-kaki/25 bg-kaki-wash px-5 py-5 text-center shadow-[var(--shadow-card)]"
      >
        <p className="font-display text-[1.05rem] leading-relaxed text-ink">
          The lanterns go out for tonight. <span className="font-semibold">Day {debrief.day}</span>{" "}
          opens tomorrow — your due words will be waiting in the next scene.
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          <span lang="ja">また明日。</span> See you tomorrow.
        </p>
      </div>
    </section>
  );
}

interface DebriefGroupProps {
  group: "learned" | "strengthened" | "due-tomorrow";
  titleJa: string;
  title: string;
  note: string;
  children: React.ReactNode;
}

function DebriefGroup({ group, titleJa, title, note, children }: DebriefGroupProps) {
  const empty = Array.isArray(children) && children.length === 0;
  return (
    <section
      data-debrief-group={group}
      className="rounded-sm border border-washi-deep bg-shoji px-5 py-4 shadow-[var(--shadow-card)]"
    >
      <h2 className="font-display text-xs font-semibold tracking-[0.18em] uppercase text-kaki">
        {title}
        <span lang="ja" className="ml-2 font-normal tracking-normal normal-case text-ink-soft">
          {titleJa}
        </span>
      </h2>
      <p className="mt-1 text-sm text-ink-soft">{note}</p>
      {empty ? (
        <p className="mt-3 text-sm text-ink-soft">Nothing tonight.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">{children}</ul>
      )}
    </section>
  );
}

interface EntryRowProps {
  entry: DebriefEntry;
  outcome?: StrengthenedEntry["outcome"];
}

function EntryRow({ entry, outcome }: EntryRowProps) {
  return (
    <li
      data-item-id={entry.itemId}
      className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-t border-washi-deep/60 pt-2 first:border-t-0 first:pt-0"
    >
      <span lang="ja" className="font-display text-lg font-medium text-ink">
        {entry.surface}
      </span>
      {entry.reading !== null && (
        <span lang="ja" className="text-sm text-ink-soft">
          {entry.reading}
        </span>
      )}
      <span className="text-sm text-ink-soft">{entry.meaning}</span>
      {outcome !== undefined && (
        <span
          data-outcome={outcome}
          className={`ml-auto inline-flex rounded-full border px-2.5 py-0.5 text-xs ${OUTCOME_STYLES[outcome]}`}
        >
          {OUTCOME_LABELS[outcome]}
        </span>
      )}
    </li>
  );
}
