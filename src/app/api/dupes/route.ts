import { NextRequest, NextResponse } from 'next/server';
import { getCache, refreshDupes } from '@/lib/scanner';
import type { DupItem } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const cache = getCache();
  if (!cache.scannedAt && !cache.scanning) refreshDupes().catch(() => {});

  const { searchParams } = new URL(req.url);
  const library = searchParams.get('library'); // movie | show | anime
  const offset = Number(searchParams.get('offset') ?? 0);
  const limit = Math.min(Number(searchParams.get('limit') ?? 200), 1000);

  let items: DupItem[] = cache.items;
  if (library === 'movie') items = items.filter((x) => x.sectionType === 'movie');
  else if (library === 'show')
    items = items.filter((x) => x.sectionType === 'show' && !x.section.toLowerCase().includes('anime'));
  else if (library === 'anime') items = items.filter((x) => x.section.toLowerCase().includes('anime'));

  const totalForFilter = items.length;
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
  });
}
