import { NextRequest, NextResponse } from 'next/server';
import { getCache, removeVersionFromCache } from '@/lib/scanner';
import { deleteMedia, refreshItem } from '@/lib/plex';
import { prisma } from '@/lib/db';

export async function POST(
  _req: NextRequest,
  { params }: { params: { showRatingKey: string } },
) {
  const { showRatingKey } = params;
  const cache = getCache();
  const targets = cache.items.filter(
    (it) =>
      it.type === 'episode' &&
      String(it.grandparentRatingKey) === showRatingKey &&
      it.seriesPref?.status === 'autoClean' &&
      it.seriesPref.keepMediaId,
  );

  let deleted = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const ep of targets) {
    const keepId = ep.seriesPref!.keepMediaId!;
    for (const m of ep.media) {
      if (m.id === keepId) continue;
      const { ok, msg } = await deleteMedia(ep.ratingKey, m.id);
      await prisma.deletionLog.create({
        data: {
          ratingKey: ep.ratingKey,
          parentRatingKey: ep.parentRatingKey ?? null,
          title: ep.title,
          showTitle: ep.showTitle ?? null,
          seasonEpisode: ep.seasonEpisode ?? null,
          mediaId: m.id,
          filePath: m.file,
          sizeBytes: BigInt(m.size),
          resolution: m.resolution,
          videoCodec: m.videoCodec,
          qualityTags: JSON.stringify(m.quality),
          status: ok ? 'success' : 'failed',
          error: ok ? null : msg,
          triggeredBy: 'series-pref-auto-clean',
        },
      });
      if (ok) {
        deleted++;
        removeVersionFromCache(ep.ratingKey, m.id);
      } else {
        failed++;
        errors.push(`${ep.title}: ${msg}`);
      }
    }
    refreshItem(ep.ratingKey).catch(() => {});
  }

  return NextResponse.json({
    episodes: targets.length,
    deleted,
    failed,
    errors: errors.slice(0, 10),
  });
}
