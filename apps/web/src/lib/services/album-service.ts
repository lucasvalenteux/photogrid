import {
  deleteDoc,
  doc,
  getDoc,
  increment,
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

import { albumDoc, albumsCollection, galleryDoc } from '@/lib/firebase/firestore';
import type { AlbumDoc, PhotoDoc } from '@/types';

export interface CreateAlbumInput {
  studioId: string;
  galleryId: string;
  /** Display title — typically the client's / family's / student's name. */
  title: string;
  visibility?: Visibility;
}

export interface UpdateAlbumInput {
  title: string;
  visibility?: Visibility;
}

/**
 * Albums are curated selections inside a gallery. Each album owns no storage
 * — only a `photoIds` array pointing at photos in its parent gallery. This
 * lets photographers pick a subset to deliver / sell to a specific client
 * without duplicating files.
 */
export async function createAlbum({
  studioId,
  galleryId,
  title,
  visibility = 'unlisted',
}: CreateAlbumInput): Promise<AlbumDoc> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error('Informe o nome do cliente.');

  const ref = doc(albumsCollection());
  const payload: AlbumDoc = {
    id: ref.id,
    studioId,
    galleryId,
    title: trimmed,
    subjectName: trimmed,
    coverPhotoUrl: null,
    photoIds: [],
    visibility,
    createdAt: new Date().toISOString(),
  };

  await setDoc(ref, {
    ...payload,
    createdAt: serverTimestamp(),
  });

  try {
    await updateDoc(galleryDoc(galleryId), { albumCount: increment(1) });
  } catch (error) {
    console.warn('[album] failed to bump gallery.albumCount', error);
  }

  return payload;
}

export async function updateAlbum(albumId: string, input: UpdateAlbumInput): Promise<void> {
  const trimmed = input.title.trim();
  if (!trimmed) throw new Error('Informe o nome do cliente.');
  const patch: Record<string, unknown> = {
    title: trimmed,
    subjectName: trimmed,
  };
  if (input.visibility) patch.visibility = input.visibility;
  await updateDoc(albumDoc(albumId), patch);
}

export async function deleteAlbum(albumId: string, galleryId: string): Promise<void> {
  await deleteDoc(albumDoc(albumId));
  try {
    await updateDoc(galleryDoc(galleryId), { albumCount: increment(-1) });
  } catch (error) {
    console.warn('[album] failed to decrement gallery.albumCount', error);
  }
}

export async function getAlbum(albumId: string): Promise<AlbumDoc | null> {
  const snap = await getDoc(albumDoc(albumId));
  return snap.exists() ? snap.data() : null;
}

export interface SetAlbumPhotosInput {
  albumId: string;
  photoIds: string[];
  /**
   * Photo objects keyed by id — used to derive a cover image without an
   * extra read. Optional; if absent, `coverPhotoUrl` is just cleared.
   */
  galleryPhotos: PhotoDoc[];
}

/**
 * Replace the album's photo selection. Keeps `coverPhotoUrl` in sync with
 * the first selected photo so list views stay accurate.
 */
export async function setAlbumPhotos({
  albumId,
  photoIds,
  galleryPhotos,
}: SetAlbumPhotosInput): Promise<void> {
  const first = photoIds[0];
  const cover = first
    ? galleryPhotos.find((p) => p.id === first)
    : undefined;
  const coverUrl = cover?.thumbnailUrl ?? cover?.imageUrl ?? null;

  await updateDoc(albumDoc(albumId), {
    photoIds,
    coverPhotoUrl: coverUrl,
  });
}

export function subscribeToAlbums(
  galleryId: string,
  onChange: (albums: AlbumDoc[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    albumsCollection(),
    where('galleryId', '==', galleryId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data())),
    (error) => onError?.(error),
  );
}
