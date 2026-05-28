import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { dropItemFromCache } from '@/lib/scanner';

export async function GET() {
  const rows = await prisma.ignoredItem.findMany({ orderBy: { ignoredAt: 'desc' } });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { ratingKey, title, type, reason } = body;
  if (!ratingKey) return NextResponse.json({ error: 'ratingKey required' }, { status: 400 });

  await prisma.ignoredItem.upsert({
    where: { ratingKey: String(ratingKey) },
    create: { ratingKey: String(ratingKey), title: title ?? null, type: type ?? null, reason: reason ?? null },
    update: { title: title ?? undefined, type: type ?? undefined, reason: reason ?? undefined },
  });
  dropItemFromCache(String(ratingKey));
  return NextResponse.json({ ignored: ratingKey });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rk = searchParams.get('ratingKey');
  if (!rk) return NextResponse.json({ error: 'ratingKey required' }, { status: 400 });
  await prisma.ignoredItem.deleteMany({ where: { ratingKey: rk } });
  return NextResponse.json({ unignored: rk });
}
