import type { CleanupCandidate } from './types';
import { listMoviesInSection, listShowsInSection, listSections } from './plex';

interface ScopedCache {
  scannedAt: number | null;
  scanning: boolean;
  items: CleanupCandidate[];
  error: string | null;
}

const cache: { movie: ScopedCache; show: ScopedCache } = {
  movie: { scannedAt: null, scanning: false, items: [], error: null },
  show: { scannedAt: null, scanning: false, items: [], error: null },
};

export function getCleanupCache(scope: 'movie' | 'show'): ScopedCache {
  return cache[scope];
}

function asArray(x: any): string[] {
  if (!Array.isArray(x)) return [];
  return x.map((o: any) => o?.tag).filter((s: any) => typeof s === 'string' && s.length > 0);
}

function totalSizeFromMedia(media: any[]): number {
  let s = 0;
  for (const m of media ?? []) {
    for (const p of m?.Part ?? []) s += Number(p?.size ?? 0);
  }
  return s;
}

function mapMovie(meta: any, sectionTitle: string): CleanupCandidate {
  const media = (meta.Media ?? []).map((m: any) => ({
    id: String(m.id),
    file: m.Part?.[0]?.file ?? null,
    size: Number(m.Part?.[0]?.size ?? 0),
    resolution: m.videoResolution ?? null,
    videoCodec: m.videoCodec ?? null,
    bitrate: Number(m.bitrate ?? 0),
    container: m.container ?? null,
    audioChannels: Number(m.audioChannels ?? 0),
    audioCodec: m.audioCodec ?? null,
    quality: [],
  }));
  return {
    ratingKey: String(meta.ratingKey),
    title: String(meta.title ?? ''),
    year: meta.year ?? null,
    sectionTitle,
    scope: 'movie',
    studio: meta.studio ?? null,
    genres: asArray(meta.Genre),
    collections: asArray(meta.Collection),
    thumb: meta.thumb ?? null,
    viewCount: Number(meta.viewCount ?? 0),
    lastViewedAt: meta.lastViewedAt ? Number(meta.lastViewedAt) : null,
    rating: meta.rating != null ? Number(meta.rating) : null,
    userRating: meta.userRating != null ? Number(meta.userRating) : null,
    audienceRating: meta.audienceRating != null ? Number(meta.audienceRating) : null,
    contentRating: meta.contentRating ?? null,
    totalSize: totalSizeFromMedia(meta.Media ?? []),
    media,
    matchedRules: [],
  };
}

function mapShow(meta: any, sectionTitle: string): CleanupCandidate {
  return {
    ratingKey: String(meta.ratingKey),
    title: String(meta.title ?? ''),
    year: meta.year ?? null,
    sectionTitle,
    scope: 'show',
    studio: meta.studio ?? null,
    genres: asArray(meta.Genre),
    collections: asArray(meta.Collection),
    thumb: meta.thumb ?? null,
    viewCount: Number(meta.viewCount ?? 0),
    lastViewedAt: meta.lastViewedAt ? Number(meta.lastViewedAt) : null,
    rating: meta.rating != null ? Number(meta.rating) : null,
    userRating: meta.userRating != null ? Number(meta.userRating) : null,
    audienceRating: meta.audienceRating != null ? Number(meta.audienceRating) : null,
    contentRating: meta.contentRating ?? null,
    totalSize: 0, // expensive to compute for shows; not loaded here
    leafCount: Number(meta.leafCount ?? 0),
    viewedLeafCount: Number(meta.viewedLeafCount ?? 0),
    media: [],
    matchedRules: [],
  };
}

export async function refreshCleanupCache(scope: 'movie' | 'show'): Promise<void> {
  const slot = cache[scope];
  if (slot.scanning) return;
  slot.scanning = true;
  slot.error = null;
  try {
    const sections = await listSections();
    const sectionType = scope === 'movie' ? 'movie' : 'show';
    const wanted = sections.filter((s: any) => s.type === sectionType);
    const items: CleanupCandidate[] = [];
    for (const sec of wanted) {
      try {
        const raw = scope === 'movie'
          ? await listMoviesInSection(String(sec.key))
          : await listShowsInSection(String(sec.key));
        for (const m of raw) {
          items.push(scope === 'movie' ? mapMovie(m, String(sec.title)) : mapShow(m, String(sec.title)));
        }
      } catch (e: any) {
        // Skip the section but keep going
        slot.error = (slot.error ? slot.error + '; ' : '') + `${sec.title}: ${e?.message ?? e}`;
      }
    }
    slot.items = items;
    slot.scannedAt = Math.floor(Date.now() / 1000);
  } catch (e: any) {
    slot.error = e?.message ?? String(e);
  } finally {
    slot.scanning = false;
  }
}
