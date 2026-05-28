import { NextRequest, NextResponse } from 'next/server';
import { refreshCleanupCache } from '@/lib/cleanupCache';

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get('scope') === 'show' ? 'show' : 'movie';
  refreshCleanupCache(scope).catch(() => {});
  return NextResponse.json({ queued: true, scope });
}
