import {
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { clientsCollection } from '@/lib/firebase/firestore';
import type { ClientDoc } from '@/types';

export interface CreateClientInput {
  studioId: string;
  name: string;
  phone: string;
}

export async function createClient({
  studioId,
  name,
  phone,
}: CreateClientInput): Promise<ClientDoc> {
  const trimmedName = name.trim();
  if (trimmedName.length < 2) throw new Error('Informe o nome do cliente.');

  const ref = doc(clientsCollection());
  const now = new Date().toISOString();
  const payload: ClientDoc = {
    id: ref.id,
    studioId,
    name: trimmedName,
    phone,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(ref, {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return payload;
}

export function subscribeToStudioClients(
  studioId: string,
  onChange: (clients: ClientDoc[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(
    clientsCollection(),
    where('studioId', '==', studioId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => d.data())),
    (error) => onError?.(error),
  );
}
