import { NextRequest, NextResponse } from 'next/server';
import { deleteMedia, refreshItem } from '@/lib/plex';
import { prisma } from '@/lib/db';
import { getCache, removeVersionFromCache } from '@/lib/scanner';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { ratingKey: string; mediaId: string } },
) {
  const { ratingKey, mediaId } = params;
  const cache = getCache();
  const matched = cache.items.find((d) => d.ratingKey === ratingKey);
  const media = matched?.media.find((m) => m.id === mediaId);

  const { ok, msg } = await deleteMedia(ratingKey, mediaId);

  await prisma.deletionLog.create({
    data: {
      ratingKey,
      parentRatingKey: matched?.parentRatingKey,
      title: matched?.title ?? null,
      showTitle: matched?.showTitle ?? null,
      seasonEpisode: matched?.seasonEpisode ?? null,
      mediaId,
      filePath: media?.file ?? null,
      sizeBytes: media?.size ? BigInt(media.size) : null,
      resolution: media?.resolution ?? null,
      videoCodec: media?.videoCodec ?? null,
      qualityTags: media?.quality ? JSON.stringify(media.quality) : null,
      status: ok ? 'success' : 'failed',
      error: ok ? null : msg,
      triggeredBy: 'user',
    },
  });

  if (ok) {
    removeVersionFromCache(ratingKey, mediaId);
    refreshItem(ratingKey).catch(() => {});
  }
  return NextResponse.json({ ok, msg });
}
