# Backlog — minshuku MEXT demo (deadline ~2026-06-25)

Worked top-to-bottom, one contract each. The product thesis every contract serves: *reviews and learning are the same activity — the SRS casts today's episode, playing it is the review.*

## 1. Engine bridge + fixture LLM mode
`web/lib/engine/` server-side bridge importing `runScene`/generator/SRS from `../src/lib` (engine untouched). An `LLMClient` implementation with two modes: live Gemini (key server-side via Next API route only) and `MINSHUKU_FAKE_LLM=1` fixture/replay mode returning recorded dialogue deterministically. Done = an API route returns a generated episode JSON for a demo learner in fixture mode.

## 2. Today's episode generation + story-so-far
Daily episode endpoint: picks due items, generates the scene, weaves a thin story-so-far (persisted summary + day counter fed to the dialogue prompt — continuity the player feels, no plot-state machine). Done = two consecutive "days" produce episodes that reference each other.

## 3. Play-the-scene UI
The core screen: dialogue turns render in order; player turns are free-text input; new/passive words in NPC lines are tappable for furigana+gloss; evaluator grades each player turn inline (outcome ladder: recognized → produced_with_help → produced → mastered). Coach turns (1 and final) styled as teaching beats.

## 4. Debrief + SRS update + return-tomorrow beat
End-of-episode debrief screen: learned (new passives met) / strengthened (dues produced) / due tomorrow. SRS intervals update from aggregated outcomes. Closing beat invites tomorrow's episode.

## 5. Seeded demo learner
A demo profile with realistic SRS history and 3-4 days of story already progressed, so the interview shows "here's day 5 and how it knew what to teach today." Seed script, deterministic, documented in README.

## 6. Polish + responsive pass
民宿 aesthetic applied end to end (existing art/audio assets), 375/768/1440 clean, loading/error/empty states, no console errors.

## 7. Deploy smoke
Vercel deploy, key in env vars, fixture mode togglable for safe public URL. Done = live URL runs the full demo-learner loop.

## Season 2 (explicitly NOT for the demo)
- Knowledge-mirror companion (NPC constrained to player's known vocab — day-poc idea)
- Voice I/O (mine-poc's STT loop)
- Quick-review widget for due backlogs after lapses
