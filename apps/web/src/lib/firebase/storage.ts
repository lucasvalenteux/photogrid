import { STORAGE_PATHS } from '@photogrid/config';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type UploadTaskSnapshot,
} from 'firebase/storage';

import { storage } from './client';

export interface UploadPhotoOptions {
  studioId: string;
  galleryId: string;
  photoId: string;
  file: Blob;
  fileName: string;
  /** Defaults to `original`. Use `thumb` to upload the thumbnail variant. */
  variant?: 'original' | 'thumb';
  onProgress?: (progress: number) => void;
}

export interface UploadResult {
  storagePath: string;
  downloadUrl: string;
  bytes: number;
  contentType: string;
}

function buildPath({
  studioId,
  galleryId,
  photoId,
  variant = 'original',
  fileName,
}: Pick<UploadPhotoOptions, 'studioId' | 'galleryId' | 'photoId' | 'variant'> & {
  fileName: string;
}): string {
  const base = STORAGE_PATHS.photo(studioId, galleryId, photoId);
  return `${base}/${variant}-${fileName}`;
}

/**
 * Resumable upload of a single image blob. Caller decides whether the blob is
 * the original or a thumbnail variant; both variants land under the same
 * `photos/{photoId}/` folder so deletes can wipe everything at once.
 */
export function uploadPhoto({
  studioId,
  galleryId,
  photoId,
  file,
  fileName,
  variant = 'original',
  onProgress,
}: UploadPhotoOptions): Promise<UploadResult> {
  const storagePath = buildPath({ studioId, galleryId, photoId, variant, fileName });
  const storageRef = ref(storage, storagePath);
  const contentType = (file as File).type || 'application/octet-stream';
  const task = uploadBytesResumable(storageRef, file, { contentType });

  return new Promise<UploadResult>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot: UploadTaskSnapshot) => {
        if (onProgress) {
          const progress = snapshot.totalBytes
            ? snapshot.bytesTransferred / snapshot.totalBytes
            : 0;
          onProgress(progress);
        }
      },
      (error) => reject(error),
      async () => {
        try {
          const downloadUrl = await getDownloadURL(task.snapshot.ref);
          resolve({
            storagePath,
            downloadUrl,
            bytes: task.snapshot.totalBytes,
            contentType,
          });
        } catch (error) {
          reject(error);
        }
      },
    );
  });
}

/** Best-effort delete; silently no-ops on missing object. */
export async function deletePhotoObject(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage, path));
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'storage/object-not-found') return;
    throw error;
  }
}

export interface UploadStudioLogoResult {
  storagePath: string;
  downloadUrl: string;
}

/**
 * Upload a studio logo to `studios/{studioId}/logo-{ts}.{ext}`. The
 * timestamp suffix gives us cache-busting (a fresh download URL each
 * time) and lets the caller delete the previous logo by its
 * `logoStoragePath` without race conditions.
 *
 * Caller is expected to have already done the client-side resize/crop —
 * we just push the bytes. The Storage rules cap writes at 25 MB and
 * `image/*`, both of which the caller validates ahead of time for
 * better UX.
 */
export async function uploadStudioLogo({
  studioId,
  blob,
  extension,
}: {
  studioId: string;
  blob: Blob;
  /** File extension without dot — e.g. "jpg". */
  extension: string;
}): Promise<UploadStudioLogoResult> {
  const safeExt = extension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
  const storagePath = `studios/${studioId}/logo-${Date.now()}.${safeExt}`;
  const storageRef = ref(storage, storagePath);
  const contentType = blob.type || `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`;
  // Non-resumable: logos are <30 KB after the canvas resize, so the
  // overhead of resumable uploads (chunking, state metadata) isn't worth it.
  const { uploadBytes } = await import('firebase/storage');
  await uploadBytes(storageRef, blob, { contentType });
  const downloadUrl = await getDownloadURL(storageRef);
  return { storagePath, downloadUrl };
}

/** Best-effort delete of a studio logo. Silently no-ops on missing object. */
export async function deleteStudioLogo(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage, path));
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'storage/object-not-found') return;
    throw error;
  }
}
