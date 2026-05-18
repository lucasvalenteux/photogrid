import { doc, getDoc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase/client';
import {
  slugDoc,
  studioDoc,
  studiosCollection,
  userDoc,
} from '@/lib/firebase/firestore';
import { slugify, validateSlug } from '@/lib/slug';
import { FIRESTORE_COLLECTIONS } from '@photogrid/config';

export interface CreateStudioInput {
  ownerId: string;
  name: string;
}

export interface CreateStudioResult {
  studioId: string;
  slug: string;
}

/**
 * Compute a unique slug derived from `name`. Tries the base slug, then
 * `-2`, `-3`, ... up to `maxAttempts`. Throws if none is free.
 */
async function findAvailableSlug(name: string, maxAttempts = 20): Promise<string> {
  const base = slugify(name) || 'studio';
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    if (validateSlug(candidate) !== null) continue;
    const snap = await getDoc(slugDoc(candidate));
    if (!snap.exists()) return candidate;
  }
  throw new Error('Não conseguimos gerar um endereço único. Tente outro nome.');
}

/**
 * Atomically create a studio:
 *   1. reserve /slugs/{slug}
 *   2. create /studios/{studioId}
 *   3. link /users/{ownerId}.studioId
 *
 * If any step fails the transaction aborts and nothing is persisted, so we
 * never end up with a half-created tenant.
 */
export async function createStudio({
  ownerId,
  name,
}: CreateStudioInput): Promise<CreateStudioResult> {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    throw new Error('Nome muito curto.');
  }

  const slug = await findAvailableSlug(trimmed);
  const studioRef = doc(studiosCollection());
  const studioId = studioRef.id;

  await runTransaction(db, async (transaction) => {
    const slugRef = slugDoc(slug);
    const slugSnap = await transaction.get(slugRef);
    if (slugSnap.exists()) {
      throw new Error('Este endereço já está em uso. Tente outro nome.');
    }

    transaction.set(studioRef, {
      id: studioId,
      ownerId,
      name: trimmed,
      slug,
      createdAt: serverTimestamp(),
    });

    transaction.set(slugRef, {
      slug,
      studioId,
      ownerId,
      createdAt: serverTimestamp(),
    });

    transaction.set(
      userDoc(ownerId),
      { studioId, email: '' },
      { merge: true },
    );
  });

  return { studioId, slug };
}

export async function getStudioBySlug(slug: string) {
  const slugSnap = await getDoc(slugDoc(slug));
  if (!slugSnap.exists()) return null;
  const studioSnap = await getDoc(studioDoc(slugSnap.data().studioId));
  return studioSnap.exists() ? studioSnap.data() : null;
}

/**
 * Toggle face detection / album suggestions for the studio. The Firestore
 * rule on `/studios/{id}.update` only forbids changing `ownerId` and `slug`,
 * so the owner can flip this field freely. When false, the FastAPI service
 * still runs (the API doesn't read this flag), but the web app never calls
 * it and never subscribes to cluster suggestions — making the toggle the
 * single source of truth on the client.
 */
export async function updateStudioFaceClustering(
  studioId: string,
  enabled: boolean,
): Promise<void> {
  await updateDoc(studioDoc(studioId), { faceClusteringEnabled: enabled });
}

/**
 * Update a single field inside the studio's `security` object. We patch
 * via dot-notation (`security.<key>`) so concurrent flips of different
 * toggles don't clobber each other — Firestore merges them at the
 * field level instead of overwriting the whole object.
 */
export async function updateStudioSecurity(
  studioId: string,
  key: 'dimPhotos' | 'watermark' | 'disableRightClick' | 'antiAi',
  value: boolean,
): Promise<void> {
  await updateDoc(studioDoc(studioId), { [`security.${key}`]: value });
}

export const STUDIO_COLLECTION = FIRESTORE_COLLECTIONS.studios;
