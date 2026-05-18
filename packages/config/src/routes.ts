/**
 * Centralised route table.
 * Always import paths from here — never hardcode URLs across the app.
 */

export const ROUTES = {
  home: '/',
  /** Single unified entry point — handles both sign-up and sign-in. */
  login: '/login',
  onboarding: '/onboarding',
  dashboard: '/dashboard',
  galleries: '/dashboard/galleries',
  gallery: (galleryId: string) => `/dashboard/galleries/${galleryId}`,
  album: (galleryId: string, albumId: string) =>
    `/dashboard/galleries/${galleryId}/albums/${albumId}`,
  clients: '/dashboard/clients',
  orders: '/dashboard/orders',
  settings: '/dashboard/settings',
  /** Public storefront URLs. */
  studio: (slug: string) => `/${slug}`,
  publicGallery: (slug: string, galleryId: string) => `/${slug}/${galleryId}`,
  publicAlbum: (slug: string, galleryId: string, albumId: string) =>
    `/${slug}/${galleryId}/${albumId}`,
} as const;

export const PUBLIC_ROUTES = [
  ROUTES.home,
  ROUTES.login,
] as readonly string[];

export const AUTH_ONLY_ROUTES = [ROUTES.onboarding] as readonly string[];

export const STUDIO_ROUTES = [
  ROUTES.dashboard,
  ROUTES.galleries,
  ROUTES.clients,
  ROUTES.orders,
  ROUTES.settings,
] as readonly string[];
