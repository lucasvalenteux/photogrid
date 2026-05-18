/**
 * Global brand & product constants for Photogrid.
 * Keep all magic strings here so the product stays consistent across surfaces.
 */

export const APP_NAME = 'Photogrid' as const;
export const APP_TAGLINE = 'Where photographers host and sell their work.' as const;
export const APP_DOMAIN = 'photogrid.store' as const;
export const APP_URL = `https://${APP_DOMAIN}` as const;
export const SUPPORT_EMAIL = 'hello@photogrid.store' as const;

export const FIRESTORE_COLLECTIONS = {
  users: 'users',
  studios: 'studios',
  slugs: 'slugs',
  /**
   * Two-tier content model:
   *
   *   studio ─┐
   *           ├── gallery   (e.g. "Colégio Santa Maria — 2026")
   *           │   ├── photo (uploaded *into* the gallery)
   *           │   └── album (a curated selection of photos from the gallery,
   *           │              e.g. "Família Silva · 24 fotos") — shared with
   *           │              the client as the unit of sale.
   *           └── gallery …
   *
   * Photos belong to the gallery, not to an album. An album is a saved
   * selection: it holds a `photoIds` array referencing photos in its parent
   * gallery. A photo can live in multiple albums.
   */
  galleries: 'galleries',
  albums: 'albums',
  photos: 'photos',
  // Face-clustering collections — written exclusively by the FastAPI
  // backend (Firebase Admin SDK bypasses Firestore rules). The web app
  // only reads.
  faceClusters: 'faceClusters',
  photoFaces: 'photoFaces',
} as const;

export type FirestoreCollection =
  (typeof FIRESTORE_COLLECTIONS)[keyof typeof FIRESTORE_COLLECTIONS];

export const STORAGE_PATHS = {
  studio: (studioId: string) => `studios/${studioId}`,
  gallery: (studioId: string, galleryId: string) =>
    `studios/${studioId}/galleries/${galleryId}`,
  /**
   * Photos always live under the gallery — albums never own storage objects,
   * only references.
   */
  photo: (studioId: string, galleryId: string, photoId: string) =>
    `studios/${studioId}/galleries/${galleryId}/photos/${photoId}`,
} as const;

/**
 * Visibility levels for galleries and albums.
 *
 *   public   — appears on the studio home and is reachable by direct link.
 *   unlisted — does not show up in any public listing, but anyone holding
 *              the direct link can open it. Useful for "soft" shares.
 *   private  — only owners may view. Public requests return 404, even with
 *              the direct link.
 *
 * Existing docs without an explicit `visibility` field are treated as
 * `public` for backwards compatibility (see `effectiveVisibility`).
 */
export const VISIBILITY_LEVELS = ['public', 'unlisted', 'private'] as const;
export type Visibility = (typeof VISIBILITY_LEVELS)[number];

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: 'Público',
  unlisted: 'Apenas com link',
  private: 'Privado',
};

export const VISIBILITY_DESCRIPTIONS: Record<Visibility, string> = {
  public: 'Aparece na página do estúdio. Qualquer pessoa pode acessar.',
  unlisted: 'Não aparece em listas. Só quem tem o link consegue abrir.',
  private: 'Só você consegue visualizar. O link público não funciona.',
};

export function effectiveVisibility(value: unknown): Visibility {
  return value === 'unlisted' || value === 'private' ? value : 'public';
}

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 40;
export const RESERVED_SLUGS = new Set<string>([
  'admin',
  'api',
  'app',
  'auth',
  'dashboard',
  'login',
  'logout',
  'onboarding',
  'photogrid',
  'pricing',
  'settings',
  'signup',
  'studio',
  'support',
  'terms',
  'privacy',
  'www',
]);
