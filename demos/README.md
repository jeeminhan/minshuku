# demos

Prototype scripts from Friday 2026-05-08. These are **design references**, not part of the production pipeline. They bypass `data/templates/` and encode content inline in TypeScript.

Kept because each one proved a UX idea worth pulling into the real pipeline later.

| Script | Run | What it proves |
|---|---|---|
| `mine-poc.ts` | `npm run mine` | Voice I/O loop: ffmpeg captures mic, Gemini transcribes JA. Two-phase "mine then refine" with hardcoded word-vein cards and a kototama currency reward. |
| `day-poc.ts` | `npm run day` | Daily-loop shape: 2 inline errand vignettes with per-turn coaching beats, then a "meadow debrief" with Aoi who replies only in vocabulary the player has seen (knowledge-mirror companion). |
| `day-demo.ts` | `npm run day-demo` | Self-playing version of `day-poc` — AI plays the player turns. Useful for showing the loop to someone who doesn't read Japanese. |
| `finale-poc.ts` | `npm run finale` | Scripted ritual-boss climax against the Silence Demon. Hardcoded "fake SRS state" drives ritual-line success/failure. Tests the endgame shape. |
| `quest-debrief-poc.ts` | `npm run debrief` | Standalone version of `day-poc`'s meadow scene. Aoi asks about your "dream" using only vocabulary in her constrained pool. Pairs with cached Lyria meadow music. |
| `serve-prototype.ts` | `npm run prototype` | Local HTTP server for `public/word-ore-prototype.html` — the Word Ore world map mockup (5 sectors, 19 inhabitants). Vision artifact, not gameplay. |

## Why archived, not deleted

The shipped architecture is data-driven: scene templates in `data/templates/*.json`, generator picks based on SRS dues, LLM writes dialogue, evaluator grades. These POCs each hardcode their content in TypeScript instead — fine for prototyping, but they don't extend the template pipeline and they can't be authored by anyone but the original developer.

The valuable ideas (voice I/O, knowledge-mirror NPC, ambient music, word-vein mechanic) belong as layers on top of the template pipeline, not as parallel scripts.

## When to revisit

- **Voice I/O (`mine-poc`):** lift the ffmpeg + Gemini multimodal STT into `scripts/scene-interactive.ts` as an input mode.
- **Knowledge-mirror NPC (`day-poc`, `quest-debrief-poc`):** the constraint "Aoi only uses words the player has seen" becomes a generator prompt rule once stories have a companion role.
- **Ritual boss (`finale-poc`):** revisit once an actual story arc has progressed far enough to have a climax — the fake-SRS-as-narrative-fuel idea is real.
- **Ambient bed (`day-poc`, `quest-debrief-poc`):** already lifted via `src/lib/audio/lyriaPrompts.ts`; `scene-interactive.ts` wires it onto real scenes.

See repo memory (`canonical-npc-architecture`, `north-star`, `path-1-strategy`) for where these ideas fit in the long-term architecture.
