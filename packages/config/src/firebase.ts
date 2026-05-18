/**
 * Public Firebase configuration.
 *
 * These values are *public by design* — they identify the Firebase project but
 * grant no privileged access. All security must be enforced via Firebase Rules
 * and Firebase Authentication. See firestore.rules / storage.rules.
 *
 * We still let them be overridden via NEXT_PUBLIC_FIREBASE_* env vars so the
 * same codebase can target different Firebase projects per environment.
 */

import { env } from './env';

export interface FirebasePublicConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const DEFAULT_FIREBASE_CONFIG: FirebasePublicConfig = {
  apiKey: 'AIzaSyB_-OkRHmYrVKhiSlb_A0MaHVLyDLr6GNw',
  authDomain: 'photogrid-1822d.firebaseapp.com',
  projectId: 'photogrid-1822d',
  storageBucket: 'photogrid-1822d.firebasestorage.app',
  messagingSenderId: '447868371526',
  appId: '1:447868371526:web:c8ad54ed882e0fe83a4047',
};

export const firebaseConfig: FirebasePublicConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY ?? DEFAULT_FIREBASE_CONFIG.apiKey,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? DEFAULT_FIREBASE_CONFIG.authDomain,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? DEFAULT_FIREBASE_CONFIG.projectId,
  storageBucket:
    env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? DEFAULT_FIREBASE_CONFIG.storageBucket,
  messagingSenderId:
    env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? DEFAULT_FIREBASE_CONFIG.messagingSenderId,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID ?? DEFAULT_FIREBASE_CONFIG.appId,
};
