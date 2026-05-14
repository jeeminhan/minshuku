# Art Generation Workflow

Follow these steps every time you generate new art for *minshuku*.

## Step 1 — Use the style bible

Open `public/art/style-bible.md`. Every ChatGPT image-generation message must start with **Section 1 (the Master Style Paragraph)** pasted verbatim, followed by a filled-in **Section 4 (scene)** or **Section 5 (portrait)** template. Never send an image prompt without the bible prefix.

## Step 2 — Save the locked palette

Save the palette from `style-bible.md` Section 2 as `public/art/palette.gpl` in Aseprite/GIMP format. If you don't have it yet, paste Section 2 into ChatGPT and ask:

> Convert this palette to GIMP `.gpl` format. Output only the file contents, ready to save.

Commit `palette.gpl` to the repo. Every post-processed image must quantize to this exact palette — no improvised colors.

## Step 3 — Generate 3 test images first

Before generating any production assets, generate these three:

1. **Minshuku tea room at golden hour** — interior, no characters, focal point on steaming teacups.
2. **Shrine at afternoon** — stone torii, mossy steps, dappled cedar light, no characters.
3. **Rural JR station at dusk** — single platform, vending machine glow, lone silhouette.

Put them side by side. If they don't feel like the same game (palette drift, inconsistent perspective, mismatched mood), **stop and iterate on the bible** — adjust Section 1, regenerate, repeat. Do not start producing scene assets until the three test images are visually coherent.

## Step 4 — Post-process every image

ChatGPT outputs anti-aliased *fake* pixel art. Every image must go through:

1. **Downscale** to target resolution (320×180 for scenes, 48×48 for portraits) using **nearest-neighbor only** — no bilinear, no Lanczos.
2. **Quantize** to `palette.gpl` so colors snap to the locked set.

Either tool works:

- **Aseprite**: open the image → Sprite → Sprite Size (nearest neighbor) → Sprite → Color Mode → Indexed (using `palette.gpl`).
- **ImageMagick** one-liner:
  ```bash
  magick input.png -filter point -resize 320x180 -dither None -remap palette.png output.png
  ```

Never commit a raw ChatGPT output as a final asset — always the post-processed version.

## File layout

```
public/art/
  style-bible.md          # the bible — Section 1 is the prompt prefix
  style-bible-prompt.md   # original prompt used to generate the bible
  palette.gpl             # locked palette for quantization
  WORKFLOW.md             # this file
  hero/                   # homepage hero, logo, OG image, favicon
  ui/                     # dialogue box, buttons, frames
  scenes/<scene-id>/
    bg.png                # post-processed 320×180 background
    portraits/<npc>.png   # post-processed 48×48 portraits
```
