# minshuku 民宿

**A Japanese guesthouse where each evening's story _is_ your spaced-repetition review.**
The scene you play tonight is cast from the exact words you're due to remember — so
studying and living the story become the same act.

![minshuku](docs/assets/hero.png)

### ▶ Live demo

- **[The story tour →](https://minshuku.vercel.app/story)** — a guided walk through four
  evenings that explains what the app does (**start here**)
- **[Play it →](https://minshuku.vercel.app)** — the interactive demo: type your replies
  in Japanese, get graded, hear the characters

_Runs in a deterministic "fixture" mode — no API key, free, identical every visit. The
same engine also runs live against Gemini for real, generated conversations._

---

## What it is

Most language apps show you flashcards. minshuku shows you a town. Each night you arrive
somewhere, talk to someone, and the conversation is built from what your memory needs to
review. Use a word correctly in real dialogue and it climbs a ladder —
**recognized → produced-with-help → produced → mastered** — then rests until it's due again.

Four evenings of the demo learner's story:

| Night | Scene | Due words | Beat |
|------:|-------|-----------|------|
| 1 | The café | つもり _(intend to)_, 窓 _(window)_ | Festival plans with the regular |
| 2 | The night road | 雨 _(rain)_ | A stranger who knows your promise |
| 3 | The bookshop | 不思議 _(mysterious)_ | A book of the town's old stories |
| 4 | Home at the minshuku | + てもいい, + 持つ | Mom greets you — in her own voice |

The story isn't decoration on top of an SRS app — **the review queue writes the story.**
What's due decides who you meet tonight.

## How it works

1. **An SRS engine** picks the items due today and the scene that fits them.
2. **You converse** in free-text Japanese; a rule-based evaluator grades whether you
   actually _used_ each target correctly — not just whether you passed.
3. **Outcomes update your memory**, the story-so-far carries to tomorrow, and the next
   night is cast from your evolved state.

Voices are per-character (Gemini TTS); scene music is per-location (Lyria).

## Run it locally

```bash
npm install && (cd web && npm install)

# deterministic demo — no API key needed (also serves /story)
MINSHUKU_FAKE_LLM=1 npm --prefix web run dev      # → http://localhost:3000

# seed the 4-day demo learner (days 1–3 simulated, lands on day 4)
npm --prefix web run seed-demo
```

For live generation, add a `GEMINI_API_KEY` to `.env` and run `npm --prefix web run dev`
without the fixture flag. The demo script and scene-art notes are in
[`DEMO-STORYLINE.md`](DEMO-STORYLINE.md).

## Status

A **working demo of the core loop** — engine, spaced repetition, voice, story, and a
guided tour — all real and deployed on Vercel. The path to a full app (accounts, a
database, a larger word bank, live generation in production) is scoped and de-risked.
The hard part — making review feel like living a story — is done.

## Under the hood

Subject-agnostic core: the engine (items, SRS, scenes, evaluator) doesn't know about
Japanese — a "JP pack" supplies the grading and prompts, and a future "math" or "history"
pack could plug in alongside. The deterministic parts (SRS, template scoring, conjugation
rules) are covered by 101 unit tests; the model-driven dialogue is held to a separate
qualitative review loop.

Full engineering reference — architecture, data types, testing layers, deploy model —
lives in **[`docs/engineering.md`](docs/engineering.md)**.

## Stack

TypeScript (ESM) · Next.js · `@google/genai` (dialogue + TTS) · Lyria (music) ·
`kuromoji` (Japanese morphology) · `zod` · `vitest` · deployed on Vercel.
