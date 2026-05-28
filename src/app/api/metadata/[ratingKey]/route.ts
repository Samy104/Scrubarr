import { NextRequest, NextResponse } from 'next/server';

const PLEX = process.env.PLEX_BASE_URL ?? 'http://172.18.0.1:32400';
const TOKEN = process.env.PLEX_TOKEN ?? '';

export const dynamic = 'force-dynamic';

/**
 * Slimmed Plex metadata proxy used by the in-app InfoModal. Plex returns a
 * fat XML/JSON blob with stream-level data, GUIDs, ultra-blur palettes etc.
 * We don't need any of that on the client -- only what the modal renders.
 *
 * Same security posture as the thumb proxy: never expose the X-Plex-Token,
 * never log the full upstream URL, validate the ratingKey format. The 5 min
 * cache is a compromise -- metadata changes less often than file state but
 * more often than we'd want a 24h freeze.
 */

type Slim = {
  ratingKey: string;
  type: 'movie' | 'show' | 'episode' | 'season';
  title: string;
  year: number | null;
  summary: string | null;
  tagline: string | null;
  studio: string | null;
  contentRating: string | null;
  duration: number | null;
  originallyAvailableAt: string | null;
  rating: number | null;
  audienceRating: number | null;
  genres: string[];
  directors: string[];
  writers: string[];
  actors: { name: string; role: string | null; thumb: string | null }[];
  thumbPath: string;
  artPath: string | null;
  showTitle?: string;
  showRatingKey?: string;
  seasonNumber?: number;
  episodeNumber?: number;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { ratingKey: string } },
) {
  const rk = params.ratingKey;
  if (!/^[a-zA-Z0-9_-]+$/.test(rk)) {
    return NextResponse.json({ error: 'bad rating key' }, { status: 400 });
  }
  if (!TOKEN) {
    return NextResponse.json({ error: 'plex token not configured' }, { status: 503 });
  }

  const url = new URL(`/library/metadata/${rk}`, PLEX);

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 15_000);
  let upstream: Response;
  try {
    upstream = await fetch(url.toString(), {
      signal: ac.signal,
      headers: {
        'X-Plex-Token': TOKEN,
        Accept: 'application/json',
      },
    });
  } catch {
    clearTimeout(t);
    return NextResponse.json({ error: 'upstream fetch failed' }, { status: 502 });
  }
  clearTimeout(t);

  if (upstream.status === 404) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  if (!upstream.ok) {
    return NextResponse.json({ error: 'upstream error' }, { status: 502 });
  }

  let body: any;
  try {
    body = await upstream.json();
  } catch {
    return NextResponse.json({ error: 'upstream parse error' }, { status: 502 });
  }

  const meta = body?.MediaContainer?.Metadata?.[0];
  if (!meta) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const rawType = String(meta.type ?? '');
  const type: Slim['type'] =
    rawType === 'movie' || rawType === 'show' || rawType === 'episode' || rawType === 'season'
      ? rawType
      : 'movie';

  // For episodes the most useful art is the show's backdrop. Plex hands us
  // grandparentArt on episode payloads -- prefer that, otherwise fall back to
  // whatever art the item has.
  const hasArt = !!(meta.art || meta.grandparentArt || meta.parentArt);
  const artRatingKey =
    type === 'episode'
      ? String(meta.grandparentRatingKey ?? meta.parentRatingKey ?? rk)
      : rk;

  const slim: Slim = {
    ratingKey: String(meta.ratingKey ?? rk),
    type,
    title: String(meta.title ?? ''),
    year: typeof meta.year === 'number' ? meta.year : null,
    summary: meta.summary ? String(meta.summary) : null,
    tagline: meta.tagline ? String(meta.tagline) : null,
    studio: meta.studio ? String(meta.studio) : null,
    contentRating: meta.contentRating ? String(meta.contentRating) : null,
    duration: typeof meta.duration === 'number' ? meta.duration : null,
    originallyAvailableAt: meta.originallyAvailableAt ? String(meta.originallyAvailableAt) : null,
    rating: typeof meta.rating === 'number' ? meta.rating : null,
    audienceRating: typeof meta.audienceRating === 'number' ? meta.audienceRating : null,
    genres: tagList(meta.Genre),
    directors: tagList(meta.Director),
    writers: tagList(meta.Writer),
    actors: roleList(meta.Role).slice(0, 12),
    thumbPath: `/api/thumb/${encodeURIComponent(String(meta.ratingKey ?? rk))}`,
    artPath: hasArt ? `/api/thumb/${encodeURIComponent(artRatingKey)}/art` : null,
  };

  if (type === 'episode') {
    if (meta.grandparentTitle) slim.showTitle = String(meta.grandparentTitle);
    if (meta.grandparentRatingKey) slim.showRatingKey = String(meta.grandparentRatingKey);
    if (typeof meta.parentIndex === 'number') slim.seasonNumber = meta.parentIndex;
    if (typeof meta.index === 'number') slim.episodeNumber = meta.index;
  } else if (type === 'season') {
    if (meta.parentTitle) slim.showTitle = String(meta.parentTitle);
    if (meta.parentRatingKey) slim.showRatingKey = String(meta.parentRatingKey);
    if (typeof meta.index === 'number') slim.seasonNumber = meta.index;
  }

  return NextResponse.json(slim, {
    status: 200,
    headers: {
      'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
    },
  });
}

function tagList(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x: any) => (x && typeof x.tag === 'string' ? x.tag : null))
    .filter((x): x is string => !!x);
}

function roleList(arr: unknown): { name: string; role: string | null; thumb: string | null }[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x: any) => {
      if (!x || typeof x.tag !== 'string') return null;
      return {
        name: x.tag,
        role: typeof x.role === 'string' && x.role ? x.role : null,
        // Plex returns a public CDN URL for Role.thumb (metadata-static.plex.tv),
        // which the browser can fetch without auth. We pass it through as-is.
        thumb: typeof x.thumb === 'string' && x.thumb ? x.thumb : null,
      };
    })
    .filter((x): x is { name: string; role: string | null; thumb: string | null } => !!x);
}
