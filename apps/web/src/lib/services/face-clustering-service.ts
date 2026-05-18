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
 */
export async function enqueuePhotoForClustering({
  photo,
  force = false,
}: EnqueuePhotoInput): Promise<void> {
  if (!ENABLED) return;
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
    }
  } catch (error) {
    // Don't let face-clustering failures impact the upload flow.
    console.warn('[face-clustering] enqueue failed', error);
  }
}

/* ------------------------------------------------------------------------ */
/* Reads                                                                     */
/* ------------------------------------------------------------------------ */

/**
 * Live subscription for a gallery's open cluster suggestions. Clusters
 * with status === 'promoted' / 'dismissed' are filtered out client-side so
 * we can rely on a single composite index.
 */
export function subscribeToOpenClusters(
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
