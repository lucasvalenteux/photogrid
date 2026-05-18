'use client';

import {
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { env } from '@photogrid/config';

import { auth } from '@/lib/firebase/client';
import { faceClustersCollection } from '@/lib/firebase/firestore';
import type { FaceClusterDoc, PhotoDoc } from '@/types';

/**
 * Web-side glue for the FastAPI face-clustering service.
 *
 * Architecture
 * ------------
 *
 * - **Triggering**: `enqueuePhotoForClustering` posts the photo's URLs to
 *   the API which schedules a background task. It's intentionally
 *   fire-and-forget — if the API is unreachable (or simply not configured
 *   via `NEXT_PUBLIC_API_URL`), we swallow the error so the upload UX
 *   isn't impacted.
 * - **Reads**: cluster docs are written by the trusted backend into
 *   Firestore, so the UI subscribes directly via the client SDK and the
 *   API never has to serve list queries. This keeps the API stateless and
 *   the dashboard reactive.
 * - **Mutations** (promote / dismiss): proxied through the API so all
 *   privileged writes still flow through the Admin SDK.
 */

const ENABLED = Boolean(env.NEXT_PUBLIC_API_URL);

export function isFaceClusteringEnabled(): boolean {
  return ENABLED;
}

function apiUrl(path: string): string {
  if (!env.NEXT_PUBLIC_API_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured.');
  }
  // Tolerate trailing slashes on the env var.
  const base = env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

async function authedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  const token = await user.getIdToken();
  const headers = new Headers(init.headers ?? {});
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(apiUrl(path), { ...init, headers });
}

/* ------------------------------------------------------------------------ */
/* Triggers                                                                  */
/* ------------------------------------------------------------------------ */

interface EnqueuePhotoInput {
  photo: Pick<PhotoDoc, 'id' | 'galleryId' | 'imageUrl' | 'thumbnailUrl'>;
  force?: boolean;
}

/**
 * Fire-and-forget request to the API after a successful photo upload. The
 * server returns 202 immediately and processes asynchronously; we don't
 * await any clustering output here.
 *
 * Returns `true` on a successful 2xx, `false` on any other outcome — the
 * upload path ignores the return, but `reprocessGalleryPhotos` uses it to
 * keep a running success count for the toast feedback.
 */
export async function enqueuePhotoForClustering({
  photo,
  force = false,
}: EnqueuePhotoInput): Promise<boolean> {
  if (!ENABLED) return false;
  try {
    const resp = await authedFetch('/api/v1/face-clustering/process-photo', {
      method: 'POST',
      body: JSON.stringify({
        photoId: photo.id,
        galleryId: photo.galleryId,
        imageUrl: photo.imageUrl,
        thumbnailUrl: photo.thumbnailUrl,
        force,
      }),
    });
    if (!resp.ok) {
      console.warn(
        '[face-clustering] enqueue rejected',
        resp.status,
        await resp.text().catch(() => ''),
      );
      return false;
    }
    return true;
  } catch (error) {
    // Don't let face-clustering failures impact the upload flow.
    console.warn('[face-clustering] enqueue failed', error);
    return false;
  }
}

/**
 * Re-enqueue every photo in a gallery for face-clustering, with a small
 * concurrency cap so we don't open hundreds of parallel sockets. Used by
 * the "Reprocessar fotos" button — invaluable for galleries that were
 * uploaded before the AI backend existed, or before the
 * `NEXT_PUBLIC_API_URL` env var was set in production.
 */
export interface ReprocessProgress {
  total: number;
  queued: number;
  failed: number;
}

export async function reprocessGalleryPhotos(
  photos: Array<Pick<PhotoDoc, 'id' | 'galleryId' | 'imageUrl' | 'thumbnailUrl'>>,
  onProgress?: (progress: ReprocessProgress) => void,
): Promise<ReprocessProgress> {
  const total = photos.length;
  let queued = 0;
  let failed = 0;
  const report = () => onProgress?.({ total, queued, failed });

  // 4 concurrent in-flight POSTs keeps the API from queueing 100 background
  // tasks at once (which would all wait on the single-worker ONNX runtime
  // and inflate the 1 GB memory headroom).
  const concurrency = 4;
  let cursor = 0;
  const next = (): typeof photos[number] | undefined => {
    if (cursor >= photos.length) return undefined;
    return photos[cursor++];
  };

  const worker = async () => {
    while (true) {
      const photo = next();
      if (!photo) return;
      const ok = await enqueuePhotoForClustering({ photo, force: true });
      if (ok) queued += 1;
      else failed += 1;
      report();
    }
  };

  report();
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { total, queued, failed };
}

/* ------------------------------------------------------------------------ */
/* Reads                                                                     */
/* ------------------------------------------------------------------------ */

/**
 * Live subscription for a gallery's open cluster suggestions. Clusters
 * with status === 'promoted' / 'dismissed' are filtered out client-side so
 * we can rely on a single composite index.
 *
 * The query must include `studioId` in the where clause even though it's
 * functionally redundant (one studio per gallery): Firestore's security
 * rules for queries evaluate via static analysis, and the rule on
 * /faceClusters checks `ownsStudio(resource.data.studioId)`. Without
 * matching the rule's field on the query side, Firestore can't prove
 * every result will pass and rejects the entire subscription with
 * "Missing or insufficient permissions".
 */
export function subscribeToOpenClusters(
  studioId: string,
  galleryId: string,
  onChange: (clusters: FaceClusterDoc[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!ENABLED) {
    onChange([]);
    return () => undefined;
  }
  const q = query(
    faceClustersCollection(),
    where('studioId', '==', studioId),
    where('galleryId', '==', galleryId),
    orderBy('photoCount', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const docs = snap.docs
        .map((d) => d.data())
        .filter((c) => c.status === 'open');
      onChange(docs);
    },
    (error) => onError?.(error),
  );
}

/* ------------------------------------------------------------------------ */
/* Mutations                                                                 */
/* ------------------------------------------------------------------------ */

interface PromoteClusterInput {
  clusterId: string;
  galleryTitle: string;
}

export interface PromoteClusterResult {
  albumId: string;
  status: 'promoted' | 'already_promoted';
}

export async function promoteClusterToAlbum({
  clusterId,
  galleryTitle,
}: PromoteClusterInput): Promise<PromoteClusterResult> {
  const resp = await authedFetch(
    `/api/v1/face-clustering/clusters/${encodeURIComponent(clusterId)}/promote`,
    {
      method: 'POST',
      body: JSON.stringify({ galleryTitle }),
    },
  );
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`Falha ao criar álbum: ${resp.status} ${detail}`);
  }
  return (await resp.json()) as PromoteClusterResult;
}

export async function dismissCluster(clusterId: string): Promise<void> {
  const resp = await authedFetch(
    `/api/v1/face-clustering/clusters/${encodeURIComponent(clusterId)}/dismiss`,
    { method: 'POST' },
  );
  if (!resp.ok && resp.status !== 204) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`Falha ao descartar sugestão: ${resp.status} ${detail}`);
  }
}

export interface ConsolidateResult {
  /** Number of clusters absorbed (merged into a larger one). */
  merged: number;
}

/**
 * Trigger a centroid-overlap merge pass on a gallery. Cheap and
 * idempotent — safe to call after any batch operation that may have
 * produced near-duplicate clusters (e.g. `reprocessGalleryPhotos`).
 */
export async function consolidateClusters(
  galleryId: string,
): Promise<ConsolidateResult> {
  if (!ENABLED) return { merged: 0 };
  const resp = await authedFetch(
    `/api/v1/face-clustering/galleries/${encodeURIComponent(galleryId)}/consolidate`,
    { method: 'POST' },
  );
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`Falha ao consolidar: ${resp.status} ${detail}`);
  }
  return (await resp.json()) as ConsolidateResult;
}
