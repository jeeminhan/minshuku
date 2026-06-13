// Contract 009 — the authored 6-beat storyline for the presenter tour at
// /story. Content source of truth is DEMO-STORYLINE.md (the thesis, per-beat
// copy, under-the-hood callouts, image slots, and target words come from
// there). This module holds ONLY authored copy + which day's derived data a
// beat pulls + which target surfaces it highlights — it hardcodes NO dialogue.
// The per-day episode dialogue/items/debrief are DERIVED from the engine in
// lib/demo/storyTour.ts (runEpisode + completeEpisode over fixture replay) and
// rendered by the tour; this file never restates an NPC line.

// A highlight target authored per day beat. The `surface` is the JA string the
// tour wraps in [data-tour-highlight]; `itemId` must match the day's real
// derived episode item (highlighting is anchored to actual items, never a free
// string list — the tour filters glossSegments by these item ids).
export interface HighlightTarget {
  itemId: string;
  surface: string;
}

export type BeatKind = "intro" | "day" | "outro";

export interface StoryBeat {
  // Stable id + ordinal label for the progress indicator (Intro · Day 1 …).
  id: string;
  kind: BeatKind;
  // Short pip label for [data-testid="tour-progress"].
  pipLabel: string;
  // The day's number when kind === "day"; null for intro/outro.
  day: number | null;
  // The chapter card title + a JA sub-title for 民宿 character.
  title: string;
  titleJa: string;
  // The scene image slot basename — files land at web/public/story/<slot>.webp.
  imageSlot: string;
  // One-line caption shown inside the washi placeholder (and as image alt).
  imageCaption: string;
  // The on-screen narrative copy for the beat (the story-so-far / the scene).
  narrative: string[];
  // The "under the hood" explanation — the load-bearing "explains the app"
  // content. Empty array for beats with no engine callout (intro/outro carry
  // pitch copy in `narrative` + `presenterNote` instead).
  callout: string[];
  // The presenter's spoken aside ("What you say" in DEMO-STORYLINE) — rendered
  // as a quiet note so the demo-driver has their line on screen.
  presenterNote: string | null;
  // For day beats: the target surfaces to highlight in that day's NPC dialogue.
  highlights: HighlightTarget[];
}

// ——— Beat 0 — Intro (the hook) ———
const INTRO: StoryBeat = {
  id: "intro",
  kind: "intro",
  pipLabel: "Intro",
  day: null,
  title: "Watch the words become a story",
  titleJa: "四つの夜",
  imageSlot: "00-minshuku-dusk",
  imageCaption: "The guesthouse at dusk — warm light in the windows.",
  narrative: [
    "minshuku is a Japanese guesthouse where each evening’s story is your spaced-repetition review. The scene you play tonight is cast from the exact words you’re due to remember — so studying and living the story are the same act.",
    "Four evenings. Watch the words become a story.",
  ],
  callout: [
    "The magic to land: the story isn’t decoration on top of an SRS app — the SRS queue writes the story. What’s due decides who you meet tonight.",
  ],
  presenterNote:
    "Most language apps show you flashcards. minshuku shows you a town. Every night you arrive somewhere, talk to someone, and the conversation is built from what your memory needs to review. Let me show you four nights.",
  highlights: [],
};

// ——— Beat 1 — Day 1, The Café ———
const DAY_1: StoryBeat = {
  id: "day-1",
  kind: "day",
  pipLabel: "Day 1",
  day: 1,
  title: "The Café",
  titleJa: "一日目・喫茶店",
  imageSlot: "01-cafe",
  imageCaption: "A small-town café, evening, rain starting beyond the window.",
  narrative: [
    "You take the counter seat next to a friendly regular. They ask about your weekend; you say what you intend to do (つもり), and mention the seat by the window (窓) where you saw last night’s sky.",
  ],
  callout: [
    "Two words came due today. The engine picked this café scene because it naturally fits them — then you had to actually produce つもり and 窓 in conversation. That production is the review.",
    "Get it right and the word climbs the ladder: recognized → produced → mastered.",
  ],
  presenterNote:
    "Notice I didn’t review a flashcard for ‘window.’ I used it to tell someone where I’d been sitting.",
  highlights: [
    { itemId: "grammar.tsumori", surface: "つもり" },
    { itemId: "vocab.mado", surface: "窓" },
  ],
};

// ——— Beat 2 — Day 2, The Night Road ———
const DAY_2: StoryBeat = {
  id: "day-2",
  kind: "day",
  pipLabel: "Day 2",
  day: 2,
  title: "The Night Road",
  titleJa: "二日目・夜道",
  imageSlot: "02-night-road",
  imageCaption: "A dark road at the edge of town, a lone stranger, the first rain.",
  narrative: [
    "On the dark road you meet a stranger who somehow already knows about yesterday’s promise. You read tonight’s sky for them — the rain (雨) — and turn back before it catches you.",
  ],
  callout: [
    "Yesterday’s つもり was answered well, so the engine rested it — it won’t return until it’s due again. That’s why tonight is about a different word. The story moved forward because your memory moved forward.",
    "And the stranger ‘knowing about the promise’? That’s the story-so-far carried between nights.",
  ],
  presenterNote:
    "The continuity is real — the app remembers what happened, and so the world remembers you.",
  highlights: [{ itemId: "vocab.ame", surface: "雨" }],
};

// ——— Beat 3 — Day 3, The Bookshop ———
const DAY_3: StoryBeat = {
  id: "day-3",
  kind: "day",
  pipLabel: "Day 3",
  day: 3,
  title: "The Bookshop",
  titleJa: "三日目・古本屋",
  imageSlot: "03-bookshop",
  imageCaption: "A dim riverside bookshop, the owner wrapping a book in lamplight.",
  narrative: [
    "In the dim bookshop by the river you ask the owner for a book of the town’s old mysterious (不思議) stories. She wraps one for you — already knowing about your festival promise.",
  ],
  callout: [
    "Three nights in, the threads are accumulating — the promise, the sky, now a book. None of this was hand-scripted as ‘a story.’",
    "Each night the engine cast a scene for the due word, and the summary of what happened threads them together.",
  ],
  presenterNote: null,
  highlights: [{ itemId: "vocab.fushigi", surface: "不思議" }],
};

// ——— Beat 4 — Day 4, Home at the Minshuku (the payoff) ———
const DAY_4: StoryBeat = {
  id: "day-4",
  kind: "day",
  pipLabel: "Day 4",
  day: 4,
  title: "Home at the Minshuku",
  titleJa: "四日目・民宿に帰る",
  imageSlot: "04-minshuku-mom",
  imageCaption: "The lamplit genkan at night — Mom welcoming the traveler in.",
  narrative: [
    "You come back to the minshuku with your wrapped-up book. Mom meets you in the entryway — and she speaks, in her own voice — to settle you in. You ask permission (てもいい) for what you’d like to do before dinner.",
  ],
  callout: [
    "Look at the knowledge panel: 雨 went brand-new → mastered across four nights and is now resting. Tonight introduces new words — てもいい, 持つ — so the deck grows.",
    "The learner is progressing, and the story is the record of it. This is day four of a system that could run for a year.",
  ],
  presenterNote:
    "Voice + your own art = the panel leans in. Play Mom’s voiced line here.",
  highlights: [
    { itemId: "grammar.temo-ii", surface: "てもいい" },
    { itemId: "vocab.motsu", surface: "持つ" },
  ],
};

// ——— Beat 5 — Outro (the pitch) ———
const OUTRO: StoryBeat = {
  id: "outro",
  kind: "outro",
  pipLabel: "Outro",
  day: null,
  title: "The pitch",
  titleJa: "終わりに",
  imageSlot: "05-ladder",
  imageCaption: "The knowledge ladder: recognized → produced → mastered.",
  narrative: [
    "What you saw is a working demo of the core loop — the engine, the spaced repetition, the voice, the story, all real and running.",
    "The path to a shipped app is clear and de-risked: live AI generation already works end-to-end; what’s left is accounts, a database, and a full word bank — not the hard part.",
    "The hard part — making review feel like living a story — is done.",
  ],
  callout: [],
  presenterNote: null,
  highlights: [],
};

// The ordered six beats: Intro · Day 1 · Day 2 · Day 3 · Day 4 · Outro.
export const STORYLINE_BEATS: readonly StoryBeat[] = [
  INTRO,
  DAY_1,
  DAY_2,
  DAY_3,
  DAY_4,
  OUTRO,
];

// The knowledge ladder rungs, rendered on the outro beat (an in-app chart is the
// default render for beat 5 per the contract — the image slot is optional there).
export const KNOWLEDGE_LADDER: readonly { label: string; note: string }[] = [
  { label: "recognized", note: "you knew it when you saw it" },
  { label: "produced_with_help", note: "you used it with a nudge" },
  { label: "produced", note: "you used it on your own" },
  { label: "mastered", note: "it’s yours — resting until it’s due again" },
];
