import type { DupItem, MediaVersion, RuleAction, RuleMatch, RuleDTO } from './types';

declare module './types' {
  interface DupItem {
    /** rule-recommended action; UI uses this to highlight a "keep this" version */
    recommended?: { action: string; keepMediaId?: string; ruleName: string };
  }
}

function itemMatchesRule(it: DupItem, match: RuleMatch): boolean {
  if (match.titleRegex) {
    try {
      if (!new RegExp(match.titleRegex, 'i').test(it.title)) return false;
    } catch {
      return false;
    }
  }
  if (match.yearMin && (it.year ?? 0) < match.yearMin) return false;
  if (match.yearMax && (it.year ?? Infinity) > match.yearMax) return false;
  if (match.libraries?.length && !match.libraries.includes(it.section)) return false;

  const anyOf = (list: string[] | undefined, src: string[]): boolean => {
    if (!list?.length) return true;
    const setSrc = new Set(src.map((s) => s.toLowerCase()));
    return list.some((needle) => setSrc.has(needle.toLowerCase()));
  };
  if (!anyOf(match.genres, it.genres)) return false;
  if (!anyOf(match.collections, it.collections)) return false;
  if (!anyOf(match.studios, it.studios)) return false;
  return true;
}

function pickRecommendedVersion(it: DupItem, action: RuleAction): MediaVersion | null {
  if (it.media.length === 0) return null;
  switch (action.kind) {
    case 'prefer_resolution': {
      const target = (action.value ?? '2160p').toLowerCase();
      // Find versions matching the target resolution; pick the largest among them
      const match = it.media.filter((m) => (m.resolution ?? '').toLowerCase() === target);
      return match.length > 0 ? match[0] : it.media[0];
    }
    case 'prefer_codec': {
      const target = (action.value ?? 'x265').toLowerCase();
      const match = it.media.filter((m) => (m.videoCodec ?? '').toLowerCase().includes(target));
      return match.length > 0 ? match[0] : it.media[0];
    }
    case 'prefer_largest':
      return it.media[0];
    default:
      return null;
  }
}

/** Annotates each DupItem with a rule recommendation. Does NOT delete anything - UI uses the hint. */
export function applyRulesAnnotation(items: DupItem[], rules: { id: number; name: string; scope: string; matchJson: string; actionJson: string; appliedCount: number }[]): void {
  const parsed = rules
    .map((r) => {
      try {
        return {
          id: r.id,
          name: r.name,
          scope: r.scope as RuleDTO['scope'],
          match: JSON.parse(r.matchJson) as RuleMatch,
          action: JSON.parse(r.actionJson) as RuleAction,
        };
      } catch {
        return null;
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  for (const it of items) {
    const scopeOk = (scope: string) =>
      scope === 'all' ||
      (scope === 'movie' && it.type === 'movie') ||
      (scope === 'show' && (it.type === 'show' || it.type === 'episode')) ||
      (scope === 'anime' && it.section.toLowerCase().includes('anime'));

    for (const r of parsed) {
      if (!scopeOk(r.scope)) continue;
      if (!itemMatchesRule(it, r.match)) continue;

      if (r.action.kind === 'ignore' || r.action.kind === 'mark_review') {
        it.recommended = { action: r.action.kind, ruleName: r.name };
        break;
      }
      const v = pickRecommendedVersion(it, r.action);
      if (v) {
        it.recommended = {
          action: r.action.kind + (r.action.value ? `:${r.action.value}` : ''),
          keepMediaId: v.id,
          ruleName: r.name,
        };
        break;
      }
    }
  }
}
