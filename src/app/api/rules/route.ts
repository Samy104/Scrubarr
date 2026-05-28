import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const rows = await prisma.rule.findMany({ orderBy: [{ priority: 'asc' }, { id: 'asc' }] });
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      scope: r.scope,
      priority: r.priority,
      enabled: r.enabled,
      match: JSON.parse(r.matchJson),
      action: JSON.parse(r.actionJson),
      appliedCount: r.appliedCount,
    })),
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, name, description, scope, priority, enabled, match, action } = body;

  const data = {
    name: String(name ?? 'Untitled rule'),
    description: description ? String(description) : null,
    scope: scope ?? 'all',
    priority: typeof priority === 'number' ? priority : 100,
    enabled: enabled !== false,
    matchJson: JSON.stringify(match ?? {}),
    actionJson: JSON.stringify(action ?? { kind: 'mark_review' }),
  };

  if (id) {
    const updated = await prisma.rule.update({ where: { id: Number(id) }, data });
    return NextResponse.json(updated);
  }
  const created = await prisma.rule.create({ data });
  return NextResponse.json(created);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await prisma.rule.delete({ where: { id } });
  return NextResponse.json({ deleted: id });
}
