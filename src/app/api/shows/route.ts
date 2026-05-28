import { NextRequest, NextResponse } from 'next/server';
import { getCache } from '@/lib/scanner';
import { buildShowSummaries } from '@/lib/seriesPref';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const cache = getCache();
  const prefs = await prisma.seriesPreference.findMany();
  const summaries = buildShowSummaries(cache.items, prefs);

  const { searchParams } = new URL(req.url);
  const library = searchParams.get('library'); // show | anime
  let filtered = summaries;
  if (library === 'show') filtered = filtered.filter((s) => !s.sectionTitle.toLowerCase().includes('anime'));
  else if (library === 'anime') filtered = filtered.filter((s) => s.sectionTitle.toLowerCase().includes('anime'));

  return NextResponse.json({
    count: filtered.length,
    items: filtered,
    scannedAt: cache.scannedAt,
    scanning: cache.scanning,
  });
}
