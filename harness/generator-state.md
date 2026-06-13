# Generator state — contract 009 (Demo storyline tour `/story`)

Mode: BUILD. Round 1. Contract ACCEPTED. All criteria self-verified against a Playwright walk on port 3020 (production build, `next start`). Server killed, port 3020 free, the user's dev server on :3000 left untouched, `web/.data/story-state.json` byte-identical before/after.

## What changed (files + why)

All additive — NEW files only. Zero edits to any C-REG-pinned file.

- **`web/lib/demo/storyline.ts`** (NEW) — the authored 6-beat content module: ids, pip labels, titles (EN + JA), image-slot basenames, narrative copy, under-the-hood callouts, presenter notes, and per-day highlight targets. Copy sourced from `DEMO-STORYLINE.md`. Hardcodes NO dialogue — only authored copy + which day each beat pulls + which target surfaces it highlights. Also exports `KNOWLEDGE_LADDER` (the outro's in-app chart).
- **`web/lib/demo/storyTour.ts`** (NEW) — `buildStoryTour()` + a private `InMemoryStoryStore`. Simulates days 1→4 through the SAME engine path the play view/seed use: `runEpisode(store)` → `completeEpisode(store.state)` (called directly on the state value — it is a free function, not a store method) → `store.write(completed.state)`. Forces `MINSHUKU_FAKE_LLM=1`, appends `day4LessonBatch()` at the day-4 boundary (so day 4 casts `minshuku-arrival-with-mom` against てもいい/持つ), and points `logDir` at `os.tmpdir()`. **Never reads/writes `web/.data/story-state.json`.** Returns only serializable `TourDay[]` (briefing/result/turns/items/summary/debrief — debrief joined to display fields exactly like the complete route).
- **`web/app/story/page.tsx`** (NEW) — server component, `force-dynamic` + `maxDuration = 60`. `await buildStoryTour()`, and `presentImageSlots()` checks `fs.existsSync` per slot so the client mounts an `<img>` ONLY for art that exists (empty `public/story/` ⇒ zero image 404s).
- **`web/components/story/StoryTourView.tsx`** (NEW) — the client island. Wraps in the existing `SoundProvider`; owns the current-beat index; Next/Back buttons (`tour-next`/`tour-back`, disabled at the ends), ArrowRight/ArrowLeft on `document` (guarded against text fields), and renders `SoundToggle` + `TourProgress` + one `TourBeatCard`.
- **`web/components/story/TourProgress.tsx`** (NEW) — `[data-testid="tour-progress"]` with exactly 6 button pips (Intro · Day 1–4 · Outro); current pip carries `aria-current="step"` + `data-active="true"`. Pips are clickable (direct jump) and Next/Back move the marker.
- **`web/components/story/TourBeatCard.tsx`** (NEW) — one visible chapter: `SceneImage`, narrative, the day's dialogue, `[data-testid="tour-callout"]`, `[data-testid="tour-knowledge"]` (learned/strengthened/due), the beat-4 Mom `TtsClip`, the outro knowledge ladder, and the presenter note.
- **`web/components/story/SceneImage.tsx`** (NEW) — fixed 16:9 box (intrinsic 1600×900) → zero layout shift. `[data-testid="scene-placeholder"]` (washi-toned, 民宿 palette tokens) is the default render; the lazy `<img loading="lazy">` mounts only when `hasImage` is true.
- **`web/components/story/TourDialogue.tsx`** (NEW) — reuses `components/episode/glossSegments.ts`'s `segmentLine` (read-only, imported relatively), filtered to the beat's target items, wrapping matches in `<mark data-tour-highlight data-item-id>`.
- **`web/public/story/.gitkeep`** + **`web/public/story/README.md`** (NEW) — directory exists; README documents the expected `0N-*.webp` filenames, specs, and art direction.

## IMPORTANT note for the evaluator on C6 (highlights span BOTH speakers)

The contract's C6 says highlights appear "inside the rendered NPC dialogue." In this engine the **active** due targets are produced by the LEARNER, so they surface in the **player** turns, not the NPC's: つもり/窓 (day-1 player lines), 雨 (day-2 player), 不思議 (day-3 player), てもいい (day-4 player, inside 入ってもいいですか). Only the day-4 passive 持つ lands in the NPC (Mom) line (若い人が持つことに…). I therefore highlight across every turn (NPC + player), anchored to real items by id. This is faithful to DEMO-STORYLINE ("you say what you intend to do (つもり)") and still satisfies C6's mechanical checks: each `[data-tour-highlight]` carries the correct `data-item-id` with matching JA text, nothing outside the targets is wrapped, and the concatenated text is unaltered. If C6 is read as "NPC turns ONLY," all four day beats would show zero/partial highlights — that reading contradicts the engine ground truth, so I did NOT restrict to NPC turns. Flagging for an explicit decision if the evaluator disagrees.

Verified per-beat `data-tour-highlight` ids:
- day-1: grammar.tsumori (×2) + vocab.mado — only those two ids
- day-2: vocab.ame (×2)
- day-3: vocab.fushigi
- day-4: grammar.temo-ii + vocab.motsu — exactly these two (約束/vocab.yakusoku NOT highlighted), proving the seeded-progression day-4 episode.

## Self-verification (port 3020, production build, Playwright from a throwaway install)

31/31 checks PASS covering C2–C7, C9: one beat visible, 6 pips, Next/Back/arrow nav, end-disabled controls, placeholder visible with zero files, no `/story/*` request for non-current beats, image box height stable across beats, per-beat highlight ids, callout/knowledge non-empty, day-4 audio `src` ends `/tts/day4-turn2.m4a` + `preload="none"` + no tts request before gesture + plays after gesture + sound-off blocks play, and **zero pageerror / zero console error / zero ≥400 responses / zero non-localhost requests**.

C8 (responsive): no horizontal overflow (`scrollWidth - innerWidth <= 1`) at 375/768/1440 across all six beats, with nav + progress visible at each.

C10 (determinism): two `/story` loads produce byte-identical Day-1..4 dialogue text.

C-REG: `git status --porcelain` shows NO modifications to any pinned file (`web/app/page.tsx`, `web/components/episode/**`, `web/components/audio/**`, `web/app/api/**`, `web/fixtures/**`, `web/lib/engine/{runEpisode,fixtureClient,demoLearner,lessonBatch,storyStore}.ts`, `src/lib/**`). `storyStore.ts` was NOT touched — `InMemoryStoryStore` lives in `storyTour.ts`. `web/.data/story-state.json` byte-identical (md5 `77a78bc7…`) before and after `/story` visits. `seed-demo` script exists (Finding 9).

## Gate results

```
# repo root: npm run code-check
 Test Files  22 passed (22)
      Tests  101 passed (101)

# web: npm run lint
> eslint
(clean — no output)

# web: npm run build  (env -u GEMINI_API_KEY MINSHUKU_FAKE_LLM=1)
✓ Compiled successfully
✓ Generating static pages (4/4)
└ ƒ /story   (Dynamic — server-rendered on demand)
```

## How to run / evaluate

- Dev: `cd web && env -u GEMINI_API_KEY MINSHUKU_FAKE_LLM=1 npm run dev` → http://localhost:3000/story (read port from startup). Next 16 refuses a second dev server for the same dir — if :3000 is busy, `npm run build && env -u GEMINI_API_KEY MINSHUKU_FAKE_LLM=1 PORT=<free> npm run start`.
- Image criteria run with `web/public/story/` holding ONLY `.gitkeep` + `README.md` (zero `.webp`) — that is the shipped state; every beat shows its placeholder and the page fires zero image requests.
- The tour derives its own state in-memory; no seed step needed. `web/.data/story-state.json` is never read or written by `/story`.

## Known issues / notes

- None blocking. The standalone-output warning from `next start` ("does not work with output: standalone") is pre-existing (contract-007 config) and harmless for local QA — the route still serves 200 on the chosen PORT; use `npm run start` with `PORT=<free>` as 003–008 did.
- Did NOT commit (per harness rules).
