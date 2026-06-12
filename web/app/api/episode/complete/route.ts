import { NextResponse } from "next/server";
import type { ItemType, Outcome } from "@engine/types";
import { lookupItemDetails } from "@web/lib/engine/itemDetails";
import { completeEpisode, readStoryState, writeStoryState } from "@web/lib/engine/storyStore";
import type { EpisodeDebrief } from "@web/lib/engine/storyStore";

// Never prerender: this route reads/writes runtime state on every request.
export const dynamic = "force-dynamic";

// One debrief entry as the UI consumes it: the id pair joined with the same
// content-pack display fields as the episode's `items` (contract 003).
interface DebriefEntry {
  itemId: string;
  itemType: ItemType;
  surface: string;
  reading: string | null;
  meaning: string;
}

function debriefEntry(ref: { itemId: string; itemType: ItemType }): DebriefEntry {
  return {
    itemId: ref.itemId,
    itemType: ref.itemType,
    ...lookupItemDetails(ref.itemId, ref.itemType),
  };
}

function joinDebrief(debrief: EpisodeDebrief): {
  learned: DebriefEntry[];
  strengthened: (DebriefEntry & { outcome: Outcome })[];
  dueTomorrow: DebriefEntry[];
} {
  return {
    learned: debrief.learned.map(debriefEntry),
    strengthened: debrief.strengthened.map((entry) => ({
      ...debriefEntry(entry),
      outcome: entry.outcome,
    })),
    dueTomorrow: debrief.dueTomorrow.map(debriefEntry),
  };
}

// Advance the story by one day: fold the pending episode's result line into
// the persisted summary verbatim, increment the day, clear pending, and apply
// the day's aggregated outcomes to the persisted reviewItems through the
// engine's SRS update (contract 004). Responds with { day, summary } as
// before (contract 002) plus the debrief: learned (today's passives) /
// strengthened (actives the learner produced) / dueTomorrow (the evolved
// items due at tomorrow's clock). A 409 writes nothing — no double-apply.
export async function POST(): Promise<NextResponse> {
  try {
    const state = readStoryState();
    const completed = completeEpisode(state);
    if (!completed) {
      return NextResponse.json(
        {
          error:
            "No pending episode to complete — GET /api/episode to generate today's episode first.",
        },
        { status: 409 },
      );
    }
    writeStoryState(completed.state);
    return NextResponse.json({
      day: completed.state.day,
      summary: completed.state.summary,
      debrief: joinDebrief(completed.debrief),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unexpected error while completing the episode";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
