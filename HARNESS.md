# HARNESS.md — harness manifest for minshuku

> Read by the /harness skill and its generator/evaluator agents. Keep every line current — the loop trusts this file.

## App
Daily Japanese story-SRS: each day one episode is generated from your due SRS items; playing the conversation IS the review. Engine (scenes, generator, evaluator, SRS) is finished and tested; `web/` is the new Next.js face. Deadline: live demo for MEXT interview ~2026-06-25.

## Run
- Web dev server: `cd web && npm run dev` → http://localhost:3000
- Env/stubs: `GEMINI_API_KEY` in `.env.local` for live LLM. For QA always set `MINSHUKU_FAKE_LLM=1` (fixture/replay mode — deterministic, no API calls; built in contract 001).

## Gates (deterministic, must pass before any QA round)
- `npm run code-check` (repo root — engine typecheck + 101 vitest tests; engine must NEVER regress)
- `cd web && npm run lint && npm run build`

## Backlog
- `harness/backlog.md` — the MEXT demo contracts, in order

## Evaluate
- Mode: browser (Playwright)
- Journeys: the daily loop — open app → today's episode (shows new words glossed, due targets woven in) → play all player turns → graded feedback inline → end-of-day debrief (learned / strengthened / due tomorrow) → return-tomorrow beat
- Viewports: 375 / 768 / 1440 (demo will be shown on a laptop — 1440 is the money viewport)
- **Safety (absolute):** QA only ever runs with `MINSHUKU_FAKE_LLM=1`. Never QA against live Gemini (cost + nondeterminism). Never commit `.env.local`.

## Models
- generator: inherit
- evaluator: sonnet (default)

## Conventions
- Engine code in `src/lib` is read-only for web work — the web app imports it, never modifies it. If the UI seems to need an engine change, stop and surface it to the user.
- Web code: TypeScript strict, no `any`; App Router; scene data from `data/templates/` via the engine, never hardcoded.
- Aesthetic: 民宿 guesthouse warmth (existing assets in `public/art`, `public/audio`) — not generic SaaS. Design tokens once established live in web/app/globals.css.
