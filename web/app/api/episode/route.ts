import { NextResponse } from "next/server";
import { runEpisode } from "@web/lib/engine/runEpisode";

// Never prerender: in live mode without a key this route must fail at request
// time with a JSON 500, not break `next build`.
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const result = await runEpisode();
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unexpected error while generating the episode";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
