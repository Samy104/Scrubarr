import type { DupItem, MediaVersion, SeriesPreferenceDTO, ShowSummary } from './types';
import { humanSize } from './format';

interface PrefRow {
  id: number;
  showRatingKey: string;
  showTitle: string;
  sectionTitle: string | null;
  preferredResolution: string | null;
  preferredCodec: string | null;
  preferRemux: boolean;
  enabled: boolean;
  notes: string | null;
}

/**
 * Plex reports resolutions inconsistently: "4k" or "uhd" instead of "2160",
 * sometimes with a trailing "p". The dropdown saves "2160" / "1080" / "720".
 * Normalize both sides so the comparison is robust.
 */
function normRes(s: string | null | undefined): string {
  if (!s) return '';
  const t = s.toLowerCase().trim().replace(/p$/, '');
  if (t === '4k' || t === 'uhd' || t === '2160') return '2160';
  if (t === '1080' || t === 'fhd') return '1080';
  if (t === '720' || t === 'hd') return '720';
  if (t === '480' || t === 'sd') return '480';
  return t;
}

/**
 * Hard filter: resolution and codec are required matches when set. REMUX is
 * NOT a hard filter — it is a soft tiebreaker applied during ranking, so a
 * series with "prefer REMUX" still auto-cleans episodes that only have a
 * non-REMUX version at the preferred resolution.
 */
function matchesPreference(m: MediaVersion, pref: PrefRow): boolean {
  if (pref.preferredResolution && normRes(m.resolution) !== normRes(pref.preferredResolution)) return false;
  if (pref.preferredCodec && !(m.videoCodec ?? '').toLowerCase().includes(pref.preferredCodec.toLowerCase())) return false;
  return true;
}

function rankMatch(m: MediaVersion, pref: PrefRow): number {
  // Higher rank wins. REMUX wins over non-REMUX when preferRemux is on; size is
  // the final tiebreaker so the largest variant wins within a tier.
  let rank = 0;
  if (pref.preferRemux && m.quality.includes('REMUX')) rank += 1_000_000_000_000;
  rank += m.size ?? 0;
  return rank;
}

/** Annotates every TV/Anime episode item with seriesPref status based on its show's preference. */
export function applySeriesPreferences(items: DupItem[], prefs: PrefRow[]): void {
  const byShow = new Map<string, PrefRow>();
  for (const p of prefs) {
    if (!p.enabled) continue;
    byShow.set(p.showRatingKey, p);
  }
  for (const it of items) {
    if (it.type !== 'episode') continue;
    const showKey = String(it.grandparentRatingKey ?? '');
    const pref = byShow.get(showKey);
    if (!pref) continue;
    // Find every version that satisfies the hard filters (resolution, codec)
    const matches = it.media.filter((m) => matchesPreference(m, pref));
    if (matches.length > 0) {
      // Rank candidates: REMUX wins when preferred, size is the final tiebreaker
      const keep = [...matches].sort((a, b) => rankMatch(b, pref) - rankMatch(a, pref))[0];
      const remuxNote = pref.preferRemux && keep.quality.includes('REMUX') ? ' REMUX' : '';
      it.seriesPref = {
        status: 'autoClean',
        keepMediaId: keep.id,
        reason: `Keep ${keep.resolution} ${keep.videoCodec}${remuxNote} per series preference`,
      };
    } else {
      const target = [pref.preferredResolution, pref.preferredCodec, pref.preferRemux ? 'prefer REMUX' : null]
        .filter(Boolean)
        .join(' ');
      it.seriesPref = {
        status: 'needsReview',
        reason: `No version matches preference (${target})`,
      };
    }
  }
}

/** Builds the per-show summary used by the /shows page. */
export function buildShowSummaries(items: DupItem[], prefs: PrefRow[]): ShowSummary[] {
  const byShow = new Map<string, PrefRow>();
  for (const p of prefs) byShow.set(p.showRatingKey, p);

  const byKey = new Map<string, ShowSummary>();
  for (const it of items) {
    if (it.type !== 'episode' || !it.grandparentRatingKey) continue;
    const k = String(it.grandparentRatingKey);
    if (!byKey.has(k)) {
      byKey.set(k, {
        showRatingKey: k,
        showTitle: it.showTitle ?? '',
        sectionTitle: it.section,
        sectionType: 'show',
        episodeCount: 0,
        totalSize: 0,
        totalSizeHuman: '0 B',
        savingsPotential: 0,
        savingsHuman: '0 B',
        resolutionMix: {},
        preference: prefToDto(byShow.get(k) ?? null),
        autoCleanCount: 0,
        needsReviewCount: 0,
      });
    }
    const s = byKey.get(k)!;
    s.episodeCount++;
    s.totalSize += it.totalSize;
    s.savingsPotential += it.savingsPotential;
    for (const m of it.media) {
      const key = m.resolution || '?';
      s.resolutionMix[key] = (s.resolutionMix[key] ?? 0) + 1;
    }
    if (it.seriesPref?.status === 'autoClean') s.autoCleanCount++;
    else if (it.seriesPref?.status === 'needsReview') s.needsReviewCount++;
  }
  const out = Array.from(byKey.values());
  for (const s of out) {
    s.totalSizeHuman = humanSize(s.totalSize);
    s.savingsHuman = humanSize(s.savingsPotential);
  }
  out.sort((a, b) => b.savingsPotential - a.savingsPotential);
  return out;
}

function prefToDto(p: PrefRow | null): SeriesPreferenceDTO | null {
  if (!p) return null;
  return {
    id: p.id,
    showRatingKey: p.showRatingKey,
    showTitle: p.showTitle,
    sectionTitle: p.sectionTitle,
    preferredResolution: p.preferredResolution,
    preferredCodec: p.preferredCodec,
    preferRemux: p.preferRemux,
    enabled: p.enabled,
    notes: p.notes,
  };
}
