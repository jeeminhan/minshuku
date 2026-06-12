import { NextResponse } from "next/server";
import {
  STORY_COOKIE_NAME,
  STORY_COOKIE_OPTIONS,
  isCookieStoreMode,
  serializeStoryCookie,
} from "@web/lib/engine/cookieStore";

// Never prerender: this route's whole job is a per-request Set-Cookie.
export const dynamic = "force-dynamic";

// Deployed equivalent of `npm run seed-demo` (contract 007): in cookie mode,
// set the story cookie to the start of day 4 with the lesson batch applied
// and bounce to the app. Revisiting /demo after completing day 4 IS the
// reset-to-day-4 (idempotent); day-1 reset = clear cookies (no endpoint).
// In file mode this must not silently half-work — the filesystem seed has a
// real script, so point at it loudly instead.
export function GET(): NextResponse {
  if (!isCookieStoreMode()) {
    return NextResponse.json(
      {
        error:
          "/demo seeds the demo only in cookie mode (MINSHUKU_STORE=cookie). " +
          "In file mode run `npm --prefix web run seed-demo` instead.",
      },
      { status: 400 },
    );
  }
  // Relative Location, set explicitly: NextResponse.redirect demands an
  // absolute URL, and behind Vercel's proxy the request URL's origin is not
  // worth trusting — `/` is unambiguous. no-store: a CDN must never serve
  // this Set-Cookie stale.
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: "/", "cache-control": "no-store" },
  });
  response.cookies.set(
    STORY_COOKIE_NAME,
    serializeStoryCookie({ day: 4, seeded: true, pending: false }),
    STORY_COOKIE_OPTIONS,
  );
  return response;
}
