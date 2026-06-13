# Story tour scene art (`/story`)

Drop your ChatGPT-generated scene images here and the presenter tour at `/story`
swaps them in automatically. Until then, each beat renders a tasteful
washi-toned placeholder (same pattern as the audio assets), so the tour is fully
presentable with this directory empty.

## Expected filenames

The tour looks for one `.webp` per beat, by exact basename:

| Beat | Drop in | Scene |
|------|---------|-------|
| 0 — Intro | `00-minshuku-dusk.webp` | Guesthouse exterior at dusk, warm windows, lanterns |
| 1 — Day 1, The Café | `01-cafe.webp` | Small-town café at evening, a regular, rain at the window |
| 2 — Day 2, The Night Road | `02-night-road.webp` | Dark road at the town's edge, a lone stranger, first rain |
| 3 — Day 3, The Bookshop | `03-bookshop.webp` | Dim riverside bookshop, owner wrapping a book, lamplight |
| 4 — Day 4, Home at the Minshuku | `04-minshuku-mom.webp` | Lamplit genkan, Mom welcoming the traveler, the wrapped book |
| 5 — Outro | `05-ladder.webp` *(optional)* | Knowledge ladder — or skip and let the in-app chart render |

## Specs

- **Aspect ratio:** 16:9 (the slot box is fixed at intrinsic 1600×900, so any
  ratio loads with zero layout shift, but 16:9 fills the box without cropping).
- **Target size:** ~1600×900, keep each under ~400 KB.
- **Format:** `.webp` (the basenames above are what the tour requests). If you
  must use `.png`/`.jpg`, re-export to `.webp` — the slot only requests `.webp`.
- **Art direction (keep consistent across all six):** painterly, warm,
  *民宿 evening* palette — washi-cream, persimmon, indigo, lamplight. Soft
  storybook / anime-watercolour feel (Ghibli-adjacent quiet interiors), never
  photorealistic. A young traveller seen from behind or in soft focus so they
  read as "you." Generous negative space at the top or one side for text.

See `DEMO-STORYLINE.md` (repo root) for the full per-beat prompt seeds.
