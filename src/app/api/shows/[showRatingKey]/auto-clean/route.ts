import { NextRequest } from 'next/server';
import { getCache, removeVersionFromCache } from '@/lib/scanner';
import { deleteMedia, refreshItem } from '@/lib/plex';
import { prisma } from '@/lib/db';

/**
 * Streams NDJSON progress events while bulk-deleting every non-preferred media
 * version on a show's auto-clean episodes. Each line is one JSON object:
 *   { type: 'start',    total }
 *   { type: 'progress', done, ok, failed, current }
 *   { type: 'done',     deleted, failed, errors }
 *
 * Client uses fetch + ReadableStream + TextDecoder, splitting on '\n'.
 */
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

  // Pre-compute every (episode, mediaId) to delete so we have a stable total
  const work: { ep: typeof targets[number]; mediaId: string; mediaIdx: number; size: number; resolution: string | null; videoCodec: string | null; file: string | null; quality: string[] }[] = [];
  for (const ep of targets) {
    const keepId = ep.seriesPref!.keepMediaId!;
    let idx = 0;
    for (const m of ep.media) {
      if (m.id === keepId) { idx++; continue; }
      work.push({
        ep, mediaId: m.id, mediaIdx: idx++,
        size: m.size, resolution: m.resolution, videoCodec: m.videoCodec, file: m.file, quality: m.quality,
      });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: any) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      send({ type: 'start', total: work.length, episodes: targets.length });

      let ok = 0, failed = 0;
      const errors: string[] = [];
      const touchedEpisodes = new Set<string>();

      for (let i = 0; i < work.length; i++) {
        const w = work[i];
        const { ok: success, msg } = await deleteMedia(w.ep.ratingKey, w.mediaId);
        await prisma.deletionLog.create({
          data: {
            ratingKey: w.ep.ratingKey,
            parentRatingKey: w.ep.parentRatingKey ?? null,
            title: w.ep.title,
            showTitle: w.ep.showTitle ?? null,
            seasonEpisode: w.ep.seasonEpisode ?? null,
            mediaId: w.mediaId,
            filePath: w.file,
            sizeBytes: BigInt(w.size),
            resolution: w.resolution,
            videoCodec: w.videoCodec,
            qualityTags: JSON.stringify(w.quality),
            status: success ? 'success' : 'failed',
            error: success ? null : msg,
            triggeredBy: 'series-pref-auto-clean',
          },
        });
        if (success) {
          ok++;
          removeVersionFromCache(w.ep.ratingKey, w.mediaId);
          touchedEpisodes.add(w.ep.ratingKey);
        } else {
          failed++;
          errors.push(`${w.ep.title}: ${msg}`);
        }
        send({ type: 'progress', done: i + 1, ok, failed, current: w.ep.title });
      }

      for (const rk of touchedEpisodes) refreshItem(rk).catch(() => {});
      send({ type: 'done', deleted: ok, failed, errors: errors.slice(0, 10) });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' },
  });
}
