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
