const FACE_SEARCH_STORAGE_PREFIX = 'photogrid:public-face-search';

export interface StoredPublicFaceSearch {
  photoIds: string[];
  savedAt: number;
}

export function publicFaceSearchStorageKey(studioId: string): string {
  return `${FACE_SEARCH_STORAGE_PREFIX}:${studioId}`;
}
