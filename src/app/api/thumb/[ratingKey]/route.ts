import { NextRequest, NextResponse } from 'next/server';

const PLEX = process.env.PLEX_BASE_URL ?? 'http://172.18.0.1:32400';
const TOKEN = process.env.PLEX_TOKEN ?? '';

export const dynamic = 'force-dynamic';

/**
 * Server-side thumb proxy. The browser can't reach Plex directly (it lives on
 * a docker network) and we don't want the X-Plex-Token in page source either,
 * so this thin route fetches the poster server-side and streams the bytes
 * back. Plex returns 404 when the item has no thumb — surface that as 404 so
 * <img onError> can fall back to a placeholder. We deliberately do NOT log
 * tokens or full Plex URLs at INFO level.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { ratingKey: string } },
) {
  const rk = params.ratingKey;
  if (!/^[a-zA-Z0-9_-]+$/.test(rk)) {
    return new NextResponse('bad rating key', { status: 400 });
  }
  if (!TOKEN) {
    return new NextResponse('plex token not configured', { status: 503 });
  }

  // Plex accepts the canonical metadata thumb URL keyed by ratingKey; the
  // optional timestamp segment is only used for cache-busting on the Plex
  // side and isn't required for the response.
  const url = new URL(`/library/metadata/${rk}/thumb`, PLEX);

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 15_000);
  let upstream: Response;
  try {
    upstream = await fetch(url.toString(), {
      signal: ac.signal,
      headers: { 'X-Plex-Token': TOKEN, Accept: 'image/*' },
    });
  } catch {
    clearTimeout(t);
    return new NextResponse('upstream fetch failed', { status: 502 });
  }
  clearTimeout(t);

  if (upstream.status === 404) {
    return new NextResponse('not found', { status: 404 });
  }
  if (!upstream.ok || !upstream.body) {
    return new NextResponse('upstream error', { status: 502 });
  }

  const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
  const contentLength = upstream.headers.get('content-length') ?? undefined;
  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
  };
  if (contentLength) headers['Content-Length'] = contentLength;

  return new NextResponse(upstream.body, { status: 200, headers });
}
