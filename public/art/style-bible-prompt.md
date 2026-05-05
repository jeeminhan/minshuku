# Style Bible Prompt — paste into ChatGPT

Paste the block below as your first message to ChatGPT. Save its response as `style-bible.md` in this folder and reuse it as a prefix for every image-generation prompt.

---

I'm making a slow, atmospheric Japanese language-learning game called **hanare (はなれ)**. It's set in modern-day rural and small-town Japan — a family minshuku, a quiet shrine, a country train station, a neighborhood café and bookshop, a late-night street. The mood is warm, nostalgic, and unhurried — closer to a Studio Ghibli slice-of-life than a combat JRPG.

I need you to write a **reusable art-direction style bible** for this game's pixel art. I will paste your output verbatim at the top of every future image-generation prompt, so it must be self-contained, concrete, and prescriptive.

**Lock these decisions in the bible:**

- **Era reference**: SNES-era JRPG pixel art (think *Chrono Trigger*, *Secret of Mana*, *Mother 3*), updated with a slightly higher color count. Not GBA-crunchy, not modern hi-bit Octopath.
- **Internal resolution**: 320×180. 1 logical pixel = 1 art pixel. No anti-aliasing. No gradient dithering for skies — use banded dithering only where appropriate (Aseprite-style).
- **Perspective**: 3/4 oblique top-down for environments (camera tilted ~30° down). Characters drawn front-facing or 3/4 view with consistent foreshortening.
- **Character proportions**: 3-head-tall (not chibi 2-head, not realistic 6-head). Roughly 24–32px tall sprites for full-body, 48×48 for dialogue portraits.
- **Outline**: dark indigo (#2a1f3d), not pure black. Outlines are 1px and selective — interior detail uses color contrast, not outlines.
- **Palette**: ~40 colors, warm and muted, Ghibli-leaning. Anchor it with: washi-paper cream, persimmon orange, indigo, moss green, charcoal, tatami beige, sakura pink. Avoid neon, pure white, pure black, oversaturated reds. Output the palette as a list of hex codes.
- **Lighting**: time-of-day driven. Specify how morning, afternoon, golden hour, dusk, and night each shift the palette (warm/cool, contrast, shadow color). Shadows are colored, never gray.
- **Texture & atmosphere**: light grain on wooden surfaces, paper texture on shoji, dappled light through leaves. No photorealistic textures. Atmospheric perspective for distance (slight desaturation + cool shift).
- **Composition rules**: clear foreground/midground/background separation. One focal point per scene. Negative space is welcome — this is a quiet game.
- **Cultural specificity**: the architecture, props, and signage must read as authentically Japanese (not generic "Asian fantasy"). Tatami, fusuma, engawa, noren, vending machines, kei trucks, JR rural-line signage, hand-painted shrine ema. No pagodas-as-decoration, no fake kanji.
- **Banned patterns**: no anime "moe" face conventions (giant sparkle eyes, blush dots), no fantasy elements (magic, monsters), no UI/text/watermarks baked into images, no anti-aliased "fake pixel art" smoothing.

**Output format I want from you:**

1. **One paragraph (150–200 words)** that I can paste as a prefix before every image prompt. It should densely encode the style so a generator stays on-model.
2. **A locked palette** — list of hex codes grouped by role (skin tones, foliage, wood, sky-day, sky-dusk, sky-night, accents).
3. **Five lighting presets** — one short paragraph each for morning / afternoon / golden hour / dusk / night, describing palette shift and shadow behavior.
4. **A "scene prompt template"** — the fill-in-the-blanks structure I should use for each new image, with slots for location, time, props, characters, mood, and a negative-prompt block.
5. **A "character portrait template"** — same idea, for 48×48 dialogue portraits.

Be opinionated. If any of my constraints conflict, flag it and pick the better choice. Don't hedge with "you could also try…" — commit.
