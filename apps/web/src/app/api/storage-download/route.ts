import { type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Server-side proxy that re-streams a Firebase Storage object with
 * `Content-Disposition: attachment` so the browser saves it instead
 * of trying to render it inline.
 *
 * Why this exists:
 *
 *   - The Firebase Storage `?alt=media` URLs are publicly accessible
 *     when they include the download token, but the bucket has no
 *     CORS configuration. That's fine for `<img>` (no CORS) but
 *     breaks `fetch()` from the storefront origin.
 *   - We could configure CORS on the bucket once via `gsutil`, but
 *     that requires the gcloud SDK in the deploy environment and is
 *     easy to forget. A serverless proxy keeps the configuration in
 *     the codebase and lets us also force a sensible filename per
 *     download.
 *
 * Security model: the upstream URL must point at the project's
 * Firebase Storage host (`firebasestorage.googleapis.com`). Anyone
 * holding a valid download URL can already fetch the file directly
 * via the public token, so the proxy doesn't relax the existing
 * security boundary — it just papers over CORS.
 */

const ALLOWED_HOST = 'firebasestorage.googleapis.com';
// Cap upstream wait. If Firebase is slow we'd rather give up than
// hold a Vercel function open until its global 60s budget expires.
const FETCH_TIMEOUT_MS = 45_000;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const target = params.get('url');
  const filename = params.get('filename') || 'photo.jpg';

  if (!target) {
    return new Response('Missing url', { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new Response('Invalid url', { status: 400 });
  }
  if (parsed.host !== ALLOWED_HOST) {
    return new Response('Forbidden host', { status: 403 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(parsed.toString(), {
      signal: controller.signal,
      // Storage's media URL is public + signed; we never need cookies.
      cache: 'no-store',
    });
    if (!upstream.ok || !upstream.body) {
      return new Response('Upstream error', { status: 502 });
    }

    // RFC 5987 compatible disposition — supports non-ASCII filenames
    // while keeping a plain ASCII fallback for older clients.
    const asciiSafe = filename.replace(/[^\x20-\x7E]/g, '_');
    const utf8Encoded = encodeURIComponent(filename);
    const disposition = `attachment; filename="${asciiSafe}"; filename*=UTF-8''${utf8Encoded}`;

    const headers = new Headers();
    const upstreamType =
      upstream.headers.get('content-type') || 'application/octet-stream';
    headers.set('content-type', upstreamType);
    headers.set('content-disposition', disposition);
    const upstreamLength = upstream.headers.get('content-length');
    if (upstreamLength) headers.set('content-length', upstreamLength);
    headers.set('cache-control', 'private, max-age=60');

    return new Response(upstream.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('[storage-download] proxy failed', error);
    return new Response('Proxy error', { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
