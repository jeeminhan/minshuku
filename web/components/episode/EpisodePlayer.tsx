"use client";

import { useEffect, useState } from "react";
import { CoachBeat } from "./CoachBeat";
import { CompletePanel } from "./CompletePanel";
import type { CompletionState } from "./CompletePanel";
import { DebriefPanel } from "./DebriefPanel";
import { NpcTurn } from "./NpcTurn";
import { PlayerInput } from "./PlayerInput";
import { PlayerTurn } from "./PlayerTurn";
import { StorySoFar } from "./StorySoFar";
import { completeResponseSchema, episodeResponseSchema } from "./episodeData";
import type {
  CompleteResponse,
  CompletedEpisode,
  DialogueTurn,
  EpisodeResponse,
} from "./episodeData";

// Module-level cache: the episode is fetched exactly once per page load, even
// under React strict mode's double effect in dev (contract 003 C2). The UI is
// a progressive reveal over this single response — no per-turn requests.
let episodeFetch: Promise<EpisodeResponse> | null = null;

function errorMessageFrom(body: unknown, status: number): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const { error } = body as { error: unknown };
    if (typeof error === "string") return error;
  }
  return `Episode request failed (HTTP ${status})`;
}

async function requestEpisode(): Promise<EpisodeResponse> {
  const response = await fetch("/api/episode", { cache: "no-store" });
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(errorMessageFrom(body, response.status));
  return episodeResponseSchema.parse(body);
}

function fetchEpisodeOnce(): Promise<EpisodeResponse> {
  episodeFetch ??= requestEpisode().catch((error: unknown) => {
    episodeFetch = null; // a failed load may be retried on reload
    throw error;
  });
  return episodeFetch;
}

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "skipped"; message: string }
  | { phase: "ready"; episode: CompletedEpisode };

interface Completion {
  state: CompletionState;
  error: string | null;
  // The parsed POST /api/episode/complete response — the debrief view is
  // rendered from this alone (never a second episode fetch).
  debrief: CompleteResponse | null;
}

// Reveal rule: every turn up to (but not including) the first player turn the
// learner has not yet submitted text for. On load that is briefing + leading
// NPC turns; each submission reveals the player turn plus the NPC turns that
// follow it.
function revealTurns(ordered: DialogueTurn[], submittedCount: number): DialogueTurn[] {
  const visible: DialogueTurn[] = [];
  let playersRevealed = 0;
  for (const turn of ordered) {
    if (turn.speaker === "player") {
      if (playersRevealed >= submittedCount) break;
      playersRevealed += 1;
    }
    visible.push(turn);
  }
  return visible;
}

export function EpisodePlayer() {
  const [load, setLoad] = useState<LoadState>({ phase: "loading" });
  const [typedByTurn, setTypedByTurn] = useState<Readonly<Record<number, string>>>({});
  const [completion, setCompletion] = useState<Completion>({
    state: "idle",
    error: null,
    debrief: null,
  });

  useEffect(() => {
    let cancelled = false;
    fetchEpisodeOnce()
      .then((episode) => {
        if (cancelled) return;
        setLoad(
          episode.status === "completed"
            ? { phase: "ready", episode }
            : { phase: "skipped", message: episode.message },
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoad({
          phase: "error",
          message: error instanceof Error ? error.message : "Could not load today’s episode.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (load.phase === "loading") {
    return (
      <Shell>
        <BrandMark />
        <p className="mt-10 animate-pulse text-ink-soft">Preparing today’s episode…</p>
      </Shell>
    );
  }

  if (load.phase === "error" || load.phase === "skipped") {
    return (
      <Shell>
        <BrandMark />
        <div
          role={load.phase === "error" ? "alert" : "status"}
          className="mt-10 rounded-sm border border-rust/40 bg-rust-wash px-5 py-4"
        >
          <p className="font-medium text-rust">
            {load.phase === "error" ? "Could not load today’s episode." : "No episode today."}
          </p>
          <p className="mt-1 text-sm text-ink-soft">{load.message}</p>
          {load.phase === "error" && (
            <p className="mt-2 text-sm text-ink-soft">Reload the page to try again.</p>
          )}
        </div>
      </Shell>
    );
  }

  const { episode } = load;
  const orderedTurns = [...episode.log.turns].sort((a, b) => a.turn - b.turn);
  const playerTurns = orderedTurns.filter((turn) => turn.speaker === "player");
  const submittedCount = Object.keys(typedByTurn).length;
  const visibleTurns = revealTurns(orderedTurns, submittedCount);
  const nextPlayerTurn = playerTurns[submittedCount] ?? null;
  const finished = nextPlayerTurn === null;
  const passiveItems = episode.items.filter((item) => item.mode === "passive");
  const itemsById = new Map(episode.items.map((item) => [item.itemId, item]));

  const handlePlayerSubmit = (text: string) => {
    if (nextPlayerTurn === null) return;
    setTypedByTurn((prev) => ({ ...prev, [nextPlayerTurn.turn]: text }));
  };

  const handleComplete = async () => {
    if (completion.state !== "idle") return;
    setCompletion({ state: "pending", error: null, debrief: null });
    try {
      const response = await fetch("/api/episode/complete", { method: "POST" });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(errorMessageFrom(body, response.status));
      const parsed = completeResponseSchema.parse(body);
      setCompletion({ state: "done", error: null, debrief: parsed });
    } catch (error: unknown) {
      setCompletion({
        state: "idle",
        error: error instanceof Error ? error.message : "Could not complete the episode.",
        debrief: null,
      });
    }
  };

  return (
    <Shell>
      <header className="border-b border-washi-deep pb-6">
        <BrandMark />
        <h1 className="mt-3 font-display text-4xl font-semibold text-ink sm:text-5xl">
          Day {episode.story.day}
          <span lang="ja" className="ml-3 align-middle text-xl font-normal text-ink-soft sm:text-2xl">
            {episode.story.day}日目
          </span>
        </h1>
        <p className="mt-3 text-sm text-ink-soft">
          Tonight’s scene is the review — play your turns and the words come back to you. Dotted
          words are tappable.
        </p>
      </header>
      {episode.story.summary !== "" && <StorySoFar summary={episode.story.summary} />}
      <section aria-label="Today’s dialogue" className="mt-8">
        <ol className="flex flex-col gap-4">
          <CoachBeat kind="briefing" text={episode.log.briefing} />
          {visibleTurns.map((turn) =>
            turn.speaker === "player" ? (
              <PlayerTurn
                key={turn.turn}
                turn={turn}
                typedText={typedByTurn[turn.turn] ?? ""}
                itemsById={itemsById}
              />
            ) : (
              <NpcTurn
                key={turn.turn}
                turn={turn.turn}
                speaker={turn.speaker}
                text={turn.text}
                passiveItems={passiveItems}
              />
            ),
          )}
          {finished && <CoachBeat kind="result" text={episode.log.result} />}
        </ol>
      </section>
      {finished ? (
        completion.debrief !== null ? (
          <DebriefPanel debrief={completion.debrief} />
        ) : (
          <CompletePanel
            state={completion.state}
            error={completion.error}
            onComplete={() => {
              void handleComplete();
            }}
          />
        )
      ) : (
        <PlayerInput turnNumber={nextPlayerTurn.turn} onSubmit={handlePlayerSubmit} />
      )}
    </Shell>
  );
}

// A centered reading column — comfortable for mixed JA/EN text, never
// full-bleed (≤ 960px per contract 003 C8).
function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[760px] px-5 pt-10 pb-24 sm:pt-14">{children}</div>;
}

function BrandMark() {
  return (
    <p className="text-sm font-medium tracking-[0.28em] text-kaki">
      <span lang="ja">民宿</span> MINSHUKU
    </p>
  );
}
