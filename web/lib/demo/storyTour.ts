import { tmpdir } from "node:os";
import { join } from "node:path";
import { day4LessonBatch } from "../engine/lessonBatch";
import { runEpisode } from "../engine/runEpisode";
import { completeEpisode, freshStoryState } from "../engine/storyStore";
import type { StoryState, StoryStore } from "../engine/storyStore";
import { lookupItemDetails } from "../engine/itemDetails";
import type { CompleteResponse, DialogueTurn, EpisodeItem } from "../../components/episode/episodeData";

// Contract 009 — derive the four story days for the presenter tour from the
// SAME engine path the play view and seed-demo use (runEpisode + completeEpisode
// over fixture replay), but against a private in-memory store so the tour NEVER
// reads, writes, or depends on web/.data/story-state.json. The page renders
// these derived per-day records; nothing here is hardcoded dialogue.

// The day-4 lesson batch lands at the day-4 boundary exactly as seed-demo.ts
// appends it (after simulating day 3), so day 4 casts
// `minshuku-arrival-with-mom` against the new てもいい/持つ lessons.
const SIMULATED_DAYS = 4;
const LESSON_BATCH_DAY = 4;

// Scene-run logs go to os.tmpdir() — the only place this server simulation may
// write, and never the repo logs/ the file store uses. Mirrors cookieStore's
// MemoryStoryStore / FileStoryStore split.
const TOUR_LOG_DIR = join(tmpdir(), "minshuku", "logs", "story-tour");

// A StoryStore that holds state in a field — runEpisode reads from it and writes
// its `pending` back, and completeEpisode runs on the returned value. No disk,
// no cookie. Exactly the shape cookieStore's replay uses, kept local to the tour.
class InMemoryStoryStore implements StoryStore {
  readonly logDir = TOUR_LOG_DIR;

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

// One serializable day of the tour. Only plain data crosses to the client
// island — never engine objects. Mirrors the play view's display shapes
// (DialogueTurn / EpisodeItem / CompleteResponse["debrief"]) so the tour's
// renderers reuse the same component machinery.
export interface TourDay {
  day: number;
  templateId: string;
  // The episode briefing + result coach text, and the ordered dialogue turns
  // (NPC + player), straight from the derived EpisodeResult.
  briefing: string;
  result: string;
  turns: DialogueTurn[];
  // The day's joined items (actives + passives) — the anchor set highlighting
  // is filtered against, so a beat can only highlight real episode items.
  items: EpisodeItem[];
  // The persisted summary the day's generation ran against ("" on day 1).
  summary: string;
  // The end-of-day knowledge delta (learned / strengthened / dueTomorrow),
  // joined to display fields — same shape POST /api/episode/complete returns.
  debrief: CompleteResponse["debrief"];
}

export interface StoryTour {
  days: TourDay[];
}

function toDialogueTurns(turns: { turn: number; speaker: string; text: string }[]): DialogueTurn[] {
  return turns.map((turn) => ({ turn: turn.turn, speaker: turn.speaker, text: turn.text }));
}

// Join the engine debrief (ids only) to content-pack display fields — exactly
// what app/api/episode/complete/route.ts does for the play view's DebriefPanel.
function joinDebrief(debrief: ReturnType<typeof completeEpisode>): CompleteResponse["debrief"] {
  if (debrief === null) {
    throw new Error("Story tour: nothing pending after a completed episode run");
  }
  const join = (entry: { itemId: string; itemType: "vocab" | "grammar" }) => ({
    itemId: entry.itemId,
    itemType: entry.itemType,
    ...lookupItemDetails(entry.itemId, entry.itemType),
  });
  return {
    learned: debrief.debrief.learned.map(join),
    strengthened: debrief.debrief.strengthened.map((entry) => ({
      ...join(entry),
      outcome: entry.outcome,
    })),
    dueTomorrow: debrief.debrief.dueTomorrow.map((entry) => ({
      ...join({ itemId: entry.itemId, itemType: entry.itemType }),
    })),
  };
}

function withDay4LessonBatch(state: StoryState): StoryState {
  return { ...state, reviewItems: [...state.reviewItems, ...day4LessonBatch()] };
}

// Simulate one story day to completion against the in-memory store and capture
// its derived display data. Returns the day's TourDay plus the advanced state
// to carry into the next day. The runEpisode → read → completeEpisode → write
// sequence is the one seed-demo's simulateDay and cookieStore's replayDay use.
async function simulateTourDay(state: StoryState): Promise<{ tourDay: TourDay; next: StoryState }> {
  const store = new InMemoryStoryStore(state);
  const episode = await runEpisode(store);
  if (episode.status !== "completed") {
    throw new Error(`Story tour: day ${state.day} episode skipped — ${episode.message}`);
  }
  // completeEpisode is a free function on the STATE value (not a store method) —
  // call it directly on the store's pending-bearing state after runEpisode.
  const completed = completeEpisode(store.state);
  const debrief = joinDebrief(completed);
  if (completed === null) {
    throw new Error(`Story tour: nothing pending after day ${state.day}'s episode`);
  }
  return {
    tourDay: {
      day: episode.story.day,
      templateId: episode.log.templateId,
      briefing: episode.log.briefing,
      result: episode.log.result,
      turns: toDialogueTurns(episode.log.turns),
      items: episode.items,
      summary: episode.story.summary,
      debrief,
    },
    next: completed.state,
  };
}

// Build the four-day tour. Forces MINSHUKU_FAKE_LLM=1 (same as seed-demo's
// main()) so it always replays fixtures — deterministic, no key, never live
// Gemini — and never touches the persisted play-view state.
export async function buildStoryTour(): Promise<StoryTour> {
  process.env.MINSHUKU_FAKE_LLM = "1";

  let state = freshStoryState();
  const days: TourDay[] = [];
  for (let day = 1; day <= SIMULATED_DAYS; day += 1) {
    // The lesson batch lands at the day-4 boundary — before day 4's episode
    // runs (its fixture was recorded against the batched items), matching
    // seed-demo's append-after-day-3 exactly.
    if (day === LESSON_BATCH_DAY) state = withDay4LessonBatch(state);
    const { tourDay, next } = await simulateTourDay(state);
    days.push(tourDay);
    state = next;
  }
  return { days };
}
