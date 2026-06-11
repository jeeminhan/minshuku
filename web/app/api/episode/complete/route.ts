import { NextResponse } from "next/server";
import { foldPendingIntoStory, readStoryState, writeStoryState } from "@web/lib/engine/storyStore";

// Never prerender: this route reads/writes runtime state on every request.
export const dynamic = "force-dynamic";

// Advance the story by one day: fold the pending episode's result line into
// the persisted summary verbatim, increment the day, clear pending. No LLM —
// the summary is accumulated log.result lines, nothing more.
export async function POST(): Promise<NextResponse> {
  try {
    const state = readStoryState();
    const next = foldPendingIntoStory(state);
    if (!next) {
      return NextResponse.json(
        {
          error:
            "No pending episode to complete — GET /api/episode to generate today's episode first.",
        },
        { status: 409 },
      );
    }
    writeStoryState(next);
    return NextResponse.json({ day: next.day, summary: next.summary });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unexpected error while completing the episode";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
