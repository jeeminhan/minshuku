import Link from "next/link";

const modes = [
  {
    id: "voice",
    name: "Voice",
    jp: "声",
    blurb: "Speak. Be spoken to.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
        <path d="M12 2v10M8 6v6M16 6v6M5 9v3M19 9v3M12 16v6M9 22h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "visual-novel",
    name: "Visual novel",
    jp: "場面",
    blurb: "A room. A face. A line.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
        <rect x="3" y="4" width="18" height="14" rx="1.5" />
        <circle cx="9" cy="11" r="2" />
        <path d="M14 10h4M14 13h3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "choice",
    name: "Choice",
    jp: "選択",
    blurb: "Three replies. Pick one.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7">
        <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" />
        <circle cx="19" cy="17" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
] as const;

export default function Home() {
  return (
    <main className="flex-1">
      <Hero />
      <RecommendationSection />
      <LoopSection />
      <ModeSection />
      <GuidanceStrip />
      <AuthoringTeaser />
      <FeedbackInvite />
      <Footer />
    </main>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-5xl gap-12 px-6 pt-20 pb-16 sm:pt-28 lg:grid-cols-[1.1fr_1fr] lg:items-center">
      <div>
        <p className="font-serif text-xs tracking-[0.22em] uppercase text-[color:var(--muted)]">
          minshuku · 民宿
        </p>
        <h1 className="mt-5 font-serif text-5xl leading-[1.05] tracking-tight text-[color:var(--foreground)] sm:text-6xl">
          Learn Japanese
          <span className="block text-[color:var(--accent)]">
            inside a story.
          </span>
        </h1>
        <p className="mt-6 max-w-md text-lg leading-snug text-[color:var(--foreground)]/80">
          Spaced repetition, but the words you&apos;re due to review show up
          in tonight&apos;s conversation.
        </p>
      </div>
      <HeroIllustration />
    </section>
  );
}

function HeroIllustration() {
  return (
    <div className="relative aspect-[5/4] overflow-hidden rounded-xl border border-[color:var(--rule)] bg-[color:var(--surface)]">
      <svg
        viewBox="0 0 500 400"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {/* sky wash */}
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbf7ee" />
            <stop offset="100%" stopColor="#f0e6cf" />
          </linearGradient>
          <linearGradient id="lantern" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f5b674" />
            <stop offset="100%" stopColor="#c95f3b" />
          </linearGradient>
        </defs>
        <rect width="500" height="400" fill="url(#sky)" />

        {/* distant hill */}
        <path
          d="M0,260 Q120,210 250,240 T500,230 L500,400 L0,400 Z"
          fill="#d9d1bd"
          opacity="0.7"
        />
        {/* nearer hill */}
        <path
          d="M0,300 Q150,260 280,290 T500,290 L500,400 L0,400 Z"
          fill="#c2b794"
          opacity="0.8"
        />

        {/* minshuku building */}
        <g transform="translate(120, 200)">
          {/* roof */}
          <path
            d="M-20,40 L130,-30 L280,40 Z"
            fill="#1c1a14"
          />
          <path
            d="M-20,40 L130,-30 L280,40 L130,30 Z"
            fill="#3a342a"
          />
          {/* walls */}
          <rect x="0" y="40" width="260" height="120" fill="#f5efde" />
          {/* doorway */}
          <rect x="100" y="80" width="60" height="80" fill="#3a342a" />
          {/* shoji windows */}
          <g stroke="#1c1a14" strokeWidth="1.5" fill="#fbf7ee">
            <rect x="20" y="65" width="55" height="55" />
            <rect x="185" y="65" width="55" height="55" />
            <line x1="47" y1="65" x2="47" y2="120" />
            <line x1="20" y1="92" x2="75" y2="92" />
            <line x1="212" y1="65" x2="212" y2="120" />
            <line x1="185" y1="92" x2="240" y2="92" />
          </g>
        </g>

        {/* lantern */}
        <g transform="translate(110, 220)">
          <line x1="0" y1="0" x2="0" y2="20" stroke="#1c1a14" strokeWidth="1.5" />
          <ellipse cx="0" cy="32" rx="14" ry="18" fill="url(#lantern)" />
          <line x1="-14" y1="32" x2="14" y2="32" stroke="#1c1a14" strokeWidth="1.2" />
          <line x1="-12" y1="22" x2="12" y2="22" stroke="#1c1a14" strokeWidth="1" />
          <line x1="-12" y1="42" x2="12" y2="42" stroke="#1c1a14" strokeWidth="1" />
        </g>

        {/* floating Japanese characters as motif */}
        <g
          fill="#1c1a14"
          opacity="0.18"
          fontFamily="serif"
          fontSize="22"
        >
          <text x="380" y="100">こ</text>
          <text x="420" y="140">ん</text>
          <text x="395" y="180">ば</text>
          <text x="430" y="220">ん</text>
          <text x="400" y="260">は</text>
        </g>
      </svg>
    </div>
  );
}

function RecommendationSection() {
  const recs = [
    {
      label: "Continue",
      type: "Learning story",
      title: "Summer at the minshuku",
      scene: "Scene 2 · First morning with mom",
      minutes: "15 min",
      coverage: "covers 6 of today's 9 due items",
      reason: "Advances your story. Mom remembers you.",
      progressFilled: 1,
      progressTotal: 8,
      cta: "Continue →",
      accent: true,
    },
    {
      label: "Stay in this world",
      type: "Side-episode",
      title: "Evening tea with Tanaka-san",
      scene: "Side-episode · Summer at the minshuku",
      minutes: "10 min",
      coverage: "covers 5 of today's 9 due items",
      reason: "Same people, no plot. Pure review in a familiar place.",
      progressFilled: 0,
      progressTotal: 1,
      cta: "Play →",
      accent: false,
    },
    {
      label: "Quick session",
      type: "Drill",
      title: "3 items you missed yesterday",
      scene: "Drill · 包丁 · 紹介 · から",
      minutes: "3 min",
      coverage: "targets only what slipped",
      reason: "No story. In and out. For short windows.",
      progressFilled: 0,
      progressTotal: 1,
      cta: "Drill →",
      accent: false,
    },
  ];

  return (
    <section className="mx-auto max-w-5xl px-6 pb-8">
      <div className="flex items-baseline justify-between gap-6 border-b border-[color:var(--rule)] pb-4">
        <p className="font-serif text-xs tracking-[0.22em] uppercase text-[color:var(--muted)]">
          Tonight, we'd recommend
        </p>
        <Link
          href="/library"
          className="text-xs font-medium text-[color:var(--accent)] hover:underline"
        >
          Browse the library →
        </Link>
      </div>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[color:var(--foreground)]/70">
        Three ways to spend tonight, ranked by how much story you want.
        Advance your arc, stay in the same world without moving the plot,
        or just drill what slipped.
      </p>
      <ul className="mt-6 grid gap-4 lg:grid-cols-3">
        {recs.map((r) => (
          <li key={r.title}>
            <RecommendationCard {...r} />
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-[color:var(--muted)]">
        The engine picks these for you based on what you&apos;re due to
        review. You can always{" "}
        <Link
          href="/library"
          className="text-[color:var(--accent)] hover:underline"
        >
          browse the full library
        </Link>{" "}
        instead.
      </p>
    </section>
  );
}

function RecommendationCard({
  label,
  type,
  title,
  scene,
  minutes,
  coverage,
  reason,
  progressFilled,
  progressTotal,
  cta,
  accent,
}: {
  label: string;
  type: string;
  title: string;
  scene: string;
  minutes: string;
  coverage: string;
  reason: string;
  progressFilled: number;
  progressTotal: number;
  cta: string;
  accent: boolean;
}) {
  const borderClass = accent
    ? "border-[color:var(--accent)]/60 bg-[color:var(--surface)]"
    : "border-[color:var(--rule)] bg-[color:var(--surface)]/40";

  return (
    <div
      className={`group h-full rounded-lg border ${borderClass} p-5 transition-colors hover:border-[color:var(--accent)]`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-medium tracking-[0.15em] uppercase ${
            accent
              ? "bg-[color:var(--accent)] text-[color:var(--background)]"
              : "border border-[color:var(--rule)] text-[color:var(--muted)]"
          }`}
        >
          {label}
        </span>
        <span className="text-xs text-[color:var(--muted)]">{minutes}</span>
      </div>

      <p className="mt-4 text-[10px] font-medium tracking-[0.18em] uppercase text-[color:var(--accent)]/80">
        {type}
      </p>
      <h3 className="mt-1.5 font-serif text-lg leading-snug text-[color:var(--foreground)]">
        {title}
      </h3>
      <p className="mt-1 text-xs text-[color:var(--muted)]">{scene}</p>

      {progressTotal > 1 && (
        <div className="mt-4 flex gap-1">
          {Array.from({ length: progressTotal }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i < progressFilled
                  ? "bg-[color:var(--accent)]"
                  : "bg-[color:var(--rule)]"
              }`}
            />
          ))}
        </div>
      )}

      <p className="mt-4 font-serif text-sm italic text-[color:var(--foreground)]/80">
        {coverage}
      </p>
      <p className="mt-2 text-sm text-[color:var(--foreground)]/65">
        {reason}
      </p>

      <p className="mt-5 text-sm font-medium text-[color:var(--accent)]">
        {cta}
      </p>
    </div>
  );
}

function LoopSection() {
  const steps = [
    {
      title: "What you're due",
      body: "The engine picks the words and grammar you're closest to forgetting.",
      icon: (
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8">
          <circle cx="16" cy="16" r="11" />
          <path d="M16 9v7l4 3" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      title: "A scene that fits",
      body: "It surfaces inside a real conversation — the cook hands you a 包丁.",
      icon: (
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8">
          <path d="M5 26 V12 L16 5 L27 12 V26" strokeLinejoin="round" />
          <path d="M12 26 V18 H20 V26" />
        </svg>
      ),
    },
    {
      title: "You use it",
      body: "You speak or type your reply. The system watches if you used the target.",
      icon: (
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8">
          <path d="M6 8 H26 V22 H12 L6 27 Z" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: "Your schedule updates",
      body: "Got it right? Days from now. Missed it? Tomorrow.",
      icon: (
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8">
          <path d="M25 16 a9 9 0 1 1 -2.5 -6.3" strokeLinecap="round" />
          <path d="M25 8 V13 H20" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  return (
    <section className="border-y border-[color:var(--rule)] bg-[color:var(--surface)]/60">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <p className="font-serif text-xs tracking-[0.22em] uppercase text-[color:var(--muted)]">
          The loop
        </p>
        <h2 className="mt-4 font-serif text-3xl leading-tight text-[color:var(--foreground)] sm:text-4xl">
          It&apos;s Anki, but you&apos;re inside the deck.
        </h2>

        <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--accent)]/40 text-[color:var(--accent)]">
                {s.icon}
              </div>
              <p className="mt-5 font-serif text-xs tracking-[0.22em] uppercase text-[color:var(--muted)]">
                Step {i + 1}
              </p>
              <h3 className="mt-2 font-serif text-lg text-[color:var(--foreground)]">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--foreground)]/70">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ModeSection() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <p className="font-serif text-xs tracking-[0.22em] uppercase text-[color:var(--muted)]">
        Try the same scene three ways
      </p>
      <h2 className="mt-4 font-serif text-3xl leading-tight text-[color:var(--foreground)] sm:text-4xl">
        Pick how you want to be in the room.
      </h2>

      <ul className="mt-12 grid gap-6 sm:grid-cols-3">
        {modes.map((m) => (
          <li key={m.id}>
            <ModeCard {...m} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ModeCard({
  id,
  name,
  jp,
  blurb,
  icon,
}: {
  id: string;
  name: string;
  jp: string;
  blurb: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={`/${id}`}
      className="group block h-full rounded-lg border border-[color:var(--rule)] bg-[color:var(--surface)]/40 p-6 transition-all hover:border-[color:var(--accent)] hover:bg-[color:var(--surface)]"
    >
      <div className="flex items-center justify-between">
        <div className="text-[color:var(--accent)]">{icon}</div>
        <span className="font-serif text-2xl text-[color:var(--accent)]/40 transition-colors group-hover:text-[color:var(--accent)]">
          {jp}
        </span>
      </div>
      <h3 className="mt-6 font-serif text-xl text-[color:var(--foreground)]">
        {name}
      </h3>
      <p className="mt-2 font-serif italic text-base leading-snug text-[color:var(--foreground)]/75">
        {blurb}
      </p>
      <p className="mt-6 text-sm font-medium text-[color:var(--accent)]">
        Try it →
      </p>
    </Link>
  );
}

function GuidanceStrip() {
  const levels = ["Open", "Targets shown", "Step-by-step"];
  return (
    <section className="border-t border-[color:var(--rule)]">
      <div className="mx-auto max-w-5xl px-6 py-14">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-serif text-xl text-[color:var(--foreground)]">
            How much help do you want?
          </p>
          <div className="flex flex-wrap gap-2">
            {levels.map((l) => (
              <span
                key={l}
                className="rounded-full border border-[color:var(--rule)] bg-[color:var(--surface)]/50 px-4 py-2 text-sm text-[color:var(--foreground)]/80"
              >
                {l}
              </span>
            ))}
          </div>
        </div>
        <p className="mt-4 text-sm text-[color:var(--muted)]">
          Pick a level inside each mode. Open = bring whatever you have.
          Step-by-step = suggested phrasing.
        </p>
      </div>
    </section>
  );
}

function AuthoringTeaser() {
  return (
    <section className="border-t border-[color:var(--rule)] bg-[color:var(--surface)]/60">
      <div className="mx-auto grid max-w-5xl gap-12 px-6 py-20 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div>
          <p className="font-serif text-xs tracking-[0.22em] uppercase text-[color:var(--muted)]">
            For authors
          </p>
          <h2 className="mt-4 font-serif text-3xl leading-tight text-[color:var(--foreground)] sm:text-4xl">
            Every story is a few text files.
          </h2>
          <p className="mt-6 text-base leading-relaxed text-[color:var(--foreground)]/80">
            Teachers, fans, students — anyone can write one. You sketch the
            scene. The engine picks which review items to drop in.
          </p>
          <p className="mt-4 text-base text-[color:var(--foreground)]/80">
            Would you write one?{" "}
            <Link
              href="/feedback"
              className="font-medium text-[color:var(--accent)] hover:underline"
            >
              Tell us in the form.
            </Link>
          </p>
        </div>
        <AuthoringDiagram />
      </div>
    </section>
  );
}

function AuthoringDiagram() {
  return (
    <div className="rounded-xl border border-[color:var(--rule)] bg-[color:var(--background)] p-6 shadow-sm">
      <div className="flex items-center gap-3 border-b border-[color:var(--rule)] pb-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--accent)]" />
        <span className="font-mono text-xs text-[color:var(--muted)]">
          minshuku-arrival.json
        </span>
      </div>
      <pre className="mt-4 overflow-x-auto font-mono text-xs leading-relaxed text-[color:var(--foreground)]/80">
        {`{
  "npc":      "tanaka-san",
  "place":    "minshuku-entrance",
  "moment":   "first arrival, polite",
  "wants":    ["self-intro", "ます-form"]
}`}
      </pre>
      <div className="mt-4 flex items-center gap-3 text-xs text-[color:var(--muted)]">
        <svg viewBox="0 0 16 16" className="h-4 w-4 text-[color:var(--accent)]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 8h12M10 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="font-serif italic">engine writes the rest</span>
      </div>
    </div>
  );
}

function FeedbackInvite() {
  return (
    <section className="bg-[color:var(--foreground)] text-[color:var(--background)]">
      <div className="mx-auto max-w-5xl px-6 py-16 text-center">
        <h2 className="font-serif text-3xl leading-tight sm:text-4xl">
          Five minutes. Six questions.
        </h2>
        <p className="mt-4 text-base text-[color:var(--background)]/75">
          Your reactions decide what we build next.
        </p>
        <Link
          href="/feedback"
          className="mt-8 inline-block rounded-full bg-[color:var(--accent)] px-8 py-3 text-sm font-medium tracking-wide text-[color:var(--background)] transition-colors hover:bg-[color:var(--background)] hover:text-[color:var(--foreground)]"
        >
          Leave feedback
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[color:var(--rule)] py-8">
      <div className="mx-auto max-w-5xl px-6 text-xs text-[color:var(--muted)]">
        <p className="font-serif">
          A research prototype. Japanese is the wedge — the engine is for
          anything you can learn by being there.
        </p>
      </div>
    </footer>
  );
}
