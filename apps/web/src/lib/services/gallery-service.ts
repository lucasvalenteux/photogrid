import {
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import type { Visibility } from '@photogrid/config';

import { galleriesCollection, galleryDoc } from '@/lib/firebase/firestore';
import type { GalleryDoc } from '@/types';

export interface CreateGalleryInput {
  studioId: string;
  title: string;
  description?: string;
  visibility?: Visibility;
}

export interface UpdateGalleryInput {
  title: string;
  description?: string | null;
  visibility?: Visibility;
}

/**
 * Galleries are the top-level organising primitive — they own the actual
 * photos that the photographer uploads. Albums (the curated selections live
 * in `album-service.ts`) only reference photos inside the gallery, they
 * never own storage objects.
 */
export async function createGallery({
  studioId,
  title,
  description,
  visibility = 'public',
}: CreateGalleryInput): Promise<GalleryDoc> {
  const trimmed = title.trim();
  if (trimmed.length < 1) throw new Error('Dê um título à galeria.');

  const ref = doc(galleriesCollection());
  const payload: GalleryDoc = {
    id: ref.id,
    studioId,
    title: trimmed,
    description: description?.trim() || null,
    coverPhotoUrl: null,
    photoCount: 0,
    albumCount: 0,
    visibility,
    createdAt: new Date().toISOString(),
  };

  await setDoc(ref, {
    ...payload,
    createdAt: serverTimestamp(),
  });

  return payload;
}

export async function updateGallery(
  galleryId: string,
  input: UpdateGalleryInput,
): Promise<void> {
  const trimmedTitle = input.title.trim();
  if (!trimmedTitle) throw new Error('Dê um título à galeria.');
  const patch: Record<string, unknown> = {
    title: trimmedTitle,
    description: input.description?.trim() ? input.description.trim() : null,
  };
  if (input.visibility) patch.visibility = input.visibility;
  await updateDoc(galleryDoc(galleryId), patch);
}

export async function deleteGallery(galleryId: string): Promise<void> {
  await deleteDoc(galleryDoc(galleryId));
}

export async function getGallery(galleryId: string): Promise<GalleryDoc | null> {
  const snap = await getDoc(galleryDoc(galleryId));
  return snap.exists() ? snap.data() : null;
}

export interface ReconcileGalleryCountersInput {
  galleryId: string;
  /** Authoritative count of photos currently in the gallery. */
  photoCount: number;
  /** Authoritative count of albums currently in the gallery. */
  albumCount: number;
  /**
   * Authoritative cover URL — typically derived from the first photo in
   * creation order. Passing `null` clears the cover.
   */
  coverPhotoUrl: string | null;
  /** Current persisted values (so we can skip the write when in sync). */
  current: Pick<GalleryDoc, 'photoCount' | 'albumCount' | 'coverPhotoUrl'>;
}

/**
 * Self-healing reconciliation for the denormalised counters/cover on a
 * gallery. We rely on `increment(±1)` everywhere we mutate /photos and
 * /albums, but those calls can drift when:
 *
 *   - A race wrote duplicate /photos docs that were later cleaned up by
 *     a delete from the grid (only -1 is applied per delete, while the
 *     duplicates +N'd the counter on the way in).
 *   - A delete fails between Storage and Firestore (rare).
 *   - The cover was set from the latest upload but that photo was deleted.
 *
 * Anyone who opens the gallery detail page sees the real numbers; we
 * silently bring the persisted values back in line with reality. No-op
 * when everything already matches.
 */
export async function reconcileGalleryCounters({
  galleryId,
  photoCount,
  albumCount,
  coverPhotoUrl,
  current,
}: ReconcileGalleryCountersInput): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (current.photoCount !== photoCount) patch.photoCount = photoCount;
  if (current.albumCount !== albumCount) patch.albumCount = albumCount;
  if ((current.coverPhotoUrl ?? null) !== coverPhotoUrl) {
    patch.coverPhotoUrl = coverPhotoUrl;
  }
  if (Object.keys(patch).length === 0) return;
  try {
    await updateDoc(galleryDoc(galleryId), patch);
  } catch (error) {
    console.warn('[gallery] reconciliation failed', error);
  }
}

export function subscribeToGalleries(
  studioId: string,
  onChange: (galleries: GalleryDoc[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    galleriesCollection(),
    where('studioId', '==', studioId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data())),
    (error) => onError?.(error),
  );
}
