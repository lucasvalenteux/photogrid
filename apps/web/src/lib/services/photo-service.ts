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

import { deletePhotoObject, uploadPhoto } from '@/lib/firebase/storage';
import { galleryDoc, photoDoc, photosCollection } from '@/lib/firebase/firestore';
import type { PhotoDoc } from '@/types';

/** Maximum thumbnail edge in pixels — keeps grids fast without distorting the preview. */
const THUMBNAIL_MAX_EDGE = 640;
const THUMBNAIL_QUALITY = 0.82;

export interface UploadPhotoInput {
  studioId: string;
  galleryId: string;
  file: File;
  onProgress?: (progress: number) => void;
}

interface RasterMetadata {
  width: number;
  height: number;
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

async function createThumbnail(
  file: File,
): Promise<{ blob: Blob; meta: RasterMetadata } | null> {
  try {
    const img = await loadImageFromBlob(file);
    const aspect = img.width / img.height;
    const [w, h] =
      img.width >= img.height
        ? [Math.min(THUMBNAIL_MAX_EDGE, img.width), Math.min(THUMBNAIL_MAX_EDGE, img.width) / aspect]
        : [
            Math.min(THUMBNAIL_MAX_EDGE, img.height) * aspect,
            Math.min(THUMBNAIL_MAX_EDGE, img.height),
          ];

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w);
    canvas.height = Math.round(h);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', THUMBNAIL_QUALITY),
    );
    if (!blob) return null;

    return { blob, meta: { width: img.width, height: img.height } };
  } catch (error) {
    console.warn('[photo] thumbnail generation failed', error);
    return null;
  }
}

async function probeImage(file: File): Promise<RasterMetadata | null> {
  try {
    const img = await loadImageFromBlob(file);
    return { width: img.width, height: img.height };
  } catch {
    return null;
  }
}

/**
 * Upload + commit a single photo into a gallery:
 *   1. Generate a client-side thumbnail (best-effort).
 *   2. Upload original.
 *   3. Upload thumbnail.
 *   4. Write the Firestore /photos/{id} document.
 *   5. Bump gallery.photoCount + cover.
 */
export async function uploadAndCommitPhoto({
  studioId,
  galleryId,
  file,
  onProgress,
}: UploadPhotoInput): Promise<PhotoDoc> {
  const photoRef = doc(photosCollection());
  const photoId = photoRef.id;

  const thumb = await createThumbnail(file);
  const meta = thumb?.meta ?? (await probeImage(file));

  const original = await uploadPhoto({
    studioId,
    galleryId,
    photoId,
    file,
    fileName: file.name,
    variant: 'original',
    onProgress,
  });

  let thumbnail: { storagePath: string; downloadUrl: string } | null = null;
  if (thumb) {
    const result = await uploadPhoto({
      studioId,
      galleryId,
      photoId,
      file: thumb.blob,
      fileName: `${file.name.replace(/\.[^.]+$/, '')}.jpg`,
      variant: 'thumb',
    });
    thumbnail = { storagePath: result.storagePath, downloadUrl: result.downloadUrl };
  }

  const payload: PhotoDoc = {
    id: photoId,
    studioId,
    galleryId,
    imageUrl: original.downloadUrl,
    thumbnailUrl: thumbnail?.downloadUrl ?? null,
    storagePath: original.storagePath,
    thumbnailPath: thumbnail?.storagePath ?? null,
    width: meta?.width ?? null,
    height: meta?.height ?? null,
    bytes: original.bytes,
    contentType: original.contentType,
    fileName: file.name,
    createdAt: new Date().toISOString(),
  };

  await setDoc(photoRef, {
    ...payload,
    createdAt: serverTimestamp(),
  });

  const coverUrl = thumbnail?.downloadUrl ?? original.downloadUrl;

  // We optimistically +1 the counter and only seed the cover when there
  // isn't one yet. The detail page runs `reconcileGalleryCounters` so any
  // drift here (from concurrent uploads, partial failures, deletes) is
  // healed the next time the gallery is opened.
  try {
    const gallerySnap = await getDoc(galleryDoc(galleryId));
    const hasCover = gallerySnap.exists() && Boolean(gallerySnap.data().coverPhotoUrl);
    const patch: Record<string, unknown> = { photoCount: increment(1) };
    if (!hasCover) patch.coverPhotoUrl = coverUrl;
    await updateDoc(galleryDoc(galleryId), patch);
  } catch (error) {
    console.warn('[photo] failed to update gallery counters', error);
  }

  return payload;
}

export async function deletePhoto(photo: PhotoDoc): Promise<void> {
  await deleteDoc(photoDoc(photo.id));
  await Promise.all([
    deletePhotoObject(photo.storagePath),
    photo.thumbnailPath ? deletePhotoObject(photo.thumbnailPath) : Promise.resolve(),
  ]);
  // Decrement the counter. If the deleted photo was the gallery's cover, we
  // clear it — the detail page reconciler will re-pick a stable cover from
  // the remaining photos on the next mount.
  try {
    const gallerySnap = await getDoc(galleryDoc(photo.galleryId));
    const wasCover =
      gallerySnap.exists() &&
      [photo.thumbnailUrl, photo.imageUrl].includes(
        (gallerySnap.data().coverPhotoUrl as string | null) ?? '',
      );
    const patch: Record<string, unknown> = { photoCount: increment(-1) };
    if (wasCover) patch.coverPhotoUrl = null;
    await updateDoc(galleryDoc(photo.galleryId), patch);
  } catch (error) {
    console.warn('[photo] failed to decrement gallery counter', error);
  }
}

/** Live photos for a given gallery, oldest-first (creation order). */
export function subscribeToGalleryPhotos(
  galleryId: string,
  onChange: (photos: PhotoDoc[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    photosCollection(),
    where('galleryId', '==', galleryId),
    orderBy('createdAt', 'asc'),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data())),
    (error) => onError?.(error),
  );
}
