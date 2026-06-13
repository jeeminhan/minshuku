# minshuku — Demo Storyline & Presenter Script

The guided tour that explains what the app *is*, told through one learner's first
four evenings. Built as a navigable `/story` flow (Next/Back, one chapter per beat)
with an image slot per scene that you fill with ChatGPT-generated art.

**The one-line thesis (say this first):**
> "minshuku is a Japanese guesthouse where each evening's story *is* your
> spaced-repetition review. The scene you play tonight is cast from the exact words
> you're due to remember — so studying and living the story are the same act."

The magic to land for the panel: **the story isn't decoration on top of an SRS app —
the SRS queue writes the story.** What's due decides who you meet tonight.

---

## Beat 0 — Intro (the hook)

- **Image slot:** `story/00-minshuku-dusk` — the guesthouse exterior at dusk, warm
  light in the windows, lanterns. Establishes place and mood.
- **On screen:** the thesis line + "Four evenings. Watch the words become a story."
- **What you say:** "Most language apps show you flashcards. minshuku shows you a town.
  Every night you arrive somewhere, talk to someone, and the conversation is built from
  what your memory needs to review. Let me show you four nights."

## Beat 1 — Day 1, The Café

- **Image slot:** `story/01-cafe` — a small town café, evening, a regular at the counter,
  rain starting outside the window.
- **Due tonight:** つもり (intend to) · 窓 (window)
- **The scene:** You take the counter seat next to a friendly regular. They ask about
  your weekend; you say what you *intend to* do (つもり), and mention the seat by the
  **window** (窓) where you saw last night's sky.
- **Under-the-hood callout:** "Two words came due today. The engine picked *this* café
  scene because it naturally fits them — then you had to actually *produce* つもり and 窓
  in conversation. That production **is** the review. Get it right and the word climbs
  the ladder: recognized → produced → mastered."
- **What you say:** "Notice I didn't review a flashcard for 'window.' I used it to tell
  someone where I'd been sitting."

## Beat 2 — Day 2, The Night Road

- **Image slot:** `story/02-night-road` — a dark road at the edge of town, a lone
  stranger, heavy clouds, the first drops of rain.
- **Due tonight:** 雨 (rain)
- **The scene:** On the dark road you meet a stranger who somehow already knows about
  yesterday's promise. You read tonight's sky for them — the **rain** (雨) — and turn
  back before it catches you.
- **Under-the-hood callout:** "Yesterday's つもり was answered well, so the engine
  *rested* it — it won't return until it's due again. That's why tonight is about a
  different word. The story moved forward because your *memory* moved forward. And the
  stranger 'knowing about the promise'? That's the story-so-far carried between nights."
- **What you say:** "The continuity is real — the app remembers what happened, and so
  the world remembers you."

## Beat 3 — Day 3, The Bookshop

- **Image slot:** `story/03-bookshop` — a dim riverside bookshop, shelves, an owner
  wrapping a book, lamplight.
- **Due tonight:** 不思議 (mysterious / strange)
- **The scene:** In the dim bookshop by the river you ask the owner for a book of the
  town's old **mysterious** (不思議) stories. She wraps one for you — already knowing
  about your festival promise.
- **Under-the-hood callout:** "Three nights in, the threads are accumulating — the
  promise, the sky, now a book. None of this was hand-scripted as 'a story.' Each night
  the engine cast a scene for the due word, and the *summary* of what happened threads
  them together."

## Beat 4 — Day 4, Home at the Minshuku (the payoff)

- **Image slot:** `story/04-minshuku-mom` — the guesthouse entryway (genkan) at night,
  Mom welcoming the traveler in, the wrapped book in hand.
- **New tonight:** てもいい (may / it's OK to) · 持つ (to hold / have) — *lessons enter*
- **The scene:** You come back to the minshuku with your wrapped-up book. **Mom** meets
  you in the entryway — *and she speaks, in her own voice* — to settle you in. You ask
  permission (てもいい) for what you'd like to do before dinner.
- **Under-the-hood callout:** "Look at the knowledge panel: 雨 went brand-new → mastered
  across four nights and is now resting. Tonight introduces *new* words — てもいい, 持つ —
  so the deck grows. The learner is progressing, and the story is the record of it. This
  is day four of a system that could run for a year."
- **The moment:** play Mom's voiced line here. Voice + your own art = the panel leans in.

## Beat 5 — Outro (the pitch)

- **Image slot:** `story/05-ladder` — optional: a clean visual of the knowledge ladder
  (recognized → produced_with_help → produced → mastered) with the demo's words placed
  on it. (Could be a real in-app chart instead of art.)
- **What you say:** "What you saw is a *working* demo of the core loop — the engine,
  the spaced repetition, the voice, the story, all real and running. The path to a
  shipped app is clear and de-risked: live AI generation already works end-to-end;
  what's left is accounts, a database, and a full word bank — not the hard part. The
  hard part — making review feel like living a story — is done."

---

## Image Shot-List (for ChatGPT / image gen)

**Art direction (keep consistent across all six):** painterly, warm, *民宿 evening*
palette — washi-cream, persimmon, indigo, lamplight. Soft, storybook/anime-watercolor
feel (think Ghibli-adjacent quiet interiors), never photorealistic, never harsh.
Consistent character: a young traveler (the learner) seen from behind or in soft focus,
so they read as "you." 16:9 landscape, generous negative space at top or one side for
text overlay.

| Slot | Filename (drop into `web/public/story/`) | Prompt seed |
|------|------------------------------------------|-------------|
| 0 | `00-minshuku-dusk.webp` | "A small Japanese guesthouse (minshuku) at dusk, warm light glowing in the windows, paper lanterns, quiet street, painterly anime-watercolor, washi-cream and persimmon palette, 16:9, soft negative space top-left for a title." |
| 1 | `01-cafe.webp` | "Cozy small-town Japanese café interior at evening, a friendly regular at the wooden counter, rain beginning beyond a large window, lamplight, painterly anime-watercolor, warm muted persimmon/indigo, 16:9." |
| 2 | `02-night-road.webp` | "A dark country road at the edge of a Japanese town at night, a lone stranger under heavy clouds, first drops of rain, lantern glow in the distance, moody painterly anime-watercolor, indigo and warm accents, 16:9." |
| 3 | `03-bookshop.webp` | "A dim riverside Japanese secondhand bookshop at night, tall shelves, an elderly owner wrapping a book in paper, lamplight and soft shadows, painterly anime-watercolor, warm amber tones, 16:9." |
| 4 | `04-minshuku-mom.webp` | "The lamplit entryway (genkan) of a Japanese guesthouse at night, a warm motherly host welcoming a young traveler holding a wrapped book, slippers and wood, painterly anime-watercolor, persimmon warmth, 16:9." |
| 5 | `05-ladder.webp` (optional) | "An elegant minimalist illustration of four ascending stepping stones in a misty Japanese garden, faint labels, painterly, washi-cream and indigo, 16:9 — or skip and use an in-app chart." |

**Notes:**
- Export as `.webp` (or `.png`/`.jpg`; the build will accept any and the slot specifies
  dimensions for zero layout shift). Target ~1600×900, keep each under ~400 KB.
- Until you drop real images in, the tour renders tasteful washi-toned placeholders so
  it's presentable immediately — same pattern as the audio.
- Generate 2–3 variants of Beat 4 (the payoff) and pick the warmest.
