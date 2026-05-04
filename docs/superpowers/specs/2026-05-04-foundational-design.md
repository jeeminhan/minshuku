# Foundational Design — Nihongo Scenes

**Status:** v1 design, source of truth.
**Date:** 2026-05-04
**Scope:** Japanese only for v1. Other languages out of scope.
**Replaces:** the transitional `/SPEC.md` at repo root and the four open-language briefs (`LANDING_BRIEF.md`, `CURRICULUM_SOURCES.md`, `CURRICULUM_INTEGRATION.md`, `LANDING_DESIGN_PROMPT.md`).

When this doc and any other doc disagree, this doc wins. When this doc and the code disagree, update one of them — don't let them drift.

---

## 1. One-line concept

A gamified, audio-first Japanese tutor where the **scene** is the base unit. Each scene is a short, hands-free, structured voice interaction set in a persistent soft-magical countryside town. The SRS dictates which items today's scene must deliver; an authored library of scene templates dictates how.

Daily review with a town that remembers you.

---

## 2. North star

**Tolerable daily review with relevant variety.**

The user is someone who already does daily review (Anki, WaniKani, etc.) and is sick of grinding flashcards. They open the app because:
1. The material is *theirs* — what's actually due, not random teaching.
2. Variety is a feature, not a happy accident.
3. The town is a place they want to come back to.

Success = "I show up every day because I want to know what happens next, and the things I'm reviewing are exactly what I needed to review."

This north star pins everything downstream: SRS quality is non-negotiable, story is the dopamine layer (not the engine), and "tolerable" means *we don't waste the user's time, ever*.

---

## 3. Design principles

These are derived from real testing. Violating them is what makes the product feel bad.

1. **One thing at a time.** Never ask the learner to juggle a grammar pattern, three vocab words, and a metaphor in one turn. One active target per turn.
2. **One direction per scene.** A scene has one focus, one location, one mood. If a scene is "going in three directions," it's broken.
3. **JP for the scene, EN for instructions.** Roleplay/dialogue in Japanese. Coach (briefings, lessons, quiz prompts, results) switches to English. Never mix mid-utterance.
4. **Active recall is rare and deliberate.** Most review items appear *passively* (AI uses them naturally). Only 1–2 items per scene are forced into active production.
5. **Turn boundaries are explicit.** The learner always knows when it's their turn. No ambiguous open mics.
6. **Weirdness is a feature.** When SRS items don't fit the scene naturally, embrace surreal prompts ("describe wind as a moonwalking octopus"). The soft-magical register gives this cover.
7. **Objective scoring beats vibes.** "Sounds good" is not a grade. Every target has a checkable outcome.
8. **Short by default.** A scene is ~5 minutes. Sessions stack scenes — the learner stops whenever.
9. **The screen never demands a tap during a scene.** It can be looked at, but it's never a blocker. Hands-free is the contract.
10. **Items drive scene selection; scenes never compromise SRS.** When an authored thread or mystery beat conflicts with SRS quality, SRS wins.

---

## 4. Architecture (layers)

| Layer | Responsibility |
|---|---|
| **Content** | Vocab + grammar items, scenario tags, prompt templates, example sentences, scene templates, character configs, location assets |
| **Scheduling (SRS)** | Decides what's due, what's new, what's weak. Tracks per-item state. |
| **Generation** | Builds a scene: picks active targets, picks template, fills slots, resolves thread state, layers mystery beats, prompts the LLM for dialogue. |
| **Interaction** | Runs the scene end-to-end — TTS out, STT in, turn management, ambient audio, on-screen scaffolding. |
| **Evaluation** | Turn-based, layered. Scores active production, checks passive comprehension, updates SRS. |
| **Game** | Thread state, mystery beat state, cadence rules. (No XP, no streaks in v1 — see §14.) |

The **generation layer is the brain.** The **scheduling layer is the metronome.** The **interaction layer is the stage.** The **evaluation layer is the coach.**

---

## 5. The Scene (base unit)

A scene is a self-contained ~5-minute hands-free unit. Everything in the app is composed of scenes.

A scene has:

- **Location** (one of ~6, see §7)
- **Character(s)** the player talks to (one or more — multi-AI scenes are first-class)
- **Story context** — today's micro-stake; the reason this conversation is happening today
- **One main lesson item** (only when there's a new item to teach; otherwise omitted)
- **Active target(s)** — usually 1, occasionally 2 — the player must produce
- **Passive targets** — typically 3 review items the AI works into its own speech
- **One drill** — a focused storytelling prompt for the active target
- **One roleplay** — the multi-turn conversation, anchored in the location
- **One quiz** — adaptive verbal checks (yes/no + recall + production)
- **One result** — voice-led summary + on-screen result card

### Default composition (per scene)

- 1 new lesson item *(when applicable)*
- 5 review items total, split:
  - 1 active grammar target (often the new lesson, when there is one)
  - 1 active vocab target (sometimes — beginners often only have 1 active total)
  - 3 passive vocab/grammar targets

Beginners can drop to (1 active / 2 passive). Advanced learners can push to (1 active grammar / 2 active vocab / 4–5 passive).

**Hard rule: never more than 2 active targets in a single scene.**

### Scene rhythm (strict 5-phase)

```
1. Briefing (voice + on-screen mission card)
2. (Lesson, only when there's a new item to teach)
3. Drill (storytelling prompt; single utterance)
4. Roleplay (multi-turn JP dialogue, in-world)
5. Quiz (adaptive verbal: yes/no + recall + production)
6. Result (voice-led summary + on-screen result card)
```

Strict for v1 because predictability is currently more valuable than adaptive variation. Future v2 may collapse phases that don't add value (per-scene-type).

---

## 6. Modes inside a scene

Three core delivery modes plus the bookend phases. They are *not* interchangeable.

### Lesson
Short. Introduces or refreshes one grammar pattern or key phrase. Pattern + formation + meaning + 1–2 example sentences. Coach voice (EN) explains; example sentences are JP (target voice or stock TTS). Never exceeds ~60 seconds. Skipped when no new item is being introduced.

### Drill
Targeted, single-item, **storytelling-based**. Not "use 窓 in a sentence." Instead:
> "You're on a night train. Outside the window, you see something strange. Describe it."

The learner produces one utterance. The AI gives a small reaction, not a full conversation. Drill always exists in v1; could later be skipped for items the learner has produced cleanly N times in a row.

### Roleplay
Immersive, multi-turn, anchored in location. The AI plays one or more characters. The player has one main active goal + several passive items the AI works in. The AI:

- speaks Japanese
- asks **one** question per turn
- naturally uses passive targets in its own speech
- nudges the active target if the learner doesn't reach for it
- never overloads a turn
- in multi-AI scenes, follows scripted turn order from the template

### Quiz
Adaptive verbal — item-type-aware. Coach voice (EN) asks 2–3 short questions:

- **Passive items:** *"Did you catch 窓 just now?"* → *"What did it mean?"*
- **Active items:** *"Try one more sentence with つもり."*
- **New lesson items:** *"What's the difference between 行くつもり and 行ったつもり?"*

The mix depends on which items appeared and how. ~30–60 seconds total.

### Briefing & Result
See §11.

---

## 7. The World

### Setting

A small, fictional countryside town in real Japan, **stylized / anime-esque**, with a **soft-magical / mysterious** register. Working reference: *Natsume Yuujinchou*. The town has cultural texture (real Japan), but full creative license over what's there.

The town's defining qualities:
- Cozy, slow, slightly heightened
- Soft-magical — characters know things, locations have history, weirdness is normal
- Specific aesthetic identity (audio-first means specific ambient sounds, specific instruments, specific palette per location)

### Player frame

The player is a **foreign arrival, ~3 months in, part-timing at a small family-run minshuku**. This frame:
- Justifies imperfect Japanese in-world (you're new)
- Anchors a daily ritual (you "go to work" at the inn)
- Allows everywhere else in town to be a reason to *leave* the inn — natural variety cover
- Most plausible job for the protagonist's situation

### Home base: the minshuku

The default location at session open. A small family-run inn with a recurring host family. Where most "today's a normal day" scenes happen. Also where rotating one-shot guests appear — these are the procedural variety engine.

### Cast (9 recurring characters)

#### Inner circle: host family (4)

| Role | Speech register served | Soft-magical asset |
|---|---|---|
| **Mom** | Warm casual register; the warm anchor | — |
| **Dad** | Practical / work register; gentle authority | — |
| **Kid** (~8–12) | Child-informal register; matches player's casual level; co-conspirator | Sees things others don't |
| **Grandparent** | Elder / regional register; soft authority | Knows old stories, calls player by old nicknames |

#### Outer circle (5)

| Role | Speech register served | Anchored at |
|---|---|---|
| **Shrine keeper** | Formal / elder; the mystery anchor | The local shrine |
| **Café or small-shop owner** | Polite-business register; social hub | A café (working name: kissaten) |
| **Peer / fellow young adult** | Casual / slang; the player's friend | TBD location (likely a hangout spot — see open questions) |
| **Mysterious wanderer** | Variable / soft-magical; quest beats | Drifts in and out — sometimes the inn, sometimes the shrine, sometimes the bookshop |
| **Bookshop / archive keeper** | Knowledge register; town historian | The bookshop |

#### Rotating one-shots
Guests at the minshuku — generated per-session as one-shot characters wrapped around today's SRS items. Each carries a story, comes from somewhere, sometimes isn't quite what they seem. The procedural variety engine.

### Locations (~6 anchors)

1. **Minshuku** (home base; host family)
2. **Shrine** (keeper)
3. **Café/kissaten** (shop owner)
4. **Peer-friend hangout** (TBD specific — see open questions)
5. **Bookshop / archive** (bookshop keeper)
6. **Itinerant / wandering** (the mysterious wanderer's haunts — multi-location)

Each location has pre-generated visual + audio assets (atmospheric background image/illustration, ambient audio loop, mood palette). All unlocked from day 1 (no progression-gated locations in v1).

---

## 8. Quest layer (two tracks)

### Daily micro-stakes
Each scene has its own tiny in-scene reason for the conversation to happen (the kid lost his cat, a guest is late, the keeper's bell broke, mom's recipe attempt). Resolved within the scene OR opens a thread (§10).

Without micro-stakes, every scene feels like "the AI prompts you to use words" — a quiz wearing a costume. With them, the conversation has a *reason*, and the language becomes the tool to engage with that reason.

### Slow long-running mystery
A single per-player mystery thread that progresses very slowly (weeks–months) via mystery beats woven into compatible scenes. Each player progresses at their own pace based on their natural review schedule.

**Per-player progression + light shared seasonality.** The mystery progresses at each player's own pace; world events (festival in spring, snow in winter) happen on a shared real-world calendar.

---

## 9. Variety mechanism

### Item-anchored, scene-fitted hybrid

The system is **top-down (SRS first)**, not bottom-up. The conversation is the *delivery vehicle* for items already known to be due, not the *discovery mechanism* for what's due.

Two-way fit:

1. **SRS picks active targets** (the most urgent due items today). These are non-negotiable.
2. **Templates declare compatibility tags** (which active targets they can host, what registers they support, what locations/characters they involve).
3. **The system filters templates** to those compatible with today's active targets.
4. **Among compatible templates, prefer thread-advancers** for an open thread the player has with that character (§10).
5. **Pick one. Passive items are then drawn to fit the chosen scene** — items the AI can use naturally given the location, characters, register.

Result: items drive *what* the scene must accomplish; templates drive *how* it gets accomplished. Both layers do real work; neither dominates.

### Scene templates (~50 in v1)

Authored skeletons. Each defines:
- Location + present character(s)
- Compatible active-target tags (which active targets this template can host)
- Compatible passive-item scenario tags
- Register requirement
- Micro-stake skeleton (with slots)
- Allowed nudges / hints
- Scripted turn order (for multi-AI scenes)
- Exit beat (how the scene ends)
- Optional flags: `mystery-porous: true` (can carry beats), `opens-thread`, `requires-open-thread`, `closes-thread`

Templates are **shared across all players**. Selection is **per-player, per-session**.

### Edge cases

- **No template fits today's most-urgent active target?** → 2nd-most-urgent gets promoted to active; the original demotes to passive (still gets exposure).
- **Not enough due items?** → curriculum tops up with the next lesson item, OR (player choice from Q22) player can tap "learn something new" to add a fresh lesson manually.
- **Imported items have no scenario tags?** → one-time LLM tagging pass when items are imported, with manual override.

---

## 10. Continuity — threads and beats

Two narrative state layers operating on different scales. They don't conflict.

### Threads (per-character, per-location)

Small, local narrative state.

- **Lifespan:** short — 1–3 scenes from open to close.
- **Origin:** organic — micro-stakes give rise to threads.
- **Concurrency:** many can be open at once (the kid's cat, the keeper's festival prep, mom's recipe).
- **Personal:** each player has unique threads based on their scene history.

Each scene's relationship to threads:
- **Opens** a thread (the kid's cat goes missing)
- **Advances** a thread (the cat hasn't been found; the keeper asks for festival help)
- **Closes** a thread (the cat is found; the festival happens)
- Or — most scenes — **stands alone** (today's stake resolves in-scene)

The system tracks per-player thread state:
```
threads = [
  { character: "kid", summary: "lost cat, last seen by the well", openedAt: scene_42, status: open },
  { character: "shrine_keeper", summary: "festival prep ongoing", openedAt: scene_38, status: advancing },
]
```

The "memory" the AI uses in scene prompts is **only the open threads** — never raw history. Bounded, focused, narratively load-bearing.

### Mystery beats (global per-player, authored)

Long-running narrative arc.

- **Lifespan:** long — weeks/months of real time.
- **Origin:** authored sequence (beat 1 → beat 2 → beat 3 → ...).
- **Concurrency:** one beat active at a time (the next in sequence).
- **Personal in pace, shared in content:** same authored content for every player; pace varies per player.

### Layered insertion model

Mystery doesn't replace scene selection. It rides *on top* of it.

```
1. SRS picks today's active targets         (LOCKED — never compromised)
2. Filter compatible templates              (item tags must match)
3. Prefer templates that advance an open thread  (Q20 logic)
4. Pick one template
5. THREAD LAYER:
     - is there an open thread for this character/location?
       yes → does this template advance/close it?
       no  → does this template open one?
6. BEAT LAYER:
     - is any mystery beat ARMED and compatible with this template?
       yes → weave beat content into the dialogue prompt
       no  → no beat content
7. LLM generates dialogue with: base + thread state + (maybe) beat content
```

### How beats arm

A beat sits dormant until armed. Arming triggers:
- N scenes since last beat fired (default cadence — say 7 scenes)
- Player crosses a familiarity threshold with a beat-relevant character
- A narratively relevant SRS item becomes due
- External conditions (real-world season, real-world date)

When armed, the beat becomes a candidate for layer 6 above. It fires the next time a compatible template is chosen by the SRS-first pipeline.

### Failure mode: patient, not force-fire

If a beat is armed and no compatible scene appears for 3 weeks: **do nothing**. The beat stays armed. SRS quality is never compromised. Mystery progresses *at the pace the player's natural review schedule allows.*

### Why this design is clean

- SRS is never compromised — beats only fire when they fit a scene already chosen for review value.
- Author burden is bounded — beats are written per-arc (5–10 beats per arc) with compatibility tags.
- Player has agency, even if invisible — what they choose to study determines which characters they bond with, which determines which beats arm, which determines what they discover.
- Most templates are mystery-agnostic. Only mystery-porous templates (the shrine, the bookshop, wandering-figure encounters) host beats. The minshuku's everyday scenes don't — that's intentional.

---

## 11. Interaction model

### Physical model

**Hands-free.** Open the app, the scene plays. AI speaks → audio cue → mic auto-activates → player speaks → silence triggers turn end → AI responds. No buttons during a scene.

The screen exists as **passive support** — never demands a tap. Player can glance at it; player can also set the phone down.

### Coach voice

**A single disembodied narrator.** Speaks English. Delivers briefing, lesson, mistake hints, quiz prompts, and result. The player learns within one scene: *coach voice = stop, listen, this is meta. Character voice = engage, you're in the scene.*

The coach is a **brand asset** — one consistent personality (warm, encouraging, slightly playful) across the whole product.

### Briefing format

Voice + quiet on-screen mission card. Coach speaks (~15–30 seconds); meanwhile the screen shows a card with:
- Location name
- Character(s) present (avatar or name)
- Active target (word/grammar)
- Today's micro-stake (1 line)

Card stays visible during briefing, then dissolves into scene mode.

### Scene-mode UI: story frame

After the briefing card dissolves, the screen enters **scene mode**:

- **Atmospheric background** per location (subtle illustration or color block — forest at the shrine, café warm light, station blue dusk, etc.)
- **Top label:** location + currently-speaking character (small, quiet)
- **Subtitle bar** at bottom: latest AI line in JP with optional toggleable furigana
- **Active target** as a quiet tag (color-coded, persistent)
- **Mic state** indicator (idle / listening / processing) — small, not prominent

Mood is the feature; info is light. Player can glance for help; doesn't have to.

### Mistake handling (v1: coach immediate)

When the evaluator detects a miss (silence, wrong word, wrong conjugation, mispronunciation), the **coach voice steps in immediately** with a hint or model phrase. Then the scene resumes.

This is the v1 starting point — chosen for visibility (we want to see the evaluator working). The known v2 path:

**v2: tiered escalation.**
1. First miss → character gentle in-JP nudge ("もう一回？")
2. Second miss → on-screen target word brightens / shows hint
3. Third miss → coach steps in (EN) with explicit hint
4. Last resort → coach gives the model answer and the scene moves on

### Quiz (adaptive verbal)

After the roleplay, coach asks 2–3 short questions, item-type-aware (see §6 Quiz). Hands-free; player answers verbally.

### End-of-scene

Voice-led + on-screen result card.

```
┌──────────────────────────────────┐
│  Scene 47 — Hiro · Minshuku     │
│  ───────────────────             │
│  ✓ つもり    used                 │
│  ✓ 約束     understood            │
│  ✓ 持つ     understood            │
│  ✓ 雨       understood            │
│  ⚪ 不思議   review tomorrow      │
│                                  │
│  🌀 Hiro's umbrella → morning   │
│                                  │
│  [continue] [stop for today]     │
└──────────────────────────────────┘
```

Voice (~10s): *"Nice scene. つもり came through clean, 不思議 we'll catch tomorrow. The umbrella search continues in the morning. Keep going?"*

Player answers verbally ("yes" / "もう一回" / "no" / "止める") or taps if they want.

---

## 12. Voice / Audio substrate

**TTS/STT, not live/streaming voice.** This is settled.

### Why TTS/STT (and not Gemini Live / similar streaming)

Streaming voice is fluid but uncontrollable. It can't:
- enforce explicit turn boundaries
- use distinct character voices reliably
- pause for quiz inserts
- swap to English for instructions and back to Japanese
- layer ambient music cleanly

TTS/STT is structured: we decide when the AI speaks, which voice, what language, when the player's mic is live. We accept reduced fluidity in exchange for controllability — the entire spec depends on that control.

### Required capabilities

- Multiple **JP voices** for distinct characters (host family + outer cast = ~9 distinct voices)
- At least one **EN voice** for the coach (clearly different prosody)
- **Language switching at utterance boundaries** — never mid-sentence
- **Audio cues** for turn boundaries (chime, breath, soft prompt phrase)
- **Ambient audio loops** layered behind dialogue (per-location ambience — forest at shrine, café hum, etc.)
- **STT confidence thresholds** so we know when to ask the player to repeat vs. accept and adapt

### Multi-AI scenes — first-class

Multiple characters in one scene is supported from v1.

- **TTS:** trivial — each tagged line routes to the right character voice config.
- **Generation:** LLM gets cast list in scene prompt; produces structured turn-attributed dialogue.
- **Turn-taking:** scripted turn order in the template (Owner opens, Tanaka enters at turn 3, Owner closes). Most natural feel; deterministic for the evaluator.
- **UI:** subtitle bar shows current speaker label.

Used for moments where social texture matters: family dinner with all 4 host family members, café with regular + owner, shrine with keeper + helping kid, two AIs chatting while player listens then turns to player. Also great for **passive listening** practice specifically.

---

## 13. Onboarding

**World-first. Import surfaced after scene 1.**

- Sign-up → drop the player straight into the world.
- Scene 1 happens at the minshuku — the host family kid asks easy questions, escalating until the player struggles. This *is* the level calibration; it also welcomes them.
- Right after scene 1, the coach surfaces the import option: *"If you're already studying with a deck, you can bring it here — your daily review will pull from your own material instead of (or alongside) ours."*

Why: most users decide in the first 60 seconds. The first thing that happens should be the *thing* (a scene), not a form. Existing-deck users see "bring your own material" *after* deciding the product is interesting — conversion goes up.

---

## 14. Cadence + motivation

**Pure SRS, hard-stops when done. Optional add-lessons when reviews are empty.**

- Daily target = today's due items.
- Default session = 1 scene (~5 min). Player can stack via the continue prompt at end of each scene (typical session: 1–3 scenes).
- When SRS is empty for the day → coach says *"you're caught up — see you tomorrow"* (hard stop).
- Player can also choose to **add a new lesson** instead of stopping — pulls the next curriculum item into the queue (uses the curriculum side of the hybrid SRS source). Same generation pipeline; no new code path.

### What we are NOT doing in v1

- ❌ Streak counters / streak shame
- ❌ Push notifications by default
- ❌ "Play forever" world-scene mode (this is a known v2 path — see §17)
- ❌ Daily goal counters / XP grinds
- ❌ Leaderboards or social features

Calm-ritual feel. The product is the work; the work is the reward.

### Re-engagement

Optional gentle daily reminder, **off by default**. Soft phrasing if the user opts in: *"Hiro's still wondering about that umbrella."* Never streak-driven.

---

## 15. Data model

### VocabItem
```
{
  id, word, reading, meaning, partOfSpeech, jlptLevel, frequencyRank,
  exampleSentences: [...],
  scenarioTags: ["cafe", "train", "morning", ...],
  activePromptTemplates: [...],     // storytelling drill prompts
  passiveExampleTemplates: [...],   // sentences the AI can drop into roleplay
  commonCollocations: [...]
}
```

### GrammarItem
```
{
  id, pattern, meaning, jlptLevel, formation,
  exampleSentences: [...],
  commonMistakes: [...],
  scenarioTags: [...],
  activePromptTemplates: [...],
  passiveExampleTemplates: [...]
}
```

### SceneTemplate
```
{
  id,
  location: "shrine" | "minshuku" | ...,
  characters: [{ id, role, voiceConfig }],   // 1+ characters
  scriptedTurns: [{ turn: n, speaker: "character_id" | "player" | "coach" }],
  microStakeSkeleton: "...",                 // with slots for items
  registerTag: "casual" | "polite" | "elder" | "keigo",
  activeTargetCompatibility: ["grammar:つもり", "tag:planning", ...],
  passiveScenarioTags: ["evening", "weather", ...],
  allowedNudges: [...],
  exitBeat: "...",
  flags: { mysteryPorous: true, opensThread: false, requiresOpenThread: false }
}
```

### ReviewItem (per user × item)
```
{
  id, userId, itemId, itemType: "vocab" | "grammar",
  lastReviewedAt, nextReviewAt,
  ease, interval, lapses,
  history: [{ sceneId, mode: "active" | "passive", outcome, timestamp }]
}
```

### Thread (per user × character)
```
{
  id, userId, characterId, locationId,
  summary,
  openedAt: sceneId, lastTouchedAt: sceneId,
  status: "open" | "advancing" | "resolved"
}
```

### MysteryState (per user)
```
{
  userId,
  arcId,
  beatsFiredHistory: [...],
  currentBeatId,
  beatArmed: boolean,
  armedSince: sceneCount | timestamp,
  factsLearned: [...]   // narrative facts the player has discovered
}
```

### SceneRun
```
{
  id, userId, sceneTemplateId,
  startedAt, endedAt,
  itemsAssigned: { active: [...], passive: [...] },
  threadStateAtStart, threadStateAtEnd,
  beatFired: beatId | null,
  turns: [{ speaker, text, audioUrl, transcribedAt }],
  outcomes: [{ itemId, mode, outcome, evidence }]
}
```

### UserState
- Profile, JLPT level estimate (from onboarding + ongoing performance)
- Preferences (voice speed, furigana on/off, reminder opt-in, etc.)
- Familiarity scores per character (v2)
- Cumulative scene count, last-active date (used for natural review-cadence calculations, not displayed as streak)

---

## 16. Scene generation pipeline

```
buildScene(userId):
  # 1. Schedule
  dueItems = srs.getDue(userId)
  if empty(dueItems):
    if user wants new lesson:
      newLesson = curriculum.getNextLesson(userId)
      dueItems = [newLesson]
    else:
      return DAILY_DONE

  # 2. Pick active targets
  activeTargets = pickActiveTargets(dueItems, count: 1-2)   # weakest/most-urgent first

  # 3. Filter templates
  candidates = templates.filterCompatibleWith(activeTargets)

  # 4. Prefer thread-advancers
  openThreads = threads.getOpen(userId)
  scoredCandidates = score(candidates, by: {
    advancesOpenThread: +5,
    notUsedRecently: +3,
    differentLocationThanLastScene: +2,
    differentCharacterThanLastScene: +1
  })
  template = pickTop(scoredCandidates)

  # 5. Resolve thread layer
  threadAction = resolveThreadAction(template, openThreads)
  # one of: advance(threadId) | close(threadId) | open(newThread) | standalone

  # 6. Resolve beat layer
  armedBeat = mystery.getArmedBeat(userId)
  beatToFire = (armedBeat && template.flags.mysteryPorous && armedBeat.compatibleWith(template))
    ? armedBeat : null

  # 7. Pick passive items to fit
  passiveItems = pickPassiveItems(dueItems, fittingTemplate: template, count: 3)

  # 8. Build scene plan
  scenePlan = {
    template,
    activeTargets,
    passiveItems,
    threadAction,
    beatToFire,
    microStake: instantiate(template.microStakeSkeleton, threadAction, beatToFire)
  }

  # 9. Generate dialogue (LLM)
  dialogue = llm.generateDialogue(scenePlan)

  # 10. Pre-synth what we can
  audio = tts.synthesize(dialogue.lines, characterVoiceConfigs)

  return scenePlan, dialogue, audio
```

The AI does **not** improvise the scene from scratch. It receives a structured plan and generates only the dialogue lines.

---

## 17. Evaluator architecture

**Turn-based, layered. The AI is not continuously monitoring** — it reacts to completed turns.

```
Per turn:
1. AI speaks (TTS plays).
2. Audio cue → mic opens.
3. Player speaks → silence triggers turn end → STT transcribes the utterance.
4. Evaluator runs ONCE on the completed transcript:
     a. STT confidence check (free, instant) — did we hear them clearly?
     b. Target-presence rule (free, instant) — did the target word/pattern appear?
     c. Conjugation/morphology check (free, instant) — using a JP morphological analyzer
        like Sudachi or Kuromoji.
     d. LLM judge — ONLY invoked if rules pass but we need to grade nuance
        (meaning appropriateness, naturalness). Skipped when rules give a clear yes/no.
5. Scene state updates. AI generates its next response based on the evaluator outcome.
6. Loop.
```

### Per-turn outcome categories

- `missed` — wasn't used or wasn't understood
- `recognized` — understood passively but couldn't produce
- `produced_with_help` — produced after a hint
- `produced` — produced cleanly
- `mastered` — produced in a non-prompted context

These map to standard SRS grades (Again / Hard / Good / Easy).

### Cost / latency profile

- **Cost.** LLM judge runs maybe once per turn, only for nuance. A 5-minute session has ~6–10 turns; that's at most 6–10 LLM judge calls, often fewer. Plus 1 LLM call for scene-script generation.
- **Latency.** Pause between learner-finishes and AI-responds is dominated by STT + rule check, not LLM. Feels conversational, not surveillant.
- **Feel.** No always-on grading. The AI responds to your completed turns, like a human partner.

---

## 18. Pre-generated assets vs runtime

| Pre-generated (one-time, reused forever) | Runtime (per session) |
|---|---|
| Atmospheric backgrounds per location (~6) | The roleplay dialogue itself (LLM, per-session) |
| Ambient audio loops (~6) | TTS audio for dynamic dialogue lines |
| Character voice IDs / TTS configs (×9) | Active/passive item chips for the scene |
| Stock TTS lines per character (~20–50 per character) | Evaluator outputs (per turn) |
| Coach meta-narration scaffolds (partial TTS cache) | Scene state, thread state, beat state updates |
| Scene templates (~50 authored) | The chosen template for today |
| Briefing card layouts (per template) | The filled-in micro-stake content |

A scene at runtime is roughly:
- Load static assets (background + ambient + voice configs) — instant from cache.
- Load template + scene plan — instant from local data.
- One LLM generation for the dialogue script.
- TTS synthesizes dynamic lines (streaming where possible). Stock lines played from cache.
- Per-turn STT + evaluator (cheap).

Per-scene cost is bounded.

---

## 19. Per-player vs shared

| Shared across all players | Personal to each player |
|---|---|
| The world (6 locations, 9 recurring characters, voices, personalities) | Their SRS state (their items, due today) |
| The library of scene templates (~50) | Which template gets *picked* for them today |
| Pre-generated assets (backgrounds, ambient, voice configs, stock phrases) | Which items get plugged in |
| The soft-magical register, writing style | The actual LLM-generated dialogue |
| The slow long-mystery arc (authored sequence) | Their familiarity with each character |
| Light shared seasonality (festival in May, snow in February) | Their open threads with each character |
| | Their progression through the slow long-thread |

**The kid is the same kid for everyone, but the kid is having a different conversation with each player because each player has a different relationship with him.** Same town, different lives. Same as a real Japanese town.

---

## 20. v1 / v2 / v3 roadmap consolidated

Things explicitly layered as future work:

| Item | v1 | v2 | v3+ |
|---|---|---|---|
| Mistake handling | Coach immediate | Tiered escalation (4-step) | — |
| Continuity | Threads only | Threads + familiarity scoring | Threads + familiarity + character arcs |
| Scene rhythm | Strict 5-phase | Adaptive (collapse phases that don't add value) | Per-scene-type rhythm |
| Cadence | Pure SRS hard-stop + add-lesson | + world-scenes when SRS empty | — |
| Mystery arcs | One arc | Multiple arcs available | — |
| Re-engagement | Opt-in gentle reminder | — | — |
| Languages | JP only | (consider) | — |

---

## 21. Non-goals (v1)

- ❌ Free-form open conversation. The product is *structured* scenes.
- ❌ Live/streaming voice substrate.
- ❌ Other target languages. Japanese only.
- ❌ Native mobile apps. Web first.
- ❌ Live human tutors.
- ❌ Writing/kanji practice as a primary mode. Listening + speaking is the core.
- ❌ Streak counters, push notification spam, leaderboards, social features. (Streaks are an open consideration for post-v1 — see §22.)
- ❌ Conversation-mining as the engine (the open-language model). SRS is the engine.
- ❌ Pre-baked scene scripts that ignore SRS. The whole point is items drive scenes.

---

## 22. Open design questions / authoring tasks

These are the real authoring + design work that's still to do. Each needs its own pass.

### Authoring (large)
1. **The pilot mystery arc.** Working title TBD. ~10 beats spanning months of in-app time. Who/what is the mystery about? What's the structure?
2. **The 9 recurring characters in detail.** Names, voices, personalities, speech patterns, soft-magical assets, character bios.
3. **The 50 v1 scene templates.** Distribution across the 6 locations + multi-character scenes.
4. **The town itself.** Name. Region of Japan. Specific real-world cultural references. Map.
5. **The peer-friend's hangout location.** Bar? Beach? Music venue? Their home? Influences scene possibilities.

### Content sources
6. **Vocabulary source.** JMdict + frequency lists (which? BCCWJ? Wikipedia frequency? Anki Core?). License audit.
7. **Grammar source.** Dictionary of Japanese Grammar? Tofugu? Bunpro-shaped? Authored from scratch?
8. **Curriculum order.** Frequency-driven vs scenario-coherent — resolve.

### Technical decisions
9. **TTS provider(s).** Need: ~10 distinct JP voices + 1 EN coach voice, language-switching, decent latency, viable per-scene cost. Candidates: ElevenLabs, OpenAI TTS, Google TTS, Azure, fal-hosted.
10. **STT provider.** Candidates: Whisper, Deepgram, Google STT. Need: JP confidence, segment timing, low latency.
11. **LLM provider for dialogue generation.** Default to Claude (Sonnet/Haiku) given default Vercel AI SDK / AI Gateway availability. Need: structured output for tagged-turn dialogue.
12. **JP morphological analyzer.** Sudachi vs Kuromoji vs Mecab. Need: accurate conjugation/POS tagging for the rule-based evaluator layer.
13. **Stack.** Likely Next.js + Supabase + Vercel given prior context, but should be a deliberate post-design call.
14. **Audio mixing.** Client-side WebAudio for ambient + dialogue mixing? Server-rendered? Streaming TTS?

### Onboarding details
15. **Scene 1 calibration mechanic.** How does the kid escalate questions? What determines the placement-bucket the player lands in?
16. **Import flows.** Anki .apkg parser? CSV paste? WaniKani API? At minimum: paste-a-list. Likely v1 = paste-list, v2 = .apkg + integrations.
17. **Tagging pass for imported items.** LLM tagging with manual override UI.

### Scoring details
18. **STT confidence thresholds** for "ask to repeat" vs "accept and adapt."
19. **Pronunciation scoring.** Depth vs phoneme-level analysis. v1 is probably "STT confidence is the proxy."
20. **What counts as "correct conjugation"** (tolerance for filler words, slight register slips).

### Game mechanics
21. **Streak counter exact behavior.** Reset rules, time-zone handling, freeze/grace logic.
22. **XP-light system, if any.** The exact dopamine math.

### Design / UI / Brand
23. **Visual identity / palette.** Per-location and overall.
24. **Coach voice personality direction.** The brand voice in detail.
25. **Audio cue vocabulary.** Specific sounds for turn start, turn end, scene transitions, success, miss, beat firing.
26. **Onboarding visual.**

### Business
27. **Pricing model.** Out of scope for this design but shapes scope decisions (free trial length, free arc, etc.).

---

## 23. What to build first

A minimum loop that proves the system, not a polished product. Each step builds on the previous.

1. **Seed content.** Small vocab + grammar set (~30 vocab, ~10 grammar) — N3/N2 to keep authoring burden low. Enough to drive ~10 scenes.
2. **Author 5–10 scene templates.** Spanning at least 2 locations and 2 characters.
3. **SRS that picks due items.** Postgres-shaped. Just the basic interval/ease/lapse model.
4. **Scene generator** that fills a template (no thread or beat layers yet — those are step 7).
5. **TTS + STT plumbing.** One JP character voice + one EN coach voice. Hands-free turn boundaries with audio cues.
6. **Evaluator (rule-based only for v0.1).** Target-presence + conjugation. LLM judge layer comes after.
7. **Run a scene end-to-end.** Score one active target and three passive targets. Update SRS.
8. **Loop:** scene → result → next scene. Confirm the rhythm feels right.
9. **Add thread layer.** One open thread per character; advance/close logic in the generator.
10. **Add LLM judge layer** for nuance evaluation.
11. **Add multi-AI scenes** (one template, one author session).
12. **Add mystery beat layer** with one armed beat to test the layered insertion.

Everything else (full quest arc, all 9 characters, all 6 locations, ambient audio, on-screen story-frame polish, onboarding flow, import flow, settings) builds on this loop.

**The loop is the product. Don't build features that don't run through it.**

---

## 24. What carries over from open-language

Almost nothing. The architecture is fundamentally inverted:

| | Open-language (old) | Nihongo Scenes (this) |
|---|---|---|
| Loop direction | Conversation first → mine for signal | SRS first → deliver in scene |
| Source of truth | Conversation transcript | SRS state |
| Where intelligence lives | Mining layer | Scheduling + generation layers |
| Voice substrate | Gemini Live (streaming) | TTS/STT (structured) |
| Cold start | Hard | Easy |

What *can* be reused: nothing significant. The Next.js + Supabase + Vercel infra patterns are useful conventions but the new repo will scaffold fresh.

What's explicitly thrown away: the entire Gemini Live pipeline, the level-test-as-conversation flow, all current prompts, the existing data model, the four briefs that this doc replaces.
