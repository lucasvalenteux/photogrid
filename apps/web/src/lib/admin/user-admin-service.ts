import {
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore';

import { deleteAccountViaApi, isAdminApiAvailable } from '@/lib/admin/admin-api';
import { isSystemAdmin } from '@/lib/admin/access';
import type { AccountAdminDetail } from '@/lib/admin/metrics';
import { deleteStudioCascade } from '@/lib/admin/studio-admin-service';
import { db } from '@/lib/firebase/client';
import { accountAccessLogsCollection, userDoc } from '@/lib/firebase/firestore';

const FIRESTORE_BATCH_LIMIT = 450;

function assertNotSystemAdmin(email: string): void {
  if (isSystemAdmin(email)) {
    throw new Error('Não é possível excluir uma conta de administrador do sistema.');
  }
}

async function deleteDocumentsInBatches(refs: DocumentReference[]): Promise<void> {
  if (refs.length === 0) return;

  let batch = writeBatch(db);
  let size = 0;

  const commitIfFull = async () => {
    if (size < FIRESTORE_BATCH_LIMIT) return;
    await batch.commit();
    batch = writeBatch(db);
    size = 0;
  };

  for (const ref of refs) {
    batch.delete(ref);
    size += 1;
    await commitIfFull();
  }

  if (size > 0) {
    await batch.commit();
  }
}

async function deleteUserAccessLogs(userId: string): Promise<void> {
  const snap = await getDocs(
    query(accountAccessLogsCollection(), where('userId', '==', userId)),
  );
  await deleteDocumentsInBatches(snap.docs.map((doc) => doc.ref));
}

async function deleteAdminAccountClient(
  account: AccountAdminDetail,
  { deleteOwnedStudio }: { deleteOwnedStudio: boolean },
): Promise<void> {
  const { user, studio, displayEmail } = account;
  const ownsStudio = Boolean(studio && studio.ownerId === user.id);

  if (ownsStudio && studio) {
    if (!deleteOwnedStudio) {
      throw new Error(
        'Esta conta é dona de um estúdio. Confirme a exclusão do estúdio e de todo o conteúdo.',
      );
    }
    await deleteStudioCascade({
      studioId: studio.id,
      slug: studio.slug,
      ownerId: studio.ownerId,
      logoStoragePath: studio.logoStoragePath,
    });
  }

  await deleteUserAccessLogs(user.id);

  const profileSnap = await getDoc(userDoc(user.id));
  if (profileSnap.exists()) {
    await deleteDoc(userDoc(user.id));
  }
}

/**
 * Remove a photographer account. Prefer the FastAPI Admin SDK route so we
 * do not depend on widening Firestore client rules for destructive ops.
 */
export async function deleteAdminAccount(
  account: AccountAdminDetail,
  { deleteOwnedStudio }: { deleteOwnedStudio: boolean },
): Promise<void> {
  const { user, displayEmail } = account;
  assertNotSystemAdmin(displayEmail);
  if (user.email?.trim()) {
    assertNotSystemAdmin(user.email);
  }

  if (isAdminApiAvailable()) {
    await deleteAccountViaApi({
      userId: user.id,
      email: displayEmail,
      deleteOwnedStudio,
    });
    return;
  }

  await deleteAdminAccountClient(account, { deleteOwnedStudio });
}

export function accountDeleteConfirmationValue(account: AccountAdminDetail): string {
  const email = account.displayEmail.trim();
  if (email.includes('@') && !email.startsWith('UID ')) {
    return email.toLowerCase();
  }
  return account.user.id;
}
