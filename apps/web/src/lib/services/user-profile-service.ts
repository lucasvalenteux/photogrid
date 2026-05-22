import type { User } from 'firebase/auth';
import { getDocs, limit, query, updateDoc, where } from 'firebase/firestore';

import { studiosCollection, userDoc } from '@/lib/firebase/firestore';
import type { UserDoc } from '@/types';

/**
 * Repairs common drift between `/users/{uid}` and `/studios`:
 *
 *   - `createStudio` used to merge `email: ''`, wiping the address.
 *   - `studioId` on the user doc missing even though `studios.ownerId`
 *     already points at the same uid.
 *
 * Called on every auth profile load so existing tenants self-heal on login.
 */
export async function healUserProfile(
  firebaseUser: User,
  data: UserDoc,
): Promise<UserDoc> {
  const authEmail = firebaseUser.email?.trim() ?? '';
  let studioId = data.studioId ?? null;
  let email = data.email?.trim() || authEmail;

  const patch: Record<string, string | null> = {};

  if (!studioId) {
    const owned = await getDocs(
      query(
        studiosCollection(),
        where('ownerId', '==', firebaseUser.uid),
        limit(1),
      ),
    );
    const ownedDoc = owned.docs[0];
    if (ownedDoc) {
      studioId = ownedDoc.id;
      patch.studioId = studioId;
    }
  }

  if (authEmail && email !== authEmail) {
    email = authEmail;
    patch.email = authEmail;
  }

  if (Object.keys(patch).length > 0) {
    await updateDoc(userDoc(firebaseUser.uid), patch);
  }

  return {
    ...data,
    studioId,
    email,
  };
}
