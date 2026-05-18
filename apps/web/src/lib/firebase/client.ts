import { firebaseConfig } from '@photogrid/config';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

/**
 * Lazy-singleton Firebase client. Safe to import from server components — the
 * SDK only opens long-lived connections after first interaction (auth listener,
 * firestore query, etc.).
 *
 * In dev (Fast Refresh) Next.js re-evaluates this module on hot reload, so we
 * guard against duplicate `initializeApp` / `initializeFirestore` calls.
 */
const firebaseApp: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

/**
 * Firestore's default transport is the streaming WebChannel API on
 * `firestore.googleapis.com/.../Listen/channel?...`. That URL pattern is
 * blocked by uBlock Origin, Brave Shields, corporate proxies and many other
 * adblockers — which manifests as a cryptic `ERR_BLOCKED_BY_CLIENT` and a
 * dashboard that never finishes loading.
 *
 * `experimentalAutoDetectLongPolling: true` makes the SDK probe the streaming
 * channel and transparently fall back to long-polling (plain XHR) when it
 * fails. This is the production-grade setting recommended by Firebase for
 * browser apps.
 */
function createFirestore(): Firestore {
  try {
    return initializeFirestore(firebaseApp, {
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    // initializeFirestore() throws if it's been called before (HMR). Re-use the
    // existing instance in that case.
    return getFirestore(firebaseApp);
  }
}

export const auth: Auth = getAuth(firebaseApp);
export const db: Firestore = createFirestore();
export const storage: FirebaseStorage = getStorage(firebaseApp);

export { firebaseApp };
