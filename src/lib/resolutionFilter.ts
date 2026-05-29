import { normRes } from './seriesPref';

/**
 * Resolution-mix bucket identifiers. Each bucket describes a shape of the
 * resolution set on a single item (DupItem) or aggregated set on a show
 * (ShowSummary.resolutionMix). The buckets are mutually exclusive only where
 * the names imply it (e.g. 1080-720 means EXACTLY {1080, 720}); '4k-any' and
 * '720-any' are overlapping families used for bulk drop-720 style actions.
 */
export type ResolutionBucket =
  | 'all'
  | '1080-only'
  | '720-only'
  | '1080-720'
  | '4k-1080'
  | 'all-three'
  | '4k-any'
  | '720-any';

export const RESOLUTION_BUCKETS: { value: ResolutionBucket; label: string }[] = [
  { value: 'all', label: 'All resolutions' },
  { value: '1080-only', label: '1080p only' },
  { value: '720-only', label: '720p or lower only' },
  { value: '1080-720', label: '1080p + 720p (no 4K)' },
  { value: '4k-1080', label: '4K + 1080p (no 720p)' },
  { value: 'all-three', label: '4K + 1080p + 720p' },
  { value: '4k-any', label: 'Has any 4K version' },
  { value: '720-any', label: 'Has any 720p version' },
];

/**
 * Convert a resolutionMix map into a normalized Set of tier strings:
 * '2160', '1080', '720', '480' or '?'.
 */
export function tiersFromMix(mix: Record<string, number>): Set<string> {
  const out = new Set<string>();
  for (const key of Object.keys(mix)) {
    const n = normRes(key);
    out.add(n || '?');
  }
  return out;
}

/**
 * Convert an iterable of raw resolution strings (e.g. `item.media.map(m => m.resolution)`)
 * into the same normalized Set.
 */
export function tiersFromResolutions(resolutions: Iterable<string | null | undefined>): Set<string> {
  const out = new Set<string>();
  for (const r of resolutions) {
    const n = normRes(r ?? '');
    out.add(n || '?');
  }
  return out;
}

/**
 * Does this set of normalized resolution tiers match the requested bucket?
 * Buckets that mention "no X" require X to be absent. "any" buckets only
 * require X to be present.
 */
export function matchesBucket(tiers: Set<string>, bucket: ResolutionBucket): boolean {
  const has4k = tiers.has('2160');
  const has1080 = tiers.has('1080');
  const has720 = tiers.has('720');
  const hasBelow = tiers.has('480');
  switch (bucket) {
    case 'all':
      return true;
    case '1080-only':
      // strictly only 1080
      return has1080 && tiers.size === 1;
    case '720-only':
      // strictly only 720 and/or 480 (no 1080+)
      return !has4k && !has1080 && (has720 || hasBelow);
    case '1080-720':
      // exactly the 1080+720 set (no 4k, no 480, no unknown)
      return has1080 && has720 && !has4k && !hasBelow && !tiers.has('?');
    case '4k-1080':
      return has4k && has1080 && !has720 && !hasBelow && !tiers.has('?');
    case 'all-three':
      return has4k && has1080 && has720;
    case '4k-any':
      return has4k;
    case '720-any':
      return has720 || hasBelow;
  }
}

/**
 * Count how many items fall into each bucket. Used to populate the dropdown
 * labels like "1080p + 720p (no 4K) (87)".
 */
export function countBuckets<T>(
  items: T[],
  tiersFor: (item: T) => Set<string>,
): Record<ResolutionBucket, number> {
  const out: Record<ResolutionBucket, number> = {
    'all': items.length,
    '1080-only': 0,
    '720-only': 0,
    '1080-720': 0,
    '4k-1080': 0,
    'all-three': 0,
    '4k-any': 0,
    '720-any': 0,
  };
  for (const it of items) {
    const tiers = tiersFor(it);
    for (const b of ['1080-only', '720-only', '1080-720', '4k-1080', 'all-three', '4k-any', '720-any'] as ResolutionBucket[]) {
      if (matchesBucket(tiers, b)) out[b]++;
    }
  }
  return out;
}
