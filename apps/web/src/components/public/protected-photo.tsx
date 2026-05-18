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
  const { dimPhotos, watermark, disableRightClick } = security;

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
    </figure>
  );
}

/**
 * Tiled diagonal watermark with the studio name. Implemented with a
 * single absolutely-positioned grid so the tile density adapts to the
 * container's natural aspect ratio without media queries.
 */
function WatermarkOverlay({ studioName }: { studioName: string }) {
  // 5×7 grid is dense enough to survive moderate crops while still
  // leaving room for the photo to breathe. Each cell renders the same
  // text — the visual variety comes from rotation + the underlying
  // photo, not from per-cell tweaks.
  const cells = Array.from({ length: 35 });
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -rotate-[18deg] scale-125"
    >
      <div className="grid h-full w-full grid-cols-5 grid-rows-7 place-items-center gap-0">
        {cells.map((_, index) => (
          <span
            key={index}
            className="select-none whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.18em] text-white/55 [text-shadow:0_1px_2px_rgba(0,0,0,0.45)] sm:text-xs"
          >
            © {studioName}
          </span>
        ))}
      </div>
    </div>
  );
}
