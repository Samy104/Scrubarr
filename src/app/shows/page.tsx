'use client';
import { useEffect, useState, useMemo } from 'react';
import { Sparkles, Save, Trash2, AlertCircle, CheckCircle2, ListTree, RefreshCw, Play } from 'lucide-react';
import { humanSize } from '@/lib/format';
import type { ShowSummary, SeriesPreferenceDTO } from '@/lib/types';

const RESOLUTIONS = ['', '2160', '1080', '720', '480'];
const CODECS = ['', 'hevc', 'h264', 'av1', 'mpeg4'];

export default function ShowsPage() {
  const [shows, setShows] = useState<ShowSummary[]>([]);
  const [lib, setLib] = useState<'all' | 'show' | 'anime'>('all');
  const [prefFilter, setPrefFilter] = useState<'all' | 'with' | 'without'>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scannedAt, setScannedAt] = useState<number | null>(null);

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
      return true;
    });
  }, [shows, query, prefFilter]);

  const prefCount = useMemo(() => {
    let withPref = 0;
    for (const s of shows) if (s.preference) withPref++;
    return { withPref, withoutPref: shows.length - withPref };
  }, [shows]);

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
    await fetch('/api/rescan', { method: 'POST' });
    setTimeout(load, 1500);
  };

  const handleDelete = async (showRatingKey: string) => {
    if (!confirm('Remove preference for this show?')) return;
    await fetch(`/api/series-preference?showRatingKey=${encodeURIComponent(showRatingKey)}`, {
      method: 'DELETE',
    });
    await fetch('/api/rescan', { method: 'POST' });
    setTimeout(load, 1500);
  };

  const handleAutoClean = async (s: ShowSummary) => {
    if (s.autoCleanCount === 0) return;
    if (
      !confirm(
        `Auto-clean ${s.autoCleanCount} episode(s) of "${s.showTitle}"?\n\nThis deletes every non-preferred version on Plex + disk. Cannot be undone.`,
      )
    )
      return;
    const r = await fetch(`/api/shows/${s.showRatingKey}/auto-clean`, { method: 'POST' });
    const d = await r.json();
    alert(`${d.deleted} versions deleted, ${d.failed} failed.`);
    await fetch('/api/rescan', { method: 'POST' });
    setTimeout(load, 1500);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 bg-panel border-b border-border sticky top-0 z-10">
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
        <div className="text-xs text-text-dim">
          {filtered.length} shown
        </div>
      </div>

      <div className="p-4 max-w-6xl mx-auto">
        <p className="text-sm text-text-dim mb-4 max-w-3xl">
          Set a preferred version per series (e.g. <span className="text-text font-medium">Westworld = 1080p REMUX</span>).
          Episodes that have the preferred version are marked <span className="text-good">auto-clean</span>; episodes
          without it stay in the normal TV/Anime list for manual review.
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
                onDelete={handleDelete}
                onAutoClean={handleAutoClean}
              />
            ))}
          </div>
        )}
      </div>
    </div>
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
  onAutoClean,
}: {
  show: ShowSummary;
  onSave: (s: ShowSummary, p: Partial<SeriesPreferenceDTO>) => Promise<void>;
  onDelete: (rk: string) => Promise<void>;
  onAutoClean: (s: ShowSummary) => Promise<void>;
}) {
  const [open, setOpen] = useState(!!show.preference);
  const [res, setRes] = useState(show.preference?.preferredResolution ?? '');
  const [codec, setCodec] = useState(show.preference?.preferredCodec ?? '');
  const [remux, setRemux] = useState(show.preference?.preferRemux ?? false);
  const [busy, setBusy] = useState(false);

  const resList = Object.entries(show.resolutionMix).sort((a, b) => b[1] - a[1]);
  const hasUnsavedChanges =
    show.preference == null
      ? !!(res || codec || remux)
      : (show.preference.preferredResolution ?? '') !== res ||
        (show.preference.preferredCodec ?? '') !== codec ||
        show.preference.preferRemux !== remux;

  return (
    <div className="bg-panel border border-border rounded-lg p-3.5 hover:border-text-dim/40 transition-colors">
      <div className="flex items-start gap-3">
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
                  r === res
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
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onAutoClean(show);
              setBusy(false);
            }}
            className="px-3 py-1.5 bg-good text-accent-ink font-semibold rounded text-xs flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
            title={`Delete every non-preferred version on ${show.autoCleanCount} episode(s)`}
          >
            <Play size={11} />
            Auto-clean {show.autoCleanCount}
          </button>
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
            <label className="flex items-center gap-2 text-sm text-text-dim self-end mb-1.5">
              <input
                type="checkbox"
                checked={remux}
                onChange={(e) => setRemux(e.target.checked)}
                className="accent-accent"
              />
              Require REMUX
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
