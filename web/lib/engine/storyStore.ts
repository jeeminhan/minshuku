import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { z } from "zod";
import { applyOutcome } from "@engine/srs/intervals";
import { pickDueItems } from "@engine/srs/pickDueItems";
import type { Outcome, ReviewItem } from "@engine/types";
import { demoClock, demoReviewItems } from "./demoLearner";

// Story-so-far persistence for contract 002: a single JSON file at
// web/.data/story-state.json, read from disk on EVERY request and rewritten
// on every state change. No in-memory cache — deleting the file resets the
// story to day 1 on the very next request, without a server restart.
// (cwd is web/ under `next dev`/`next start`, per HARNESS.md.)
// Contract 004 adds the learner's ReviewItem[] to the state: GET reads them
// (never writes them), POST /api/episode/complete evolves them through the
// engine's applyOutcome. A pre-004 state file fails the schema below and
// produces the loud "corrupt — delete to reset" error; deleting the file is
// the documented migration.
// The file store anchors on the web app directory. Under `next dev`/`next
// start` that IS process.cwd() (all next commands run from web/). The
// standalone production server (contract 007's local QA path) chdirs into
// web/.next/standalone/web — strip that suffix so the file store keeps
// reading/writing the same web/.data and repo-level logs/ as every other
// entry point (state inside .next/ would be invisible to seed-demo and wiped
// by the next build).
function webAppDir(): string {
  const cwd = process.cwd();
  const standaloneSuffix = `${sep}${join(".next", "standalone", "web")}`;
  return cwd.endsWith(standaloneSuffix)
    ? cwd.slice(0, cwd.length - standaloneSuffix.length)
    : cwd;
}

const STORY_STATE_PATH = join(webAppDir(), ".data", "story-state.json");

const ItemTypeSchema = z.enum(["vocab", "grammar"]);
const RecallModeSchema = z.enum(["active", "passive"]);
const OutcomeSchema = z.enum([
  "missed",
  "recognized",
  "produced_with_help",
  "produced",
  "mastered",
]);

// Mirrors the engine's ReviewItem (src/lib/types.ts) — structural identity is
// what lets state.reviewItems flow into runScene/applyOutcome/pickDueItems.
const ReviewItemSchema = z.object({
  itemId: z.string(),
  itemType: ItemTypeSchema,
  lastReviewedAt: z.string().nullable(),
  nextReviewAt: z.string().nullable(),
  ease: z.number(),
  interval: z.number(),
  lapses: z.number(),
});

// Mirrors the engine's ItemAssignment.
const ItemAssignmentSchema = z.object({
  itemId: z.string(),
  itemType: ItemTypeSchema,
  mode: RecallModeSchema,
});

// One aggregated active-target outcome from the day's SceneRunLog, with the
// itemType joined in (log.itemOutcomes carries only itemId/mode/outcome).
const PendingOutcomeSchema = z.object({
  itemId: z.string(),
  itemType: ItemTypeSchema,
  outcome: OutcomeSchema,
});

// The not-yet-folded-in result of the current day's generated episode.
// Recorded by GET /api/episode, consumed by POST /api/episode/complete.
const PendingEpisodeSchema = z.object({
  day: z.number().int().min(1),
  result: z.string(),
  templateId: z.string(),
  location: z.string().nullable(),
  // Aggregated outcomes for the day's ACTIVE targets — applied to
  // reviewItems on complete, and the source of the debrief's "strengthened".
  itemOutcomes: z.array(PendingOutcomeSchema),
  // The day's passive ItemAssignments — the debrief's "learned". Passives
  // get NO SRS update (engine precedent: only actives are evaluated).
  passiveItems: z.array(ItemAssignmentSchema),
});

const StoryStateSchema = z.object({
  day: z.number().int().min(1),
  summary: z.string(),
  pending: PendingEpisodeSchema.nullable(),
  // Day N's template/location, fed into day N+1's buildScenePlan so
  // consecutive days don't replay the same scene.
  recentContext: z.object({
    lastTemplateId: z.string().nullable(),
    lastLocation: z.string().nullable(),
  }),
  // The persisted learner SRS state, in seed order (pickDueItems tie-breaks
  // by stable sort on input order — preserving order is load-bearing).
  reviewItems: z.array(ReviewItemSchema),
});

export type PendingOutcome = z.infer<typeof PendingOutcomeSchema>;
export type PendingEpisode = z.infer<typeof PendingEpisodeSchema>;
export type StoryState = z.infer<typeof StoryStateSchema>;

export function freshStoryState(): StoryState {
  return {
    day: 1,
    summary: "",
    pending: null,
    recentContext: { lastTemplateId: null, lastLocation: null },
    reviewItems: demoReviewItems(),
  };
}

// Missing file → fresh day-1 state (that IS the reset mechanism).
// Unparseable file → fail loud; never silently restart the story.
export function readStoryState(): StoryState {
  if (!existsSync(STORY_STATE_PATH)) {
    return freshStoryState();
  }
  const raw = readFileSync(STORY_STATE_PATH, "utf8");
  try {
    return StoryStateSchema.parse(JSON.parse(raw));
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Corrupt story state at ${STORY_STATE_PATH} — delete the file to reset to day 1. (${detail})`,
    );
  }
}

export function writeStoryState(state: StoryState): void {
  mkdirSync(dirname(STORY_STATE_PATH), { recursive: true });
  writeFileSync(STORY_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

// Storage abstraction (contract 007): runEpisode and the API routes take a
// StoryStore by injection instead of calling readStoryState/writeStoryState
// directly, so the same code path serves the local file store (default,
// behavior unchanged) and the Vercel cookie store (MINSHUKU_STORE=cookie,
// web/lib/engine/cookieStore.ts) where the filesystem is read-only.
export interface StoryStore {
  // Where runScene appends its scene-run JSONL log. The file store keeps the
  // repo-level logs/web; the cookie store points at os.tmpdir() — the only
  // writable path on a serverless filesystem.
  readonly logDir: string;
  read(): Promise<StoryState>;
  write(state: StoryState): Promise<void>;
  // Serialized cookie value the route must Set-Cookie after a write, or null
  // when nothing needs to reach the client (the file store is always null —
  // its write already persisted to disk).
  cookieToSet(): string | null;
}

// The repo-level logs/ directory is one level up from the web app dir.
// Passed explicitly — never rely on the engine's cwd default, which would
// write into web/logs.
const WEB_LOG_DIR = join(webAppDir(), "..", "logs", "web");

// The local default: the pre-007 file behavior, verbatim, behind the
// StoryStore interface.
export class FileStoryStore implements StoryStore {
  readonly logDir = WEB_LOG_DIR;

  async read(): Promise<StoryState> {
    return readStoryState();
  }

  async write(state: StoryState): Promise<void> {
    writeStoryState(state);
  }

  cookieToSet(): string | null {
    return null;
  }
}

// Debrief data computed at completion (contract 004), in engine terms — the
// API route joins each entry with surface/reading/meaning for the response.
export interface EpisodeDebrief {
  // New passives met today (no SRS update — they resurface via dueTomorrow).
  learned: PendingEpisode["passiveItems"];
  // Active targets the learner actually produced today.
  strengthened: PendingOutcome[];
  // The evolved items due at the NEXT day's clock, in pickDueItems order.
  dueTomorrow: ReviewItem[];
}

export interface CompletedDay {
  state: StoryState;
  debrief: EpisodeDebrief;
}

const STRENGTHENED_OUTCOMES: readonly Outcome[] = [
  "produced_with_help",
  "produced",
  "mastered",
];

// Apply the day's aggregated outcomes exactly the way scripts/run-scene.ts
// does (applySceneOutcomes): one engine applyOutcome per item that has an
// entry in itemOutcomes, at the COMPLETED day's clock; items with no outcome
// (passives, off-plan items) are left untouched.
function applyPendingOutcomes(
  items: StoryState["reviewItems"],
  outcomes: PendingOutcome[],
  now: Date,
): StoryState["reviewItems"] {
  const outcomesByItem = new Map(outcomes.map((o) => [o.itemId, o.outcome]));
  return items.map((item) => {
    const outcome = outcomesByItem.get(item.itemId);
    return outcome ? applyOutcome(item, outcome, now) : item;
  });
}

// Complete the pending episode (contract 004, extending contract 002's
// foldPendingIntoStory): append its result line VERBATIM (with a day-label
// prefix), advance the day, clear pending, carry the episode's
// template/location forward as the next day's recentContext, evolve
// reviewItems through the engine's applyOutcome, and compute the debrief.
// Returns null when there is nothing pending (caller maps that to a 409 and
// must NOT write — a 409 never applies outcomes). Pure — the caller persists
// the returned state. No LLM involved: the summary is accumulated log.result
// lines, nothing more.
export function completeEpisode(state: StoryState): CompletedDay | null {
  if (!state.pending) return null;
  const pending = state.pending;
  const reviewItems = applyPendingOutcomes(
    state.reviewItems,
    pending.itemOutcomes,
    demoClock(pending.day),
  );
  const nextDay = state.day + 1;
  const line = `Day ${pending.day}: ${pending.result}`;
  return {
    state: {
      day: nextDay,
      summary: state.summary === "" ? line : `${state.summary}\n${line}`,
      pending: null,
      recentContext: {
        lastTemplateId: pending.templateId,
        lastLocation: pending.location,
      },
      reviewItems,
    },
    debrief: {
      learned: pending.passiveItems,
      strengthened: pending.itemOutcomes.filter((o) =>
        STRENGTHENED_OUTCOMES.includes(o.outcome),
      ),
      dueTomorrow: pickDueItems(reviewItems, demoClock(nextDay)),
    },
  };
}
