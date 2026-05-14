import Link from "next/link";

export function ComingSoon({
  title,
  jp,
  blurb,
}: {
  title: string;
  jp: string;
  blurb: string;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6">
      <section className="max-w-xl text-center">
        <p className="font-serif text-6xl text-[color:var(--accent)]/40">
          {jp}
        </p>
        <h1 className="mt-8 font-serif text-4xl text-[color:var(--foreground)]">
          {title}
        </h1>
        <p className="mt-6 text-base leading-relaxed text-[color:var(--foreground)]/75">
          {blurb}
        </p>
        <p className="mt-4 text-sm text-[color:var(--muted)]">
          Coming soon in the next demo update.
        </p>
        <Link
          href="/"
          className="mt-10 inline-block text-sm font-medium text-[color:var(--accent)] hover:underline"
        >
          ← Back to the demo
        </Link>
      </section>
    </main>
  );
}
