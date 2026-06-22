# Generator state — contract-010 (tour narration + sound unlock + how-it-was-built)

BUILD round. All three gates green; self-verified on port 3020 with a throwaway
Playwright install. No commit made. Servers killed, state file untouched.

## What changed (files + why)

- **`web/lib/demo/storyline.ts`**
  - Extended `BeatKind` union: `"intro" | "day" | "how-built" | "outro"`.
  - Added the 7th beat object `HOW_BUILT` (id `"how-built"`, kind `"how-built"`,
    pipLabel `"Built"`, day `null`, imageSlot `"05-ladder"`, no highlights) in
    民宿 voice. Inserted as beat index 5 → ordered list is now
    Intro · Day 1 · Day 2 · Day 3 · Day 4 · **How it was built** · Outro (7 beats).
  - The 5 grep-able substance claims are woven into the beat's `narrative` +
    `callout` (both render inside the same `[data-testid="tour-beat"]` article):
    `"101 tests"` + `"SRS engine"` + `"rule-based grader"` (claim 1);
    `"Gemini"` + per-character `"TTS"` voices (claim 2); `"Lyria"` (claim 3);
    `"Vercel"` (claim 4); `"Everything you just saw runs on that same engine"`
    + "real working prototype" (claim 5). NOTE: literal substring `"101 tests"`
    was required by C-HOWBUILT claim 1 — copy says exactly "101 tests" (not
    "101 passing tests"), verified.

- **`web/components/story/SoundUnlock.tsx`** (NEW)
  - The intro-beat `[data-testid="sound-unlock"]` "▶ Begin with sound" CTA.
    One click: (1) the click's pointerdown satisfies `SoundProvider`'s capture
    gesture gate (NO provider change — relied on the existing listener as the
    contract specified); (2) calls `toggleSound()` ONLY when `soundOn === false`
    (never blindly toggles an already-on tour off). When `gestured && soundOn`
    it swaps to a quiet `data-unlocked="true"` "Sound on — advance to begin"
    affordance. Accessible name contains "sound".

- **`web/components/story/BeatNarration.tsx`** (NEW)
  - Per-day auto-narration. Owns its own lazy `<audio preload="none">`, uses the
    SoundProvider primitives directly (`registerClip` / `notifyPlaying`) — same
    mechanism as `TtsClip` but `TtsClip.tsx` is NOT modified. Auto-plays once on
    mount when `soundOn && gestured` (TourBeatCard is keyed by `beat.id`, so each
    day beat mounts this fresh → fires exactly once per beat activation).
    Surfaces a live `[data-testid="reading-indicator"]` ("🔊 reading…") driven by
    `onPlay`/`onPause`/`onEnded` (reflects ACTIVE play state, hidden when
    paused/ended), and a `[data-testid="replay-clip"]` button (non-empty
    accessible name) that re-fires the clip. `.play()` is `.catch()`ed so
    autoplay-policy rejections never surface as console errors (C-CLEAN).

- **`web/components/story/TourBeatCard.tsx`**
  - Renders `<SoundUnlock/>` on the intro beat only.
  - Replaced the old day-4-only `[data-testid="mom-voice"]` `TtsClip` block with
    a single per-day `<BeatNarration src={`/tts/day${beat.day}-turn2.m4a`} />`
    for EVERY day beat (1–4). Day 4 now mounts exactly ONE `day4-turn2.m4a`
    audio element (the Mom welcome IS the day-4 auto-narration) — no two
    competing elements. `mom-voice` testid removed (it was Mom-specific; the
    fold makes it the generic day-4 narration).
  - Added `<PlayInvitation/>` on the how-built beat: a `next/link`
    `[data-testid="play-cta"]` with `href="/"` and a non-empty inviting label.
  - Map `NARRATION_LABEL` gives each day clip a human accessible-name fragment.

- **`web/components/story/StoryTourView.tsx`**, **`TourProgress.tsx`**
  - Doc-comment updates only ("six" → "seven" step indicator; reflect the new
    intro CTA + per-day narration). No behavior change; both still iterate
    `STORYLINE_BEATS` so the progress indicator and nav automatically show 7.

## Decision 7 (optional play-view first-line auto-read): DEFERRED
Not taken. Rationale: the play view, `components/episode/**`, and the engine are
required by C-REG-PLAY to be byte-identical (`git status --porcelain` shows no
modifications). Adding `autoOnReveal` there is permitted but optional and there
is NO criterion requiring it. To keep `/` provably unchanged and de-risk the
regression gate, it is deferred. The tour (the panel-facing surface) carries all
the narration this contract needs.

## Self-verification (throwaway Playwright, fresh dev server per first request)
At 1440×900, full narrated walkthrough:
- tts requests before any gesture: **0** (preload="none" holds).
- sound-unlock visible, name has "sound", `data-unlocked="true"` after click,
  `sound-toggle aria-pressed="true"`.
- progress step count: **7**.
- Day 1–4: each mounts exactly 1 `audio[src*="dayN-turn2.m4a"]`, a
  `/tts/dayN-turn2.m4a` request fired, `audio.paused === false`, `replay-clip`
  present, and exactly 1 playing audio at a time.
- Day-4 `audio[src*="day4-turn2.m4a"]` count: **1** (single clip — C-SINGLE).
- How-built: 5 claims all true; `play-cta` href `/`, visible; 0 day-narration
  audio on the beat.
- Outro: `tour-next` disabled on last beat.
- console errors: 0; responses ≥400: 0; off-host requests: 0.
- Responsive overflow (`scrollWidth - innerWidth`): 375 → 0 (clean), 768 → 0
  (clean), 1440 → full walk clean.

## Known issue the evaluator MUST know — kuromoji 500 on the 2nd `/story` hit
This is a PRE-EXISTING contract-009 condition in the derivation layer
(`buildStoryTour()` → kuromoji), NOT introduced by this contract, and is in the
out-of-scope `web/lib/demo/storyTour.ts` / `src/lib` path I did not touch.

- The **first** `/story` request to a freshly-started dev server returns 200 and
  renders fully. The **second** `force-dynamic` request re-initializes kuromoji
  and throws `Error: ConnectionCosts buffer overflow` → 500.
- **How to run the evaluator reliably:** treat `/story` as one-shot per server.
  Either (a) restart the dev server before each fresh page-load that needs SSR,
  or (b) use a production server. `npm run start` warns because next config is
  `output: "standalone"` — the standalone entry is `.next/standalone/web/server.js`
  (you must also surface `public/` and `.next/static` for it). The simplest path
  that worked for me: `env -u GEMINI_API_KEY MINSHUKU_FAKE_LLM=1 PORT=<free> npm run dev`
  and make the Playwright `goto('/story')` the FIRST request to that server;
  for multi-viewport/multi-context checks, restart the dev server (or open one
  context, complete the whole walk, then restart) so each SSR render is a "first
  request". Once the page is loaded, all client-side stepping (Next/Back/arrows,
  audio, replay) works fully — the 500 only affects a repeated server render.
- Within one loaded page the criteria all pass; this only matters for how you
  sequence multiple SSR loads.

## Audio-testing reminder (per contract's headless caveat)
Assert on element state / network, never audible output. The clip "attempts
play" signals available: a `/tts/dayN-turn2.m4a` request fires AND `audio.paused`
flips to false AND `[data-testid="reading-indicator"]` appears AND
`[data-testid="replay-clip"]` shows `data-state="playing"`.

## Gates (tails)
- Root `npm run code-check`: `Tests  101 passed (101)` — engine intact.
- `cd web && npm run lint`: clean (no output).
- `cd web && npm run build`: `✓ Compiled successfully`; `/story` builds (ƒ Dynamic).

## State / cleanup
- `web/.data/story-state.json` not read or written by the tour (untouched).
- `web/public/story/` left with zero `.webp` for slot `05-ladder` (washi
  placeholder renders; the how-built beat reuses that slot — no image binary
  committed this round, per contract).
- All dev servers killed. Start command unchanged:
  `cd web && env -u GEMINI_API_KEY MINSHUKU_FAKE_LLM=1 npm run dev`.
