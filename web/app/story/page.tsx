import { existsSync } from "node:fs";
import { join } from "node:path";
import { StoryTourView } from "@web/components/story/StoryTourView";
import { STORYLINE_BEATS } from "@web/lib/demo/storyline";
import { buildStoryTour } from "@web/lib/demo/storyTour";

// The presenter tour (contract 009): a server component that derives the four
// story days from the engine in-memory (buildStoryTour — runEpisode +
// completeEpisode over fixture replay, never touching web/.data/story-state.json)
// and hands the serializable per-day data to the client tour island.
// force-dynamic + maxDuration like the episode route, since it loads kuromoji
// and replays four fixtures.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata = {
  title: "minshuku — the story tour",
  description:
    "A guided four-evening walkthrough: watch the spaced-repetition queue cast tonight’s scene, and the words become a story.",
};

// Which scene slots have real art dropped in (web/public/story/<slot>.webp).
// Checked server-side so the client mounts an <img> ONLY for files that exist —
// with an empty public/story/ (this contract's shipped state) every beat shows
// its washi placeholder and the page fires ZERO 404s. The user drops a .webp in
// later and it swaps in with no layout shift (the slot box is fixed).
function presentImageSlots(slots: string[]): string[] {
  // In production `process.cwd()` is the web app dir, but under Turbopack dev the
  // configured workspace root (repo root) is the cwd — so check both candidate
  // public dirs and the art is detected in either mode.
  const candidateDirs = [
    join(process.cwd(), "public", "story"),
    join(process.cwd(), "web", "public", "story"),
  ];
  return slots.filter((slot) =>
    candidateDirs.some((dir) => existsSync(join(dir, `${slot}.webp`))),
  );
}

export default async function StoryPage() {
  const tour = await buildStoryTour();
  const presentSlots = presentImageSlots(STORYLINE_BEATS.map((beat) => beat.imageSlot));
  return <StoryTourView beats={STORYLINE_BEATS} days={tour.days} presentImageSlots={presentSlots} />;
}
