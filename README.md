# Hi, this is minshuku 民宿.

Hey! I'm Jeemin, and I made this because I'm learning Japanese and I got tired of
flashcards.

Here's the idea: minshuku is a little Japanese guesthouse where **each evening is a tiny
story — and the story is your spaced-repetition review.** The scene you play tonight gets
built from the exact words you're due to remember. So you're not studying _and_ reading a
story. It's the same thing.

![minshuku](docs/assets/hero.png)

## Try it (no signup, nothing to install)

- **[Take the tour →](https://minshuku.vercel.app/story)** — a guided walk through four
  nights that shows you what this actually is. Start here.
- **[Play it →](https://minshuku.vercel.app)** — type back in Japanese, get graded on
  whether you actually used the words right, and hear the characters talk.

It's running in a free "demo mode" so anyone can poke at it — same every time, no API key,
can't cost anybody money. The same engine also runs live against Gemini for real,
made-up-on-the-spot conversations.

## So what's actually happening?

Most apps show you a flashcard. minshuku shows you a town. Every night you go somewhere,
talk to someone, and the conversation is stitched from whatever your memory needs to
review. Use a word right in a real sentence and it climbs a ladder —
**recognized → produced-with-help → produced → mastered** — then it goes quiet until it's
due again.

Here are the four nights in the demo:

| Night | Where | Words due | What happens |
|------:|-------|-----------|--------------|
| 1 | The café | つもり _(intend to)_, 窓 _(window)_ | You tell the regular your festival plans |
| 2 | The night road | 雨 _(rain)_ | A stranger somehow knows about your promise |
| 3 | The bookshop | 不思議 _(mysterious)_ | The owner wraps up a book of old town stories |
| 4 | Back home | + てもいい, + 持つ | Mom meets you at the door — and she _talks_ |

The fun part: nobody hand-wrote this as "a story." Each night the engine just picked a
scene for the words you owed — and the story fell out of that. **What's due decides who
you meet.**

## Wanna run it yourself?

Easiest way is with [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Clone
it, then paste this:

```
Read the README and docs/engineering.md. Get minshuku running locally on my machine
in demo mode (no API key needed), and open the story tour for me.
```

Or do it by hand:

```bash
npm install && (cd web && npm install)

# demo mode — no key needed. opens the play view + /story
MINSHUKU_FAKE_LLM=1 npm --prefix web run dev      # → localhost:3000

# jump straight to the seeded 4-day demo learner
npm --prefix web run seed-demo
```

For real, live conversations, drop a `GEMINI_API_KEY` in `.env` and run it without the
`MINSHUKU_FAKE_LLM` flag.

## Where it's at

This is a **working demo of the whole core loop** — the engine, the spaced repetition, the
voices, the story, the guided tour — all real, all deployed. The road to a full app
(accounts, a real database, a way bigger word bank, live generation on the live site) is
mapped out and the scary parts are already proven. The hard part — making review feel like
living a story instead of grinding cards — that part's done.

## A bit under the hood

The engine doesn't actually know Japanese. The core (items, spaced repetition, scenes,
grading) is subject-agnostic — a "Japanese pack" plugs in the grading and prompts, and one
day a "math pack" or "history pack" could sit right next to it. The boring-but-important
parts (the SRS math, scene scoring, conjugation checking) have 101 tests on them; the
model-written dialogue gets held to a separate quality-review loop so it can't quietly get
worse.

If you want the real nuts-and-bolts — architecture, data shapes, the testing setup, how it
deploys — it's all in **[`docs/engineering.md`](docs/engineering.md)**.

Built with TypeScript, Next.js, Gemini (talking + voices), Lyria (music), and kuromoji for
the Japanese parsing. MIT licensed — go nuts.
