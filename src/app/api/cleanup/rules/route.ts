import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { decodeRule } from '@/lib/cleanupRules';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get('scope');
  const where = scope ? { scope } : {};
  const rows = await prisma.cleanupRule.findMany({
    where,
    orderBy: [{ priority: 'asc' }, { id: 'asc' }],
  });
  return NextResponse.json(rows.map(decodeRule));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const data = {
    name: String(body.name ?? '').trim(),
    description: body.description ?? null,
    scope: body.scope === 'show' ? 'show' : 'movie',
    kind: body.kind === 'exception' ? 'exception' : 'eligibility',
    priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : 50,
    enabled: body.enabled !== false,
    matchJson: JSON.stringify(body.match ?? {}),
    conditionsJson: JSON.stringify(body.conditions ?? {}),
  };
  if (!data.name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  let saved;
  if (Number.isFinite(Number(body.id))) {
    saved = await prisma.cleanupRule.update({ where: { id: Number(body.id) }, data });
  } else {
    saved = await prisma.cleanupRule.create({ data });
  }
  return NextResponse.json(decodeRule(saved));
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id'));
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await prisma.cleanupRule.delete({ where: { id } });
  return NextResponse.json({ deleted: id });
}
