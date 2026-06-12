import { tmpdir } from "node:os";
import { join } from "node:path";
import { day4LessonBatch } from "./lessonBatch";
import { runEpisode } from "./runEpisode";
import { FileStoryStore, completeEpisode, freshStoryState } from "./storyStore";
import type { StoryState, StoryStore } from "./storyStore";

// Cookie-replay store (contract 007): on Vercel the filesystem is read-only,
// but in fixture mode (fixed demo clock/seed, fixture replay) the entire
// StoryState is a deterministic function of the day number — state at the
// start of day N = replay days 1..N−1 through the same runEpisode() +
// completeEpisode() path seed-demo uses (fast local computation, no LLM). So
// the cookie holds only { day, seeded, pending }:
//   day     — current story day,
//   seeded  — whether the day-4 lesson batch applies (replay appends
//             day4LessonBatch() at the day-4 boundary exactly as
//             scripts/seed-demo.ts does — one shared definition),
//   pending — set by GET (via Set-Cookie), required and cleared by POST
//             complete, preserving the file store's 409-on-double-complete.
// The full PendingEpisode is NOT in the cookie: read() reconstructs it by
// re-running the current day's episode (deterministic), so completeEpisode()
// sees exactly what the file store would have persisted.

export const STORY_COOKIE_NAME = "minshuku-story";

// Options for response.cookies.set — plain object so this module never
// imports next/server (seed-demo's tsx run pulls in storyStore/runEpisode,
// and nothing engine-side should depend on Next).
export const STORY_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
} as const;

export interface StoryCookiePayload {
  day: number;
  seeded: boolean;
  pending: boolean;
}

// Compact `v1.<day>.<seeded>.<pending>` — no characters any cookie encoder
// rewrites, so the value round-trips byte-identically through Set-Cookie,
// curl jars, and Playwright contexts.
export function serializeStoryCookie(payload: StoryCookiePayload): string {
  return `v1.${payload.day}.${payload.seeded ? 1 : 0}.${payload.pending ? 1 : 0}`;
}

const COOKIE_PATTERN = /^v1\.([1-9]\d*)\.([01])\.([01])$/;

// Missing cookie → null (fresh day-1 state — that IS the reset mechanism,
// mirroring the file store's missing-file behavior). Unparseable cookie →
// fail loud; never silently restart the story.
function parseStoryCookie(raw: string | undefined): StoryCookiePayload | null {
  if (raw === undefined) return null;
  const match = COOKIE_PATTERN.exec(raw);
  if (!match) {
    throw new Error(
      `Corrupt ${STORY_COOKIE_NAME} cookie ("${raw}") — clear cookies (or visit /demo) to reset.`,
    );
  }
  return { day: Number(match[1]), seeded: match[2] === "1", pending: match[3] === "1" };
}

// Scene-run logs go to os.tmpdir() — the only writable path on Vercel. The
// engine stays untouched: logDir is already a runScene parameter.
const COOKIE_LOG_DIR = join(tmpdir(), "minshuku", "logs", "web");

// In-memory store backing the replay: each replayed day's runEpisode() needs
// a store to read from and record `pending` into, and nothing during replay
// may touch disk (beyond the tmpdir scene-run log).
class MemoryStoryStore implements StoryStore {
  readonly logDir = COOKIE_LOG_DIR;

  constructor(public state: StoryState) {}

  async read(): Promise<StoryState> {
    return this.state;
  }

  async write(state: StoryState): Promise<void> {
    this.state = state;
  }

  cookieToSet(): string | null {
    return null;
  }
}

function withDay4LessonBatch(state: StoryState): StoryState {
  return { ...state, reviewItems: [...state.reviewItems, ...day4LessonBatch()] };
}

// Replay one story day to completion against the in-memory store: the exact
// runEpisode() + completeEpisode() sequence seed-demo's simulateDay uses —
// never constructing SRS numbers by hand.
async function replayDay(state: StoryState, day: number): Promise<StoryState> {
  const store = new MemoryStoryStore(state);
  const episode = await runEpisode(store);
  if (episode.status !== "completed") {
    throw new Error(`Cookie replay: day ${day} episode skipped — ${episode.message}`);
  }
  const completed = completeEpisode(store.state);
  if (!completed) {
    throw new Error(`Cookie replay: nothing pending after day ${day}'s completed episode run`);
  }
  return completed.state;
}

export class CookieStoryStore implements StoryStore {
  readonly logDir = COOKIE_LOG_DIR;
  private readonly payload: StoryCookiePayload | null;
  private next: StoryCookiePayload | null = null;

  constructor(rawCookie: string | undefined) {
    this.payload = parseStoryCookie(rawCookie);
  }

  async read(): Promise<StoryState> {
    const payload = this.payload ?? { day: 1, seeded: false, pending: false };
    let state = freshStoryState();
    for (let day = 1; day <= payload.day; day += 1) {
      // The lesson batch lands at the day-4 BOUNDARY — before day 4's own
      // episode runs (its fixture was recorded against the batched items),
      // matching seed-demo's append-after-day-3 exactly.
      if (payload.seeded && day === 4) state = withDay4LessonBatch(state);
      if (day === payload.day) break;
      state = await replayDay(state, day);
    }
    if (payload.pending) {
      // Reconstruct the full PendingEpisode the cookie's boolean stands for:
      // re-run today's episode (deterministic fixture replay) so the
      // completion path sees exactly what the file store would have read.
      const store = new MemoryStoryStore(state);
      const episode = await runEpisode(store);
      if (episode.status !== "completed") {
        throw new Error(
          `Cookie replay: pending day ${payload.day} episode skipped — ${episode.message}`,
        );
      }
      state = store.state;
    }
    return state;
  }

  async write(state: StoryState): Promise<void> {
    this.next = {
      day: state.day,
      // seeded survives every write: once /demo applied the lesson batch it
      // is part of the learner's history forever.
      seeded: this.payload?.seeded ?? false,
      pending: state.pending !== null,
    };
  }

  cookieToSet(): string | null {
    return this.next === null ? null : serializeStoryCookie(this.next);
  }
}

export function isCookieStoreMode(): boolean {
  return process.env.MINSHUKU_STORE === "cookie";
}

// The one store-selection point the API routes call: cookie store when
// MINSHUKU_STORE=cookie (Vercel), file store otherwise (local default,
// behavior unchanged).
export function createStoryStore(rawCookie: string | undefined): StoryStore {
  return isCookieStoreMode() ? new CookieStoryStore(rawCookie) : new FileStoryStore();
}
