import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { decodeRule, evaluate } from '@/lib/cleanupRules';
import { getCleanupCache, refreshCleanupCache } from '@/lib/cleanupCache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Evaluate the cleanup rules against the live Plex library and return:
 *  - the full library annotated with matchedRules
 *  - the subset that are deletion candidates
 *
 * Query: scope=movie|show (required), refresh=1 to force re-fetch from Plex.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get('scope') === 'show' ? 'show' : 'movie';
  const force = searchParams.get('refresh') === '1';

  const slot = getCleanupCache(scope);
  if (force || (!slot.scannedAt && !slot.scanning)) {
    refreshCleanupCache(scope).catch(() => {});
  }

  const [ruleRows, ignored] = await Promise.all([
    prisma.cleanupRule.findMany({ where: { scope } }),
    prisma.cleanupIgnoredItem.findMany({ where: { scope }, select: { ratingKey: true } }),
  ]);
  const rules = ruleRows.map(decodeRule);
  const ignoredSet = new Set(ignored.map((r) => r.ratingKey));
  const annotated = slot.items.map((c) => {
    const { isCandidate, reasons } = evaluate(c, rules);
    const ignoredFlag = ignoredSet.has(c.ratingKey);
    return { ...c, matchedRules: reasons, isCandidate: isCandidate && !ignoredFlag, ignored: ignoredFlag };
  });
  const candidateCount = annotated.reduce((a, x: any) => a + (x.isCandidate ? 1 : 0), 0);
  const totalSize = annotated.reduce((a, x: any) => a + (x.isCandidate ? x.totalSize || 0 : 0), 0);

  return NextResponse.json({
    scope,
    scannedAt: slot.scannedAt,
    scanning: slot.scanning,
    error: slot.error,
    libraryCount: annotated.length,
    candidateCount,
    totalSize,
    // Return the full annotated library so the UI can toggle between
    // "candidates only" and "full library". The list keeps the isCandidate flag.
    candidates: annotated,
  });
}
