# Generator state — Contract 003, build round 1

**No engine changes** — `src/lib` untouched (`git status --porcelain -- src/lib` empty). The modified `scripts/review-loop.ts` / `scripts/review-trends.ts` in `git status` are pre-existing user changes, same as the contract-002 round.

## What changed (files + why)

- `web/lib/engine/runEpisode.ts` — **additive `items` extension only.** New `EpisodeItem` interface + `joinItems()`: joins `log.activeTargetsChosen` + `log.passiveItemsChosen` (in that order) against `loadVocab()`/`loadGrammar()` (engine imports, read-only) into `items: {itemId, itemType, mode, surface, reading, meaning}[]`. `surface` = `VocabItem.word` | `GrammarItem.pattern`; `reading` = vocab reading | `null` for grammar; unknown ids throw loudly (→ JSON 500 from the route). `items: []` on skipped status. `status`/`log`/`story` shapes untouched; derived purely from static content data, so contract-002 byte-identity holds with no new exclusions (verified below).
- `web/app/page.tsx` — scaffold replaced; renders `<main>` + the `EpisodePlayer` client island.
- `web/app/layout.tsx` — Geist removed; **Shippori Mincho** loaded via `next/font/google` as `--font-shippori` (weights 500/600/700, latin slice preloaded, JA slices stream via unicode-range). New metadata (no create-next-app strings).
- `web/app/globals.css` — 民宿 design-token foundation: `:root` motion/shadow tokens + `@theme` palette (washi/shoji paper, ink, 柿 kaki, 藍 aizome, moss, gold, rust + wash variants — 23 custom-property lines, C10c grep ≥ 6) + `@theme inline` font stacks. Body = warm washi `#f4ecdc` (`rgb(244, 236, 220)`) with a faint lantern-light gradient; turn reveal is a single opacity/transform keyframe with a `prefers-reduced-motion` opt-out.
- **`web/components/episode/`** (new — the component location named per contract scope):
  - `EpisodePlayer.tsx` — the only `"use client"` file; module-level promise cache so `/api/episode` is fetched **exactly once** even under React strict mode's double effect in dev; progressive-reveal state (`revealTurns`: everything up to the first unsubmitted player turn); complete-POST state machine.
  - `episodeData.ts` — zod schemas validating the API response at the fetch boundary (strips fields the UI doesn't use; full 5-value outcome enum from the engine ladder).
  - `glossSegments.ts` — pure segmentation of NPC line text around passive surface forms (concatenation of segments always equals the original line).
  - `CoachBeat.tsx` (kaki-wash 手紙 note, `data-role="coach"`, no `data-turn`), `NpcTurn.tsx` (shoji card, `data-role="npc" data-turn`, gloss tray under the line), `GlossToken.tsx` (`<button data-token-item>` — only the surface text lives in the sentence; reading+gloss render in the tray, so textContent substrings stay contiguous), `PlayerTurn.tsx` (aizome card: typed text + "The scene's line — what gets graded" + badges), `OutcomeBadge.tsx` (`data-outcome`, 5 distinct wash backgrounds), `PlayerInput.tsx` (`player-input`/`player-submit`, trims, rejects empty, clears to `""` after submit), `CompletePanel.tsx` (`complete-episode` button is **removed** after the 200 and replaced by `complete-confirmation` — no clickable trace remains).

## Behavior notes for the evaluator

1. **Reveal model:** briefing + leading NPC turn render on load; each non-empty submission reveals the player turn (typed + recorded + badges) and the following NPC turn; after the third submission the result coach beat + complete button appear and the input form is removed from the DOM.
2. **Single fetch:** `fetch("/api/episode")` goes through a module-level promise cache — strict-mode dev double-effect still produces one network request. A failed load clears the cache so a page reload retries.
3. **Gloss reveal placement:** tapped glosses appear in a tray *below* the NPC line (not inline), deliberately — inline insertion (e.g. `<ruby>`) would break the C7 textContent-substring checks. Keyboard: native `<button>`, Enter fires click.
4. **Complete:** in-flight guard + disabled-while-pending + button removal after success; a non-200 shows `role="alert"` text and returns the button to idle for retry.
5. Day indicator: `h1` = `Day {n}` + `{n}日目` (lang="ja"); h1 computed first font family resolves to Shippori Mincho.
6. Reading column: content shell is `max-w-[760px]` centered; the dialogue `<section aria-label="Today's dialogue">` measured 720px wide at 1440.
7. Server start commands unchanged from contract 002 (dev singleton caveat still applies — a stale `next-server` from a previous round was holding port **3010** this round, so I verified on **3020**; pick a free port for `npm run start`).

## Gate results

`npm run code-check` (repo root) — pass:

```
 Test Files  22 passed (22)
      Tests  101 passed (101)
   Duration  2.28s
```

`cd web && npm run lint` — exit 0, no output. `npm run build` — exit 0:

```
┌ ○ /
├ ○ /_not-found
├ ƒ /api/episode
└ ƒ /api/episode/complete
```

## Self-verification (production server, port 3020, `MINSHUKU_FAKE_LLM=1`, fresh state)

- **C1 (curl/jq):** `.status=="completed"`, `.story.day==1`, `.items` length 5 (2 active / 3 passive); `vocab.fushigi` entry equals the pinned object literal; `grammar.tsumori` has `surface=="つもり"`, `reading==null`; two consecutive GETs byte-identical (`cmp`) after the contract-002 `del(...)` — no new exclusions needed. PASS.
- **C2–C10 (Playwright 1.58, chromium, 1440×900 + 375×812):** full scripted walkthrough mirroring the contract's ordered criteria — all 60 assertions passed, including: exactly 1 GET + 1 POST observed via pre-goto listeners; empty-submit reveals nothing; marker text + recorded line both in turn 3; input value `""` after submit; badge bgs `rgb(226,234,208)` (produced) vs `rgb(238,214,202)` (missed) vs body `rgb(244,236,220)`; turns 2–7 ascending, 6 badges; coach bg `rgb(245,224,205)` ≠ npc bg `rgb(252,248,238)`; confirmation visible + button removed, POST count stayed 1; 3 tokens in turns 2/4/6, all `<button>`, sentence substrings intact, glosses hidden before tap and revealed by click (fushigi) and focus+Enter (ame); zero pageerrors / console errors / ≥400 responses; h1 first family "Shippori Mincho"; no Tailwind-blue interactive elements; no horizontal overflow at either viewport, max turn-block right edge 355px at 375.
- **C11:** gates above; `git status --porcelain -- src/lib` empty; `grep -rn "create-next-app\|vercel.com/templates" web/app` empty; `grep -c "^\s*--" web/app/globals.css` = 23.

## Known issues / notes

- No unit tests added for `glossSegments.ts`: `web/` has no test runner and the harness gates don't include web tests — covered by the Playwright walkthrough instead. Flagging rather than silently wiring a new runner into the gates.
- Story state at end of round: `web/.data/story-state.json` deleted (fresh day 1), per the contract's cleanup rule. My verification server on 3020 is stopped; the stale next-server on 3010 (pre-existing, not mine) was left running, as was the user's dev server if any on 3000.
