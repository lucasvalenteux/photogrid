/**
 * Light-weight environment accessor. We intentionally avoid pulling in `zod`
 * here to keep the package zero-dependency. The shape is enforced by the type.
 *
 * Public Firebase config has safe fallbacks (see ./firebase.ts) so the app
 * boots even when env vars are missing during local dev.
 */

const get = (key: string): string | undefined => {
  if (typeof process === 'undefined' || !process.env) return undefined;
  const value = process.env[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

export interface PhotogridEnv {
  NODE_ENV: 'development' | 'production' | 'test';
  NEXT_PUBLIC_APP_URL: string | undefined;
  NEXT_PUBLIC_FIREBASE_API_KEY: string | undefined;
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: string | undefined;
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: string | undefined;
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: string | undefined;
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string | undefined;
  NEXT_PUBLIC_FIREBASE_APP_ID: string | undefined;
  NEXT_PUBLIC_API_URL: string | undefined;
}

export const env: PhotogridEnv = {
  NODE_ENV: (get('NODE_ENV') as PhotogridEnv['NODE_ENV']) ?? 'development',
  NEXT_PUBLIC_APP_URL: get('NEXT_PUBLIC_APP_URL'),
  NEXT_PUBLIC_FIREBASE_API_KEY: get('NEXT_PUBLIC_FIREBASE_API_KEY'),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: get('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: get('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: get('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: get('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  NEXT_PUBLIC_FIREBASE_APP_ID: get('NEXT_PUBLIC_FIREBASE_APP_ID'),
  NEXT_PUBLIC_API_URL: get('NEXT_PUBLIC_API_URL'),
};

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
