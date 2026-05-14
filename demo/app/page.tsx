import Link from "next/link";

const modes = [
  {
    id: "voice",
    name: "Voice",
    jp: "声",
    blurb:
      "The host mom speaks to you. You reply out loud. The room is quiet, the conversation isn't.",
    detail:
      "Audio-first interaction with Japanese TTS and your microphone. No typing.",
    status: "preview",
  },
  {
    id: "visual-novel",
    name: "Visual novel",
    jp: "場面",
    blurb:
      "A portrait, a room, a line of dialogue. You write your reply. It feels like reading a book you're inside.",
    detail:
      "Illustrated scene with character art. Typed Japanese replies. Closest to a game.",
    status: "preview",
  },
  {
    id: "choice",
    name: "Choice",
    jp: "選択",
    blurb:
      "Three Japanese replies are offered. You pick one. The conversation moves on. Low friction, fast clarity.",
    detail:
      "Pick from prewritten options. Good for low confidence or first contact with the language.",
    status: "preview",
  },
] as const;

export default function Home() {
  return (
    <main className="flex-1">
      <Hero />
      <Pitch />
      <ModeSection />
      <GuidanceSection />
      <AuthoringTeaser />
      <FeedbackInvite />
      <Footer />
    </main>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-3xl px-6 pt-24 pb-12 sm:pt-32">
      <p className="font-serif text-sm tracking-[0.18em] uppercase text-[color:var(--muted)]">
        minshuku · 民宿
      </p>
      <h1 className="mt-6 font-serif text-5xl leading-[1.05] tracking-tight text-[color:var(--foreground)] sm:text-6xl">
        Live inside a Japanese story
        <span className="block text-[color:var(--accent)]">
          to learn the language.
        </span>
      </h1>
      <p className="mt-8 max-w-xl text-lg leading-relaxed text-[color:var(--foreground)]/80">
        Step into a small countryside guesthouse. Meet the family who runs it.
        Have a conversation with them in Japanese, in whichever way feels
        right for you today. We&apos;re prototyping three of them.
      </p>
      <p className="mt-6 max-w-xl text-base leading-relaxed text-[color:var(--muted)]">
        This page is a research demo. Try each mode, then tell us what worked.
      </p>
    </section>
  );
}

function Pitch() {
  return (
    <section className="border-y border-[color:var(--rule)] bg-[color:var(--surface)]">
      <div className="mx-auto grid max-w-3xl gap-10 px-6 py-16 sm:grid-cols-3">
        <Pillar
          label="01"
          title="Stories, not flashcards"
          body="The unit isn't a word. It's a moment in someone's house. You learn by being there."
        />
        <Pillar
          label="02"
          title="Pick your scaffolding"
          body="Open-ended, target words shown, or step-by-step coaching — whichever your day needs."
        />
        <Pillar
          label="03"
          title="Anyone can write one"
          body="The story you're about to play could've been written by a teacher, a fan, or you."
        />
      </div>
    </section>
  );
}

function Pillar({
  label,
  title,
  body,
}: {
  label: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <p className="font-serif text-xs tracking-[0.2em] text-[color:var(--accent)]">
        {label}
      </p>
      <h3 className="mt-3 font-serif text-xl text-[color:var(--foreground)]">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-[color:var(--foreground)]/75">
        {body}
      </p>
    </div>
  );
}

function ModeSection() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <p className="font-serif text-sm tracking-[0.18em] uppercase text-[color:var(--muted)]">
        Try the same scene three ways
      </p>
      <h2 className="mt-4 font-serif text-3xl leading-tight text-[color:var(--foreground)]">
        Same dialogue. Same person. Three different ways to be in the room.
      </h2>
      <p className="mt-6 text-base leading-relaxed text-[color:var(--foreground)]/75">
        You&apos;ve just arrived at the minshuku after a long trip. Tanaka-san,
        the host mom, meets you at the entrance. Pick a mode below and play
        the four-turn opener. Then try another. We want to know which one
        felt like it was made for you.
      </p>
      <ul className="mt-12 grid gap-6">
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
  detail,
}: {
  id: string;
  name: string;
  jp: string;
  blurb: string;
  detail: string;
}) {
  return (
    <Link
      href={`/${id}`}
      className="group block rounded-lg border border-[color:var(--rule)] bg-[color:var(--surface)]/40 p-8 transition-all hover:border-[color:var(--accent)] hover:bg-[color:var(--surface)]"
    >
      <div className="flex items-baseline justify-between gap-6">
        <h3 className="font-serif text-2xl text-[color:var(--foreground)]">
          {name}
        </h3>
        <span className="font-serif text-3xl text-[color:var(--accent)]/60 transition-colors group-hover:text-[color:var(--accent)]">
          {jp}
        </span>
      </div>
      <p className="mt-4 font-serif text-lg italic leading-snug text-[color:var(--foreground)]/85">
        {blurb}
      </p>
      <p className="mt-4 text-sm leading-relaxed text-[color:var(--muted)]">
        {detail}
      </p>
      <p className="mt-6 text-sm font-medium text-[color:var(--accent)]">
        Play this mode →
      </p>
    </Link>
  );
}

function GuidanceSection() {
  return (
    <section className="border-t border-[color:var(--rule)] bg-[color:var(--surface)]/60">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <p className="font-serif text-sm tracking-[0.18em] uppercase text-[color:var(--muted)]">
          How much help do you want?
        </p>
        <h2 className="mt-4 font-serif text-3xl leading-tight text-[color:var(--foreground)]">
          A toggle, inside each mode. Three levels of guidance.
        </h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          <Guidance
            level="Open"
            body="Just the briefing. You bring whatever Japanese you have."
          />
          <Guidance
            level="Targets shown"
            body="A short list of words and grammar to weave in. The rest is up to you."
          />
          <Guidance
            level="Step-by-step"
            body="Each player turn comes with a suggested phrasing. You can use it or stray."
          />
        </div>
      </div>
    </section>
  );
}

function Guidance({ level, body }: { level: string; body: string }) {
  return (
    <div className="border-l-2 border-[color:var(--accent)]/40 pl-5">
      <p className="font-serif text-lg text-[color:var(--foreground)]">
        {level}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[color:var(--foreground)]/75">
        {body}
      </p>
    </div>
  );
}

function AuthoringTeaser() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <p className="font-serif text-sm tracking-[0.18em] uppercase text-[color:var(--muted)]">
        The big idea
      </p>
      <h2 className="mt-4 font-serif text-3xl leading-tight text-[color:var(--foreground)]">
        Every story here is just a few text files. You could write the next one.
      </h2>
      <p className="mt-6 text-base leading-relaxed text-[color:var(--foreground)]/80">
        Behind every scene is a small JSON file describing the people, the
        place, and the moment. We&apos;re building the tools so a teacher, a
        fan of a show, or a student finishing a unit can write their own
        story — and someone else can step inside it tomorrow.
      </p>
      <pre className="mt-8 overflow-x-auto rounded-lg border border-[color:var(--rule)] bg-[color:var(--surface)]/60 p-6 text-xs leading-relaxed text-[color:var(--foreground)]/80">
        {`{
  "npc": "tanaka-san",
  "location": "minshuku-entrance",
  "moment": "first arrival, polite stranger meeting",
  "targets": ["polite ます-form", "self-introduction"],
  "want_to_teach": ["お世話になります", "よろしくお願いします"]
}`}
      </pre>
      <p className="mt-6 text-base leading-relaxed text-[color:var(--foreground)]/80">
        Would you write one? Tell us in the form below.
      </p>
    </section>
  );
}

function FeedbackInvite() {
  return (
    <section className="border-t border-[color:var(--rule)] bg-[color:var(--foreground)] text-[color:var(--background)]">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <p className="font-serif text-sm tracking-[0.18em] uppercase text-[color:var(--background)]/60">
          We need 5 minutes of your honest reactions
        </p>
        <h2 className="mt-4 font-serif text-3xl leading-tight">
          Tell us what worked, what didn&apos;t, and what you&apos;d want next.
        </h2>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-[color:var(--background)]/80">
          Six short questions. No email required. Your answers shape what we
          build next.
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
    <footer className="border-t border-[color:var(--rule)] py-10">
      <div className="mx-auto max-w-3xl px-6 text-sm text-[color:var(--muted)]">
        <p className="font-serif">
          minshuku is a research prototype, not a product. The Japanese
          language is the wedge; the platform is for anything you can learn
          by being there.
        </p>
      </div>
    </footer>
  );
}
