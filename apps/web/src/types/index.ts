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

export interface StudioDoc {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  createdAt: string;
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
