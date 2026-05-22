import { effectiveVisibility, type Visibility } from '@photogrid/config';

import { formatBytes, isTestStudio, timestamp } from '@/lib/admin/format';
import {
  effectiveFaceClusteringEnabled,
  effectivePublicFaceSearchEnabled,
  effectiveStudioSecurity,
  type AccountAccessEvent,
  type AccountAccessLogDoc,
  type AlbumDoc,
  type ClientDoc,
  type GalleryDoc,
  type OrderDoc,
  type PhotoDoc,
  type StudioDoc,
  type UserDoc,
} from '@/types';

export type VisibilityCounts = Record<Visibility, number>;

export type StudioAdminDetail = {
  studio: StudioDoc;
  owner: UserDoc | null;
  galleries: number;
  albums: number;
  photos: number;
  clients: number;
  orders: number;
  paidOrders: number;
  pendingOrders: number;
  carts: number;
  revenueCents: number;
  pendingCents: number;
  storageBytes: number;
  galleryVisibility: VisibilityCounts;
  albumVisibility: VisibilityCounts;
  faceClusteringEnabled: boolean;
  publicFaceSearchEnabled: boolean;
  storefrontTheme: string;
  paymentLabel: string;
  securityLabels: string[];
  aiFaceDetectionCalls: number;
  aiPublicFaceSearchCalls: number;
  pricePerPhotoCents: number | null;
  pricePerAlbumCents: number | null;
};

export type AccountAdminDetail = {
  user: UserDoc;
  /** Resolved from perfil, logs de acesso ou estúdio vinculado. */
  displayEmail: string;
  studio: StudioDoc | null;
  accessCount: number;
  accessByEvent: Record<AccountAccessEvent, number>;
  lastAccessAt: string | null;
  uniqueAccessDays: number;
  logs: AccountAccessLogDoc[];
};

export type PlatformOverview = {
  productionUsers: number;
  productionStudios: number;
  testStudios: number;
  galleries: number;
  albums: number;
  photos: number;
  clients: number;
  orders: number;
  paidOrders: number;
  pendingOrders: number;
  cartOrders: number;
  revenueCents: number;
  pendingCents: number;
  cartCents: number;
  conversionRate: number;
  storageBytes: number;
  firestoreDocs: number;
  totalAccessEvents: number;
  activeAccounts7d: number;
};

const EMPTY_VISIBILITY: VisibilityCounts = {
  public: 0,
  unlisted: 0,
  face_gated: 0,
  private: 0,
};

function countVisibility<T extends { visibility?: unknown }>(
  items: T[],
): VisibilityCounts {
  const counts = { ...EMPTY_VISIBILITY };
  for (const item of items) {
    const key = effectiveVisibility(item.visibility);
    counts[key] += 1;
  }
  return counts;
}

function paymentLabel(studio: StudioDoc): string {
  const method = studio.payment?.method ?? 'pix';
  if (method === 'automatic') {
    const status = studio.payment?.automatic?.status ?? 'pending';
    return `Automático (${status})`;
  }
  const pix = studio.payment?.pix;
  if (!pix?.key) return 'Pix não configurado';
  return `Pix · ${pix.keyType}`;
}

function securityLabels(studio: StudioDoc): string[] {
  const security = effectiveStudioSecurity(studio);
  const labels: string[] = [];
  if (security.dimPhotos) labels.push('Escurecer fotos');
  if (security.watermark) labels.push('Marca d\'água');
  if (security.disableRightClick) labels.push('Bloquear clique direito');
  if (security.screenshotShield) labels.push('Anti-print');
  if (security.protectCovers) labels.push('Proteger capas');
  if (security.antiAi) labels.push('Anti-IA');
  return labels.length > 0 ? labels : ['Nenhuma proteção ativa'];
}

export function buildStudioDetails({
  studios,
  users,
  galleries,
  albums,
  photos,
  orders,
  clients,
}: {
  studios: StudioDoc[];
  users: UserDoc[];
  galleries: GalleryDoc[];
  albums: AlbumDoc[];
  photos: PhotoDoc[];
  orders: OrderDoc[];
  clients: ClientDoc[];
}): StudioAdminDetail[] {
  const usersById = new Map(users.map((user) => [user.id, user]));

  return studios
    .map((studio) => {
      const studioGalleries = galleries.filter((g) => g.studioId === studio.id);
      const studioAlbums = albums.filter((a) => a.studioId === studio.id);
      const studioPhotos = photos.filter((p) => p.studioId === studio.id);
      const studioOrders = orders.filter((o) => o.studioId === studio.id);
      const studioClients = clients.filter((c) => c.studioId === studio.id);
      const paidOrders = studioOrders.filter((o) => o.status === 'paid');
      const pendingOrders = studioOrders.filter((o) => o.status === 'pending');
      const carts = studioOrders.filter((o) => o.status === 'cart');

      return {
        studio,
        owner: usersById.get(studio.ownerId) ?? null,
        galleries: studioGalleries.length,
        albums: studioAlbums.length,
        photos: studioPhotos.length,
        clients: studioClients.length,
        orders: studioOrders.filter((o) => o.status !== 'cart').length,
        paidOrders: paidOrders.length,
        pendingOrders: pendingOrders.length,
        carts: carts.length,
        revenueCents: paidOrders.reduce((sum, o) => sum + o.totalCents, 0),
        pendingCents: pendingOrders.reduce((sum, o) => sum + o.totalCents, 0),
        storageBytes: studioPhotos.reduce((sum, p) => sum + (p.bytes ?? 0), 0),
        galleryVisibility: countVisibility(studioGalleries),
        albumVisibility: countVisibility(studioAlbums),
        faceClusteringEnabled: effectiveFaceClusteringEnabled(studio),
        publicFaceSearchEnabled: effectivePublicFaceSearchEnabled(studio),
        storefrontTheme: studio.storefrontTheme ?? 'default',
        paymentLabel: paymentLabel(studio),
        securityLabels: securityLabels(studio),
        aiFaceDetectionCalls: studio.usage?.aiFaceDetectionCalls ?? 0,
        aiPublicFaceSearchCalls: studio.usage?.aiPublicFaceSearchCalls ?? 0,
        pricePerPhotoCents: studio.pricing?.pricePerPhotoCents ?? null,
        pricePerAlbumCents: studio.pricing?.pricePerAlbumCents ?? null,
      };
    })
    .sort((a, b) => {
      if (isTestStudio(a.studio) !== isTestStudio(b.studio)) {
        return isTestStudio(a.studio) ? 1 : -1;
      }
      return (
        b.revenueCents +
        b.pendingCents +
        b.storageBytes / 1000 -
        (a.revenueCents + a.pendingCents + a.storageBytes / 1000)
      );
    });
}

function resolveStudioForUser(
  user: UserDoc,
  studiosById: Map<string, StudioDoc>,
  studioByOwnerId: Map<string, StudioDoc>,
): StudioDoc | null {
  if (user.studioId) {
    const linked = studiosById.get(user.studioId);
    if (linked) return linked;
  }
  return studioByOwnerId.get(user.id) ?? null;
}

function resolveAccountEmail(
  user: UserDoc,
  logs: AccountAccessLogDoc[],
  studio: StudioDoc | null,
  users: UserDoc[],
): string {
  const fromProfile = user.email?.trim();
  if (fromProfile) return fromProfile;

  const fromLog = logs.find((entry) => entry.email?.trim())?.email?.trim();
  if (fromLog) return fromLog;

  if (studio) {
    const owner = users.find((entry) => entry.id === studio.ownerId);
    if (owner?.email?.trim()) return owner.email.trim();
    const linked = users.find(
      (entry) => entry.studioId === studio.id && entry.email?.trim(),
    );
    if (linked?.email?.trim()) return linked.email.trim();
  }

  return `UID ${user.id.slice(0, 8)}…`;
}

export function buildAccountDetails({
  users,
  studios,
  accessLogs,
}: {
  users: UserDoc[];
  studios: StudioDoc[];
  accessLogs: AccountAccessLogDoc[];
}): AccountAdminDetail[] {
  const studiosById = new Map(studios.map((s) => [s.id, s]));
  const studioByOwnerId = new Map(studios.map((s) => [s.ownerId, s]));
  const logsByUser = new Map<string, AccountAccessLogDoc[]>();

  for (const log of accessLogs) {
    const bucket = logsByUser.get(log.userId) ?? [];
    bucket.push(log);
    logsByUser.set(log.userId, bucket);
  }

  const userById = new Map(users.map((user) => [user.id, user]));

  for (const log of accessLogs) {
    if (userById.has(log.userId)) continue;
    userById.set(log.userId, {
      id: log.userId,
      email: log.email?.trim() ?? '',
      studioId: log.studioId ?? null,
      createdAt: log.createdAt,
    });
  }

  for (const studio of studios) {
    if (userById.has(studio.ownerId)) continue;
    if (users.some((entry) => entry.studioId === studio.id)) continue;
    userById.set(studio.ownerId, {
      id: studio.ownerId,
      email: '',
      studioId: studio.id,
      createdAt: studio.createdAt,
    });
  }

  return [...userById.values()]
    .map((user) => {
      const logs = (logsByUser.get(user.id) ?? []).sort(
        (a, b) => timestamp(b.createdAt) - timestamp(a.createdAt),
      );
      const accessByEvent: Record<AccountAccessEvent, number> = {
        login: 0,
        dashboard_view: 0,
        admin_view: 0,
        onboarding_view: 0,
      };
      const accessDays = new Set<string>();

      for (const log of logs) {
        accessByEvent[log.event] += 1;
        const day = log.createdAt.slice(0, 10);
        if (day) accessDays.add(day);
      }

      const studio = resolveStudioForUser(user, studiosById, studioByOwnerId);

      return {
        user,
        displayEmail: resolveAccountEmail(user, logs, studio, users),
        studio,
        accessCount: logs.length,
        accessByEvent,
        lastAccessAt: logs[0]?.createdAt ?? null,
        uniqueAccessDays: accessDays.size,
        logs: logs.slice(0, 40),
      };
    })
    .sort((a, b) => timestamp(b.user.createdAt) - timestamp(a.user.createdAt));
}

/** Email do owner para a tabela de estúdios. */
export function resolveStudioOwnerEmail(
  owner: UserDoc | null,
  ownerId: string,
  studioId: string,
  users: UserDoc[],
  accessLogs: AccountAccessLogDoc[],
): string {
  if (owner?.email?.trim()) return owner.email.trim();
  const linked = users.find(
    (entry) => entry.studioId === studioId && entry.email?.trim(),
  );
  if (linked?.email?.trim()) return linked.email.trim();
  const fromLog = accessLogs.find(
    (entry) => entry.userId === ownerId && entry.email?.trim(),
  )?.email;
  if (fromLog?.trim()) return fromLog.trim();
  return '—';
}

export function buildPlatformOverview({
  users,
  studios,
  galleries,
  albums,
  photos,
  orders,
  clients,
  accessLogs,
}: {
  users: UserDoc[];
  studios: StudioDoc[];
  galleries: GalleryDoc[];
  albums: AlbumDoc[];
  photos: PhotoDoc[];
  orders: OrderDoc[];
  clients: ClientDoc[];
  accessLogs: AccountAccessLogDoc[];
}): PlatformOverview {
  const productionStudioIds = new Set(
    studios.filter((s) => !isTestStudio(s)).map((s) => s.id),
  );
  const productionStudios = studios.filter((s) => productionStudioIds.has(s.id));
  const productionUsers = users.filter(
    (u) => !u.studioId || productionStudioIds.has(u.studioId),
  );

  const productionGalleries = galleries.filter((g) =>
    productionStudioIds.has(g.studioId),
  );
  const productionAlbums = albums.filter((a) => productionStudioIds.has(a.studioId));
  const productionPhotos = photos.filter((p) => productionStudioIds.has(p.studioId));
  const productionOrders = orders.filter((o) => productionStudioIds.has(o.studioId));
  const productionClients = clients.filter((c) => productionStudioIds.has(c.studioId));

  const paidOrders = productionOrders.filter((o) => o.status === 'paid');
  const pendingOrders = productionOrders.filter((o) => o.status === 'pending');
  const cartOrders = productionOrders.filter((o) => o.status === 'cart');
  const realOrders = productionOrders.filter((o) => o.status !== 'cart');

  const revenueCents = paidOrders.reduce((sum, o) => sum + o.totalCents, 0);
  const pendingCents = pendingOrders.reduce((sum, o) => sum + o.totalCents, 0);
  const cartCents = cartOrders.reduce((sum, o) => sum + o.totalCents, 0);
  const interested = paidOrders.length + pendingOrders.length + cartOrders.length;
  const conversionRate =
    interested > 0 ? (paidOrders.length / interested) * 100 : 0;

  const storageBytes = productionPhotos.reduce((sum, p) => sum + (p.bytes ?? 0), 0);

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const activeUserIds = new Set(
    accessLogs
      .filter((log) => timestamp(log.createdAt) >= sevenDaysAgo)
      .map((log) => log.userId),
  );

  return {
    productionUsers: productionUsers.length,
    productionStudios: productionStudios.length,
    testStudios: studios.length - productionStudios.length,
    galleries: productionGalleries.length,
    albums: productionAlbums.length,
    photos: productionPhotos.length,
    clients: productionClients.length,
    orders: realOrders.length,
    paidOrders: paidOrders.length,
    pendingOrders: pendingOrders.length,
    cartOrders: cartOrders.length,
    revenueCents,
    pendingCents,
    cartCents,
    conversionRate,
    storageBytes,
    firestoreDocs:
      productionUsers.length +
      productionStudios.length +
      productionGalleries.length +
      productionAlbums.length +
      productionPhotos.length +
      productionOrders.length +
      productionClients.length,
    totalAccessEvents: accessLogs.length,
    activeAccounts7d: activeUserIds.size,
  };
}

export { formatBytes };
