'use client';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Sparkles, Save, Trash2, AlertCircle, CheckCircle2, ListTree, RefreshCw, Play, X, Info, Layers, Wand2,
} from 'lucide-react';
import { humanSize } from '@/lib/format';
import type { ShowSummary, SeriesPreferenceDTO } from '@/lib/types';
import { useNotifications } from '@/lib/notifications';
import { useConfirm } from '@/lib/confirm';
import { MediaPoster } from '@/components/MediaPoster';
import { InfoModal } from '@/components/InfoModal';
import {
  RESOLUTION_BUCKETS, countBuckets, matchesBucket, tiersFromMix,
  type ResolutionBucket,
} from '@/lib/resolutionFilter';

const RESOLUTIONS = ['', '2160', '1080', '720', '480'];
const CODECS = ['', 'hevc', 'h264', 'av1', 'mpeg4'];

interface Progress { done: number; total: number; ok: number; failed: number; current?: string }

export default function ShowsPage() {
  const [shows, setShows] = useState<ShowSummary[]>([]);
  const [lib, setLib] = useState<'all' | 'show' | 'anime'>('all');
  const [prefFilter, setPrefFilter] = useState<'all' | 'with' | 'without'>('all');
  const [query, setQuery] = useState('');
  const { notify } = useNotifications();
  const confirm = useConfirm();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Resolution-mix filter, query-param backed so links are shareable.
  const initialBucket = (searchParams?.get('resolutionFilter') as ResolutionBucket | null) ?? 'all';
  const [resFilter, setResFilter] = useState<ResolutionBucket>(
    RESOLUTION_BUCKETS.some((b) => b.value === initialBucket) ? initialBucket : 'all',
  );
  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (resFilter === 'all') params.delete('resolutionFilter');
    else params.set('resolutionFilter', resFilter);
    const qs = params.toString();
    const next = qs ? `?${qs}` : (typeof window !== 'undefined' ? window.location.pathname : '');
    router.replace(next, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resFilter]);

  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scannedAt, setScannedAt] = useState<number | null>(null);
  const [bulk, setBulk] = useState<Progress | null>(null);

  const load = async () => {
    const params = new URLSearchParams();
    if (lib !== 'all') params.set('library', lib);
    const r = await fetch(`/api/shows?${params}`, { cache: 'no-store' });
    const d = await r.json();
    setShows(d.items ?? []);
    setScanning(!!d.scanning);
    setScannedAt(d.scannedAt ?? null);
    setLoading(false);
  };
  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [lib]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return shows.filter((s) => {
      if (!s.showTitle.toLowerCase().includes(q)) return false;
      if (prefFilter === 'with' && !s.preference) return false;
      if (prefFilter === 'without' && s.preference) return false;
      if (resFilter !== 'all' && !matchesBucket(tiersFromMix(s.resolutionMix), resFilter)) return false;
      return true;
    });
  }, [shows, query, prefFilter, resFilter]);

  const prefCount = useMemo(() => {
    let withPref = 0;
    for (const s of shows) if (s.preference) withPref++;
    return { withPref, withoutPref: shows.length - withPref };
  }, [shows]);

  // Counts per bucket — derived from the pref+lib-filtered set so the numbers
  // shift sensibly as the user narrows the higher-level filters.
  const bucketCounts = useMemo(
    () => countBuckets(
      shows.filter((s) => {
        if (prefFilter === 'with' && !s.preference) return false;
        if (prefFilter === 'without' && s.preference) return false;
        return true;
      }),
      (s) => tiersFromMix(s.resolutionMix),
    ),
    [shows, prefFilter],
  );

  const totals = useMemo(() => {
    return shows.reduce(
      (a, s) => ({
        episodes: a.episodes + s.episodeCount,
        size: a.size + s.totalSize,
        savings: a.savings + s.savingsPotential,
        autoClean: a.autoClean + s.autoCleanCount,
        needsReview: a.needsReview + s.needsReviewCount,
      }),
      { episodes: 0, size: 0, savings: 0, autoClean: 0, needsReview: 0 },
    );
  }, [shows]);

  const handleSave = async (s: ShowSummary, draft: Partial<SeriesPreferenceDTO>) => {
    await fetch('/api/series-preference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        showRatingKey: s.showRatingKey,
        showTitle: s.showTitle,
        sectionTitle: s.sectionTitle,
        preferredResolution: draft.preferredResolution ?? null,
        preferredCodec: draft.preferredCodec ?? null,
        preferRemux: !!draft.preferRemux,
        enabled: draft.enabled ?? true,
        notes: draft.notes ?? null,
      }),
    });
    const summary = [draft.preferredResolution, draft.preferredCodec, draft.preferRemux ? 'prefer REMUX' : null]
      .filter(Boolean)
      .join(' ');
    notify({ kind: 'success', title: `Preference saved for ${s.showTitle}`, body: summary || 'any version' });
    await load();
  };

  const handleDeletePref = async (showRatingKey: string) => {
    const target = shows.find((s) => s.showRatingKey === showRatingKey);
    await fetch(`/api/series-preference?showRatingKey=${encodeURIComponent(showRatingKey)}`, {
      method: 'DELETE',
    });
    notify({ kind: 'info', title: 'Preference removed', body: target?.showTitle });
    await load();
  };

  /**
   * Run a bulk auto-clean as an NDJSON stream so the caller can render
   * incremental progress. The promise resolves with the final tallies.
   */
  const runAutoClean = async (
    s: ShowSummary,
    onProgress: (p: Progress) => void,
  ): Promise<{ deleted: number; failed: number }> => {
    const resp = await fetch(`/api/shows/${s.showRatingKey}/auto-clean`, { method: 'POST' });
    if (!resp.body) return { deleted: 0, failed: 0 };
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let total = 0, ok = 0, failed = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try {
          const ev = JSON.parse(line);
          if (ev.type === 'start') { total = ev.total; onProgress({ done: 0, total, ok: 0, failed: 0 }); }
          else if (ev.type === 'progress') {
            ok = ev.ok; failed = ev.failed;
            onProgress({ done: ev.done, total, ok, failed, current: ev.current });
          } else if (ev.type === 'done') {
            ok = ev.deleted; failed = ev.failed;
          }
        } catch {}
      }
    }
    return { deleted: ok, failed };
  };

  /**
   * Streams the multi-show bulk-clean endpoint. Identical NDJSON contract as
   * runAutoClean above, just driven by a JSON body with the temporary
   * resolution preference instead of a stored SeriesPreference.
   */
  const runBulkClean = useCallback(async (
    showRatingKeys: string[],
    prefResolution: string,
    onProgress: (p: Progress) => void,
  ): Promise<{ deleted: number; failed: number }> => {
    const resp = await fetch('/api/shows/bulk-clean', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showRatingKeys, prefResolution, triggeredBy: 'bulk-keep-resolution' }),
    });
    if (!resp.body) return { deleted: 0, failed: 0 };
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let total = 0, ok = 0, failed = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try {
          const ev = JSON.parse(line);
          if (ev.type === 'start') { total = ev.total; onProgress({ done: 0, total, ok: 0, failed: 0 }); }
          else if (ev.type === 'progress') {
            ok = ev.ok; failed = ev.failed;
            onProgress({ done: ev.done, total, ok, failed, current: ev.current });
          } else if (ev.type === 'done') {
            ok = ev.deleted; failed = ev.failed;
          }
        } catch {}
      }
    }
    return { deleted: ok, failed };
  }, []);

  /** Estimated bytes to be freed by Keep-1080p across the given shows. */
  const estimateKeep1080Savings = (targets: ShowSummary[]): { bytes: number; episodes: number } => {
    // Per-show savings is hard to compute without the full episode list — use
    // the show-level savingsPotential as a conservative aggregate (the user
    // gets the savings of these shows IF they accept losing every non-1080p).
    let bytes = 0;
    let episodes = 0;
    for (const s of targets) {
      bytes += s.savingsPotential;
      episodes += s.episodeCount;
    }
    return { bytes, episodes };
  };

  const onKeep1080Click = async (skipPrompt: boolean) => {
    const targets = filtered.filter((s) =>
      matchesBucket(tiersFromMix(s.resolutionMix), '1080-720'),
    );
    if (targets.length === 0) {
      notify({ kind: 'info', title: 'Nothing to clean', body: 'No shows in the current filter match the 1080p + 720p pattern.' });
      return;
    }
    const est = estimateKeep1080Savings(targets);
    if (!skipPrompt) {
      const ok = await confirm({
        title: 'Keep 1080p across shows',
        body: (
          <>
            Delete every non-1080p version on <span className="font-mono">{targets.length}</span> show
            {targets.length === 1 ? '' : 's'} (<span className="font-mono">{est.episodes}</span> duplicate episode
            {est.episodes === 1 ? '' : 's'}). Estimated up to <span className="font-mono">{humanSize(est.bytes)}</span> freed.
          </>
        ),
        danger: true,
        confirmLabel: `Keep 1080p on ${targets.length}`,
        hint: <>Hold <Kbd>Shift</Kbd> while clicking next time to skip this prompt.</>,
      });
      if (!ok) return;
    }
    setBulk({ done: 0, total: 0, ok: 0, failed: 0 });
    try {
      const result = await runBulkClean(
        targets.map((s) => s.showRatingKey),
        '1080',
        setBulk,
      );
      notify({
        kind: result.failed ? 'warn' : 'success',
        title: `Bulk Keep 1080p: ${targets.length} show${targets.length === 1 ? '' : 's'}`,
        body: `${result.deleted} version${result.deleted === 1 ? '' : 's'} deleted${result.failed ? `, ${result.failed} failed` : ''}`,
      });
      await fetch('/api/rescan', { method: 'POST' });
      setTimeout(load, 1500);
    } finally {
      setTimeout(() => setBulk(null), 1800);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 pr-16 bg-panel border-b border-border sticky top-0 z-10">
        <Stat label="Shows" value={shows.length.toString()} />
        <Stat label="Dup episodes" value={totals.episodes.toString()} />
        <Stat label="Total dup size" value={humanSize(totals.size)} />
        <Stat label="Savings potential" value={humanSize(totals.savings)} highlight />
        {totals.autoClean > 0 && (
          <Stat label="Auto-clean ready" value={totals.autoClean.toString()} className="text-good" />
        )}
        {totals.needsReview > 0 && (
          <Stat label="Need review" value={totals.needsReview.toString()} className="text-warn" />
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-text-dim">
            {scannedAt ? new Date(scannedAt * 1000).toLocaleTimeString() : '—'}
          </span>
          <button
            onClick={async () => {
              await fetch('/api/rescan', { method: 'POST' });
              setTimeout(load, 1500);
            }}
            disabled={scanning}
            className="px-3 py-1.5 bg-panel-2 hover:bg-border border border-border rounded-md text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={14} className={scanning ? 'animate-spin' : ''} />
            {scanning ? 'Scanning…' : 'Rescan'}
          </button>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-border bg-panel/60 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <ListTree size={16} className="text-text-dim" />
          <input
            placeholder="Filter title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <select
          value={lib}
          onChange={(e) => setLib(e.target.value as 'all' | 'show' | 'anime')}
          className="px-3 py-1.5 bg-panel-2 border border-border rounded text-sm"
        >
          <option value="all">All libraries</option>
          <option value="show">TV Shows</option>
          <option value="anime">Anime</option>
        </select>
        <select
          value={prefFilter}
          onChange={(e) => setPrefFilter(e.target.value as 'all' | 'with' | 'without')}
          className="px-3 py-1.5 bg-panel-2 border border-border rounded text-sm"
          title="Filter by preference state"
        >
          <option value="all">All shows ({shows.length})</option>
          <option value="with">With preference ({prefCount.withPref})</option>
          <option value="without">Without preference ({prefCount.withoutPref})</option>
        </select>
        <select
          value={resFilter}
          onChange={(e) => setResFilter(e.target.value as ResolutionBucket)}
          className="px-3 py-1.5 bg-panel-2 border border-border rounded text-sm"
          title="Filter by resolution mix"
        >
          {RESOLUTION_BUCKETS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label} ({bucketCounts[b.value]})
            </option>
          ))}
        </select>
        <Keep1080Button
          eligible={bucketCounts['1080-720']}
          busy={!!bulk}
          progress={bulk}
          onClick={(e) => onKeep1080Click(!!(e as React.MouseEvent).shiftKey)}
          active={resFilter === '1080-720'}
        />
        <div className="text-xs text-text-dim">
          {filtered.length} shown
        </div>
      </div>

      {bulk && (
        <div className="px-4 py-2 border-b border-border bg-accent/8">
          <div className="flex items-center gap-3">
            <Layers size={14} className="text-accent flex-shrink-0" />
            <div className="text-[11px] uppercase tracking-[0.16em] text-accent font-medium">
              Bulk Keep 1080p
            </div>
            <div className="text-xs font-mono text-text-dim">
              {bulk.done} / {bulk.total} · ok {bulk.ok}{bulk.failed ? ` · failed ${bulk.failed}` : ''}
            </div>
            {bulk.current && (
              <div className="text-[11px] text-text-dim truncate font-mono" title={bulk.current}>
                {bulk.current}
              </div>
            )}
          </div>
          <div className="mt-1.5 h-1 bg-panel-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-[width] duration-150"
              style={{ width: `${bulk.total ? Math.round((bulk.done / bulk.total) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      <div className="p-4 max-w-6xl mx-auto">
        <p className="text-sm text-text-dim mb-4 max-w-3xl">
          Set a preferred version per series (e.g. <span className="text-text font-medium">Westworld = 1080p REMUX</span>).
          Episodes that have the preferred version are marked <span className="text-good">auto-clean</span>; episodes
          without it stay in the normal TV/Anime list for manual review.
          <span className="block mt-1 text-text-dim/80 text-xs">
            Tip: <kbd className="px-1 py-px bg-panel-2 border border-border rounded font-mono text-[10px]">Shift</kbd>+click Auto-clean to skip the confirmation.
          </span>
        </p>
        {loading ? (
          <p className="text-text-dim text-center py-12">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-text-dim text-center py-12 text-sm">No shows with duplicates here.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((s) => (
              <ShowCard
                key={s.showRatingKey}
                show={s}
                onSave={handleSave}
                onDelete={handleDeletePref}
                runAutoClean={runAutoClean}
                onAfterClean={async (s, result) => {
                  notify({
                    kind: result.failed ? 'warn' : 'success',
                    title: `Auto-clean: ${s.showTitle}`,
                    body: `${result.deleted} versions deleted${result.failed ? `, ${result.failed} failed` : ''}`,
                  });
                  await fetch('/api/rescan', { method: 'POST' });
                  setTimeout(load, 1500);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1 py-px bg-panel-2 border border-border rounded font-mono text-[10px]">
      {children}
    </kbd>
  );
}

function Keep1080Button({
  eligible,
  busy,
  progress,
  onClick,
  active,
}: {
  eligible: number;
  busy: boolean;
  progress: Progress | null;
  onClick: (e: React.MouseEvent) => void;
  active: boolean;
}) {
  const disabled = busy || eligible === 0;
  const title = eligible === 0
    ? 'No shows currently match the 1080p + 720p pattern in the active filters.'
    : `Across the ${eligible} matching show${eligible === 1 ? '' : 's'}, delete every non-1080p version. Shift+click skips the prompt.`;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-3 py-1.5 text-xs rounded font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? 'bg-accent text-accent-ink hover:opacity-90'
          : 'bg-accent/15 text-accent border border-accent/40 hover:bg-accent/25'
      }`}
    >
      <Wand2 size={12} />
      {progress
        ? `${progress.done} / ${progress.total}`
        : `Keep 1080p (${eligible})`}
    </button>
  );
}

function Stat({
  label,
  value,
  highlight,
  className = '',
}: {
  label: string;
  value: string;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div className={`text-xs ${className}`}>
      <span className="text-text-dim">{label}: </span>
      <span className={highlight ? 'text-warn font-mono font-semibold' : 'font-mono font-medium'}>{value}</span>
    </div>
  );
}

function ShowCard({
  show,
  onSave,
  onDelete,
  runAutoClean,
  onAfterClean,
}: {
  show: ShowSummary;
  onSave: (s: ShowSummary, p: Partial<SeriesPreferenceDTO>) => Promise<void>;
  onDelete: (rk: string) => Promise<void>;
  runAutoClean: (s: ShowSummary, onProgress: (p: Progress) => void) => Promise<{ deleted: number; failed: number }>;
  onAfterClean: (s: ShowSummary, r: { deleted: number; failed: number }) => Promise<void>;
}) {
  const [open, setOpen] = useState(!!show.preference);
  const [res, setRes] = useState(show.preference?.preferredResolution ?? '');
  const [codec, setCodec] = useState(show.preference?.preferredCodec ?? '');
  const [remux, setRemux] = useState(show.preference?.preferRemux ?? false);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirmOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setConfirmOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirmOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [confirmOpen]);

  const resList = Object.entries(show.resolutionMix).sort((a, b) => b[1] - a[1]);
  const normRes = (s: string) => {
    const t = s.toLowerCase().trim().replace(/p$/, '');
    if (t === '4k' || t === 'uhd' || t === '2160') return '2160';
    if (t === '1080' || t === 'fhd') return '1080';
    if (t === '720' || t === 'hd') return '720';
    if (t === '480' || t === 'sd') return '480';
    return t;
  };
  const hasUnsavedChanges =
    show.preference == null
      ? !!(res || codec || remux)
      : (show.preference.preferredResolution ?? '') !== res ||
        (show.preference.preferredCodec ?? '') !== codec ||
        show.preference.preferRemux !== remux;

  const executeClean = async () => {
    setConfirmOpen(false);
    setBusy(true);
    setProgress({ done: 0, total: show.autoCleanCount, ok: 0, failed: 0 });
    try {
      const result = await runAutoClean(show, setProgress);
      await onAfterClean(show, result);
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(null), 1500);
    }
  };

  const onAutoCleanClick = (e: React.MouseEvent) => {
    if (e.shiftKey) { void executeClean(); return; }
    setConfirmOpen((o) => !o);
  };

  return (
    <div className="bg-panel border border-border rounded-lg p-3.5 hover:border-text-dim/40 transition-colors">
      {infoOpen && (
        <InfoModal ratingKey={show.showRatingKey} open={infoOpen} onClose={() => setInfoOpen(false)} />
      )}
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1.5">
          <MediaPoster
            ratingKey={show.showRatingKey}
            title={show.showTitle}
            kind="show"
            width={44}
            className="mt-0.5"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setInfoOpen(true);
            }}
            className="text-text-dim hover:text-accent p-1 -mt-0.5 rounded transition-colors"
            aria-label="Show details"
            title="Show details"
          >
            <Info size={13} />
          </button>
        </div>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setOpen((o) => !o)}>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-display font-semibold tracking-tight">{show.showTitle}</h2>
            <span className="text-xs text-text-dim">{show.sectionTitle}</span>
            {show.preference && (
              <span className="inline-flex items-center gap-1 text-xs bg-accent/15 text-accent px-2 py-0.5 rounded">
                <Sparkles size={11} />
                {show.preference.preferredResolution || 'any res'}
                {show.preference.preferredCodec ? ` ${show.preference.preferredCodec}` : ''}
                {show.preference.preferRemux ? ' REMUX' : ''}
              </span>
            )}
          </div>
          <div className="text-xs text-text-dim mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            <span><span className="font-mono">{show.episodeCount}</span> dup episodes</span>
            <span>total <span className="font-mono">{humanSize(show.totalSize)}</span></span>
            <span className="text-warn">save <span className="font-mono">{humanSize(show.savingsPotential)}</span></span>
            {show.autoCleanCount > 0 && (
              <span className="text-good inline-flex items-center gap-1">
                <CheckCircle2 size={11} />
                <span className="font-mono">{show.autoCleanCount}</span> auto-clean
              </span>
            )}
            {show.needsReviewCount > 0 && (
              <span className="text-warn inline-flex items-center gap-1">
                <AlertCircle size={11} />
                <span className="font-mono">{show.needsReviewCount}</span> review
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {resList.map(([r, n]) => (
              <span
                key={r}
                className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${
                  res && normRes(r) === normRes(res)
                    ? 'bg-accent/15 text-accent border-accent/40'
                    : 'bg-panel-2 text-text-dim border-border'
                }`}
              >
                {r} ({n})
              </span>
            ))}
          </div>
        </div>
        {show.autoCleanCount > 0 && (
          <div className="relative flex flex-col items-end gap-1.5" ref={popoverRef}>
            <button
              disabled={busy}
              onClick={onAutoCleanClick}
              className={`px-3 py-1.5 font-semibold rounded text-xs flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap transition-colors ${
                confirmOpen
                  ? 'bg-good/80 text-accent-ink'
                  : 'bg-good text-accent-ink hover:opacity-90'
              }`}
              title={`Delete every non-preferred version on ${show.autoCleanCount} episode(s). Shift+click skips this prompt.`}
            >
              <Play size={11} />
              {progress
                ? `${progress.done} / ${progress.total}`
                : `Auto-clean ${show.autoCleanCount}`}
            </button>
            {progress && (
              <div className="w-full max-w-[220px] h-1 bg-panel-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-good transition-[width] duration-150"
                  style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
                />
              </div>
            )}
            {progress?.current && (
              <div className="text-[10px] text-text-dim truncate max-w-[220px]" title={progress.current}>
                {progress.current}
              </div>
            )}

            {confirmOpen && (
              <div
                role="dialog"
                className="absolute right-0 top-full mt-2 w-[280px] bg-panel border border-border rounded-lg shadow-xl z-20 origin-top-right"
                style={{ animation: 'mvPopIn 120ms ease-out' }}
              >
                <div className="px-3.5 py-2.5 border-b border-border flex items-center justify-between">
                  <div className="text-sm font-display font-semibold tracking-tight">Confirm auto-clean</div>
                  <button
                    onClick={() => setConfirmOpen(false)}
                    className="text-text-dim hover:text-text"
                    aria-label="Cancel"
                  >
                    <X size={13} />
                  </button>
                </div>
                <div className="px-3.5 py-2.5 text-xs text-text-dim space-y-2">
                  <div>
                    Delete every non-preferred version on{' '}
                    <span className="text-text font-mono">{show.autoCleanCount}</span> episode
                    {show.autoCleanCount === 1 ? '' : 's'} of{' '}
                    <span className="text-text font-medium">{show.showTitle}</span>.
                  </div>
                  <div className="text-warn">This cannot be undone.</div>
                  <div className="text-[10px] text-text-dim/80 pt-1">
                    Hold <kbd className="px-1 py-px bg-panel-2 border border-border rounded font-mono text-[10px]">Shift</kbd> while clicking next time to skip this prompt.
                  </div>
                </div>
                <div className="px-3 py-2 border-t border-border flex items-center justify-end gap-2 bg-panel-2/50">
                  <button
                    onClick={() => setConfirmOpen(false)}
                    className="px-2.5 py-1 text-xs rounded border border-border hover:bg-panel-2"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeClean}
                    className="px-2.5 py-1 text-xs rounded bg-good text-accent-ink font-semibold hover:opacity-90 inline-flex items-center gap-1.5"
                  >
                    <Play size={11} /> Delete {show.autoCleanCount}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="text-xs">
              <span className="text-text-dim mb-1 block">Preferred resolution</span>
              <select
                value={res}
                onChange={(e) => setRes(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm"
              >
                {RESOLUTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r || '(any)'}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              <span className="text-text-dim mb-1 block">Preferred video codec</span>
              <select
                value={codec}
                onChange={(e) => setCodec(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm"
              >
                {CODECS.map((c) => (
                  <option key={c} value={c}>
                    {c || '(any)'}
                  </option>
                ))}
              </select>
            </label>
            <label
              className="flex items-center gap-2 text-sm text-text-dim self-end mb-1.5"
              title="Soft tiebreaker: pick REMUX when available, otherwise fall back to the best non-REMUX version at the preferred resolution"
            >
              <input
                type="checkbox"
                checked={remux}
                onChange={(e) => setRemux(e.target.checked)}
                className="accent-accent"
              />
              Prefer REMUX
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={busy || !hasUnsavedChanges}
              onClick={async () => {
                setBusy(true);
                await onSave(show, {
                  preferredResolution: res || null,
                  preferredCodec: codec || null,
                  preferRemux: remux,
                  enabled: true,
                });
                setBusy(false);
                // Auto-collapse the editor once the preference is saved so the
                // card reverts to its compact view.
                setOpen(false);
              }}
              className="px-3 py-1.5 bg-accent text-accent-ink font-semibold rounded text-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save size={13} /> {hasUnsavedChanges ? 'Save preference' : 'Saved'}
            </button>
            {show.preference && (
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await onDelete(show.showRatingKey);
                  setBusy(false);
                }}
                className="px-3 py-1.5 border border-border hover:border-danger hover:bg-danger/10 hover:text-danger rounded text-sm flex items-center gap-1.5"
              >
                <Trash2 size={13} /> Remove preference
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
