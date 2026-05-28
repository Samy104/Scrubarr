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

function matchesPreference(m: MediaVersion, pref: PrefRow): boolean {
  if (pref.preferredResolution && (m.resolution ?? '').toLowerCase() !== pref.preferredResolution.toLowerCase()) return false;
  if (pref.preferredCodec && !(m.videoCodec ?? '').toLowerCase().includes(pref.preferredCodec.toLowerCase())) return false;
  if (pref.preferRemux && !m.quality.includes('REMUX')) return false;
  return true;
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
    // Find a version that matches the preference
    const matches = it.media.filter((m) => matchesPreference(m, pref));
    if (matches.length > 0) {
      // Among matches, prefer the largest (covers tie-breakers between REMUX vs WEB-DL for same res)
      const keep = matches[0]; // media already sorted desc by size
      it.seriesPref = {
        status: 'autoClean',
        keepMediaId: keep.id,
        reason: `Keep ${keep.resolution} ${keep.videoCodec}${pref.preferRemux ? ' REMUX' : ''} per series preference`,
      };
    } else {
      const target = [pref.preferredResolution, pref.preferredCodec, pref.preferRemux ? 'REMUX' : null]
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
