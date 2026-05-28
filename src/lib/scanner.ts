import { listSections, listDuplicateMovies, listDuplicateEpisodesInSection } from './plex';
import { prisma } from './db';
import { humanSize } from './format';
import { applyRulesAnnotation } from './rules';
import { applySeriesPreferences } from './seriesPref';
import type { DupItem, MediaVersion, ScanCache, MediaType } from './types';

const QUALITY_RE = new RegExp(
  '(2160p|1080p|720p|480p|4K|UHD|REMUX|BluRay|BDRip|WEB-?DL|WEB-?Rip|' +
    'HDRip|DVDRip|HEVC|x265|x264|AV1|H\\.?264|H\\.?265|HDR10\\+?|HDR|' +
    'Dolby[._ ]?Vision|DV|10bit|Atmos|DTS-?HD|DTS-?X|TrueHD|DDP|DD5\\.1|' +
    'PROPER|REPACK|IMAX|EXTENDED|DIRECTORS|UNCUT|MULTI|FRENCH|TRUEFRENCH|VFF|VFI|VFQ)',
  'gi',
);

const ALIAS: Record<string, string> = {
  '4K': '2160P', UHD: '2160P', H264: 'X264', H265: 'X265', WEBDL: 'WEB-DL', WEBRIP: 'WEB-RIP',
};

export function parseQuality(filename: string): string[] {
  if (!filename) return [];
  const tags = new Set<string>();
  for (const m of filename.matchAll(QUALITY_RE)) {
    let t = m[0].toUpperCase().replace(/[.\s]/g, '');
    t = ALIAS[t] ?? t;
    tags.add(t);
  }
  return Array.from(tags);
}

function buildMediaList(item: any): MediaVersion[] {
  const out: MediaVersion[] = [];
  for (const m of item.Media ?? []) {
    const parts = m.Part ?? [];
    const size = parts.reduce((acc: number, p: any) => acc + (Number(p.size) || 0), 0);
    const file = parts[0]?.file ?? '';
    out.push({
      id: String(m.id),
      size,
      sizeHuman: humanSize(size),
      resolution: m.videoResolution ?? '?',
      videoCodec: m.videoCodec ?? '?',
      videoFrameRate: m.videoFrameRate,
      audioCodec: m.audioCodec ?? '?',
      audioChannels: m.audioChannels,
      bitrate: m.bitrate ?? 0,
      durationMin: Math.floor((m.duration ?? 0) / 60_000),
      container: m.container,
      file,
      quality: parseQuality(file),
      partCount: parts.length,
    });
  }
  out.sort((a, b) => b.size - a.size);
  return out;
}

function libraryTypeToScope(sectionTitle: string, sectionType: string): 'movie' | 'show' | 'anime' {
  if (sectionType === 'movie') return 'movie';
  if (sectionTitle.toLowerCase().includes('anime')) return 'anime';
  return 'show';
}

const STATE: ScanCache = {
  scannedAt: null,
  scanning: false,
  count: 0,
  items: [],
  error: null,
  durationSec: 0,
};

export function getCache(): ScanCache {
  return STATE;
}

/** Reconciles in-memory cache against a fresh scan, dropping items that no longer have ≥2 media. */
export async function refreshDupes(): Promise<{ count: number; durationSec: number; error?: string }> {
  if (STATE.scanning) return { count: STATE.count, durationSec: 0, error: 'already scanning' };
  STATE.scanning = true;
  STATE.error = null;
  const t0 = Date.now();

  try {
    const sections = await listSections();
    const ignoredKeys = new Set(
      (await prisma.ignoredItem.findMany({ select: { ratingKey: true } })).map((r) => r.ratingKey),
    );

    const all: DupItem[] = [];

    for (const sec of sections) {
      if (sec.type !== 'movie' && sec.type !== 'show') continue;

      if (sec.type === 'movie') {
        const items = await listDuplicateMovies(sec.key);
        for (const it of items) {
          const rk = String(it.ratingKey);
          if (ignoredKeys.has(rk)) continue;
          const media = buildMediaList(it);
          if (media.length < 2) continue;
          all.push(toDupItem(it, media, sec, 'movie'));
        }
      } else {
        // TV / Anime: one call returns every duplicate episode in the library
        const dupEps = await listDuplicateEpisodesInSection(sec.key);
        for (const ep of dupEps) {
          const rk = String(ep.ratingKey);
          if (ignoredKeys.has(rk)) continue;
          if (ignoredKeys.has(String(ep.grandparentRatingKey))) continue;
          const media = buildMediaList(ep);
          if (media.length < 2) continue;
          const sxe =
            ep.parentIndex != null && ep.index != null
              ? `S${String(ep.parentIndex).padStart(2, '0')}E${String(ep.index).padStart(2, '0')}`
              : '';
          all.push(
            toDupItem(ep, media, sec, 'episode', {
              showTitle: ep.grandparentTitle ?? '',
              seasonEpisode: sxe,
              parentRatingKey: ep.parentRatingKey,
              grandparentRatingKey: ep.grandparentRatingKey,
            }),
          );
        }
      }
    }

    // Apply rule annotations (does NOT delete - just marks recommended action per item)
    const rules = await prisma.rule.findMany({ where: { enabled: true }, orderBy: { priority: 'asc' } });
    applyRulesAnnotation(all, rules);

    // Apply per-series preferences (TV/Anime only)
    const prefs = await prisma.seriesPreference.findMany();
    applySeriesPreferences(all, prefs);

    all.sort((a, b) => b.savingsPotential - a.savingsPotential);
    STATE.items = all;
    STATE.count = all.length;
    STATE.scannedAt = Math.floor(Date.now() / 1000);
    STATE.durationSec = Math.round((Date.now() - t0) / 1000);

    await prisma.scanState.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        lastScanAt: new Date(),
        lastScanCount: all.length,
        lastScanDuration: STATE.durationSec,
      },
      update: {
        lastScanAt: new Date(),
        lastScanCount: all.length,
        lastScanDuration: STATE.durationSec,
        lastScanError: null,
      },
    });
  } catch (e) {
    STATE.error = e instanceof Error ? e.message : String(e);
    await prisma.scanState
      .upsert({
        where: { id: 1 },
        create: { id: 1, lastScanError: STATE.error },
        update: { lastScanError: STATE.error },
      })
      .catch(() => {});
  } finally {
    STATE.scanning = false;
  }
  return { count: STATE.count, durationSec: STATE.durationSec, error: STATE.error ?? undefined };
}

function toDupItem(
  raw: any,
  media: MediaVersion[],
  sec: { key: string; title: string; type: string },
  type: MediaType,
  extra: Partial<DupItem> = {},
): DupItem {
  const totalSize = media.reduce((a, m) => a + m.size, 0);
  const largest = media[0]?.size ?? 0;
  return {
    ratingKey: String(raw.ratingKey),
    type,
    title: raw.title ?? '',
    year: raw.year,
    section: sec.title,
    sectionKey: sec.key,
    sectionType: sec.type as 'movie' | 'show',
    collections: (raw.Collection ?? []).map((c: any) => c.tag),
    genres: (raw.Genre ?? []).map((g: any) => g.tag),
    studios: raw.studio ? [raw.studio] : [],
    media,
    totalSize,
    totalSizeHuman: humanSize(totalSize),
    savingsPotential: totalSize - largest,
    savingsHuman: humanSize(totalSize - largest),
    versionCount: media.length,
    thumb: raw.thumb,
    ...extra,
  };
}

/** Drops a single item from the cache after delete/ignore - keeps UI snappy without a full rescan. */
export function dropItemFromCache(ratingKey: string): void {
  STATE.items = STATE.items.filter((it) => it.ratingKey !== ratingKey);
  STATE.count = STATE.items.length;
}

/** Removes a single media version from a cached item; drops the item if now <2 versions. */
export function removeVersionFromCache(ratingKey: string, mediaId: string): void {
  const idx = STATE.items.findIndex((it) => it.ratingKey === ratingKey);
  if (idx < 0) return;
  const it = STATE.items[idx];
  it.media = it.media.filter((m) => m.id !== mediaId);
  it.versionCount = it.media.length;
  it.totalSize = it.media.reduce((a, m) => a + m.size, 0);
  const largest = it.media[0]?.size ?? 0;
  it.savingsPotential = it.totalSize - largest;
  it.totalSizeHuman = humanSize(it.totalSize);
  it.savingsHuman = humanSize(it.savingsPotential);
  if (it.versionCount < 2) {
    STATE.items.splice(idx, 1);
    STATE.count = STATE.items.length;
  }
}
