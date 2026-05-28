import { NextResponse } from 'next/server';
import { getCache, refreshDupes } from '@/lib/scanner';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const cache = getCache();
  // Lazy first scan if never run
  if (!cache.scannedAt && !cache.scanning) {
    refreshDupes().catch(() => {});
  }
  return NextResponse.json(cache);
}
