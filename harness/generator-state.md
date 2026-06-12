# Generator state — Contract 006, build round 1 (two-attempt build)

This round was a **completion pass**: the first attempt died on a connection error mid-flight. Its partial work was audited against all 12 criteria and found essentially complete — including C2, which the audit prompt suspected was missing. No new code changes were needed this attempt; the work below is the dead attempt's, verified live this attempt.

**No engine changes** — `git status --porcelain -- src/lib` is empty (C12 hygiene).

## What changed (files + why)

- **`web/components/episode/EpisodePlayer.tsx`** — loading-state `<p>` now has `data-testid="episode-loading"` + `role="status"` (C1), and its pulse class is `motion-safe:animate-pulse` (C2). The `motion-safe:` variant is Tailwind-v4-native (`@media (prefers-reduced-motion: no-preference)` wrapper), so **`web/app/globals.css` did NOT need an override** — the contract explicitly allowed "`motion-safe:` variant *or* CSS override". globals.css is byte-untouched; its existing `.turn-enter { animation: none }` reduce rule is the C2 regression control and still resolves to `none`.
- **`web/app/favicon.ico`** — replaced with a minshuku-specific icon (real ICO: 2 icons, 32×32 + 16×16, 32bpp, 5430 bytes). `md5 -q` = `d32338de0a77fdcadf7f875cd64c1931` ≠ stock `c30c7d42707a47a3f4591831641e50dc` (C10).
- **`web/public/{next,vercel,globe,window,file}.svg`** — deleted; `web/public/` is now empty. `grep -rn "next.svg\|vercel.svg\|globe.svg\|window.svg\|file.svg" web/app web/components` returns nothing (C10).

## Self-verification (this attempt, production build on port 3020, `MINSHUKU_FAKE_LLM=1`)

Script: `/tmp/pw-harness/verify-006.mjs` (Playwright chromium at `/tmp/pw-harness`, survives from attempt 1) — **20/20 PASS**:

- **C1** (delayed-GET, 1440×900): loading element visible while pending, `role="status"`, text "Preparing today’s episode…", brand mark visible and above it (bounding-box y compared), coach beat after resolve, exactly 1 GET.
- **C2**: under `reducedMotion: 'reduce'` the loading element's computed `animation-name` is `none` AND `.turn-enter` is `none`; positive control in a default context resolves to `pulse`.
- **C10 liveness**: `curl /favicon.ico` → 200, body 5430 bytes (server was up at the time).
- **Happy-path shape** (C11 subset): 6 `[data-outcome]` badges in dialogue, 3 debrief groups, return-tomorrow visible, zero console errors / pageerrors.
- **C3 shape** (768×1024, day-5 500): the content alert (filtered to exclude Next's empty route-announcer live region) shows both `Could not load today’s episode.` and `fixture`; no player input; no horizontal overflow; console errors = exactly one `/Failed to load resource/`, zero others.

## Gate results

`npm run code-check` (repo root):

```
 Test Files  22 passed (22)
      Tests  101 passed (101)
```

`cd web && npm run lint` — exit 0. `npm run build` — exit 0:

```
┌ ○ /
├ ○ /_not-found
├ ƒ /api/episode
└ ƒ /api/episode/complete
```

## Notes for the evaluator

1. **C2's mechanism is the component class, not globals.css.** Assert via computed style (`getComputedStyle(el).animationName`), not by grepping globals.css for a media query — there is none and none is needed.
2. When counting console errors in C3, exclude/filter Next's `__next-route-announcer__` (an empty `[role="alert"]` region) when locating the error alert — filter by text `Could not load`.
3. `[data-outcome]` badge counts: the dialogue has exactly 6 **before** completing; DebriefPanel adds its own `[data-outcome]` entries afterwards. Count before clicking complete (as C11 contracts 003–005 shape did).
4. Server start for QA: `cd web && npm run build && env -u GEMINI_API_KEY MINSHUKU_FAKE_LLM=1 PORT=3020 npm run start`. The user's long-running dev server on port 3000 blocks any second `next dev` for this directory — use the build+start path.
5. State left **RESET** (`web/.data/story-state.json` deleted → fresh day 1 on next request); port 3020 killed and confirmed free.
6. Pre-existing uncommitted modifications to `scripts/review-loop.ts` and `scripts/review-trends.ts` (root harness tooling) predate this contract and are outside its file set — not touched, not part of contract 006's diff.

## Known issues

None found this round. All 12 criteria's changed surfaces verified; the regression-pin criteria (C4–C9, C11) ride on code untouched since their contracts and the happy-path/C3 spot-checks above came back clean.
