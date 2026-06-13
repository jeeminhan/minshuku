"use client";

import { useState } from "react";

interface SceneImageProps {
  // Image slot basename, e.g. "01-cafe" → /story/01-cafe.webp.
  slot: string;
  // Alt text / placeholder caption.
  caption: string;
  // Whether a real .webp exists on disk for this slot (server-detected). When
  // false (this contract's shipped state — empty public/story/) the <img> is
  // never mounted, so the page fires no image 404s; the placeholder is the
  // whole render.
  hasImage: boolean;
}

// A fixed 16:9 scene-image box (intrinsic 1600×900 → zero layout shift whether
// the real art is present or not). The user has generated NO art yet, so the
// default render is a washi-toned placeholder using the 民宿 palette; when a
// real /story/<slot>.webp is dropped in, it loads on top of the placeholder.
// The <img> uses loading="lazy" and is only mounted when the file actually
// exists, so an empty public/story/ produces zero /story/* requests.
const INTRINSIC_WIDTH = 1600;
const INTRINSIC_HEIGHT = 900;

export function SceneImage({ slot, caption, hasImage }: SceneImageProps) {
  const [loaded, setLoaded] = useState(false);
  const src = `/story/${slot}.webp`;

  return (
    <figure
      data-testid="scene-image"
      data-slot={slot}
      style={{ aspectRatio: `${INTRINSIC_WIDTH} / ${INTRINSIC_HEIGHT}` }}
      className="relative w-full overflow-hidden rounded-lg border border-washi-deep shadow-[var(--shadow-card)]"
    >
      {/* Washi-toned placeholder — the default render, shown until (and if) real
          art loads. Uses the 民宿 palette tokens so an empty public/story/ is
          fully presentable. */}
      <div
        data-testid="scene-placeholder"
        aria-hidden={loaded}
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[linear-gradient(135deg,var(--color-washi-deep),var(--color-kaki-wash)_55%,var(--color-aizome-wash))] px-6 text-center"
      >
        <span className="font-display text-sm font-medium tracking-[0.18em] text-kaki-deep uppercase">
          <span lang="ja" className="mr-2 tracking-normal normal-case">
            民宿
          </span>
          scene
        </span>
        <span className="text-sm text-ink-soft">{caption}</span>
        <code className="rounded-full border border-washi-deep bg-shoji/70 px-2.5 py-0.5 text-[0.7rem] tracking-[0.06em] text-ink-soft">
          {slot}.webp
        </code>
      </div>
      {hasImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={caption}
          width={INTRINSIC_WIDTH}
          height={INTRINSIC_HEIGHT}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          // Hidden until it actually loads — a missing file (the default this
          // round) never shows a broken-image glyph over the placeholder.
          style={{ opacity: loaded ? 1 : 0 }}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
        />
      )}
    </figure>
  );
}
