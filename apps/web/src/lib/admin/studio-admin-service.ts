import {
  deleteDoc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';

import { db, storage } from '@/lib/firebase/client';
import {
  albumsCollection,
  clientsCollection,
  faceClustersCollection,
  galleriesCollection,
  ordersCollection,
  photoFaceDoc,
  photoFacesCollection,
  photosCollection,
  slugDoc,
  studioDoc,
  userDoc,
  usersCollection,
} from '@/lib/firebase/firestore';
import type { PhotoDoc } from '@/types';

const FIRESTORE_BATCH_LIMIT = 450;

export async function updateAdminStudio({
  studioId,
  name,
  isTest,
}: {
  studioId: string;
  name: string;
  isTest: boolean;
}): Promise<void> {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    throw new Error('Nome do estúdio muito curto.');
  }

  await updateDoc(studioDoc(studioId), {
    name: trimmed,
    isTest,
  });
}

export async function deleteStudioCascade({
  studioId,
  slug,
  ownerId,
  logoStoragePath,
}: {
  studioId: string;
  slug: string;
  ownerId: string;
  logoStoragePath?: string | null;
}): Promise<void> {
  const [
    galleriesSnap,
    albumsSnap,
    photosSnap,
    ordersSnap,
    clientsSnap,
    clustersSnap,
    photoFacesSnap,
    linkedUsersSnap,
  ] = await Promise.all([
    getDocs(query(galleriesCollection(), where('studioId', '==', studioId))),
    getDocs(query(albumsCollection(), where('studioId', '==', studioId))),
    getDocs(query(photosCollection(), where('studioId', '==', studioId))),
    getDocs(query(ordersCollection(), where('studioId', '==', studioId))),
    getDocs(query(clientsCollection(), where('studioId', '==', studioId))),
    getDocs(query(faceClustersCollection(), where('studioId', '==', studioId))),
    getDocs(query(photoFacesCollection(), where('studioId', '==', studioId))),
    getDocs(query(usersCollection(), where('studioId', '==', studioId))),
  ]);

  const photos = photosSnap.docs.map((doc) => doc.data());
  const deletes: DocumentReference[] = [
    ...galleriesSnap.docs.map((doc) => doc.ref),
    ...albumsSnap.docs.map((doc) => doc.ref),
    ...photosSnap.docs.map((doc) => doc.ref),
    ...ordersSnap.docs.map((doc) => doc.ref),
    ...clientsSnap.docs.map((doc) => doc.ref),
    ...clustersSnap.docs.map((doc) => doc.ref),
    ...photoFacesSnap.docs.map((doc) => doc.ref),
    slugDoc(slug),
    studioDoc(studioId),
  ];

  const updates = uniqueRefs([
    ...linkedUsersSnap.docs.map((doc) => doc.ref),
    userDoc(ownerId),
  ]);

  await commitCascade({ deletes, updates });
  await cleanupStorageObjects(photos, logoStoragePath);
}

function uniqueRefs(refs: DocumentReference[]): DocumentReference[] {
  const byPath = new Map<string, DocumentReference>();
  for (const ref of refs) {
    byPath.set(ref.path, ref);
  }
  return Array.from(byPath.values());
}

async function commitCascade({
  deletes,
  updates,
}: {
  deletes: DocumentReference[];
  updates: DocumentReference[];
}) {
  let batch = writeBatch(db);
  let size = 0;

  const commitIfFull = async () => {
    if (size < FIRESTORE_BATCH_LIMIT) return;
    await batch.commit();
    batch = writeBatch(db);
    size = 0;
  };

  for (const userRef of updates) {
    batch.set(userRef, { studioId: null }, { merge: true });
    size += 1;
    await commitIfFull();
  }

  for (const refToDelete of deletes) {
    batch.delete(refToDelete);
    size += 1;
    await commitIfFull();
  }

  if (size > 0) {
    await batch.commit();
  }
}

async function cleanupStorageObjects(
  photos: PhotoDoc[],
  logoStoragePath?: string | null,
) {
  const paths = new Set<string>();

  for (const photo of photos) {
    paths.add(photo.storagePath);
    if (photo.thumbnailPath) paths.add(photo.thumbnailPath);
    paths.add(`studios/${photo.studioId}/galleries/${photo.galleryId}/photos/${photo.id}`);
    await deleteDoc(photoFaceDoc(photo.id)).catch(() => undefined);
  }

  if (logoStoragePath) paths.add(logoStoragePath);

  await Promise.all(
    Array.from(paths).map(async (path) => {
      try {
        await deleteObject(ref(storage, path));
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code !== 'storage/object-not-found') {
          console.warn('[admin] failed to delete storage object', path, error);
        }
      }
    }),
  );
}

