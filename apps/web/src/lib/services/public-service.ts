import {
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore';

import { effectiveVisibility } from '@photogrid/config';

import {
  albumDoc,
  albumsCollection,
  galleriesCollection,
  galleryDoc,
  photosCollection,
  slugDoc,
  studioDoc,
} from '@/lib/firebase/firestore';
import type {
  AlbumDoc,
  GalleryDoc,
  PhotoDoc,
  StudioDoc,
} from '@/types';

/**
 * Server-safe one-shot reads used by the public storefront route segments.
 * All collections involved are open for public read (`if true`) in
 * firestore.rules — visibility is enforced here, in the app layer:
 *
 *   - `fetchPublicGalleries` (the studio list-view) returns galleries
 *     that are either `public` themselves OR have at least one
 *     `public` album inside. The latter case ("passthrough") lets a
 *     photographer keep the parent gallery private while still
 *     publishing select albums on the storefront.
 *   - `fetchPublicAlbums` returns only `public` albums.
 *   - `fetchPublicGalleryWithAccess` / `fetchPublicAlbum` (detail-views)
 *     return `public` and `unlisted` (link holders can open them), but
 *     never `private` ones — except `fetchPublicGalleryWithAccess` will
 *     still resolve a `private` gallery in "albums-only" mode when at
 *     least one of its albums is public.
 */

/**
 * Aggregated card model used by the studio storefront. Wraps a
 * `GalleryDoc` with two derived fields that depend on cross-collection
 * state, computed once on the server and passed straight to the page.
 */
export interface PublicGalleryCard {
  gallery: GalleryDoc;
  /**
   * Cover image to show on the studio storefront. For fully-public
   * galleries this is `gallery.coverPhotoUrl`. For "passthrough"
   * galleries (private/unlisted but exposed because they contain a
   * public album), we use the public album's own cover instead — the
   * gallery's own cover could otherwise leak a non-public photo.
   */
  coverPhotoUrl: string | null;
  /** Number of photos visible from the storefront card. */
  publicPhotoCount: number;
  /** Number of `public` albums inside this gallery — what the visitor will see. */
  publicAlbumCount: number;
}

/**
 * Result of `fetchPublicGalleryWithAccess`. The `access` field tells
 * the gallery page how much it can render:
 *
 *   - `'full'`        — gallery is `public` or `unlisted`; the page
 *                       shows photos + public albums (current behaviour).
 *   - `'albums-only'` — gallery itself is `private` but contains at
 *                       least one `public` album. The page must NOT
 *                       render the gallery's own photos, only the
 *                       public albums section.
 */
export interface PublicGalleryAccess {
  gallery: GalleryDoc;
  access: 'full' | 'albums-only' | 'face-gated';
}

export interface PublicFaceSearchIndex {
  photos: PhotoDoc[];
  albums: AlbumDoc[];
  galleries: GalleryDoc[];
}

export async function fetchPublicStudioBySlug(slug: string): Promise<StudioDoc | null> {
  const slugSnap = await getDoc(slugDoc(slug.toLowerCase()));
  if (!slugSnap.exists()) return null;
  const studioId = slugSnap.data().studioId;
  if (!studioId) return null;
  const studioSnap = await getDoc(studioDoc(studioId));
  return studioSnap.exists() ? studioSnap.data() : null;
}

export async function fetchPublicGalleries(
  studioId: string,
): Promise<PublicGalleryCard[]> {
  // 1. All galleries for the studio, newest first.
  const galleriesSnap = await getDocs(
    query(
      galleriesCollection(),
      where('studioId', '==', studioId),
      orderBy('createdAt', 'desc'),
    ),
  );
  const galleries = galleriesSnap.docs.map((d) => d.data());

  // 2. All public albums for the studio in a single query. We need
  //    these both to (a) decide whether non-public galleries qualify
  //    as passthroughs and (b) source a safe cover image for them.
  const albumsSnap = await getDocs(
    query(
      albumsCollection(),
      where('studioId', '==', studioId),
      orderBy('createdAt', 'desc'),
    ),
  );
  const publicAlbums = albumsSnap.docs
    .map((d) => d.data())
    .filter((a) => effectiveVisibility(a.visibility) === 'public');

  // Index public albums by gallery for O(1) lookup below. Each entry
  // keeps the albums in the original creation order so the cover we
  // borrow is the most recent public album.
  const albumsByGallery = new Map<string, typeof publicAlbums>();
  for (const album of publicAlbums) {
    const bucket = albumsByGallery.get(album.galleryId) ?? [];
    bucket.push(album);
    albumsByGallery.set(album.galleryId, bucket);
  }

  // 3. Build the card list. Public galleries are always included;
  //    non-public galleries only when they have at least one public
  //    album inside (passthrough).
  const cards: PublicGalleryCard[] = [];
  for (const gallery of galleries) {
    const visibility = effectiveVisibility(gallery.visibility);
    const isListed = visibility === 'public' || visibility === 'face_gated';
    const albumsHere = albumsByGallery.get(gallery.id) ?? [];

    if (!isListed && albumsHere.length === 0) continue;

    const coverPhotoUrl = isListed
      ? gallery.coverPhotoUrl ?? albumsHere[0]?.coverPhotoUrl ?? null
      : albumsHere[0]?.coverPhotoUrl ?? null;
    const publicPhotoCount = isListed
      ? gallery.photoCount
      : new Set(albumsHere.flatMap((album) => album.photoIds)).size;

    cards.push({
      gallery,
      coverPhotoUrl,
      publicPhotoCount,
      publicAlbumCount: albumsHere.length,
    });
  }
  return cards;
}

export async function fetchPublicGalleryWithAccess(
  galleryId: string,
): Promise<PublicGalleryAccess | null> {
  const snap = await getDoc(galleryDoc(galleryId));
  if (!snap.exists()) return null;
  const gallery = snap.data();
  const visibility = effectiveVisibility(gallery.visibility);

  if (visibility === 'face_gated') {
    return { gallery, access: 'face-gated' };
  }

  // Public or unlisted: link holders see everything (photos + public
  // albums). This matches the original behaviour.
  if (visibility !== 'private') {
    return { gallery, access: 'full' };
  }

  // Private gallery: only render if at least one album is public. The
  // visitor will see ONLY that public album list — never the gallery's
  // own photos, since those weren't published.
  const publicAlbums = await fetchPublicAlbums(galleryId);
  if (publicAlbums.length === 0) return null;
  return { gallery, access: 'albums-only' };
}

/**
 * @deprecated Use `fetchPublicGalleryWithAccess` instead. Kept as a
 * thin wrapper for callers that don't need the access mode and are
 * happy with the legacy behaviour (404 when private).
 */
export async function fetchPublicGallery(galleryId: string): Promise<GalleryDoc | null> {
  const snap = await getDoc(galleryDoc(galleryId));
  if (!snap.exists()) return null;
  const data = snap.data();
  const visibility = effectiveVisibility(data.visibility);
  if (visibility === 'private' || visibility === 'face_gated') return null;
  return data;
}

export async function fetchPublicAlbums(galleryId: string): Promise<AlbumDoc[]> {
  const q = query(
    albumsCollection(),
    where('galleryId', '==', galleryId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data())
    .filter((a) => effectiveVisibility(a.visibility) === 'public');
}

export async function fetchPublicAlbum(albumId: string): Promise<AlbumDoc | null> {
  const snap = await getDoc(albumDoc(albumId));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (effectiveVisibility(data.visibility) === 'private') return null;
  return data;
}

/**
 * Fetch photos by id — used to materialise an album's `photoIds` array.
 * Firestore `in` is capped at 30 elements; we batch around that limit.
 */
export async function fetchPhotosByIds(ids: string[]): Promise<PhotoDoc[]> {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 30) {
    chunks.push(ids.slice(i, i + 30));
  }
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const q = query(photosCollection(), where('__name__', 'in', chunk));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data());
    }),
  );
  const flat = results.flat();
  const byId = new Map(flat.map((p) => [p.id, p]));
  // Preserve the original ordering from `ids`.
  return ids.map((id) => byId.get(id)).filter((p): p is PhotoDoc => Boolean(p));
}

export async function fetchPublicGalleryPhotos(galleryId: string): Promise<PhotoDoc[]> {
  const q = query(
    photosCollection(),
    where('galleryId', '==', galleryId),
    orderBy('createdAt', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export async function fetchPublicFaceSearchIndex(
  studioId: string,
): Promise<PublicFaceSearchIndex> {
  const galleriesSnap = await getDocs(
    query(galleriesCollection(), where('studioId', '==', studioId)),
  );
  const galleries = galleriesSnap.docs.map((d) => d.data());
  const publicGalleryIds = new Set(
    galleries
      .filter((gallery) => effectiveVisibility(gallery.visibility) === 'public')
      .map((gallery) => gallery.id),
  );

  const albumsSnap = await getDocs(
    query(albumsCollection(), where('studioId', '==', studioId)),
  );
  const publicAlbums = albumsSnap.docs
    .map((d) => d.data())
    .filter((album) => effectiveVisibility(album.visibility) === 'public');

  const allowedPhotoIds = new Set<string>();
  for (const album of publicAlbums) {
    (album.photoIds ?? []).forEach((photoId) => allowedPhotoIds.add(photoId));
  }

  const photosSnap = await getDocs(
    query(photosCollection(), where('studioId', '==', studioId)),
  );
  const photos = photosSnap.docs
    .map((d) => d.data())
    .filter(
      (photo) =>
        publicGalleryIds.has(photo.galleryId) || allowedPhotoIds.has(photo.id),
    );

  const galleryIdsWithSearchableContent = new Set([
    ...photos.map((photo) => photo.galleryId),
    ...publicAlbums.map((album) => album.galleryId),
  ]);
  const searchableGalleries = galleries.filter((gallery) =>
    galleryIdsWithSearchableContent.has(gallery.id),
  );

  return {
    photos,
    albums: publicAlbums,
    galleries: searchableGalleries,
  };
}
