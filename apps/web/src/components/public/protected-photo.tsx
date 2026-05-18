'use client';

import * as React from 'react';

import { cn } from '@photogrid/ui';

import type { StudioSecuritySettings } from '@/types';

/**
 * Public-storefront image renderer with the three photographer-controlled
 * protection layers wired in:
 *
 *   1. `dimPhotos`        — lowers opacity + lays a faint dark gradient on
 *                          top so screenshots look noticeably dull.
 *   2. `watermark`        — tiles the studio name across the image at a
 *                          diagonal angle, with light/dark text shadows so
 *                          it stays legible on any background.
 *   3. `disableRightClick`— intercepts the context menu, drag-start, and
 *                          touch long-press, AND switches the wrapping
 *                          element from a link (which would expose the
 *                          raw image URL) to a plain div.
 *
 * Each layer is opt-in and stacks cleanly with the others.  All three off
 * gives the original "click to open in new tab" behaviour for backwards
 * compatibility with studios that haven't visited the settings page yet.
 */

export interface ProtectedPhotoProps {
  /** Image source — typically a Firebase Storage thumbnail URL. */
  src: string;
  /**
   * Full-res URL — opened in a new tab when `interactive === 'full-image'`
   * and the right-click block is off. Ignored for cover-style usage.
   */
  fullSrc?: string;
  alt: string;
  studioName: string;
  security: Required<StudioSecuritySettings>;
  /**
   * How the photo behaves when clicked:
   *   - `'full-image'` (default) — wraps the image in an `<a>` that opens
   *     the full-res file in a new tab. Suppressed when right-click is
   *     disabled, since exposing the raw URL would defeat the purpose.
   *   - `'none'` — render just the image + overlays. Use this for cover
   *     thumbnails where the caller wraps the component in its own
   *     `<Link>` to a route (not a raw image URL).
   */
  interactive?: 'full-image' | 'none';
  /** Tailwind aspect class override — defaults to `aspect-square`. */
  aspect?: string;
  /** Optional extra className appended to the outer `<figure>`. */
  className?: string;
  /** Override the image's object fit (defaults to `cover`). */
  fit?: 'cover' | 'contain';
}

export function ProtectedPhoto({
  src,
  fullSrc,
  alt,
  studioName,
  security,
  interactive = 'full-image',
  aspect = 'aspect-square',
  className,
  fit = 'cover',
}: ProtectedPhotoProps) {
  const { dimPhotos, watermark, disableRightClick, antiAi } = security;

  // Block context menu + drag at the wrapper level. We intentionally
  // *don't* try to block keyboard shortcuts or DevTools — that's a
  // cat-and-mouse game we can't win, and the goal here is friction
  // against casual visitors, not bulletproof DRM.
  const blockMouse = (event: React.MouseEvent) => {
    if (disableRightClick) event.preventDefault();
  };
  const blockDrag = (event: React.DragEvent) => {
    if (disableRightClick) event.preventDefault();
  };

  const imageClasses = cn(
    'h-full w-full transition-transform duration-300',
    fit === 'cover' ? 'object-cover' : 'object-contain',
    // Group-hover scale is only applied when the photo is inside a
    // hover-aware ancestor (e.g. a CoverCard). The transition class is
    // a no-op otherwise — cheap to leave in.
    'group-hover:scale-[1.02]',
    dimPhotos && 'opacity-80',
    disableRightClick && 'pointer-events-none select-none',
  );

  // Build the image element once and reuse it inside either an <a> or
  // a plain wrapper depending on the studio's click-through policy.
  const image = (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={!disableRightClick}
      onContextMenu={blockMouse}
      onDragStart={blockDrag}
      className={imageClasses}
    />
  );

  const wrapInLink =
    interactive === 'full-image' && !disableRightClick && Boolean(fullSrc);

  return (
    <figure
      className={cn(
        'group relative overflow-hidden rounded-lg bg-muted',
        aspect,
        disableRightClick && 'select-none',
        className,
      )}
      onContextMenu={blockMouse}
      onDragStart={blockDrag}
    >
      {wrapInLink ? (
        <a
          href={fullSrc}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Abrir ${alt} em nova aba`}
          className="block h-full w-full"
        >
          {image}
        </a>
      ) : (
        image
      )}

      {dimPhotos ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/25"
        />
      ) : null}

      {watermark ? <WatermarkOverlay studioName={studioName} /> : null}

      {antiAi ? <AntiAiNoiseOverlay /> : null}
    </figure>
  );
}

/**
 * Tiled diagonal watermark with the studio name.
 *
 * Design goals:
 *   - The studio name has to be *readable*. The earlier 5×7 grid packed
 *     so many copies into a typical landscape thumbnail that they
 *     overlapped each other after rotation and the text turned into
 *     visual noise.
 *   - Still cover enough of the photo that a casual screenshot won't
 *     come out clean.
 *
 * The 3×4 layout below gives each repetition real breathing room while
 * still placing a watermark across the focal area of any aspect ratio
 * we ship (square thumbnails, 5/4 covers, portrait phone shots, etc.).
 */
function WatermarkOverlay({ studioName }: { studioName: string }) {
  const cells = Array.from({ length: 12 });
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -rotate-[20deg] scale-125"
    >
      <div className="grid h-full w-full grid-cols-3 grid-rows-4 place-items-center gap-0">
        {cells.map((_, index) => (
          <span
            key={index}
            className="select-none whitespace-nowrap text-xs font-semibold uppercase tracking-[0.22em] text-white/70 [text-shadow:0_1px_2px_rgba(0,0,0,0.55)] sm:text-sm"
          >
            © {studioName}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Procedural noise overlay used by the anti-AI mode.
 *
 * We use an inline SVG `<feTurbulence>` filter rendered into a tile —
 * the browser computes the noise locally, so there's no network cost
 * and no per-image processing on our side. The pattern is mostly black
 * with low alpha, so on screen it reads as a very subtle film grain
 * (similar to ISO 1600 grain).
 *
 * What this buys us against AI:
 *   - Screenshots capture the noise pattern, since it's a real CSS
 *     layer rendered above the photo.
 *   - When the screenshot is fed into a generative model and asked to
 *     "remove watermark and upscale", denoisers either preserve the
 *     pattern (defeating the upscale) or smear it (visible artefacts
 *     around faces and edges).
 *   - The fractal turbulence frequency is intentionally close to the
 *     frequency band that diffusion/super-res models hallucinate over,
 *     making the artefacts worse the harder the model tries.
 */
function AntiAiNoiseOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 mix-blend-overlay"
      style={{
        opacity: 0.22,
        backgroundImage: `url("${NOISE_DATA_URL}")`,
        backgroundSize: '180px 180px',
        backgroundRepeat: 'repeat',
      }}
    />
  );
}

// 180×180 tile of fractal noise. Two octaves keep the pattern detailed
// without making the data URL too long. The feColorMatrix collapses the
// noise into a single alpha channel so it tints with the photo below
// (via `mix-blend-overlay`) rather than washing it out.
const NOISE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'>
  <filter id='n'>
    <feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch' seed='7'/>
    <feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0'/>
  </filter>
  <rect width='100%' height='100%' filter='url(#n)'/>
</svg>`;

const NOISE_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(NOISE_SVG)}`;
