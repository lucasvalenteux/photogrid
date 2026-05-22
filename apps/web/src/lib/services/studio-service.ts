import { doc, getDoc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase/client';
import {
  slugDoc,
  studioDoc,
  studiosCollection,
  userDoc,
} from '@/lib/firebase/firestore';
import { deleteStudioLogo, uploadStudioLogo } from '@/lib/firebase/storage';
import { slugify, validateSlug } from '@/lib/slug';
import { FIRESTORE_COLLECTIONS } from '@photogrid/config';
import type {
  StorefrontThemeId,
  StudioPaymentSettings,
  StudioPricingSettings,
} from '@/types';

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

    // Never touch `email` here — an empty string wiped real addresses and
    // broke the admin accounts list (owner looked "sem email" while the
    // login row showed onboarding).
    transaction.set(userDoc(ownerId), { studioId }, { merge: true });
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

export async function updateStudioPublicFaceSearch(
  studioId: string,
  enabled: boolean,
): Promise<void> {
  await updateDoc(studioDoc(studioId), { publicFaceSearchEnabled: enabled });
}

/**
 * Update a single field inside the studio's `security` object. We patch
 * via dot-notation (`security.<key>`) so concurrent flips of different
 * toggles don't clobber each other — Firestore merges them at the
 * field level instead of overwriting the whole object.
 */
export async function updateStudioSecurity(
  studioId: string,
  key:
    | 'dimPhotos'
    | 'watermark'
    | 'disableRightClick'
    | 'screenshotShield'
    | 'protectCovers'
    | 'antiAi',
  value: boolean,
): Promise<void> {
  await updateDoc(studioDoc(studioId), { [`security.${key}`]: value });
}

/** Rename the studio. Slug is intentionally NOT touched — the public URL
 *  is part of the studio's identity and the photographer can change it
 *  in a separate flow (not implemented yet) to avoid breaking links. */
export async function updateStudioName(
  studioId: string,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    throw new Error('Nome muito curto.');
  }
  await updateDoc(studioDoc(studioId), { name: trimmed });
}

/**
 * Replace the studio logo. The flow is:
 *   1. Upload the new image to Storage (timestamped path).
 *   2. Patch the Firestore doc with the new URL + path.
 *   3. Best-effort delete the previous Storage object.
 *
 * We do (3) *after* the Firestore write so a half-finished operation
 * never points at a deleted file. The delete is best-effort because the
 * old URL might already have been replaced concurrently, or the object
 * might have been removed manually from the Firebase console.
 */
export async function updateStudioLogo({
  studioId,
  blob,
  extension,
  previousStoragePath,
}: {
  studioId: string;
  blob: Blob;
  extension: string;
  previousStoragePath?: string | null;
}): Promise<{ logoUrl: string; logoStoragePath: string }> {
  const uploaded = await uploadStudioLogo({ studioId, blob, extension });
  await updateDoc(studioDoc(studioId), {
    logoUrl: uploaded.downloadUrl,
    logoStoragePath: uploaded.storagePath,
  });
  if (previousStoragePath && previousStoragePath !== uploaded.storagePath) {
    try {
      await deleteStudioLogo(previousStoragePath);
    } catch (error) {
      console.warn('[studio] failed to delete previous logo', error);
    }
  }
  return {
    logoUrl: uploaded.downloadUrl,
    logoStoragePath: uploaded.storagePath,
  };
}

/** Clear the studio logo, falling back to the default avatar. */
export async function removeStudioLogo({
  studioId,
  previousStoragePath,
}: {
  studioId: string;
  previousStoragePath?: string | null;
}): Promise<void> {
  await updateDoc(studioDoc(studioId), {
    logoUrl: null,
    logoStoragePath: null,
  });
  if (previousStoragePath) {
    try {
      await deleteStudioLogo(previousStoragePath);
    } catch (error) {
      console.warn('[studio] failed to delete logo on removal', error);
    }
  }
}

/** Persist the studio's payment configuration. Overwrites the whole
 *  `payment` map — callers should provide a fully formed object. */
export async function updateStudioPayment(
  studioId: string,
  payment: StudioPaymentSettings,
): Promise<void> {
  await updateDoc(studioDoc(studioId), { payment });
}

/**
 * Persist the studio's default pricing for storefront purchases. These
 * values are used by the cart whenever the gallery itself doesn't
 * override them — see `resolveGalleryPrices` in `@/types`.
 */
export async function updateStudioPricing(
  studioId: string,
  pricing: StudioPricingSettings,
): Promise<void> {
  await updateDoc(studioDoc(studioId), { pricing });
}

/** Update the visual background preset used by the public storefront. */
export async function updateStudioStorefrontTheme(
  studioId: string,
  theme: StorefrontThemeId,
): Promise<void> {
  await updateDoc(studioDoc(studioId), { storefrontTheme: theme });
}

export const STUDIO_COLLECTION = FIRESTORE_COLLECTIONS.studios;
