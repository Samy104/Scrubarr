import type {
  CleanupCandidate,
  CleanupRuleConditions,
  CleanupRuleDTO,
  CleanupRuleMatch,
  NumRange,
} from './types';

/** Decode the JSON columns of a prisma CleanupRule row into the strongly-typed DTO. */
export function decodeRule(row: any): CleanupRuleDTO {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    scope: row.scope,
    kind: row.kind,
    priority: row.priority,
    enabled: row.enabled,
    match: safeJson<CleanupRuleMatch>(row.matchJson, {}),
    conditions: safeJson<CleanupRuleConditions>(row.conditionsJson, {}),
  };
}

function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

function inRange(n: number | null | undefined, r: NumRange | undefined): boolean {
  if (!r) return true;
  if (n == null) return false;
  if (r.min != null && n < r.min) return false;
  if (r.max != null && n > r.max) return false;
  return true;
}

function ciIncludesAny(needle: string | null | undefined, hay: string[] | undefined): boolean {
  if (!hay || hay.length === 0) return true;
  if (!needle) return false;
  const n = needle.toLowerCase();
  return hay.some((h) => n.includes(h.toLowerCase()));
}

function arrayIntersects(list: string[], needles: string[] | undefined): boolean {
  if (!needles || needles.length === 0) return true;
  const lower = new Set(list.map((s) => s.toLowerCase()));
  return needles.some((n) => lower.has(n.toLowerCase()));
}

/** Does the library-side match clause pass for this candidate? */
export function matchClause(c: CleanupCandidate, m: CleanupRuleMatch): boolean {
  if (m.titleRegex) {
    try { if (!new RegExp(m.titleRegex, 'i').test(c.title)) return false; } catch { /* invalid regex = no match */ return false; }
  }
  if (m.yearMin != null && (c.year ?? -1) < m.yearMin) return false;
  if (m.yearMax != null && (c.year ?? 99_999) > m.yearMax) return false;
  if (m.libraries && m.libraries.length > 0 && !arrayIntersects([c.sectionTitle], m.libraries)) return false;
  if (m.genres && m.genres.length > 0 && !arrayIntersects(c.genres, m.genres)) return false;
  // Either-of: any matching condition counts as a hit for studios+collections so
  // a rule can say "DC studios OR DC Extended Universe collection".
  const hasStudio = m.studios && m.studios.length > 0;
  const hasColl   = m.collections && m.collections.length > 0;
  if (hasStudio || hasColl) {
    const studioHit = hasStudio ? ciIncludesAny(c.studio, m.studios) : false;
    const collHit   = hasColl   ? arrayIntersects(c.collections, m.collections) : false;
    if (!studioHit && !collHit) return false;
  }
  if (m.contentRatings && m.contentRatings.length > 0 && !arrayIntersects([c.contentRating ?? ''], m.contentRatings)) return false;
  return true;
}

/** Do the eligibility conditions pass for this candidate? */
export function conditionsClause(c: CleanupCandidate, cond: CleanupRuleConditions): boolean {
  if (cond.neverViewed != null) {
    const never = c.viewCount === 0 || c.lastViewedAt == null;
    if (cond.neverViewed !== never) return false;
  }
  if (!inRange(c.viewCount, cond.viewCount)) return false;
  if (cond.daysSinceLastView) {
    const days = c.lastViewedAt ? Math.floor((Date.now() / 1000 - c.lastViewedAt) / 86_400) : null;
    if (!inRange(days, cond.daysSinceLastView)) return false;
  }
  if (!inRange(c.rating, cond.rating)) return false;
  if (!inRange(c.userRating, cond.userRating)) return false;
  if (!inRange(c.audienceRating, cond.audienceRating)) return false;
  if (cond.showCompletion && c.leafCount && c.leafCount > 0) {
    const pct = (c.viewedLeafCount ?? 0) / c.leafCount;
    if (!inRange(pct, cond.showCompletion)) return false;
  }
  return true;
}

/**
 * Evaluate rules against one candidate.
 * Returns: list of rules matched (exception OR eligibility) and the final decision.
 */
export function evaluate(c: CleanupCandidate, rules: CleanupRuleDTO[]): {
  isCandidate: boolean;
  reasons: { id: number; name: string; kind: 'exception' | 'eligibility' }[];
} {
  const scoped = rules.filter((r) => r.enabled && r.scope === c.scope).sort((a, b) => a.priority - b.priority);

  const matchedExceptions: typeof scoped = [];
  const matchedEligibilities: typeof scoped = [];

  for (const r of scoped) {
    if (!matchClause(c, r.match)) continue;
    if (r.kind === 'exception') {
      matchedExceptions.push(r);
    } else if (conditionsClause(c, r.conditions)) {
      matchedEligibilities.push(r);
    }
  }

  // Exception always wins: if any exception matches, this item is NOT a candidate.
  const isCandidate = matchedExceptions.length === 0 && matchedEligibilities.length > 0;
  const reasons = [...matchedExceptions, ...matchedEligibilities].map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
  }));
  return { isCandidate, reasons };
}
