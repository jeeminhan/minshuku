import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  STORY_COOKIE_NAME,
  STORY_COOKIE_OPTIONS,
  createStoryStore,
} from "@web/lib/engine/cookieStore";
import { runEpisode } from "@web/lib/engine/runEpisode";

// Never prerender: in live mode without a key this route must fail at request
// time with a JSON 500, not break `next build`.
export const dynamic = "force-dynamic";

// Cookie-mode day-4 GET = replay days 1–3 + run day 4, plus the kuromoji
// dictionary load on a cold start — headroom over the default limit.
export const maxDuration = 60;

// Explicit on every response — a CDN must never serve a stale episode or a
// stale Set-Cookie (contract 007 C10 pins this live).
const NO_STORE = { "cache-control": "no-store" };

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const store = createStoryStore(request.cookies.get(STORY_COOKIE_NAME)?.value);
    const result = await runEpisode(store);
    const response = NextResponse.json(result, { headers: NO_STORE });
    const cookie = store.cookieToSet();
    if (cookie !== null) {
      response.cookies.set(STORY_COOKIE_NAME, cookie, STORY_COOKIE_OPTIONS);
    }
    return response;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unexpected error while generating the episode";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
