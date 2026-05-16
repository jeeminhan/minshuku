import Link from "next/link";
import type { ReactNode } from "react";

interface SideEpisode {
  title: string;
  npcs: string;
  minutes: string;
  played: boolean;
}

interface Story {
  id: string;
  title: string;
  subtitle: string;
  status: "recommended" | "in-progress" | "paused" | "new" | "completed";
  scenesPlayed: number;
  scenesTotal: number;
  teaches: number;
  lastPlayed: string;
  npcs: string[];
  description: string;
  icon: ReactNode;
  sideEpisodes?: SideEpisode[];
}

const stories: Story[] = [
  {
    id: "summer-minshuku",
    title: "Summer at the minshuku",
    subtitle: "A quiet stay with a host family",
    status: "in-progress",
    scenesPlayed: 1,
    scenesTotal: 8,
    teaches: 64,
    lastPlayed: "Yesterday",
    npcs: ["Tanaka-san"],
    description:
      "Polite arrivals, kitchen mornings, evenings on tatami. JLPT N4-N3 keigo, family vocabulary, small-stakes daily life.",
    icon: <HouseIcon />,
    sideEpisodes: [
      {
        title: "Evening tea with Tanaka-san",
        npcs: "Tanaka-san",
        minutes: "10 min",
        played: false,
      },
      {
        title: "Helping fold the laundry",
        npcs: "Tanaka-san",
        minutes: "8 min",
        played: true,
      },
      {
        title: "A quiet word with grandpa",
        npcs: "Grandpa",
        minutes: "12 min",
        played: false,
      },
    ],
  },
  {
    id: "cooks-kitchen",
    title: "The cook's kitchen",
    subtitle: "A pilot scene",
    status: "recommended",
    scenesPlayed: 0,
    scenesTotal: 6,
    teaches: 48,
    lastPlayed: "Never played",
    npcs: [],
    description:
      "A gentler start. The cook teaches you tools, ingredients, and how to ask for help politely.",
    icon: <KitchenIcon />,
  },
  {
    id: "shrine-hill",
    title: "The shrine on the hill",
    subtitle: "Six conversations with a keeper",
    status: "new",
    scenesPlayed: 0,
    scenesTotal: 6,
    teaches: 52,
    lastPlayed: "Never played",
    npcs: [],
    description:
      "A slower-paced arc. Formal register, traditional vocabulary, and one quiet keeper who knows the place.",
    icon: <ToriiIcon />,
  },
  {
    id: "late-night-walk",
    title: "Late-night walk",
    subtitle: "A stranger, a station, an hour",
    status: "paused",
    scenesPlayed: 3,
    scenesTotal: 5,
    teaches: 40,
    lastPlayed: "12 days ago",
    npcs: ["Hayashi-san"],
    description:
      "Casual register, narrative-heavy. A chance encounter that turns into a real conversation.",
    icon: <MoonIcon />,
  },
  {
    id: "cafe-regulars",
    title: "Coffee at the cafe",
    subtitle: "Five mornings with the same barista",
    status: "completed",
    scenesPlayed: 5,
    scenesTotal: 5,
    teaches: 35,
    lastPlayed: "Last week",
    npcs: ["Yumiko"],
    description:
      "Light, repeated routines that built up your daily-life vocabulary. Replay anytime.",
    icon: <CupIcon />,
  },
];

const reviewingScenes = [
  {
    title: "Morning at the bus stop",
    setting: "A stranger, small talk about the weather",
    minutes: "7 min",
    domains: "transport · weather · casual",
  },
  {
    title: "Browsing the bookshop",
    setting: "A clerk who lets you wander, then asks what you like",
    minutes: "9 min",
    domains: "hobbies · shopping · neutral",
  },
  {
    title: "At the convenience store",
    setting: "A quick exchange at the register",
    minutes: "5 min",
    domains: "shopping · everyday · polite",
  },
];

const drills = [
  { items: "包丁 · 紹介 · から", note: "missed yesterday", minutes: "3 min" },
  { items: "ます-form", note: "due for review", minutes: "2 min" },
  { items: "歓迎 · 旅 · 葉書", note: "weak this week", minutes: "3 min" },
];

export default function LibraryPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="border-b border-[color:var(--rule)] pb-8">
        <Link
          href="/"
          className="text-sm text-[color:var(--accent)] hover:underline"
        >
          ← Back
        </Link>
        <h1 className="mt-6 font-serif text-4xl leading-tight text-[color:var(--foreground)] sm:text-5xl">
          Your library
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[color:var(--foreground)]/75">
          Three kinds of thing live here.{" "}
          <strong className="font-semibold text-[color:var(--foreground)]">
            Learning stories
          </strong>{" "}
          teach new words on purpose.{" "}
          <strong className="font-semibold text-[color:var(--foreground)]">
            Side-episodes
          </strong>{" "}
          let you stay in a world you know without moving the plot.{" "}
          <strong className="font-semibold text-[color:var(--foreground)]">
            Reviewing scenes and drills
          </strong>{" "}
          recycle what you already know.
        </p>
      </header>

      <SectionLabel>Learning stories</SectionLabel>
      <section className="mt-6 grid gap-6 sm:grid-cols-2">
        {stories.map((s) => (
          <StoryCard key={s.id} story={s} />
        ))}
      </section>

      <SectionLabel>Reviewing scenes</SectionLabel>
      <p className="mt-2 text-sm text-[color:var(--muted)]">
        Standalone. No story to commit to — the engine fills them with
        whatever you&apos;re due to review. Endlessly replayable.
      </p>
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {reviewingScenes.map((r) => (
          <div
            key={r.title}
            className="rounded-lg border border-[color:var(--rule)] bg-[color:var(--surface)]/40 p-5 transition-colors hover:bg-[color:var(--surface)]/70"
          >
            <div className="flex items-center justify-between">
              <span className="rounded-full border border-[color:var(--rule)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-[color:var(--muted)]">
                Reviewing scene
              </span>
              <span className="text-xs text-[color:var(--muted)]">
                {r.minutes}
              </span>
            </div>
            <h3 className="mt-4 font-serif text-lg leading-snug text-[color:var(--foreground)]">
              {r.title}
            </h3>
            <p className="mt-1 text-sm text-[color:var(--foreground)]/70">
              {r.setting}
            </p>
            <p className="mt-3 text-xs text-[color:var(--muted)]">
              {r.domains}
            </p>
            <p className="mt-5 text-sm font-medium text-[color:var(--accent)]">
              Play →
            </p>
          </div>
        ))}
      </section>

      <SectionLabel>Drills</SectionLabel>
      <p className="mt-2 text-sm text-[color:var(--muted)]">
        Not really stories — quick, targeted reps for items that slipped.
        The engine generates these; you don&apos;t browse them so much as
        accept them.
      </p>
      <section className="mt-6 flex flex-wrap gap-3">
        {drills.map((d) => (
          <div
            key={d.items}
            className="flex items-center gap-4 rounded-full border border-[color:var(--rule)] bg-[color:var(--surface)]/40 py-2.5 pl-5 pr-3 transition-colors hover:border-[color:var(--accent)]"
          >
            <div>
              <p className="font-serif text-sm text-[color:var(--foreground)]">
                {d.items}
              </p>
              <p className="text-[11px] text-[color:var(--muted)]">
                {d.note} · {d.minutes}
              </p>
            </div>
            <span className="rounded-full bg-[color:var(--accent)] px-3 py-1.5 text-xs font-medium text-[color:var(--background)]">
              Drill →
            </span>
          </div>
        ))}
      </section>

      <section className="mt-16 rounded-lg border border-[color:var(--rule)] bg-[color:var(--surface)]/60 p-6">
        <p className="font-serif text-xs tracking-[0.22em] uppercase text-[color:var(--muted)]">
          A note on time
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[color:var(--foreground)]/80">
          Stories don&apos;t expire. If you step away for a week or a month,
          the people in them wait. When you come back, the briefing
          acknowledges the gap — &quot;after a few quiet days at the
          guesthouse&quot; — and the conversation picks up like you&apos;ve
          been there all along.
        </p>
      </section>
    </main>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-16 font-serif text-2xl text-[color:var(--foreground)]">
      {children}
    </h2>
  );
}

function StoryCard({ story: s }: { story: Story }) {
  const isCompleted = s.status === "completed";
  const isPaused = s.status === "paused";
  const isNew = s.status === "new";
  const isRecommended = s.status === "recommended";

  return (
    <article
      className={`group flex flex-col rounded-lg border p-6 transition-colors ${
        isRecommended
          ? "border-[color:var(--accent)]/60 bg-[color:var(--surface)]"
          : "border-[color:var(--rule)] bg-[color:var(--surface)]/40 hover:bg-[color:var(--surface)]/70"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="text-[color:var(--accent)]/70">{s.icon}</div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <StatusBadge status={s.status} />
            <span className="text-xs text-[color:var(--muted)]">
              {s.lastPlayed}
            </span>
          </div>
          <h3 className="mt-3 font-serif text-xl leading-snug text-[color:var(--foreground)]">
            {s.title}
          </h3>
          <p className="text-xs text-[color:var(--muted)]">{s.subtitle}</p>
        </div>
      </div>

      <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--accent)]/80">
        Learning story · teaches {s.teaches} items
      </p>

      {s.scenesTotal > 1 && (
        <div className="mt-3">
          <div className="flex gap-1">
            {Array.from({ length: s.scenesTotal }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full ${
                  i < s.scenesPlayed
                    ? isCompleted
                      ? "bg-[color:var(--foreground)]/60"
                      : "bg-[color:var(--accent)]"
                    : "bg-[color:var(--rule)]"
                }`}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-[color:var(--muted)]">
            {s.scenesPlayed} of {s.scenesTotal} scenes
          </p>
        </div>
      )}

      <p className="mt-5 text-sm leading-relaxed text-[color:var(--foreground)]/75">
        {s.description}
      </p>

      {s.npcs.length > 0 && (
        <div className="mt-4 flex items-center gap-2 text-xs text-[color:var(--muted)]">
          <span className="font-serif italic">You&apos;ve met:</span>
          <span>{s.npcs.join(", ")}</span>
        </div>
      )}

      {s.sideEpisodes && s.sideEpisodes.length > 0 && (
        <div className="mt-5 border-t border-[color:var(--rule)] pt-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--muted)]">
            Side-episodes · same world, no plot
          </p>
          <ul className="mt-3 space-y-2">
            {s.sideEpisodes.map((ep) => (
              <li
                key={ep.title}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex items-center gap-2 text-[color:var(--foreground)]/80">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      ep.played
                        ? "bg-[color:var(--foreground)]/30"
                        : "bg-[color:var(--accent)]"
                    }`}
                  />
                  {ep.title}
                </span>
                <span className="shrink-0 text-xs text-[color:var(--muted)]">
                  {ep.played ? "played" : ep.minutes}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between pt-2">
        <span className="text-sm font-medium text-[color:var(--accent)]">
          {isCompleted
            ? "Replay →"
            : isPaused
              ? "Pick back up →"
              : isNew
                ? "Start →"
                : isRecommended && s.scenesPlayed === 0
                  ? "Start →"
                  : "Continue →"}
        </span>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: Story["status"] }) {
  const map = {
    recommended: {
      label: "Recommended tonight",
      cls: "bg-[color:var(--accent)] text-[color:var(--background)]",
    },
    "in-progress": {
      label: "In progress",
      cls: "border border-[color:var(--accent)]/40 text-[color:var(--accent)]",
    },
    paused: {
      label: "Paused",
      cls: "border border-[color:var(--rule)] text-[color:var(--muted)]",
    },
    new: {
      label: "New",
      cls: "border border-[color:var(--rule)] text-[color:var(--foreground)]/70",
    },
    completed: {
      label: "Completed",
      cls: "border border-[color:var(--rule)] text-[color:var(--foreground)]/50",
    },
  } as const;
  const { label, cls } = map[status];
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-medium tracking-[0.15em] uppercase ${cls}`}
    >
      {label}
    </span>
  );
}

function HouseIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-8 w-8"
    >
      <path d="M5 27 V14 L16 6 L27 14 V27" strokeLinejoin="round" />
      <path d="M13 27 V19 H19 V27" />
      <path d="M5 14 L27 14" />
    </svg>
  );
}

function KitchenIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-8 w-8"
    >
      <path
        d="M6 14 H26 V24 a2 2 0 0 1 -2 2 H8 a2 2 0 0 1 -2 -2 Z"
        strokeLinejoin="round"
      />
      <path d="M10 14 V8 M16 14 V6 M22 14 V8" strokeLinecap="round" />
    </svg>
  );
}

function ToriiIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-8 w-8"
    >
      <path d="M4 8 H28" strokeLinecap="round" />
      <path d="M5 11 H27" strokeLinecap="round" />
      <path d="M9 11 V27 M23 11 V27" strokeLinecap="round" />
      <path d="M11 15 H21" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-8 w-8"
    >
      <path
        d="M22 7 a11 11 0 1 0 3 18 a9 9 0 0 1 -3 -18 Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CupIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-8 w-8"
    >
      <path
        d="M7 12 H22 V22 a4 4 0 0 1 -4 4 H11 a4 4 0 0 1 -4 -4 Z"
        strokeLinejoin="round"
      />
      <path d="M22 14 H25 a3 3 0 0 1 0 6 H22" />
      <path d="M12 7 V9 M16 7 V9 M20 7 V9" strokeLinecap="round" />
    </svg>
  );
}
