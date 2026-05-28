import { NextRequest, NextResponse } from 'next/server';
import { getCache, refreshDupes } from '@/lib/scanner';
import { applySeriesPreferences } from '@/lib/seriesPref';
import { prisma } from '@/lib/db';
import type { DupItem } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const cache = getCache();
  if (!cache.scannedAt && !cache.scanning) refreshDupes().catch(() => {});

  // Re-apply series preferences on every request so newly saved prefs take effect
  // without waiting for a Plex rescan. Cheap: pure annotation pass over cached items.
  const prefs = await prisma.seriesPreference.findMany();
  applySeriesPreferences(cache.items, prefs);

  const { searchParams } = new URL(req.url);
  const library = searchParams.get('library'); // movie | show | anime | episodes
  const offset = Number(searchParams.get('offset') ?? 0);
  const limit = Math.min(Number(searchParams.get('limit') ?? 200), 1000);

  let items: DupItem[] = cache.items;
  if (library === 'movie') items = items.filter((x) => x.sectionType === 'movie');
  else if (library === 'show')
    items = items.filter((x) => x.sectionType === 'show' && !x.section.toLowerCase().includes('anime'));
  else if (library === 'anime') items = items.filter((x) => x.section.toLowerCase().includes('anime'));
  else if (library === 'episodes') items = items.filter((x) => x.sectionType !== 'movie');

  const totalForFilter = items.length;
  let totalSize = 0;
  let savingsPotential = 0;
  for (const it of items) {
    totalSize += it.totalSize || 0;
    savingsPotential += it.savingsPotential || 0;
  }
  const sliced = items.slice(offset, offset + limit);

  return NextResponse.json({
    scannedAt: cache.scannedAt,
    scanning: cache.scanning,
    count: totalForFilter,
    durationSec: cache.durationSec,
    error: cache.error,
    items: sliced,
    offset,
    limit,
    hasMore: offset + sliced.length < totalForFilter,
    totals: { count: totalForFilter, totalSize, savingsPotential },
  });
}
