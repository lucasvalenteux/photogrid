const GALLERY_FACE_SEARCH_PREFIX = 'photogrid:gallery-face-search';

export interface StoredGalleryFaceSearch {
  photoIds: string[];
  savedAt: number;
}

export function galleryFaceSearchStorageKey(galleryId: string): string {
  return `${GALLERY_FACE_SEARCH_PREFIX}:${galleryId}`;
}
