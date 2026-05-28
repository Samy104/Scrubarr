import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? 500), 5000);
  const offset = Number(searchParams.get('offset') ?? 0);

  const [entries, totalFreedAgg, totalSuccess, totalFail] = await Promise.all([
    prisma.deletionLog.findMany({
      orderBy: { deletedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.deletionLog.aggregate({
      where: { status: 'success' },
      _sum: { sizeBytes: true },
    }),
    prisma.deletionLog.count({ where: { status: 'success' } }),
    prisma.deletionLog.count({ where: { status: 'failed' } }),
  ]);

  const totalFreed = totalFreedAgg._sum.sizeBytes ?? BigInt(0);
  return NextResponse.json({
    totalFreedBytes: totalFreed.toString(),
    totalSuccessCount: totalSuccess,
    totalFailedCount: totalFail,
    entries: entries.map((e) => ({
      id: e.id,
      ratingKey: e.ratingKey,
      title: e.title,
      showTitle: e.showTitle,
      seasonEpisode: e.seasonEpisode,
      mediaId: e.mediaId,
      file: e.filePath,
      size: e.sizeBytes ? e.sizeBytes.toString() : null,
      resolution: e.resolution,
      videoCodec: e.videoCodec,
      quality: e.qualityTags ? JSON.parse(e.qualityTags) : [],
      deletedAt: e.deletedAt.toISOString(),
      status: e.status,
      error: e.error,
      triggeredBy: e.triggeredBy,
    })),
  });
}
