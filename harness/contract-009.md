# Contract 009 — Demo storyline tour (`/story`)

Backlog item: "A guided, presenter-friendly `/story` route that walks all four days as one narrative and EXPLAINS the app — the content/script is authored in DEMO-STORYLINE.md (6 beats: intro → day 1–4 → outro). Each beat = a chapter card with: a scene IMAGE slot (web/public/story/0N-*.webp; tasteful washi placeholders until the user drops in ChatGPT art — same pattern as audio/ambience), the day's story-so-far + episode dialogue with the due target words highlighted, an "under the hood" explanatory callout (what the SRS engine did and why this scene), and the debrief/knowledge change. Navigation: Next/Back + keyboard arrows + a Day 1·2·3·4 progress indicator; gesture-gated, presenter-optimized. Beat 4 plays Mom's voiced line (reuse contract-008 TTS). Beat 5 = the pitch/outro. Pull real per-day data from the existing seeded engine (don't hardcode dialogue — derive from the day fixtures/runEpisode like the play view does). Image slots: explicit dimensions, lazy-loaded, zero layout shift (web perf rules). Content source of truth = DEMO-STORYLINE.md; structure it as a storyline data module the UI renders. Keep the existing interactive /play demo intact — the tour is additive."

Content source of truth: **`DEMO-STORYLINE.md`** (6 beats, per-beat copy, under-the-hood callouts, image slots/filenames, art direction). The contract below names where each piece lands.

## Scope (what changes, which files)

### Design decisions (settled — do not relitigate)

1. **The tour is ADDITIVE; `/` stays byte-identical.** The interactive play view at `app/page.tsx` + `components/episode/*` + `components/audio/*` is **not touched** (one explicit exception below). The tour is a NEW route `app/story/page.tsx` plus NEW components under `components/story/` and a NEW data module `lib/demo/storyline.ts`. `git diff` on the play-view files must be empty (C-REG pins this).

2. **Per-day episode data is DERIVED from the engine, never hardcoded.** A new server module `lib/demo/storyTour.ts` exports an async `buildStoryTour()` that simulates days 1→4 through the **same modules the play view and seed script call** — `runEpisode()` (fixture replay, real `runScene`/evaluator) and `completeEpisode()` (real `applyOutcome`/`pickDueItems`) — capturing each day's `EpisodeResult` (briefing, NPC/player turns, `log.result`, joined `items`, `log.templateId`, `story.summary`) and the `EpisodeDebrief` for days 1–4, plus the day-4 lesson-batch boundary (append `day4LessonBatch()` before simulating day 4 so day 4 casts `minshuku-arrival-with-mom` with the new lessons — identical to `seed-demo.ts`). The simulation **must use an in-memory `StoryStore`** (a new `InMemoryStoryStore` implementing the existing `StoryStore` interface from `lib/engine/storyStore.ts`, holding state in a field, `logDir` pointed at `os.tmpdir()` like the cookie store) so the tour **never reads, writes, or depends on `web/.data/story-state.json`** and never mutates the play view's persisted state. `MINSHUKU_FAKE_LLM=1` is forced inside `buildStoryTour()` (same as `seed-demo.ts`'s `main()`), so the tour renders deterministically with no key and never calls live Gemini. The `/story` page is a server component that `await buildStoryTour()` and passes the derived per-day data to the client tour island. (`force-dynamic` + `maxDuration` like the episode route, since it loads kuromoji + replays four fixtures.)

3. **Beat → day mapping (engine ground truth, from contracts 004/005 — pinned, not estimated):**
   - **Beat 0 — Intro:** no day data; the thesis line + "Four evenings. Watch the words become a story." (DEMO-STORYLINE Beat 0). Image slot `story/00-minshuku-dusk`.
   - **Beat 1 — Day 1, The Café:** template `cafe-regular-encounter`, NPC `cafe_regular` (turns 2/4/6); actives `[grammar.tsumori, vocab.mado]`; **highlighted target surfaces つもり and 窓**. Image slot `story/01-cafe`.
   - **Beat 2 — Day 2, The Night Road:** template `late-night-walk-stranger`, NPC `stranger`; active `[vocab.ame]`; **highlighted target surface 雨**. Image slot `story/02-night-road`.
   - **Beat 3 — Day 3, The Bookshop:** template `bookshop-quiet-browse`, NPC `bookshop_owner`; active `[vocab.fushigi]`; **highlighted target surface 不思議**. Image slot `story/03-bookshop`.
   - **Beat 4 — Day 4, Home at the Minshuku (payoff):** template `minshuku-arrival-with-mom`, NPC **`mom`** (turns 2/4/6); actives `[grammar.temo-ii, vocab.yakusoku]`, passives `[vocab.motsu, vocab.mado]`; **highlighted target surfaces てもいい and 持つ** (the "new tonight" lessons per DEMO-STORYLINE). **Mom's voiced line plays here** — `/tts/day4-turn2.m4a` (verified against contract-008 naming: day 4's NPC is `mom`, turns 2/4/6 → `day4-turn{2,4,6}.m4a`; turn 2 is Mom's first line). Image slot `story/04-minshuku-mom`.
   - **Beat 5 — Outro (the pitch):** the closing pitch copy (DEMO-STORYLINE Beat 5). Optional image slot `story/05-ladder`; until art exists the placeholder renders (or a simple in-app knowledge-ladder list — generator's choice, but the slot/placeholder pattern is the default and is what C-IMG tests).

4. **Highlighting reuses the existing gloss machinery, not a new tokenizer.** The set of target surfaces to highlight per beat is **authored in `storyline.ts`** (decision 3's surfaces) AND must be a subset of the day's derived `items` surfaces (so highlighting is anchored to real episode items, not a free string list). The tour highlights every occurrence of those surfaces in that day's NPC dialogue by reusing `components/episode/glossSegments.ts`'s `segmentLine` (filtered to the beat's target items), wrapping matches in a marked element `[data-tour-highlight]` carrying `data-item-id`. `glossSegments.ts` is imported read-only — not modified.

5. **Placeholders are mandatory and the default render.** `web/public/story/` is **created empty in this contract** (a `.gitkeep` so the directory exists). The user has generated NO art yet, so **the tour must be fully presentable with zero real images present.** Each scene image is a NEW `components/story/SceneImage.tsx` that renders an element with explicit `width`/`height` (intrinsic 1600×900, 16:9 — zero layout shift) and lazy loading, with a **washi-toned placeholder** (a styled box using existing tokens — `--color-washi-deep`/`--color-kaki-wash`/`--color-aizome-wash`, the 民宿 palette — labeling the slot, e.g. the filename and a one-line caption) shown when the file is absent. Because no real files exist this round, the placeholder is what every beat shows. (Real-image swap is the user dropping `0N-*.webp` into `web/public/story/` later; the slot's fixed box means no layout shift either way. Whether SceneImage uses `next/image` with `onError` fallback or a plain `<img>`/CSS-background approach is the generator's call — the criteria pin explicit dimensions + lazy + visible placeholder, not the implementation.)

6. **Navigation is presenter-optimized and gesture-friendly.** One beat visible at a time. **Next/Back buttons** (`[data-testid="tour-next"]`, `[data-testid="tour-back"]`); **ArrowRight → next, ArrowLeft → previous** (keydown on the document/tour root, ignored when focus is in a text field — none exist here, but guard anyway); a **progress indicator** (`[data-testid="tour-progress"]`) showing the six steps — Intro · Day 1 · Day 2 · Day 3 · Day 4 · Outro — with the current step marked (`aria-current="step"` and/or `data-active="true"` on the current pip). Back is disabled/absent on beat 0; Next is disabled/absent on beat 5. State (current beat index) is client-only; **URL-as-state is optional** (generator may sync `?beat=N` or a hash — not required, not a criterion). Audio is gesture-gated by reusing the existing `SoundProvider` (so beat-4 TTS plays only after a user gesture and respects the global sound toggle).

7. **Beat-4 audio reuses contract-008 wiring.** The tour wraps its content in the existing `SoundProvider`, and beat 4 renders the existing `TtsClip` (or an equivalent that mounts an `<audio preload="none" src="/tts/day4-turn2.m4a">` with a visible play control) for Mom's line. No new audio assets, no runtime TTS. `preload="none"`; no `/tts/*` request before a gesture.

### Files expected to change
- **New:** `web/lib/demo/storyline.ts` (the 6-beat authored content module — beat id, title, image slot path, narrative copy, under-the-hood callout, which day's data to pull, target surfaces to highlight; copy sourced verbatim-in-spirit from DEMO-STORYLINE.md); `web/lib/demo/storyTour.ts` (`buildStoryTour()` + `InMemoryStoryStore`); `web/app/story/page.tsx` (server component); `web/components/story/*` (the tour island, beat/chapter card, SceneImage, progress indicator, highlighted-dialogue renderer — generator's exact split, each file < 800 lines); `web/public/story/.gitkeep`.
- **Edited (the one allowed play-view-adjacent touch):** if `StoryStore` needs an exported in-memory implementation, it may be ADDED to `web/lib/engine/storyStore.ts` as a new exported class with **no change to existing exports/behavior** (`FileStoryStore`, `readStoryState`, `completeEpisode`, etc. byte-identical) — OR placed in `storyTour.ts`. The episode API routes, fixtures, engine (`src/lib`), and all `components/episode/*` + `components/audio/*` files are **unchanged**.

## Out of scope
- Any edit to `app/page.tsx`, `components/episode/*`, `components/audio/*` behavior, the episode API routes (`app/api/episode/*`), the fixtures, `src/lib` (engine read-only), the cookie/file store semantics, or `web/.data/story-state.json` (the tour must not read or write it).
- Generating real story art — the contract ships placeholders only; the user drops `0N-*.webp` in later. No image binaries are committed this round.
- New audio/TTS assets or any runtime TTS/STT/Gemini call. Live mode. Deploy. Mic input on the tour.
- A day-5 beat (the tour is exactly the 6 DEMO-STORYLINE beats); per-turn grading UI / free-text input on the tour (it is read-only narration, not the interactive player); word-level karaoke.
- Changing `demoReviewItems()`, `day4LessonBatch()`, the demo clock, or the seeded state shape.

## How the evaluator runs this

Fixture mode, no key (same as 002–008). The tour derives its own state in-memory, so **no seed step is needed and `web/.data/story-state.json` need not exist** — but the play-view regression checks (C-REG) use the standard reset/seed commands.

```sh
cd /Users/jeeminhan/Code/minshuku/web && env -u GEMINI_API_KEY MINSHUKU_FAKE_LLM=1 npm run dev   # read the port from startup
```

Carried-over caveats: read the port from startup output; Next 16 refuses a second dev server for the same directory — reuse the running one or `npm run build && env -u GEMINI_API_KEY MINSHUKU_FAKE_LLM=1 PORT=<free> npm run start`. Playwright is not a repo dependency — run it from a throwaway install outside the repo, as in contracts 003–008. Register `request`/`console`/`pageerror`/`response` listeners before `page.goto("/story")`. **Image criteria run with ZERO files in `web/public/story/`** (the default state this contract ships) — that is the point: the tour must be presentable with no art. Leave `web/.data/story-state.json` in whatever state the run left it; the tour does not depend on it.

## Criteria (each must be mechanically checkable by a browser-driving evaluator)

- [ ] **C1 — Storyline module encodes the 6 beats.** `web/lib/demo/storyline.ts` exists and exports an ordered list of exactly **6** beats whose ids/titles cover Intro, Day 1 (Café), Day 2 (Night Road), Day 3 (Bookshop), Day 4 (Minshuku/Mom), Outro (grep the file: the six image-slot basenames `00-minshuku-dusk`, `01-cafe`, `02-night-road`, `03-bookshop`, `04-minshuku-mom`, `05-ladder` each appear; the day beats name the highlight surfaces `つもり`/`窓` (beat 1), `雨` (beat 2), `不思議` (beat 3), `てもいい`/`持つ` (beat 4); each beat carries non-empty narrative + an under-the-hood callout field). Dialogue text is NOT hardcoded in this file: `grep` finds none of the NPC line content — derivation is via `storyTour.ts` (grep `storyTour.ts` for `runEpisode` AND `completeEpisode`, confirming the play-view derivation path).

- [ ] **C2 — Tour renders 6 navigable beats; `/story` loads clean.** `page.goto("/story")` at 1440×900: the page loads (HTTP 200, no `pageerror`), exactly one beat/chapter card visible at a time (`[data-testid="tour-beat"]` count visible === 1), and stepping Next from beat 0 through to beat 5 reaches each of the six beats (the progress indicator's active step advances 0→5). Day 1's beat shows the café NPC speaker and Day 4's shows `mom`. No live-Gemini / non-localhost request across the whole walkthrough.

- [ ] **C3 — Next/Back + arrow keys change the beat.** From beat 0: click `[data-testid="tour-next"]` → the visible beat changes to Day 1 (its title/text differs from beat 0; `[data-testid="tour-progress"]`'s `aria-current="step"`/`data-active` moves to the Day-1 pip). Press **ArrowRight** → advances to Day 2; press **ArrowLeft** → returns to Day 1; click `[data-testid="tour-back"]` → returns to Intro. At beat 0 the Back control is disabled or absent (cannot go before Intro); at beat 5 the Next control is disabled or absent.

- [ ] **C4 — Progress indicator reflects state across all six.** `[data-testid="tour-progress"]` is visible and contains exactly **6** step markers labelled/orderable as Intro · Day 1 · Day 2 · Day 3 · Day 4 · Outro. Walking 0→5, at each step exactly one marker has `aria-current="step"` (or `data-active="true"`) and it corresponds to the visible beat. Clicking a pip directly (if pips are buttons) OR Next/Back both move the active marker — at minimum Next/Back move it (direct-jump is optional).

- [ ] **C5 — Scene image: explicit dimensions, lazy, placeholder visible with zero files present.** With `web/public/story/` empty (no `0N-*.webp`), on each of beats 0–4 the scene image element (`[data-testid="scene-image"]`) is present with **explicit non-zero `width` and `height` attributes** (or an explicit aspect-ratio box of fixed pixel dimensions) — `naturalWidth`/`naturalHeight` need not load — and a **visible washi-toned placeholder** (`[data-testid="scene-placeholder"]`, visible bounding box > 0, using the 民宿 palette) is shown because the real file is absent. The image element uses lazy loading (`loading="lazy"` on `<img>`/`next/image`, OR not requested until its beat is shown — verified by zero `/story/*` network request for beats not yet viewed). Stepping across beats produces **no measurable layout shift attributable to the image slot** (the card's image region keeps a fixed box: bounding-box height of `[data-testid="scene-image"]` is identical on beat 1 vs beat 3).

- [ ] **C6 — Highlighted target words present per beat, anchored to real items.** On the Day-1 beat, every occurrence of `つもり` and `窓` inside the rendered NPC dialogue is wrapped in `[data-tour-highlight]` (≥ 1 such element, each `data-item-id` ∈ {`grammar.tsumori`,`vocab.mado`} with visible JA text containing the surface); plain dialogue text outside the targets is NOT wrapped. Day 2 highlights `雨` (`data-item-id="vocab.ame"`); Day 3 highlights `不思議` (`vocab.fushigi`); Day 4 highlights `てもいい` and `持つ` (`grammar.temo-ii`,`vocab.motsu`). The concatenated visible dialogue text of each beat is unaltered by the wrapping (highlighting never changes the sentence). Each day beat also shows its under-the-hood callout text (`[data-testid="tour-callout"]`, non-empty) and the day's debrief/knowledge delta (`[data-testid="tour-knowledge"]` listing learned/strengthened/due — non-empty for days 1–4).

- [ ] **C7 — Beat 4 plays Mom's voiced line.** On the Day-4 beat there is an `audio` element with `src` ending `/tts/day4-turn2.m4a`, `preload="none"`, fronted by a visible play control with a non-empty accessible name; **no `/tts/*` request fires before a gesture** (navigation alone triggers none). After clicking that play control (a user gesture, sound on): within 2 s the audio element's `paused === false` and a network request for `/tts/day4-turn2.m4a` was made. The global `[data-testid="sound-toggle"]` is present; toggling sound off then clicking play produces no audio (`paused` stays true) — reusing contract-008 SoundProvider semantics.

- [ ] **C8 — Responsive 375 / 768 / 1440, no horizontal overflow.** At each of 375×812, 768×1024, 1440×900: load `/story`, then step through all six beats. At every beat `document.documentElement.scrollWidth <= window.innerWidth + 1` (no horizontal scroll); the scene image, narrative, callout, dialogue, nav controls, and progress indicator are all within the viewport's right edge (each tracked element's bounding-box right edge ≤ innerWidth + 1). Nav controls and the progress indicator remain visible/usable at 375.

- [ ] **C9 — Console-clean across the full tour.** Walking 0→5 (with the beat-4 audio play + a sound-toggle interaction) at 1440×900 with listeners registered before goto: **zero** `pageerror` events, **zero** console messages of type `error`, **zero** responses with status ≥ 400, and zero requests to any non-localhost host (in particular nothing matching `googleapis.com`).

- [ ] **C10 — Determinism: the tour's derived data is stable.** Two consecutive `GET /story` server renders (curl the route HTML twice, or two `page.goto` reloads) present the **same** per-beat dialogue and the same Day-4 NPC = `mom` / template-driven content — the tour derives from fixtures so the four days are byte-stable. (If the page exposes the derived data as JSON anywhere — e.g. an embedded script payload — two fetches are byte-identical; otherwise the evaluator compares the rendered Day-1..4 dialogue text strings across two loads for equality.) The Day-4 beat's highlighted surfaces are exactly `てもいい`+`持つ` (the seeded day-4 actives/new lessons), proving the tour pulled the seeded-progression day-4 episode, not day 1.

- [ ] **C-REG — The interactive play view at `/` is unchanged (regression).** `git status --porcelain` shows **no modifications** to `web/app/page.tsx`, `web/components/episode/**`, `web/components/audio/**`, `web/app/api/**`, `web/fixtures/**`, `web/lib/engine/runEpisode.ts`, `web/lib/engine/fixtureClient.ts`, `web/lib/engine/demoLearner.ts`, `web/lib/engine/lessonBatch.ts`, or `src/lib/**` (the only permitted edit to `web/lib/engine/storyStore.ts` is an ADDED exported in-memory store with all pre-existing exports byte-identical — `git diff` on that file must add only new lines, never alter existing ones). With a fresh state file (`rm -f web/.data/story-state.json`), `curl -s http://localhost:<port>/api/episode | jq -e '.status=="completed" and .story.day==1 and (.items|length)==5 and .log.templateId=="cafe-regular-encounter"'` exits 0; after `env -u GEMINI_API_KEY npm run seed-demo`, `jq -e '.story.day==4'` exits 0 — the play view's day-1-fresh and seeded-day-4 flows both still work, and **visiting `/story` in between leaves `web/.data/story-state.json` byte-identical** (the tour never writes it: snapshot the file before any `/story` visit and `cmp` after — or confirm it is still absent if it was absent).

- [ ] **C-GATE — Gates.** Repo root `npm run code-check` exits 0 (engine typecheck + 101 vitest tests, engine never regresses); `cd web && npm run lint` exits 0 and `npm run build` exits 0. (No build is run this round by the generator's handoff per the orchestrator; the evaluator runs the gates.)

## Notes for the builder (for `generator-state.md`, not graded)
- The day→template/active mapping in decision 3 is the contract-004/005 engine ground truth; if `buildStoryTour()` produces a different Day-4 template or different day-4 highlight surfaces, the simulation drifted from the seed path — fix the simulation, do not relax C6/C10.
- Keep `storyTour.ts` strictly server-side (it imports the engine + node `fs`/`os`); the client tour island receives only serializable derived data (beat copy + per-day dialogue turns + items + debrief), never the engine objects.
- Author the beat copy in `storyline.ts` from DEMO-STORYLINE.md; the under-the-hood callouts are the load-bearing "explains the app" content — do not abbreviate them away.

## Evaluator review

**Reviewed against:** HARNESS.md, DEMO-STORYLINE.md, `web/lib/engine/storyStore.ts`, `web/lib/engine/runEpisode.ts`, `web/components/episode/glossSegments.ts`, filesystem checks for `web/public/tts/day4-turn2.m4a` and `web/public/story/`.

---

### Finding 1 — StoryStore interface IS cleanly swappable; `runEpisode` does NOT hardcode the file store (PASS on the architectural claim)

`runEpisode(store: StoryStore)` takes the store by injection; it never calls `readStoryState()`/`writeStoryState()` directly — those are only used by `FileStoryStore`. The `StoryStore` interface (lines 144–155 of storyStore.ts) is a stable, minimal interface (`read`, `write`, `cookieToSet`, `logDir`). An `InMemoryStoryStore` implementing it will satisfy `runEpisode` and `completeEpisode` (which operates on the `StoryState` value, not the store). Decision 2's claim is architecturally sound.

**One sharp edge the generator must handle:** `completeEpisode` (storyStore.ts line 227) is a free function that takes a `StoryState` value — it does NOT go through the store interface. `buildStoryTour()` will need to call it directly on the in-memory state value after each `runEpisode`. That is straightforward, but it means the generator's loop is: `await store.read()` → `runEpisode(store)` (writes pending into store) → `store.read()` again → `completeEpisode(state)` → `await store.write(completedDay.state)`. No architectural blocker; just not the same as calling `store.complete()`.

### Finding 2 — Beat-4 audio asset `/tts/day4-turn2.m4a` EXISTS (PASS)

`web/public/tts/day4-turn2.m4a` is present in the filesystem. The contract's claim that "turn 2 is Mom's first line" is consistent with contract-008 naming convention (NPC turns are 2/4/6). No blocker.

### Finding 3 — Beat-5 image slot is optional; C5 checks beats 0–4 only (CORRECTLY SCOPED)

Decision 5 says `web/public/story/05-ladder` is optional ("or a simple in-app knowledge-ladder list — generator's choice"). C5 checks `[data-testid="scene-image"]` only on "each of beats 0–4", so beat 5's image-slot presence is NOT a criterion. This is consistent with the optional wording. The evaluator will NOT fail C5 if beat 5 renders an in-app chart instead of a `SceneImage`. No ambiguity issue.

### Finding 4 — `web/public/story/` does NOT yet exist (CONFIRMED — contract baseline is correct)

The directory is absent (`ls` returns NOT_EXISTS). C5's baseline state ("with `web/public/story/` empty") is correct: the generator must create the directory (with `.gitkeep`), and the evaluator will test against a directory that contains only `.gitkeep` (zero webp files). No blocking issue.

### Finding 5 — C6 highlight criterion: `vocab.motsu` item-id vs. `持つ` surface (POTENTIAL MISFIRE — flag for generator)

Decision 3 lists beat-4 passives as `[vocab.motsu, vocab.mado]` with "highlighted target surfaces てもいい and 持つ". C6 specifies `data-item-id="vocab.motsu"` for 持つ. However, Decision 3 also lists `vocab.yakusoku` as a beat-4 active. DEMO-STORYLINE says the "new tonight" lessons are `てもいい` and `持つ`, which per the contract are the items that ENTER as new lessons via `day4LessonBatch()`. The contract says `vocab.motsu` is a passive. If `segmentLine` is called with only the beat's authored target items (a subset of the day's derived `items`), and `vocab.motsu`'s surface is indeed `持つ`, then `data-item-id="vocab.motsu"` is correct. This is internally consistent — no criterion defect, but the generator must ensure the day-4 passive items (`vocab.motsu`) are included in the `items` list (joined from both actives and passives via `joinItems([...active, ...passive])`). C6 is mechanically testable as written.

### Finding 6 — C6 also checks `vocab.yakusoku` (active) is NOT in the highlighted surfaces (implicit)

The contract says beat-4 highlighted surfaces are ONLY `てもいい` and `持つ` (not `約束`, the surface for `vocab.yakusoku`). C6 does not explicitly test for absence of `vocab.yakusoku` highlight, but the "plain dialogue text outside the targets is NOT wrapped" clause covers this. Mechanically checkable.

### Finding 7 — `glossSegments.ts` has an `EpisodeItem` import from `./episodeData`, NOT from `runEpisode.ts` (ARCHITECTURAL CALLOUT for generator)

`glossSegments.ts` line 1 imports `EpisodeItem` from `"./episodeData"` — which re-exports it from `runEpisode.ts`. The generator's tour components will import `glossSegments.ts` from `components/episode/`, which imports `EpisodeItem` from `components/episode/episodeData`. This means the tour island's highlight renderer needs to either (a) also be inside `components/episode/` (not ideal since the contract places tour components in `components/story/`), or (b) use a relative import path `../../components/episode/glossSegments`. Decision 4 says `glossSegments.ts` is "imported read-only — not modified", but does not specify from where. This is NOT a contract defect; just a note the generator must navigate. No evaluator impact.

### Finding 8 — C10 determinism check: "two fetches are byte-identical" is over-specified for a server component (CRITERION NEEDS SOFTENING)

C10 says "if the page exposes the derived data as JSON anywhere…two fetches are byte-identical; otherwise the evaluator compares the rendered Day-1..4 dialogue text strings across two loads for equality." A Next.js server component HTML render is byte-identical only if hydration nonces and React internal IDs are stable across renders, which they are NOT under `next dev` (nonces change per render). Under `next start` (production build, `force-dynamic`) the React server rendering is more stable but still not guaranteed byte-for-byte identical due to timestamps in hydration payloads.

**Impact:** "byte-identical" for the full HTML is untestable in practice. The fallback "compare the rendered Day-1..4 dialogue text strings across two loads for equality" IS mechanically testable and sufficient to prove determinism. The criterion's primary signal is the dialogue text comparison, which is well-specified. The "byte-identical" clause is a non-binding if-branch (only applies when JSON is embedded). This is acceptable as written — the evaluator will use the dialogue-text-comparison path. No revision required, but the generator should not embed nonce-stamped JSON.

### Finding 9 — C-REG: `seed-demo` command must exist (verify before QA)

C-REG references `env -u GEMINI_API_KEY npm run seed-demo` but the run command in HARNESS.md does not mention this script. The evaluator must confirm `web/package.json` has a `seed-demo` script before running C-REG's seeded-day-4 check. Not a criterion defect (the contract references an established script from earlier contracts), but the evaluator must not assume it exists — check `package.json` first.

### Finding 10 — C5 "lazy loading OR not requested until its beat is shown" creates a dual-path test that is ambiguous for `next/image`

C5 says: lazy loading verified by "`loading='lazy'` on `<img>`/`next/image`, OR not requested until its beat is shown — verified by zero `/story/*` network request for beats not yet viewed." Under `next/image` with the default `loading="lazy"`, requests are deferred to IntersectionObserver — but the beat cards that are not visible may still be in the DOM (just hidden with CSS), meaning the IntersectionObserver may or may not fire depending on implementation. The evaluator **cannot reliably distinguish** "no request because lazy" from "no request because not in DOM" vs. "no request because hidden from viewport". The cleanest mechanical check is: navigate to beat 0, intercept all network requests matching `/story/*`, confirm zero such requests before navigating to beat 1. This is what the criterion intends and IS checkable. The `loading="lazy"` attribute check (`page.getAttribute('loading')`) is a direct DOM check that requires zero inference. Both sub-checks are mechanically testable — the criterion is fine as written.

---

### Summary of criterion verifiability

| Criterion | Mechanically testable? | Notes |
|-----------|----------------------|-------|
| C1 | YES — grep on filesystem + file content checks | |
| C2 | YES — Playwright DOM + network inspection | "shows café NPC / mom" needs `[data-testid]` or text content — contract does not specify a testid for the NPC name; evaluator will look for the NPC name text content inside `[data-testid="tour-beat"]` |
| C3 | YES — click + keyboard dispatch + DOM state checks | |
| C4 | YES — count children of `[data-testid="tour-progress"]`, check `aria-current` | |
| C5 | YES — attribute checks + bounding box + network intercept | |
| C6 | YES — `querySelectorAll('[data-tour-highlight]')` + `data-item-id` attribute checks + text content comparison | |
| C7 | YES — audio element attribute check + network intercept + `paused` property | |
| C8 | YES — `scrollWidth <= innerWidth + 1` at three viewports | |
| C9 | YES — event listeners registered before goto | |
| C10 | YES — compare rendered dialogue text across two loads | |
| C-REG | YES — `git status --porcelain` + curl checks | Evaluator must verify `seed-demo` script exists first |
| C-GATE | YES — shell exit codes | |

**One missing criterion flagged:** No criterion tests that `web/.data/story-state.json` is NOT written by a `/story` visit (C-REG mentions it but as a sub-check buried inside a compound criterion alongside other checks). The C-REG criterion is already maxed out; the storyState non-mutation check is present within it, so this is covered — no new criterion needed.

**No vague criteria found.** All criteria either pass on a boolean DOM/network/file check or compare exact values. None require judgment calls.

---

**VERDICT: ACCEPTED.**

All criteria are mechanically verifiable by a Playwright-driving evaluator with zero judgment calls. The architectural claims in the design decisions (StoryStore swappability, audio asset existence, beat-word mappings matching DEMO-STORYLINE.md) are confirmed against the codebase. The one potential test ambiguity (C10 byte-identical HTML) resolves cleanly via the criterion's own fallback clause. The beat-4 audio asset `day4-turn2.m4a` exists. The `web/public/story/` absence is the correct baseline for C5. No criteria need revision.
