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
 *   - `fetchPublicGalleries` / `fetchPublicAlbums` (the list-views) return
 *     only `public` entities.
 *   - `fetchPublicGallery` / `fetchPublicAlbum` (the detail-views) return
 *     `public` and `unlisted` (link holders can open them), but never
 *     `private` ones — callers should treat null as a 404.
 */

export async function fetchPublicStudioBySlug(slug: string): Promise<StudioDoc | null> {
  const slugSnap = await getDoc(slugDoc(slug.toLowerCase()));
  if (!slugSnap.exists()) return null;
  const studioId = slugSnap.data().studioId;
  if (!studioId) return null;
  const studioSnap = await getDoc(studioDoc(studioId));
  return studioSnap.exists() ? studioSnap.data() : null;
}

export async function fetchPublicGalleries(studioId: string): Promise<GalleryDoc[]> {
  const q = query(
    galleriesCollection(),
    where('studioId', '==', studioId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data())
    .filter((g) => effectiveVisibility(g.visibility) === 'public');
}

export async function fetchPublicGallery(galleryId: string): Promise<GalleryDoc | null> {
  const snap = await getDoc(galleryDoc(galleryId));
  if (!snap.exists()) return null;
  const data = snap.data();
  // `private` entities are inaccessible to the public regardless of how the
  // visitor obtained the link.
  if (effectiveVisibility(data.visibility) === 'private') return null;
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
