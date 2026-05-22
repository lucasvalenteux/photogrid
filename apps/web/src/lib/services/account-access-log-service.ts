import { addDoc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';

import { accountAccessLogsCollection } from '@/lib/firebase/firestore';
import type { AccountAccessEvent, AccountAccessLogDoc } from '@/types';

const SESSION_DEDUPE_PREFIX = 'pg-access-log:';

export interface RecordAccountAccessInput {
  userId: string;
  email: string;
  event: AccountAccessEvent;
  path?: string | null;
  studioId?: string | null;
}

/**
 * Append a sign-in / navigation event for admin analytics. Login is
 * always recorded; other events are deduped per browser session so
 * route changes do not spam Firestore.
 */
export async function recordAccountAccess({
  userId,
  email,
  event,
  path = null,
  studioId = null,
}: RecordAccountAccessInput): Promise<void> {
  if (typeof window !== 'undefined' && event !== 'login') {
    const dedupeKey = `${SESSION_DEDUPE_PREFIX}${event}:${path ?? '/'}`;
    if (sessionStorage.getItem(dedupeKey)) return;
    sessionStorage.setItem(dedupeKey, '1');
  }

  const userAgent =
    typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null;

  await addDoc(accountAccessLogsCollection(), {
    userId,
    email: email.trim().toLowerCase(),
    event,
    path,
    studioId,
    userAgent,
    createdAt: new Date().toISOString(),
  } as Omit<AccountAccessLogDoc, 'id'>);
}

export function subscribeToAccountAccessLogs(
  onChange: (logs: AccountAccessLogDoc[]) => void,
  onError?: (error: Error) => void,
  maxRows = 800,
): () => void {
  const q = query(
    accountAccessLogsCollection(),
    orderBy('createdAt', 'desc'),
    limit(maxRows),
  );

  return onSnapshot(
    q,
    (snap) => {
      onChange(
        snap.docs.map((docSnap) => ({
          ...docSnap.data(),
          id: docSnap.id,
        })),
      );
    },
    (error) => onError?.(error),
  );
}
