import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { deleteItem } from '@/lib/plex';
import { getCleanupCache } from '@/lib/cleanupCache';

/**
 * Delete a single whole item (movie or show) from Plex + disk and write a deletion log row.
 * Body: { ratingKey, scope, triggeredBy? }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const ratingKey = String(body.ratingKey ?? '');
  const scope = body.scope === 'show' ? 'show' : 'movie';
  const triggeredBy = String(body.triggeredBy ?? 'cleanup');
  if (!ratingKey) return NextResponse.json({ ok: false, msg: 'ratingKey required' }, { status: 400 });

  const slot = getCleanupCache(scope);
  const item = slot.items.find((x) => x.ratingKey === ratingKey);

  const { ok, msg } = await deleteItem(ratingKey);
  await prisma.deletionLog.create({
    data: {
      ratingKey,
      title: item?.title ?? null,
      showTitle: null,
      seasonEpisode: null,
      mediaId: null,
      filePath: item?.media?.[0]?.file ?? null,
      sizeBytes: item ? BigInt(Math.floor(item.totalSize)) : null,
      resolution: item?.media?.[0]?.resolution ?? null,
      videoCodec: item?.media?.[0]?.videoCodec ?? null,
      qualityTags: null,
      status: ok ? 'success' : 'failed',
      error: ok ? null : msg,
      triggeredBy,
    },
  });

  if (ok) {
    // Drop from cache so the UI updates without a full refresh
    slot.items = slot.items.filter((x) => x.ratingKey !== ratingKey);
  }

  return NextResponse.json({ ok, msg });
}
