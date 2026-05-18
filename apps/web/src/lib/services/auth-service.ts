'use client';

import { env } from '@photogrid/config';

/**
 * Thin client for the FastAPI `/api/v1/auth/*` endpoints. Today this
 * only fronts the unauthenticated email-lookup used by the two-step
 * login screen — see `apps/api/app/api/v1/auth.py` for the contract.
 *
 * Falls back gracefully when:
 *   - `NEXT_PUBLIC_API_URL` is unset (local dev without the API), or
 *   - the API responds non-2xx, or
 *   - the network call throws.
 *
 * In every failure mode we return `'unknown'` so the login form can
 * still progress with neutral copy and rely on the existing
 * `signInOrCreate` fallback on submit.
 */

export type EmailLookupResult = 'exists' | 'new' | 'unknown';

function apiUrl(path: string): string | null {
  if (!env.NEXT_PUBLIC_API_URL) return null;
  const base = env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

export async function lookupEmailExists(email: string): Promise<EmailLookupResult> {
  const url = apiUrl('/api/v1/auth/lookup');
  if (!url) return 'unknown';

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!resp.ok) {
      return 'unknown';
    }
    const data = (await resp.json()) as { exists?: boolean };
    if (typeof data.exists !== 'boolean') return 'unknown';
    return data.exists ? 'exists' : 'new';
  } catch {
    return 'unknown';
  }
}
