"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FEEDBACK_ENDPOINT,
  radioQuestions,
  type FeedbackPayload,
} from "@/lib/feedback";

type Answers = Record<string, string>;

export default function FeedbackPage() {
  const [answers, setAnswers] = useState<Answers>({});
  const [open, setOpen] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");

  const set = (id: string, value: string) =>
    setAnswers((a) => ({ ...a, [id]: value }));

  const allRadiosAnswered = radioQuestions.every((q) => answers[q.id]);

  async function submit() {
    setStatus("sending");
    const payload: FeedbackPayload = {
      mode: answers.mode ?? "",
      guidance: answers.guidance ?? "",
      wouldUse: answers.wouldUse ?? "",
      wouldAuthor: answers.wouldAuthor ?? "",
      level: answers.level ?? "",
      open,
      ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
    };

    if (FEEDBACK_ENDPOINT) {
      try {
        await fetch(FEEDBACK_ENDPOINT, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload),
        });
      } catch {
        /* fire-and-forget — no-cors hides the response anyway */
      }
    } else {
      console.log("[feedback] endpoint not configured. Payload:", payload);
    }
    setStatus("done");
  }

  if (status === "done") {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
        <p className="font-serif text-6xl text-[color:var(--accent)]/40">
          ありがとう
        </p>
        <h1 className="mt-8 font-serif text-3xl text-[color:var(--foreground)]">
          Thank you — genuinely.
        </h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-[color:var(--foreground)]/75">
          Every answer changes what gets built next. If something else
          occurs to you later, just reply to whoever sent you this.
        </p>
        <Link
          href="/"
          className="mt-10 text-sm font-medium text-[color:var(--accent)] hover:underline"
        >
          ← Back to the demo
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <header className="border-b border-[color:var(--rule)] pb-8">
        <Link
          href="/"
          className="text-sm text-[color:var(--accent)] hover:underline"
        >
          ← Back
        </Link>
        <h1 className="mt-6 font-serif text-4xl leading-tight text-[color:var(--foreground)] sm:text-5xl">
          Six questions.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-[color:var(--foreground)]/75">
          You just tried a rough taste of an idea. Be blunt — &quot;I
          wouldn&apos;t use this&quot; is as useful as praise. No email, no
          login.
        </p>
      </header>

      <div className="mt-12 space-y-12">
        {radioQuestions.map((q, idx) => (
          <fieldset key={q.id}>
            <legend className="font-serif text-xl text-[color:var(--foreground)]">
              <span className="text-[color:var(--accent)]">
                {String(idx + 1).padStart(2, "0")}
              </span>{" "}
              {q.question}
            </legend>
            {q.help && (
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                {q.help}
              </p>
            )}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {q.options.map((o) => {
                const selected = answers[q.id] === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => set(q.id, o.value)}
                    className={`rounded-lg border p-4 text-left transition-colors ${
                      selected
                        ? "border-[color:var(--accent)] bg-[color:var(--surface)]"
                        : "border-[color:var(--rule)] bg-[color:var(--surface)]/30 hover:border-[color:var(--accent)]/50"
                    }`}
                  >
                    <span className="font-medium text-[color:var(--foreground)]">
                      {o.label}
                    </span>
                    {o.sub && (
                      <span className="mt-0.5 block text-xs text-[color:var(--muted)]">
                        {o.sub}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        <fieldset>
          <legend className="font-serif text-xl text-[color:var(--foreground)]">
            <span className="text-[color:var(--accent)]">06</span> What&apos;s
            missing, or what would make you actually use it?
          </legend>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            The most valuable box on this page. Ramble freely.
          </p>
          <textarea
            value={open}
            onChange={(e) => setOpen(e.target.value)}
            rows={5}
            placeholder="It felt like… / I wished it… / I'd use this if…"
            className="mt-4 w-full resize-none rounded-lg border border-[color:var(--rule)] bg-[color:var(--background)] p-4 text-base text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
          />
        </fieldset>
      </div>

      <div className="mt-12 flex items-center gap-4 border-t border-[color:var(--rule)] pt-8">
        <button
          onClick={submit}
          disabled={status === "sending" || !allRadiosAnswered}
          className="rounded-full bg-[color:var(--accent)] px-8 py-3 text-sm font-medium tracking-wide text-[color:var(--background)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === "sending" ? "Sending…" : "Send feedback"}
        </button>
        {!allRadiosAnswered && (
          <span className="text-sm text-[color:var(--muted)]">
            Answer the five questions above first.
          </span>
        )}
      </div>
    </main>
  );
}
