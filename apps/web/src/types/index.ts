/**
 * Domain types shared across the web app.
 *
 * Hierarchy:
 *   studio → gallery → photo            (photos live in galleries)
 *                 └─→ album → photoIds  (curated selections, referencing photos)
 */

import type { Visibility } from '@photogrid/config';

export interface UserDoc {
  id: string;
  email: string;
  studioId: string | null;
  createdAt: string;
}

/**
 * Per-studio photo-protection toggles. Every flag defaults to `false`
 * (no protection) for backwards compatibility — see
 * `effectiveStudioSecurity` for the canonical reader.
 *
 * These settings only affect the **public storefront**. The owner's
 * dashboard always shows clean, undimmed photos so editing decisions
 * aren't compromised.
 */
export interface StudioSecuritySettings {
  /** Dims photos with a CSS opacity reduction + dark overlay. */
  dimPhotos?: boolean;
  /** Tiled watermark with the studio name across each photo. */
  watermark?: boolean;
  /**
   * Disables the browser context menu, image drag, and the click-through
   * link that exposes the raw image URL.
   */
  disableRightClick?: boolean;
  /**
   * Anti-AI defenses for users who screenshot the gallery and try to
   * "remove watermark / upscale" via generative AI. Stacks two layers:
   *   1. A procedural noise overlay (SVG fractal turbulence) that
   *      survives screenshots and produces visible artefacts when an
   *      inpainting model tries to clean it up.
   *   2. An extra horizontal watermark band on top of the diagonal one,
   *      making the text harder to inpaint out cleanly.
   *
   * Also opts the storefront into `robots.txt` / `noai` / `noimageai`
   * directives so well-behaved AI crawlers (GPTBot, CCBot, Claude-Web,
   * Google-Extended, etc.) won't ingest the photos for training.
   */
  antiAi?: boolean;
}

export interface StudioDoc {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  /**
   * Whether automatic face detection / album suggestions run for this
   * studio. Optional for backwards compatibility — undefined is treated
   * as `true` by `effectiveFaceClusteringEnabled`.
   */
  faceClusteringEnabled?: boolean;
  /** Public storefront photo-protection toggles. */
  security?: StudioSecuritySettings;
  createdAt: string;
}

/**
 * Backwards-compatible reader for the studio's face-clustering preference.
 * Treats missing values as enabled so existing studios keep behaving the
 * way they did before the toggle existed.
 */
export function effectiveFaceClusteringEnabled(
  studio: Pick<StudioDoc, 'faceClusteringEnabled'> | null | undefined,
): boolean {
  if (!studio) return true;
  return studio.faceClusteringEnabled !== false;
}

/**
 * Resolve a studio's photo-protection settings to a fully-populated
 * object with explicit booleans. Lets callers destructure safely
 * without `?? false` everywhere they read a flag.
 */
export function effectiveStudioSecurity(
  studio: Pick<StudioDoc, 'security'> | null | undefined,
): Required<StudioSecuritySettings> {
  const s = studio?.security ?? {};
  return {
    dimPhotos: s.dimPhotos === true,
    watermark: s.watermark === true,
    disableRightClick: s.disableRightClick === true,
    antiAi: s.antiAi === true,
  };
}

export interface GalleryDoc {
  id: string;
  studioId: string;
  title: string;
  description?: string | null;
  coverPhotoUrl?: string | null;
  /** Total photos uploaded to this gallery. */
  photoCount: number;
  /** Total albums (selections) created from this gallery. */
  albumCount: number;
  /**
   * Access level. Optional for backwards compatibility — undefined is
   * interpreted as `public` by `effectiveVisibility`.
   */
  visibility?: Visibility;
  createdAt: string;
}

export interface AlbumDoc {
  id: string;
  studioId: string;
  galleryId: string;
  /** Display name — typically the client's name (e.g. "Família Silva"). */
  title: string;
  subjectName?: string | null;
  coverPhotoUrl?: string | null;
  /**
   * References to photos in the parent gallery that belong to this album.
   * Order is preserved and used for display.
   */
  photoIds: string[];
  /** Access level — see GalleryDoc.visibility. */
  visibility?: Visibility;
  createdAt: string;
}

export interface PhotoDoc {
  id: string;
  studioId: string;
  galleryId: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  storagePath: string;
  thumbnailPath: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  contentType: string | null;
  fileName: string;
  createdAt: string;
}

export interface SlugReservation {
  slug: string;
  studioId: string;
  ownerId: string;
  createdAt: string;
}

/**
 * A visual "person" inside a gallery — produced by InsightFace clustering
 * on the FastAPI backend. Open clusters appear as album suggestions; once
 * the photographer promotes one, status flips to `promoted` and `albumId`
 * points at the freshly-created album.
 */
export type FaceClusterStatus = 'open' | 'promoted' | 'dismissed';

export interface FaceClusterDoc {
  id: string;
  galleryId: string;
  studioId: string;
  centroid: number[];
  photoCount: number;
  photoIds: string[];
  representativePhotoId: string | null;
  representativePhotoUrl: string | null;
  representativeThumbnailUrl: string | null;
  /** Bounding box on the representative photo: [x1, y1, x2, y2] in pixels. */
  representativeBbox: number[] | null;
  representativeScore: number;
  status: FaceClusterStatus;
  albumId: string | null;
  createdAt: string;
  updatedAt: string;
}
