# hanare — Pixel Art Style Bible

**Version 1.0** — Paste section 1 verbatim as a prefix to every ChatGPT image prompt. Use sections 4–5 as fill-in templates.

---

## 1. Master Style Paragraph (paste this every time)

> Pixel art for *hanare*, a slow Japanese slice-of-life game. SNES-era JRPG fidelity in the lineage of *Chrono Trigger*, *Secret of Mana*, and *Mother 3*, with a slightly expanded ~40-color palette. Internal resolution **320×180**, 1 logical pixel = 1 art pixel, **no anti-aliasing, no smoothing, no gradient blur** — hard pixel edges only, banded dithering permitted on skies and soft shadows. Environments use a **3/4 oblique top-down perspective** (camera tilted roughly 30° down). Characters are **3-heads tall**, ~24–32px full-body sprites, ~48×48 dialogue portraits, drawn front or 3/4 facing. **Outlines are 1px dark indigo (#2A1F3D), never pure black**, and selective — interior form is read through color contrast, not heavy linework. Palette is warm, muted, and Ghibli-leaning: washi cream, persimmon, indigo, moss, charcoal, tatami beige, sakura pink. **Shadows are colored (cool indigo or warm umber), never neutral gray.** Setting is authentically modern rural Japan — tatami, fusuma, shoji, engawa, noren, kei trucks, JR rural-line signage, hand-painted ema — no fantasy, no fake kanji, no generic "Asian" pastiche. Mood: quiet, nostalgic, unhurried. Negative space is welcome. **No UI, text, watermarks, anime moe-face conventions (sparkle eyes, blush dots), or photorealistic textures.**

---

## 2. Locked Palette (~40 colors)

Anchor every image to these hex values. Don't let ChatGPT improvise new colors.

### Neutrals & paper
- `#F4E9D0` washi cream (lightest)
- `#E8D7B0` tatami beige
- `#C9B189` aged paper
- `#8C7355` warm brown midtone
- `#5A4632` dark wood
- `#2A1F3D` indigo-black (outlines, deepest shadow)

### Skin tones
- `#F2D4B0` light skin
- `#D9A87C` medium skin
- `#A87049` deep skin
- `#6B3F26` skin shadow

### Foliage & nature
- `#B7C77A` young leaf green
- `#7A9B4E` moss
- `#4A6B3A` deep cedar
- `#2D4030` shadow forest

### Wood & architecture
- `#A87B5C` cedar plank
- `#7A5A40` weathered beam
- `#4A352A` shoji frame
- `#D8CFB8` shoji paper (lit)

### Sky — day
- `#BEDDE8` morning blue
- `#9CC6D9` afternoon blue
- `#7AAFC8` deep day

### Sky — golden hour & dusk
- `#F4C18A` golden warm
- `#E89E6A` persimmon glow
- `#B86B5C` sunset rust
- `#6E4A6E` dusk violet

### Sky — night
- `#3A3A6B` night blue
- `#1F1F40` deep night
- `#E8E4C0` lantern warm white
- `#F2C36A` lantern flame

### Accents (use sparingly)
- `#C94A3D` torii vermillion
- `#E8A0A8` sakura pink
- `#4A6B8C` indigo cloth
- `#D9C04A` brass / aged metal

---

## 3. Lighting Presets

Each preset = palette shift + shadow color + atmosphere. Pick one per image.

### Morning (6–9am)
Cool, soft, low-contrast. Sky `#BEDDE8`. Mist desaturates distance. Shadows are **cool blue-indigo `#4A6B8C` at ~40% opacity**. Highlights on east-facing surfaces in pale cream `#F4E9D0`. Foliage reads slightly blue-green. Mood: hushed, awakening.

### Afternoon (11am–3pm)
Bright, neutral-warm, full saturation. Sky `#9CC6D9` to `#7AAFC8`. Shadows are **warm umber `#5A4632`** with crisp edges. Maximum color contrast. Use this for "ordinary daylight" scenes. Mood: alert, present.

### Golden Hour (4–6pm)
The signature *hanare* lighting. Everything bathed in `#F4C18A` warm wash. Long shadows in **warm violet `#6E4A6E`**. Highlights edge in `#E89E6A` persimmon. Foliage shifts toward yellow-green. Skin tones glow. Mood: nostalgic, the heart of the game.

### Dusk (6–7:30pm)
Sky gradient: `#E89E6A` → `#B86B5C` → `#6E4A6E` top to bottom (banded dither only). Lit interiors glow `#F2C36A` warm through shoji. Outdoor shadows are deep violet `#2A1F3D`. Silhouettes against sky. Mood: liminal, threshold.

### Night (8pm+)
Sky `#1F1F40` to `#3A3A6B`. Lantern light = warm pool `#F2C36A` falling off into `#4A352A`, then darkness. Shadows are near-black indigo. Strong rim-lighting on faces near light sources. Stars optional — single-pixel `#E8E4C0` dots, no twinkle. Mood: intimate, still.

---

## 4. Scene Prompt Template

Copy this block, fill the slots, paste **after** the section 1 paragraph:

```
SCENE
Location: <e.g., minshuku tea room with engawa overlooking a small garden>
Time of day: <morning | afternoon | golden hour | dusk | night>  → apply lighting preset
Weather: <clear | overcast | light rain | snow | summer haze>
Camera: 3/4 oblique top-down, tilted ~30°, framed wide
Composition:
  Foreground: <e.g., low kotatsu with steaming teacups>
  Midground: <e.g., seated character on zabuton, focal point>
  Background: <e.g., open shoji revealing maple tree>
Key props: <list 4–6 specific items — be concrete>
Characters: <none, OR describe sparingly: "elderly woman in indigo yukata, seated">
Mood word: <quiet | tender | tense | playful | melancholy | warm>
Focal point: <where the eye should land first>
Negative space: <left side / upper third / etc. — leave room>

NEGATIVE
no text, no UI, no watermark, no signature, no anti-aliasing, no smoothing,
no fake kanji, no fantasy elements, no anime sparkle eyes, no blush dots,
no modern logos, no Western architecture, no pure black, no neon
```

---

## 5. Character Portrait Template

For 48×48 dialogue portraits. Same style paragraph prefix, then:

```
PORTRAIT
Subject: <e.g., the minshuku grandmother, mid-70s, kind eyes, gray hair in low bun>
Framing: head and upper shoulders, centered, facing 3/4 toward viewer
Expression: <neutral-warm | smiling softly | concerned | laughing | thoughtful>
Clothing: <specific — "navy indigo yukata with white komon pattern, cream collar">
Lighting: <which preset + direction, e.g., "golden hour from camera-left">
Background: flat solid color from palette (no scene), pick one that contrasts subject
Outline: 1px #2A1F3D, selective
Detail budget: eyes are 2–3px each, mouth 2–4px, no nose outline, hair in 3 tonal bands

NEGATIVE
no body below shoulders, no text, no border, no anime moe conventions,
no sparkle eyes, no blush circles, no chibi proportions, no Western features
forced onto Japanese subject
```

---

## 6. Workflow Notes

- ChatGPT's image generator outputs **fake pixel art** — anti-aliased, often the wrong resolution. Always post-process: downscale to 320×180 (or 48×48) with **nearest-neighbor only**, then quantize to the palette in section 2 using Aseprite or `ImageMagick -dither None -remap palette.png`.
- Generate **three test images first** (tea room at golden hour, shrine at afternoon, station at dusk). If they don't feel like the same game, iterate on section 1 before generating any production assets.
- When a scene reuses a location (all `minshuku-*` scenes), generate the **room set once** and reuse the background — only regenerate characters and lighting.
- If ChatGPT drifts off-model, re-paste section 1 and add: *"Match this style bible exactly. Previous output was too smooth / too saturated / had anti-aliasing — fix."*
