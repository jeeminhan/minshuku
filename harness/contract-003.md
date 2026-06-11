# Contract 003 — Play-the-scene UI

Backlog item: The core screen: dialogue turns render in order; player turns are free-text input; new/passive words in NPC lines are tappable for furigana+gloss; evaluator grades each player turn inline (outcome ladder: recognized → produced_with_help → produced → mastered). Coach turns (1 and final) styled as teaching beats.

## Architectural decision baked into this contract (read before building)

`GET /api/episode` returns the **complete** episode in one response — all turns at once, player turns pre-recorded, `evaluatorResults` already computed (`runScene` runs synthetic player turns server-side; this is true in BOTH fixture and live mode). **This contract's UI is therefore a progressive reveal over that single response — do NOT build a turn-by-turn backend, do NOT add per-turn API routes.** The page fetches the episode exactly once, reveals turns sequentially, and gates each player turn behind free-text input: the player must type something before their turn advances. The typed text is accepted and displayed as the player's line, and the episode's recorded player line is ALSO displayed alongside it (labeled however the generator likes — e.g. "the scene's line"), because the inline `evaluatorResults` grade the **recorded** line, not the typed text — showing the recorded line is what keeps the grading honest. Live-mode wiring stays exactly as-is from `runEpisode()`; grading the typed text is Season-2 territory.

Scope:

- **`web/app/page.tsx`** — replace the create-next-app scaffold with the episode screen at `/`. Client-side episode playthrough (a client component or client island is expected; server-component shell is fine). Fetches `GET /api/episode` exactly once per playthrough.
- **Episode components** — new files under `web/components/episode/` (or `web/app/components/` — generator's call, named in `harness/generator-state.md`): dialogue log, player input, outcome badges, gloss tokens, coach beats. Organize by feature, keep files small.
- **`web/app/globals.css` + `web/app/layout.tsx`** — 民宿 guesthouse-warmth design tokens (CSS custom properties per HARNESS convention) and a deliberately chosen heading font loaded via `next/font` (NOT the scaffold's Geist, NOT a system font — C10 enforces this as computed styles). `public/art/style-bible.md` is the visual reference; there are no committed image assets, so the aesthetic carries through color/type/texture, not backdrops.
- **Rendering model:**
  - `log.briefing` renders as the opening coach beat; `log.result` renders as the final coach beat (`log.turns` contains only NPC + player turns — coach turns are the bookend strings, per `src/lib/runScene.ts`).
  - Turns reveal in `turn`-number order. On load: briefing + the first NPC turn only. Each player turn requires a non-empty free-text submission to advance; submission reveals the player turn (typed text + recorded line + inline `evaluatorResults`) and the following NPC turn. After the last player turn, the final coach beat + complete action appear.
  - Inline evaluator results: one badge per `EvaluatorResult` on the player turn, showing the item and its outcome, with visually distinct states across the outcome ladder (`missed | recognized | produced_with_help | produced | mastered` — the full 5-value enum from `src/lib/types.ts`, even though day 1 only exercises `produced`/`missed`).
  - Gloss tokens: occurrences of **passive** items' surface forms inside NPC line text are wrapped in tappable, keyboard-focusable elements; tapping reveals furigana (reading) + English gloss. Wrapping must not alter the visible sentence text. Active items and player/coach lines get no tokens.
  - A visible day indicator driven by `story.day`.
  - "Complete episode" action wired to `POST /api/episode/complete`; on success shows a completion confirmation and prevents a second POST (the API 409s on double-complete — the UI must not invite it).
- **API extension (in scope, additive only): top-level `items` field on `GET /api/episode`.** The response today carries only `ItemAssignment`s (`itemId`/`itemType`/`mode`) — no surface/reading/gloss — so `web/lib/engine/runEpisode.ts` joins `activeTargetsChosen` + `passiveItemsChosen` against `loadVocab()`/`loadGrammar()` (engine read-only, already imported there) into `items: Array<{ itemId, itemType, mode, surface, reading, meaning }>` where `surface` = `VocabItem.word` | `GrammarItem.pattern`, `reading` = `VocabItem.reading` | `null` for grammar, `meaning` = the item's `meaning`. `status`/`log`/`story` shapes are unchanged (contracts 001/002 stay green), and the contract-002 idempotence/determinism guarantee must hold with the new field included.
- **Required selector vocabulary** (criteria depend on these exact attributes):
  - `data-role="coach" | "npc" | "player"` on each rendered beat/turn block; `data-turn="<n>"` on NPC/player turns.
  - `data-outcome="<enum value>"` on each inline evaluator badge.
  - `data-token-item="<itemId>"` on each gloss token.
  - `data-testid`: `player-input`, `player-submit`, `complete-episode`, `complete-confirmation`.

Out of scope:
- Any edit to files under `src/lib` (engine read-only, as always).
- Grading the player's typed text (live or fixture) — the inline results are the episode's recorded grading, displayed honestly per the decision above.
- New API routes; any change to `POST /api/episode/complete` semantics.
- Debrief screen, SRS interval updates, learned/strengthened/due-tomorrow summary (contract 004 — the complete-confirmation here is a minimal beat, not the debrief).
- Seeded multi-day learner (005); audio playback; full responsive/polish pass beyond the two viewports checked here (006); dark mode.
- Furigana over arbitrary kanji — tokens cover passive items only.
- Persisting the typed text anywhere.

## How the evaluator runs this

Fixture mode only, fresh story state, no key — same as contract 002:

```sh
rm -f /Users/jeeminhan/Code/minshuku/web/.data/story-state.json
cd /Users/jeeminhan/Code/minshuku/web && env -u GEMINI_API_KEY MINSHUKU_FAKE_LLM=1 npm run dev
```

Caveats carried over from contract 002 (still apply): Next 16 refuses a second dev server for the same directory — if one is already running, reuse it at its printed port, or run `npm run build && env -u GEMINI_API_KEY MINSHUKU_FAKE_LLM=1 PORT=3010 npm run start`. Read the actual port from startup output. The state file is shared per-repo; reset it before the walkthrough and leave it deleted at the end (C6 advances the day — clean up after).

Browser criteria are Playwright at viewport **1440×900** unless stated. Register `page.on("request")` / `page.on("console")` / `page.on("pageerror")` listeners **before** `page.goto("/")` — C2, C6, and C9 count requests and console events. The criteria are one ordered walkthrough; day-1 fixture ground truth used below (deterministic, verified against the committed fixture): NPC turns 2/4/6 (`cafe_regular`), player turns 3/5/7; every player turn has exactly 2 `evaluatorResults` — `grammar.tsumori` and `vocab.mado` — with outcomes (`produced`,`missed`) on turn 3, (`missed`,`produced`) on turn 5, (`produced`,`missed`) on turn 7; passives `vocab.ame`/`vocab.fushigi`/`vocab.yakusoku` appear verbatim as 雨 / 不思議 / 約束, one per NPC turn 2/4/6.

## Criteria (each must be mechanically checkable)

- [ ] C1: **API `items` extension (curl, fresh day 1).** After the reset command, `curl -s http://localhost:<port>/api/episode | jq -e` confirms: `.status=="completed"`, `.story.day==1`, and `.items` is an array of exactly 5 entries — 2 with `mode=="active"`, 3 with `mode=="passive"`; the `vocab.fushigi` entry equals `{itemId:"vocab.fushigi", itemType:"vocab", mode:"passive", surface:"不思議", reading:"ふしぎ", meaning:"mysterious; strange"}` and the `grammar.tsumori` entry has `surface=="つもり"` and `reading==null`. Determinism preserved: two consecutive GETs are byte-identical after `jq 'del(.log.id, .log.startedAt, .log.endedAt, .log.llmLatencyMs)'` (the contract-002 exclusion list — `items` must not need excluding).
- [ ] C2: **Load = opening beat only, single fetch.** `page.goto("/")` at 1440×900; exactly **one** request to `/api/episode` is observed for the whole of C2–C5 (and zero requests to any other `/api/*` path until C6). Visible: a day indicator whose text matches `/Day 1/`; the briefing text (substring `friendly regular takes the counter seat`) inside an element with `data-role="coach"`; the turn-2 NPC line (substring `週末は何か予定ある`) inside `[data-role="npc"][data-turn="2"]`; `[data-testid="player-input"]` (a writable text field) and `[data-testid="player-submit"]`. NOT in the DOM: the turn-4 NPC text (`不思議な色`), the turn-6 NPC text (`約束があるんだった`), any `[data-turn]` beyond 2, the result text (`dashed off to meet a friend`), and `[data-testid="complete-episode"]`.
- [ ] C3: **Gated reveal, typed text + recorded line.** Clicking `player-submit` with the input empty reveals nothing (count of `[data-turn]` elements stays 1). Then fill `player-input` with the marker `今日は祭りに行くテストです` and submit: a `[data-role="player"][data-turn="3"]` block appears containing BOTH the marker text and the recorded line `週末は友だちと神社のお祭りに行くつもりだよ`; `[data-role="npc"][data-turn="4"]` (substring `不思議な色`) appears; turn-6 text (`約束があるんだった`) is still absent; the `player-input` field value is `""` (empty string) after submission — confirmed via `locator.inputValue()` equals `""`. *(Wording revised per Evaluator review — applied by orchestrator verbatim.)*
- [ ] C4: **Inline outcome badges with distinct ladder states.** Within the turn-3 player block: exactly 2 elements with a `data-outcome` attribute — one `data-outcome="produced"` whose visible text contains `つもり`, one `data-outcome="missed"` whose visible text contains `窓`; every `data-outcome` value on the page is one of `missed|recognized|produced_with_help|produced|mastered`; the computed `background-color` (or, if backgrounds match, computed `border-color`) of the `produced` badge differs from the `missed` badge, and both differ from the page `body` background-color.
- [ ] C5: **Full playthrough + coach bookends + end state.** Submit non-empty text for the remaining two player turns. Then: `[data-turn]` blocks for exactly 2,3,4,5,6,7 exist in ascending DOM order; total `[data-outcome]` badge count is 6 (2 per player turn, outcomes per the ground truth above); the final coach beat (substring `dashed off to meet a friend`) is visible inside a `[data-role="coach"]` element; the computed `background-color` of `[data-role="coach"]` elements differs from `[data-role="npc"]` turn blocks (teaching beats visually distinct from dialogue); `[data-testid="player-input"]` is no longer enabled (disabled, hidden, or removed); `[data-testid="complete-episode"]` is now visible and enabled.
- [ ] C6: **Complete action wired honestly.** Clicking `complete-episode` fires exactly one `POST /api/episode/complete` which returns HTTP 200; afterwards `[data-testid="complete-confirmation"]` is visible with non-empty text, and `complete-episode` is disabled or removed; if any clickable trace of it remains, clicking again fires no second POST (observed request count to `/api/episode/complete` stays 1). No page navigation/reload is required for the confirmation (request listeners stay attached throughout).
- [ ] C7: **Tappable gloss tokens on passive vocab in NPC lines.** With all turns revealed: exactly 3 `[data-token-item]` elements exist, with values `vocab.ame`, `vocab.fushigi`, `vocab.yakusoku`, located inside `[data-role="npc"]` turns 2/4/6 respectively; each is a `<button>` or has `role="button"`, and is keyboard-focusable (`tabindex` ≥ 0 or natively focusable); each NPC turn's `textContent` still contains its full original line (wrapping did not mangle the sentence — check the three substrings from C2/C3 plus `雨がすごかった`). Gloss reveal: before any tap, neither `ふしぎ` nor `mysterious; strange` is visible anywhere on the page; after tapping (click) the `vocab.fushigi` token, both `ふしぎ` and `mysterious; strange` become visible; activating the `vocab.ame` token via keyboard (focus + Enter) makes `あめ` and `rain` visible.
- [ ] C8: **Responsive 375 + 1440, no overflow.** Repeat the playthrough (reset state file, reload) at viewport **375×812**: `document.documentElement.scrollWidth <= window.innerWidth + 1` after load AND after the full playthrough; `player-input` and `player-submit` are visible and clickable (scrolling allowed); turn blocks stack within the viewport width (every `[data-turn]` bounding box right edge ≤ 376). At **1440×900**: same scrollWidth check, and the dialogue log container's bounding-box width is ≤ 960px (a centered reading column, not full-bleed text).
- [ ] C9: **Console + network clean.** Across the full 1440 playthrough (C2–C7): zero `pageerror` events, zero `console` messages of type `error`, and zero responses with status ≥ 400 (the single GET and single POST both succeed). Hydration warnings logged as errors count as failures.
- [ ] C10: **Anti-slop computed styles.** At 1440 with the page loaded: (a) no `<button>`, `<a>`, or `[role="button"]` on the page has computed `background-color` equal to Tailwind blue-500/600/700 — `rgb(59, 130, 246)`, `rgb(37, 99, 235)`, `rgb(29, 78, 216)`; (b) the page's primary heading (the day/scene header, an `h1`) has a computed `font-family` whose **first** family is none of: `Arial`, `Helvetica`, `Helvetica Neue`, `Times`, `Times New Roman`, `system-ui`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `ui-sans-serif`, `sans-serif`, `serif`, `Geist`, `Geist Sans`, `Geist Mono` — i.e. a deliberately loaded webfont; (c) the computed `background-color` of `body` is neither pure white `rgb(255, 255, 255)` nor the scaffold's `rgb(10, 10, 10)`/pure black (民宿 warmth comes from tokens in `web/app/globals.css`, which must define the palette as CSS custom properties — `grep -c "^\s*--" web/app/globals.css` ≥ 6).
- [ ] C11: **Gates + hygiene.** At repo root `npm run code-check` exits 0 with all 101 engine tests passing; `cd web && npm run lint && npm run build` both exit 0; `git status --porcelain -- src/lib` shows no engine changes; the scaffold leftovers are gone — `grep -rn "create-next-app\|vercel.com/templates" web/app` returns nothing.

## Evaluator execution notes

- C1 runs via curl before opening the browser; its GET writes `pending` for day 1 — harmless, the browser GET is idempotent within the day.
- C6 advances the story to day 2. C8's repeat playthrough must therefore start with `rm -f /Users/jeeminhan/Code/minshuku/web/.data/story-state.json` (no restart needed — the store re-reads per request). Leave the state file deleted when done.
- "Visible" means Playwright's visibility semantics (`expect(locator).toBeVisible()`); "not in the DOM" means `locator.count() === 0` against the page content, not just off-screen.
- Computed styles via `locator.evaluate(el => getComputedStyle(el).<prop>)`. For C4/C5 color comparisons, compare the resolved `rgb(...)`/`rgba(...)` strings for inequality; if a badge background is fully transparent, fall back to `border-color` as written.
- The marker string in C3 (`今日は祭りに行くテストです`) deliberately shares no substring with any fixture line, so its presence proves the typed text is displayed.

## Evaluator review

**Ground-truth verification against `web/fixtures/episode-demo-learner.json` and engine source** — all pins checked before assessing criteria:

- Turn structure: NPC turns 2/4/6 (`cafe_regular`), player turns 3/5/7. Confirmed via fixture `generateDialogue` response; `runScene.ts` confirms coach turns are bookend strings, not in `log.turns`. ✓
- Evaluator outcomes traced through `evaluate.ts` + `ruleCheck.ts` + fixture player lines:
  - Turn 3 (`週末は友だちと神社のお祭りに行くつもりだよ`): `grammar.tsumori` (pattern `つもり`) present → `produced`; `vocab.mado` (word `窓`) absent → `missed`. ✓
  - Turn 5 (`うん、見たよ。部屋の窓から見えて、ちょっとびっくりした。`): `grammar.tsumori` absent → `missed`; `vocab.mado` present, not in prior NPC context → `produced`. ✓
  - Turn 7 (`うん、また話そう。来週もここに来るつもりだから。`): `grammar.tsumori` present, not in prior NPC context → `produced`; `vocab.mado` absent → `missed`. ✓
- Passive surface forms: `雨` (turn 2) / `不思議` (turn 4) / `約束` (turn 6). Confirmed verbatim in fixture dialogue text. ✓
- `vocab.fushigi` data: word=`不思議`, reading=`ふしぎ`, meaning=`mysterious; strange`. Confirmed from `data/vocab.json`. ✓
- `grammar.tsumori`: pattern=`つもり`. `GrammarItem` type has no `reading` field; `reading==null` in the joined `items` array is the correct expected value. ✓
- Items count: 2 active (`grammar.tsumori`, `vocab.mado`) + 3 passive (`vocab.ame`, `vocab.fushigi`, `vocab.yakusoku`) = 5. Confirmed from `demoLearner` seeds and fixture. ✓

All ground-truth pins are correct.

---

### Per-criterion assessment

**C1 — API `items` extension (curl).** Mechanically verifiable: the `jq` command is fully specified with exact field paths, counts, and a pinned object literal. The byte-identity check with the exact `jq 'del(...)` expression is precise. One issue: the criterion says the two consecutive GETs "are byte-identical after `jq 'del(.log.id, .log.startedAt, .log.endedAt, .log.llmLatencyMs)'`" — this is the contract-002 exclusion list, and the criterion asserts `items` must not need excluding. However, `items` is derived from static vocab/grammar data (no randomness), so this assertion is correct and testable as stated. **No issue.**

**C2 — Load = opening beat only, single fetch.** The "exactly one request to `/api/episode`" spanning C2–C5 requires the request counter to persist across criterion steps in the same Playwright session. The instruction to register listeners before `page.goto("/")` makes this mechanically trackable. The "NOT in the DOM" check using `locator.count() === 0` is defined in the execution notes. The substring `週末は何か予定ある` is present verbatim in the fixture. **No issue.**

**C3 — Gated reveal, typed text + recorded line.** The marker string test is clean. The "input is cleared or empty-able for the next turn" clause introduces a judgment call: "or empty-able" could mean the evaluator needs to decide whether clearing it counts. **Minor issue:** replace "cleared or empty-able" with a testable alternative: "the `player-input` field value is `""` OR the field is present and its value can be set to `""` without error (i.e., it is not disabled at this point)". The actual intent — that the input does not carry forward the previous typed text locked in — is testable as: `player-input` value equals `""` after submission.

**C4 — Inline outcome badges with distinct ladder states.** The color distinctness check is: "computed `background-color` (or, if backgrounds match, computed `border-color`) of the `produced` badge differs from the `missed` badge, and both differ from the page `body` background-color." The fallback to `border-color` when backgrounds match is a two-step evaluation with a conditional branch. This is mechanically checkable per the execution notes (`rgb(...)` inequality), but the fallback logic introduces a branch: the evaluator must first check if backgrounds are equal, then decide which property to compare. This is fine as specified — the execution note explicitly calls this out. **No issue.**

However: the criterion says "every `data-outcome` value on the page is one of `missed|recognized|produced_with_help|produced|mastered`" — this checks all badges on the page at the time only turn 3 is visible (2 badges total). This is sufficient but does not guard against garbage values on later-revealed turns. C5 checks the count is exactly 6, which prevents extra badges but not malformed enum values. **Minor gap** (not a blocking issue for this contract — noting it).

**C5 — Full playthrough + coach bookends + end state.** "ascending DOM order" for turn blocks is a valid Playwright check via `page.$$eval('[data-turn]', els => els.map(el => +el.dataset.turn))`. The coach background-color check is mechanically sound per the execution notes. The "`player-input` is no longer enabled (disabled, hidden, or removed)" clause is a disjunction across three states — all mechanically checkable: `isDisabled()`, `isHidden()`, or `count() === 0`. **No issue.**

**C6 — Complete action wired honestly.** The request-count check (stays 1) is verifiable via the `page.on("request")` listener installed before navigation. "disabled or removed" is a two-way check, both mechanically testable. **No issue.**

**C7 — Tappable gloss tokens.** "located inside `[data-role="npc"]` turns 2/4/6 respectively" is checkable via `page.locator('[data-role="npc"][data-turn="2"] [data-token-item="vocab.ame"]')`. The `textContent` check for sentence integrity is precise (specific substrings given). The gloss-reveal checks are exact (specific strings `ふしぎ`, `mysterious; strange`, `あめ`, `rain`). The keyboard activation test (focus + Enter on `vocab.ame`) is mechanically executable. **One concern:** the criterion says "before any tap, neither `ふしぎ` nor `mysterious; strange` is visible anywhere on the page" — but this is checked "with all turns revealed" meaning after C5 completes, not at initial load. If any gloss was previously opened during C5 (the turns-5 or 7 player reveal process), this check would be checking a state already modified. The walkthrough should clarify that no tokens are tapped during C5. The execution notes say "the criteria are one ordered walkthrough" — the evaluator must not tap tokens until C7. This is implied but not stated explicitly. **Acceptable as written; no revision needed.**

**C8 — Responsive 375 + 1440, no overflow.** The repeat playthrough requires a fresh state file reset (noted in execution notes). The `scrollWidth <= window.innerWidth + 1` check is exact. The bounding-box right edge ≤ 376 for every `[data-turn]` at 375 viewport is precise. The ≤ 960px container width at 1440 is exact. The "+1" tolerance in the scrollWidth check is correctly handling subpixel rendering. **No issue.**

**C9 — Console + network clean.** "zero `console` messages of type `error`" — in Playwright, `page.on("console")` captures `ConsoleMessage` objects; `msg.type() === "error"` is the correct filter. "zero responses with status ≥ 400" via `page.on("response")` is precise. Hydration-warning-as-error inclusion is explicitly called out. **No issue.**

**C10 — Anti-slop computed styles.** 
- (a) The three banned Tailwind blue RGB values are exact. Checking `<button>`, `<a>`, `[role="button"]` is comprehensive for interactive elements. The gloss tokens are `<button>` elements per C7, so they are covered by this check — if the generator uses blue for "tap to reveal" affordance, C10 will catch it. **No issue.**
- (b) The banned `font-family` first-family list is exact and complete for common system/scaffold fonts. The `next/font`-loaded webfont requirement is crisp. **No issue.**
- (c) "computed `background-color` of `body` is neither `rgb(255, 255, 255)` nor `rgb(10, 10, 10)`" — pure black is `rgb(0, 0, 0)`, but the contract says `rgb(10, 10, 10)` is the scaffold's value (Next.js scaffold default `--background: #0a0a0a`). These are exact RGB values. The `grep -c "^\s*--"` check counts CSS custom property declarations with a leading `--`; ≥ 6 is a minimum floor. **No issue.**

**C11 — Gates + hygiene.** All checks are shell commands with exact exit codes or grep return values. **No issue.**

---

### Missing criteria / gaps

1. **No criterion guards the `additive-only` contract-002 determinism at the browser level.** C1 covers the curl byte-identity check for the `items` field, which is the right place. C11 does not re-run the contract-002 test suite explicitly, but `npm run code-check` runs all 101 engine tests which includes contract-002 determinism tests. This is sufficient — **no gap.**

2. **C3's "input is cleared or empty-able" is ambiguous.** As noted above, the intended behavior is that the field value is `""` after submission so the player can type their next turn. The current wording admits a generator writing a disabled-then-re-enabled input cycle (which would pass "empty-able" but not "cleared"). Recommend tightening.

3. **Progressive-reveal request counting method is correctly specified** — `page.on("request")` with a counter variable, registered before `page.goto("/")`. The "one request for C2–C5" scope is clear. No underspecification here.

4. **The `data-outcome` enum check in C4** covers only turn-3 badges (2 badges). Badges on turns 5 and 7 are not checked for valid enum values until C5, which only checks the count (6) not the values. A generator could put a garbage `data-outcome="wrong"` on turns 5/7 and pass C5's count check. However, this is a cosmetic gap — the contract's primary goal is grading honesty and visual distinction, and the ground-truth outcomes are checked in C5's "outcomes per the ground truth above" badge-count check. **Acceptable gap for this contract round.**

5. **768px viewport is not tested.** HARNESS.md specifies 375/768/1440; C8 only covers 375 and 1440. The scope note says "beyond the two viewports checked here" so this is explicitly deferred. The out-of-scope note confirms 768 and responsive polish are contract 006 territory. **Intentional, not a gap.**

---

### Verdict

**REVISE — one criterion needs tightening before QA:**

**C3:** Replace "the input is cleared or empty-able for the next turn" with: "the `player-input` field value is `""` (empty string) after submission — confirmed via `locator.inputValue()` equals `""`." This makes the post-submit input state a single unambiguous check rather than a branching "cleared or empty-able" judgment call.

All other criteria are mechanically verifiable as written, all ground-truth pins are confirmed correct against the fixture and engine source. The contract is otherwise well-formed and ready for QA once C3 is tightened.
