/**
 * Light-weight environment accessor. We intentionally avoid pulling in `zod`
 * here to keep the package zero-dependency. The shape is enforced by the type.
 *
 * Public Firebase config has safe fallbacks (see ./firebase.ts) so the app
 * boots even when env vars are missing during local dev.
 *
 * IMPORTANT: each `NEXT_PUBLIC_*` value must be read via a **literal**
 * property access (`process.env.NEXT_PUBLIC_FOO`). Next.js's build-time
 * inliner only substitutes `process.env.NEXT_PUBLIC_*` when it can see
 * the literal key in the source — dynamic access (`process.env[name]`)
 * leaves the lookup as-is, and at runtime in the browser `process.env`
 * is the empty inlined object, so every value comes back `undefined`.
 * This bit us hard once already; please don't refactor back to a generic
 * `get(key)` helper.
 */

const nonEmpty = (value: string | undefined): string | undefined => {
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
  NODE_ENV:
    (nonEmpty(process.env.NODE_ENV) as PhotogridEnv['NODE_ENV']) ?? 'development',
  NEXT_PUBLIC_APP_URL: nonEmpty(process.env.NEXT_PUBLIC_APP_URL),
  NEXT_PUBLIC_FIREBASE_API_KEY: nonEmpty(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: nonEmpty(
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  ),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: nonEmpty(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  ),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: nonEmpty(
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  ),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: nonEmpty(
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  ),
  NEXT_PUBLIC_FIREBASE_APP_ID: nonEmpty(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  NEXT_PUBLIC_API_URL: nonEmpty(process.env.NEXT_PUBLIC_API_URL),
};

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
