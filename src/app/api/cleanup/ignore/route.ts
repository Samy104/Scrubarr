import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const rows = await prisma.cleanupIgnoredItem.findMany({ orderBy: { ignoredAt: 'desc' } });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const ratingKey = String(body.ratingKey ?? '');
  if (!ratingKey) return NextResponse.json({ error: 'ratingKey required' }, { status: 400 });
  const saved = await prisma.cleanupIgnoredItem.upsert({
    where: { ratingKey },
    create: {
      ratingKey,
      scope: body.scope === 'show' ? 'show' : 'movie',
      title: body.title ?? null,
      sectionTitle: body.sectionTitle ?? null,
      reason: body.reason ?? null,
    },
    update: {
      title: body.title ?? undefined,
      sectionTitle: body.sectionTitle ?? undefined,
      reason: body.reason ?? undefined,
    },
  });
  return NextResponse.json(saved);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ratingKey = searchParams.get('ratingKey');
  if (!ratingKey) return NextResponse.json({ error: 'ratingKey required' }, { status: 400 });
  await prisma.cleanupIgnoredItem.deleteMany({ where: { ratingKey } });
  return NextResponse.json({ restored: ratingKey });
}
