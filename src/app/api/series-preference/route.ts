import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const rows = await prisma.seriesPreference.findMany({ orderBy: { showTitle: 'asc' } });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { showRatingKey, showTitle, sectionTitle, preferredResolution, preferredCodec, preferRemux, enabled, notes } = body;
  if (!showRatingKey || !showTitle) {
    return NextResponse.json({ error: 'showRatingKey and showTitle required' }, { status: 400 });
  }
  const saved = await prisma.seriesPreference.upsert({
    where: { showRatingKey: String(showRatingKey) },
    create: {
      showRatingKey: String(showRatingKey),
      showTitle: String(showTitle),
      sectionTitle: sectionTitle ?? null,
      preferredResolution: preferredResolution ?? null,
      preferredCodec: preferredCodec ?? null,
      preferRemux: !!preferRemux,
      enabled: enabled !== false,
      notes: notes ?? null,
    },
    update: {
      showTitle: String(showTitle),
      sectionTitle: sectionTitle ?? undefined,
      preferredResolution: preferredResolution ?? null,
      preferredCodec: preferredCodec ?? null,
      preferRemux: !!preferRemux,
      enabled: enabled !== false,
      notes: notes ?? null,
    },
  });
  return NextResponse.json(saved);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const showRatingKey = searchParams.get('showRatingKey');
  if (!showRatingKey) return NextResponse.json({ error: 'showRatingKey required' }, { status: 400 });
  await prisma.seriesPreference.deleteMany({ where: { showRatingKey } });
  return NextResponse.json({ deleted: showRatingKey });
}
