# Contract 008 — Voice & atmosphere layer (TTS turns, ambience, mic input)

Backlog item: "Three pieces, all fixture-safe: (a) NPC + coach lines spoken — pre-generate audio ONCE locally with the existing TTS pipeline (src/lib/audio/tts.ts, per-template voiceConfig) for the four demo days' fixture dialogue, commit as static assets, play per revealed turn (no runtime API calls, no key on server); (b) per-scene ambience from the existing public/audio/<templateId>.m4a tracks (12 exist; minshuku-arrival-with-mom missing — generate via the music script or reuse a minshuku-* track), user-gesture-gated with a mute toggle; (c) mic input via browser SpeechRecognition (ja-JP) filling the player input — no API, graceful fallback when unsupported."

## Scope

### Design decisions (settled)

1. **TTS clip inventory and naming.** The four day fixtures (`web/fixtures/episode-demo-learner*.json`) contain exactly 12 NPC lines (turns 2/4/6 each day: day 1 `cafe_regular`, day 2 `stranger`, day 3 `bookshop_owner`, day 4 `mom`) and 8 coach beats (per-day `briefing` + `result`, English text) — **20 clips total**. Committed under `web/public/tts/` (deploys as static assets on Vercel, root dir `web`) with deterministic day+turn keys:
   - `day<N>-turn<M>.m4a` for NPC turns (N ∈ 1..4, M ∈ {2,4,6})
   - `day<N>-briefing.m4a` / `day<N>-result.m4a` for the coach beats
   Client src derivation is pure: `/tts/day${story.day}-turn${turn.turn}.m4a` etc. Coverage is total — fixture mode never renders a day ≥ 5 (day-5 fail-loud, contract 006 C3).
2. **Generation script.** New `web/scripts/gen-fixture-audio.ts` (npm script `gen-fixture-audio`, run via tsx like `seed-demo`). It **parses the line text out of the four fixture JSONs** (the `generateDialogue` response's `briefing`/`turns`/`result`) — no hand-copied strings, so clips cannot drift from fixtures. Synthesizes via the existing `synthesizeSpeech` (`src/lib/audio/tts.ts`), encodes WAV→m4a with ffmpeg (same pattern as `scripts/generate-music.ts`; ffmpeg is already a repo prerequisite). **Runs locally ONCE with the repo `.env` key — never at runtime, never in CI, never during QA.** Criteria verify the committed files, not generation.
3. **Voice mapping.** A `voiceConfig → Gemini prebuilt voice` table inside the script, covering the four demo-day characters' template `voiceConfig` labels: `ja-warm-female` (mom) → **Leda** (pinned — the canonical Tanaka-san voice per `scripts/gen-demo-audio.ts`); `ja-friendly-young-adult` (cafe_regular), `ja-soft-ambiguous` (stranger), `ja-warm-middle-aged` (bookshop_owner) → generator's pick from the 30-voice catalog (`scripts/tts-voices-tour.ts`), one distinct voice each. **Coach → Kore** — justification: it is `GEMINI_TTS_DEFAULT_VOICE`, the codebase's canonical default, distinct from all four NPC voices, and the coach speaks English so no ja-specific casting exists to reuse. Criteria pin file existence/wiring, not voice identity (not mechanically checkable).
4. **Ambience.** The four demo-day tracks copied into `web/public/audio/` (web app static root; the repo-root `public/audio/` is not served by Next): `cafe-regular-encounter.m4a`, `late-night-walk-stranger.m4a`, `bookshop-quiet-browse.m4a`, and `minshuku-arrival-with-mom.m4a` = **a byte-for-byte copy of `public/audio/minshuku-evening-talk-about-day.m4a`** (reuse, not generation — justification: all minshuku-* tracks were generated from the same `minshuku` location mood preset (`presetForLocation` keys off `template.location`), so they are the same sonic family; day 4's frame is an evening return to the minshuku, which `evening-talk-about-day` matches; zero API cost, no Lyria nondeterminism, no ffmpeg run). Client maps `log.templateId → /audio/<templateId>.m4a` with no fallback logic. `log.templateId` is already in the API response (the route returns the full `RunSceneResult`); only the client zod schema in `episodeData.ts` gains the field — **no API change**.
5. **Playback UX.** Per-line play/pause control (`data-testid="tts-toggle"`) on every revealed NPC turn and coach beat, each owning an `<audio preload="none">` with the pinned src. At most one clip plays at a time (starting one pauses the rest). **Autoplay-on-reveal**: after the first user gesture on the page, and only while sound is on, a newly revealed NPC/coach line auto-plays. **Global sound toggle** (`data-testid="sound-toggle"`, `aria-pressed`) in the episode header, default ON, persisted in `localStorage` key `minshuku:sound` (`"on"`/`"off"`); off = ambience paused, no autoplay, any playing clip stops (manual play also disabled or no-op — generator's choice, but no audio may sound while off).
6. **Ambience playback.** One looping `<audio data-testid="ambience" loop preload="none">` with the per-scene src; never starts before a user gesture (browser policy + explicit gating); starts on first gesture when sound is on; quiet volume (~0.25, like the voices-tour bed — not a criterion). The global sound toggle is the mute toggle.
7. **Mic input.** Button (`data-testid="mic-button"`) inside `PlayerInput` next to the text field, using `window.SpeechRecognition ?? window.webkitSpeechRecognition` with `lang: "ja-JP"`; the final transcript fills the controlled input draft (player edits/submits as usual). Feature-detected: **not rendered at all** when the API is absent. Listening state exposed via `data-state="listening"`/`aria-pressed`; on any recognition error (`not-allowed`, `no-speech`, `network`, …) the button returns to idle and an inline status (`data-testid="mic-status"`, `role="status"`) shows a short human message — no thrown errors, typing untouched. Playwright Chromium has the constructor but no real STT backend, so criteria test presence/fallback/error-path mechanically, never recognition accuracy.
8. **Weight discipline.** No new entries in `web/package.json` `dependencies` or `devDependencies` (script uses existing `tsx` + `@google/genai`). All `<audio>` elements `preload="none"` — zero audio bytes fetched before a gesture/play. Asset caps: `web/public/tts/` total ≤ 3 MB (20 m4a clips, mono AAC); `web/public/tts/` + `web/public/audio/` combined ≤ 12 MB (the four ambience tracks are ~1.9–2.3 MB each).

### Files expected to change
New: `web/scripts/gen-fixture-audio.ts`; `web/components/audio/` (SoundProvider/SoundToggle/AmbiencePlayer/TtsClip + `useSpeechInput`, generator's exact split); assets `web/public/tts/*.m4a` (20) and `web/public/audio/*.m4a` (4). Edited: `web/components/episode/{EpisodePlayer,NpcTurn,CoachBeat,PlayerInput,episodeData}.tsx|ts`, `web/package.json` (scripts block only), root `README.md` (one short note: how/when `gen-fixture-audio` is run, never in CI).

## Out of scope
- Live two-way voice (Gemini Live) — explicitly Season 2.
- Any runtime TTS/STT API call, any `GEMINI_API_KEY` on the server or Vercel — the deployment env from contract 007 is unchanged.
- Re-running TTS/music generation during QA or CI; QA verifies committed bytes only.
- Engine code (`src/lib` read-only), the API routes, the fixtures, the cookie/file store — none of these change.
- Player-turn or debrief audio; ambience for the 9 non-demo-day templates; root `public/audio/` (the missing `minshuku-arrival-with-mom.m4a` is solved by the copy under `web/public/audio/` only).
- Word-level karaoke highlighting, waveforms, playback-rate controls.

## Conventions
"Standing exclusions" = `jq 'del(.log.id, .log.startedAt, .log.endedAt, .log.llmLatencyMs)'`. Server: production build (`cd web && npm run build`), file mode, `MINSHUKU_FAKE_LLM=1`, **no `GEMINI_API_KEY` in the server env**, fresh state (`rm -f web/.data/story-state.json`) unless a step says otherwise. Playwright Chromium launched with `--autoplay-policy=no-user-gesture-required` (removes browser-level autoplay blocking so the app's own gesture gate is what's under test). 1440×900 unless stated. "A gesture" = any real click in the page (e.g. a tts-toggle or the sound toggle).

## Criteria (each must be mechanically checkable by a browser-driving evaluator)

- [ ] C1 — **Committed TTS assets exist and are sane.** `web/public/tts/` contains exactly 20 files, exactly the names `day{1,2,3,4}-briefing.m4a`, `day{1,2,3,4}-result.m4a`, `day{1,2,3,4}-turn{2,4,6}.m4a`; every file ≥ 10 KB; directory total ≤ 3 MB. `web/scripts/gen-fixture-audio.ts` exists, references the fixture files (grep matches `fixtures/episode-demo-learner` or equivalent import of all four), imports `synthesizeSpeech` from the engine TTS module, and maps `ja-warm-female` → `Leda` and the coach to `Kore` (greppable). `web/package.json` has a `gen-fixture-audio` script. The evaluator never executes it.
- [ ] C2 — **Ambience assets exist; the missing track is the documented reuse.** `web/public/audio/` contains exactly `cafe-regular-encounter.m4a`, `late-night-walk-stranger.m4a`, `bookshop-quiet-browse.m4a`, `minshuku-arrival-with-mom.m4a`, each ≥ 500 KB; `cmp web/public/audio/minshuku-arrival-with-mom.m4a public/audio/minshuku-evening-talk-about-day.m4a` exits 0. Combined size of `web/public/tts/` + `web/public/audio/` ≤ 12 MB.
- [ ] C3 — **Per-turn audio wiring with src pins, lazy.** Day-1 page load: the briefing coach beat contains `audio[src="/tts/day1-briefing.m4a"]` and NPC turn 2 (`[data-role="npc"][data-turn="2"]`) contains `audio[src="/tts/day1-turn2.m4a"]`; every `audio` element on the page has `preload="none"`; each of those two cards shows a visible `[data-testid="tts-toggle"]` with a non-empty accessible name. Network log from navigation start: **zero** requests to `/tts/*` or `/audio/*` before any gesture.
- [ ] C4 — **Play/pause mechanics, single active clip.** Click turn 2's tts-toggle → within 2 s its audio element has `paused === false` and a network request for `/tts/day1-turn2.m4a` was made; the toggle reflects playing state (`aria-pressed="true"` or `data-state="playing"`). Click it again → `paused === true`. Play the briefing clip while turn 2 is playing → briefing's audio `paused === false` and turn 2's `paused === true`.
- [ ] C5 — **Autoplay-on-reveal after first gesture, gated by the sound toggle.** Sound on, after one prior gesture (C4's click): submit player turn 3 → NPC turn 4 reveals and within 2 s `audio[src="/tts/day1-turn4.m4a"]` has `paused === false`; after submitting the final player turn, the result coach beat reveals and `audio[src="/tts/day1-result.m4a"]` plays. Fresh page, sound toggled OFF, same journey: revealing turns triggers **zero** `/tts/*` network requests and no audio element on the page ever has `paused === false`.
- [ ] C6 — **Ambience: per-scene src, gesture-gated.** Day 1 load: `[data-testid="ambience"]` is an audio element with `src` ending `/audio/cafe-regular-encounter.m4a`, has `loop`, `paused === true`, and no `/audio/*` request yet; after the first in-page click with sound on, `paused === false` within 2 s. Complete day 1 through the debrief, reload → day 2's ambience src ends `/audio/late-night-walk-stranger.m4a`. Then `npm --prefix web run seed-demo` + reload → day 4's ambience src ends `/audio/minshuku-arrival-with-mom.m4a`.
- [ ] C7 — **Sound toggle persists in localStorage.** `[data-testid="sound-toggle"]` visible at 375/768/1440 with `aria-pressed`. With ambience + a clip playing: toggle off → within 1 s every audio element has `paused === true` and `localStorage["minshuku:sound"] === "off"`. Reload → toggle still reads off (`aria-pressed="false"`), and clicking around/submitting a turn produces zero `/tts/*`/`/audio/*` requests. Toggle on → `localStorage` reads `"on"`, value survives another reload.
- [ ] C8 — **Mic feature-detect, both branches.** Branch A (default Chromium, `webkitSpeechRecognition` present): `[data-testid="mic-button"]` is visible inside the player-input form with a non-empty accessible name, and `[data-testid="player-input"]` + `[data-testid="player-submit"]` still work (type + submit reveals the next turn). Branch B (fresh context with `addInitScript` deleting both `window.SpeechRecognition` and `window.webkitSpeechRecognition` before load): `[data-testid="mic-button"]` is **absent from the DOM**, and the type-and-submit flow is unchanged.
- [ ] C9 — **Mic error path is graceful.** Chromium context with mic permission not granted: click `[data-testid="mic-button"]` → it may enter `data-state="listening"`, but within 5 s it is back to idle and/or `[data-testid="mic-status"]` (`role="status"`) shows a non-empty message; zero `pageerror`s and zero console errors from the click; typing into the input and submitting still works afterwards.
- [ ] C10 — **No runtime Gemini, ever.** Server started with no `GEMINI_API_KEY` in its environment. Playwright records every request URL across the full day-1 journey including C4–C7 audio interactions: zero requests to any non-localhost host (in particular nothing matching `googleapis.com`). The journey completes to the debrief regardless.
- [ ] C11 — **Determinism + surface regression pins.** Two consecutive curl GETs of `/api/episode` are byte-identical under standing exclusions, and the day-1 body has `.log.templateId == "cafe-regular-encounter"` (the ambience key was already in the response — no API change). `git status --porcelain -- src/lib web/app/api web/fixtures web/lib/engine` is empty, and `web/package.json`'s `dependencies`/`devDependencies` blocks are unchanged from HEAD (`git diff -- web/package.json` touches only `scripts`).
- [ ] C12 — **Clean full journey at 375 and 1440.** At each viewport, sound on: play one coach clip and one NPC clip, use autoplay reveal, complete day 1 to the debrief + return-tomorrow beat; zero console errors, zero `pageerror`s; at 375 `document.documentElement.scrollWidth <= 375` (the new toggle/mic/play controls cause no horizontal overflow); all contract-006 fixtures intact (6 `[data-outcome]` badges, 3 `[data-debrief-group]`s).
- [ ] C13 — **Gates.** `npm run code-check` exits 0 (101 tests); `cd web && npm run lint` exits 0 and `npm run build` exits 0.

## Evaluator review

### Fact-checks performed

**1. 20-clip count (12 NPC + 8 coach)**
Verified by parsing all four fixture files (`web/fixtures/episode-demo-learner*.json`). Each of the four `generateDialogue` responses contains exactly 3 NPC turns (turns 2, 4, 6) and 2 coach fields (`briefing`, `result`). Total: 12 NPC clips + 8 coach clips = **20 clips. CONFIRMED.**

**2. `log.templateId` already in API response**
`SceneRunLog` (engine `src/lib/types.ts` line 151) has `templateId: string`. The route (`web/app/api/episode/route.ts`) returns `result` which is `RunSceneResult & {story, items}`; the `RunSceneCompleted.log` field is the full `SceneRunLog`, so the JSON body already carries `log.templateId`. However, the **client zod schema** (`web/components/episode/episodeData.ts`) does NOT currently include `templateId` in the `log` object — it strips it. The contract correctly states "only the client zod schema in `episodeData.ts` gains the field — no API change." **CONFIRMED: route unchanged, schema update required client-side only.**

**3. Voice pins (mom=Leda, coach=Kore)**
`public/audio/`-adjacent template `data/templates/minshuku-arrival-with-mom.json` has `voiceConfig: "ja-warm-female"`. Existing scripts (`scripts/gen-demo-audio.ts`, `scripts/scene-interactive.ts`) already map `"ja-warm-female" → "Leda"`. Engine `src/lib/audio/tts.ts` defines `GEMINI_TTS_DEFAULT_VOICE = "Kore"`. The contract's C1 grep check for `ja-warm-female → Leda` and `coach → Kore` is greppable and mechanical. **CONFIRMED.**

**4. `web/public/audio/` serving reality**
`web/public/` exists but is currently empty (no subdirectories). The repo-root `public/audio/` contains 12 .m4a files but is NOT in the Next.js app's static root. Next.js serves from `web/public/` exclusively. The contract's requirement to copy assets into `web/public/audio/` is **correct and necessary.** The contract's statement "the repo-root `public/audio/` is not served by Next" is **CONFIRMED.**

**5. Ambience track count and missing file**
`public/audio/` has exactly 12 files. `minshuku-arrival-with-mom.m4a` is absent from `public/audio/` (the template JSON in `data/templates/` exists but was never given a music generation run). The proposed reuse of `minshuku-evening-talk-about-day.m4a` as a byte-copy is documented in the contract. **CONFIRMED: 12 tracks exist, 1 missing, copy strategy is sound.**

**6. Playwright/SpeechRecognition note**
Playwright Chromium provides `webkitSpeechRecognition` constructor but no real backend. C8 Branch A tests presence/wiring only; Branch B uses `addInitScript` to delete both constructors. C9 tests error handling without requiring actual recognition output. These are purely DOM/network assertions. **CONFIRMED: no recognition accuracy tested.**

---

### Criterion-by-criterion assessment

**C1** — File-system checks (exact file count, names, size floor, directory total, grep assertions on the script source). All mechanical. PASS criteria design.

**C2** — File-system checks + `cmp` byte comparison. The `cmp` command path (`web/public/audio/minshuku-arrival-with-mom.m4a` vs `public/audio/minshuku-evening-talk-about-day.m4a`) is correct given the repo structure. PASS criteria design.

**C3** — DOM attribute assertions (`audio[src=...]`, `preload="none"`) + network log zero-request check before gesture. The network log assertion requires the Playwright HAR or `page.on('request')` listener; the criteria text does not specify which Playwright API the evaluator must use, but both are standard. PASS criteria design.

**C4** — `audio.paused === false` / `=== true` state assertions via `page.evaluate`. These are JavaScript property reads, not audio output assertions. The 2-second timeout is concrete. PASS criteria design.

**C5** — Two branches: sound ON (autoplay triggers, network requests appear) and sound OFF (zero network requests, no `paused === false`). Both observable mechanically. The "fresh page, sound toggled OFF" sub-case requires a fresh navigation; that is implied. PASS criteria design. **Minor note for the evaluator:** "same journey" after a fresh page means replaying the same player turns, so this step takes appreciable time — the 2 s autoplay window is per-turn reveal, not total. No criterion change needed; the evaluator should account for multiple submit-and-wait cycles.

**C6** — DOM src check, `loop` attribute, `paused` property, network zero-request pre-gesture, then `paused === false` post-gesture; day advance verified by `seed-demo`. Mechanical. PASS criteria design.

**C7** — `localStorage` read (`localStorage["minshuku:sound"]`), `aria-pressed` at three viewports, network-zero after reload with sound off. Mechanical. PASS criteria design.

**C8** — Two browser contexts: default Chromium and `addInitScript`-patched context. DOM presence/absence of `[data-testid="mic-button"]`. Mechanical. PASS criteria design.

**C9** — Mic permission not granted, error path, `data-state`, `mic-status` message, zero `pageerror`s. In Playwright Chromium without `--use-fake-ui-for-media-stream`, clicking the mic button without permission granted will fire `not-allowed` almost immediately. The "within 5 s" window is generous. **One edge note:** if the browser's permission prompt blocks (rather than auto-denying), the evaluator must ensure the context is launched without granting mic permission (not merely without a prompt). The criteria text says "Chromium context with mic permission not granted" which implies no-grant at launch — sufficient for `addInitScript`-style context or a fresh context with no permission override. PASS criteria design.

**C10** — `page.on('request')` captures all network requests; matching against non-localhost hostname is a string check. PASS criteria design.

**C11** — curl + jq byte comparison, `git status --porcelain` (empty = no engine/API changes), `git diff -- web/package.json` (scripts-only diff). **One precision note:** The C11 criterion text says "the day-1 body has `.log.templateId == 'cafe-regular-encounter'"` and parenthetically "(the ambience key was already in the response — no API change)". However, the current `episodeResponseSchema` in `episodeData.ts` does NOT include `templateId` in the `log` object, so `jq '.log.templateId'` on the **raw JSON response** will still return `"cafe-regular-encounter"` (because the schema stripping happens only client-side). The curl check hits the raw route, not the schema. This is correct and mechanical. PASS criteria design.

**C12** — Viewport + overflow + `scrollWidth` assertion + contract-006 badge counts. All mechanical. PASS criteria design.

**C13** — Exit-code checks for `code-check`, `lint`, `build`. PASS criteria design.

---

### Issues found: NONE requiring criterion revision

All 13 criteria are mechanically testable without judgment calls. The audio-playback assertions test DOM element state (`.paused`, `.src`, `preload` attribute) not audio output. The mic criteria avoid asserting recognition accuracy. Size caps and no-Gemini-network assertions are exact. Voice identity is explicitly not a criterion (contract text: "Criteria pin file existence/wiring, not voice identity — not mechanically checkable"). The `cmp` path in C2 correctly references the repo-root copy vs the web/public copy.

**VERDICT: ACCEPTED**
