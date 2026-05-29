import { NextRequest } from 'next/server';
import { getCache, removeVersionFromCache } from '@/lib/scanner';
import { deleteMedia, refreshItem } from '@/lib/plex';
import { prisma } from '@/lib/db';
import { normRes } from '@/lib/seriesPref';
import type { DupItem, MediaVersion } from '@/lib/types';

interface BulkCleanBody {
  /** Show ratingKeys to apply the temporary preference against. */
  showRatingKeys: string[];
  /** Preferred resolution tier (e.g. "1080"). Required. */
  prefResolution: string;
  /** Optional preferred video codec substring (e.g. "hevc"). */
  prefCodec?: string;
  /** Tag persisted in DeletionLog.triggeredBy so the audit trail is searchable. */
  triggeredBy?: string;
}

interface WorkItem {
  ep: DupItem;
  mediaId: string;
  size: number;
  resolution: string | null;
  videoCodec: string | null;
  file: string | null;
  quality: string[];
}

/**
 * Streams NDJSON progress events while bulk-deleting every non-preferred
 * media version on every episode of every supplied show, using an in-memory
 * temporary preference (no DB writes). The event shape is identical to the
 * per-show auto-clean stream so the same client reader can handle both:
 *
 *   { type: 'start',    total, episodes, shows }
 *   { type: 'progress', done, ok, failed, current }
 *   { type: 'done',     deleted, failed, errors }
 *
 * The "current" field is the episode title (with the show prefix when there
 * are multiple shows in flight).
 */
export async function POST(req: NextRequest) {
  let body: BulkCleanBody;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }
  const showKeys = Array.isArray(body.showRatingKeys) ? body.showRatingKeys.map(String) : [];
  const prefResolution = normRes(body.prefResolution ?? '');
  const prefCodec = (body.prefCodec ?? '').toLowerCase();
  if (showKeys.length === 0) return new Response('showRatingKeys is required', { status: 400 });
  if (!prefResolution) return new Response('prefResolution is required', { status: 400 });
  const triggeredBy = body.triggeredBy ?? 'bulk-keep-resolution';

  const cache = getCache();
  const showSet = new Set(showKeys);

  // Choose the keep candidate per episode: largest matching version wins.
  const pickKeep = (ep: DupItem): MediaVersion | null => {
    const candidates = ep.media.filter((m) => {
      if (normRes(m.resolution) !== prefResolution) return false;
      if (prefCodec && !(m.videoCodec ?? '').toLowerCase().includes(prefCodec)) return false;
      return true;
    });
    if (candidates.length === 0) return null;
    return [...candidates].sort((a, b) => (b.size ?? 0) - (a.size ?? 0))[0];
  };

  const work: WorkItem[] = [];
  const touchedEpisodes = new Set<string>();
  const skippedEpisodes: string[] = [];

  for (const it of cache.items) {
    if (it.type !== 'episode') continue;
    if (!showSet.has(String(it.grandparentRatingKey))) continue;
    const keep = pickKeep(it);
    if (!keep) {
      skippedEpisodes.push(it.title);
      continue;
    }
    for (const m of it.media) {
      if (m.id === keep.id) continue;
      work.push({
        ep: it,
        mediaId: m.id,
        size: m.size,
        resolution: m.resolution,
        videoCodec: m.videoCodec,
        file: m.file,
        quality: m.quality,
      });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      const episodesInScope = new Set(work.map((w) => w.ep.ratingKey)).size;
      send({
        type: 'start',
        total: work.length,
        episodes: episodesInScope,
        shows: showSet.size,
        skipped: skippedEpisodes.length,
      });

      let ok = 0;
      let failed = 0;
      const errors: string[] = [];

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
            triggeredBy,
          },
        });
        const label = w.ep.showTitle ? `${w.ep.showTitle} — ${w.ep.title}` : w.ep.title;
        if (success) {
          ok++;
          removeVersionFromCache(w.ep.ratingKey, w.mediaId);
          touchedEpisodes.add(w.ep.ratingKey);
        } else {
          failed++;
          errors.push(`${label}: ${msg}`);
        }
        send({ type: 'progress', done: i + 1, ok, failed, current: label });
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
