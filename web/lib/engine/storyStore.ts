import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";

// Story-so-far persistence for contract 002: a single JSON file at
// web/.data/story-state.json, read from disk on EVERY request and rewritten
// on every state change. No in-memory cache — deleting the file resets the
// story to day 1 on the very next request, without a server restart.
// (cwd is web/ under `next dev`/`next start`, per HARNESS.md.)
const STORY_STATE_PATH = join(process.cwd(), ".data", "story-state.json");

// The not-yet-folded-in result of the current day's generated episode.
// Recorded by GET /api/episode, consumed by POST /api/episode/complete.
const PendingEpisodeSchema = z.object({
  day: z.number().int().min(1),
  result: z.string(),
  templateId: z.string(),
  location: z.string().nullable(),
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
});

export type PendingEpisode = z.infer<typeof PendingEpisodeSchema>;
export type StoryState = z.infer<typeof StoryStateSchema>;

export function freshStoryState(): StoryState {
  return {
    day: 1,
    summary: "",
    pending: null,
    recentContext: { lastTemplateId: null, lastLocation: null },
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

// Fold the pending episode into the story: append its result line VERBATIM
// (with a day-label prefix), advance the day, clear pending, and carry the
// episode's template/location forward as the next day's recentContext.
// Returns null when there is nothing pending (caller maps that to a 409).
// Pure — the caller persists the returned state. No LLM involved: the
// summary is accumulated log.result lines, nothing more.
export function foldPendingIntoStory(state: StoryState): StoryState | null {
  if (!state.pending) return null;
  const line = `Day ${state.pending.day}: ${state.pending.result}`;
  return {
    day: state.day + 1,
    summary: state.summary === "" ? line : `${state.summary}\n${line}`,
    pending: null,
    recentContext: {
      lastTemplateId: state.pending.templateId,
      lastLocation: state.pending.location,
    },
  };
}
