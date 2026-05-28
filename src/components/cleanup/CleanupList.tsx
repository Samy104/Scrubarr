'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { humanSize } from '@/lib/format';
import type { CleanupCandidate } from '@/lib/types';
import { RefreshCw, ShieldCheck, Trash2, X, Search, Play, AlertTriangle, Sparkles, ExternalLink, EyeOff } from 'lucide-react';
import { useNotifications } from '@/lib/notifications';

interface Props { scope: 'movie' | 'show' }

interface Resp {
  scope: string;
  scannedAt: number | null;
  scanning: boolean;
  error: string | null;
  libraryCount: number;
  candidateCount: number;
  totalSize: number;
  candidates: (CleanupCandidate & { isCandidate: boolean; ignored?: boolean })[];
}

interface BulkProgress { done: number; total: number; ok: number; failed: number; current?: string }

export function CleanupList({ scope }: Props) {
  const [data, setData] = useState<Resp | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'size' | 'title' | 'year' | 'rating' | 'lastView'>('size');
  const [showLib, setShowLib] = useState<'candidates' | 'all'>('candidates');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
  const { notify } = useNotifications();
  const bulkRef = useRef<HTMLDivElement>(null);

  const load = async (force = false) => {
    const url = `/api/cleanup/candidates?scope=${scope}${force ? '&refresh=1' : ''}`;
    const r = await fetch(url, { cache: 'no-store' });
    if (r.ok) setData(await r.json());
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 12_000);
    return () => clearInterval(t);
  }, [scope]);

  useEffect(() => {
    if (!confirmOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (bulkRef.current && !bulkRef.current.contains(e.target as Node)) setConfirmOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirmOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [confirmOpen]);

  const visible = useMemo(() => {
    if (!data) return [];
    let list = showLib === 'candidates' ? data.candidates.filter((x) => x.isCandidate) : data.candidates;
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((x) => x.title.toLowerCase().includes(q));
    }
    const sorts: Record<typeof sort, (a: any, b: any) => number> = {
      size: (a, b) => (b.totalSize || 0) - (a.totalSize || 0),
      title: (a, b) => a.title.localeCompare(b.title),
      year: (a, b) => (b.year ?? 0) - (a.year ?? 0),
      rating: (a, b) => (a.rating ?? 99) - (b.rating ?? 99),
      lastView: (a, b) => (a.lastViewedAt ?? 0) - (b.lastViewedAt ?? 0),
    };
    return [...list].sort(sorts[sort]);
  }, [data, query, sort, showLib]);

  const visibleCandidates = useMemo(() => visible.filter((x) => x.isCandidate), [visible]);
  const selectedSize = useMemo(() => {
    if (!data) return 0;
    let s = 0;
    for (const x of data.candidates) if (selected.has(x.ratingKey)) s += x.totalSize || 0;
    return s;
  }, [data, selected]);

  const toggleSel = (rk: string) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(rk)) next.delete(rk); else next.add(rk);
      return next;
    });
  };
  const selectAllVisible = () => {
    setSelected(new Set(visibleCandidates.map((x) => x.ratingKey)));
  };
  const clearSelection = () => setSelected(new Set());

  const ignoreItem = async (c: CleanupCandidate) => {
    await fetch('/api/cleanup/ignore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ratingKey: c.ratingKey,
        scope,
        title: c.title,
        sectionTitle: c.sectionTitle,
        reason: 'Excluded from cleanup pool',
      }),
    });
    notify({ kind: 'info', title: 'Added to cleanup ignore list', body: c.title });
    setSelected((cur) => {
      if (!cur.has(c.ratingKey)) return cur;
      const next = new Set(cur);
      next.delete(c.ratingKey);
      return next;
    });
    await load();
  };

  const unIgnoreItem = async (c: CleanupCandidate) => {
    await fetch(`/api/cleanup/ignore?ratingKey=${encodeURIComponent(c.ratingKey)}`, { method: 'DELETE' });
    notify({ kind: 'info', title: 'Removed from cleanup ignore list', body: c.title });
    await load();
  };

  const runBulkDelete = async () => {
    setConfirmOpen(false);
    const list = data?.candidates.filter((x) => selected.has(x.ratingKey)) ?? [];
    if (list.length === 0) return;
    setBulkProgress({ done: 0, total: list.length, ok: 0, failed: 0 });
    let ok = 0, failed = 0;
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      try {
        const r = await fetch('/api/cleanup/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ratingKey: item.ratingKey, scope, triggeredBy: 'cleanup-bulk' }),
        });
        const d = await r.json();
        if (d.ok) ok++; else failed++;
      } catch {
        failed++;
      }
      setBulkProgress({ done: i + 1, total: list.length, ok, failed, current: item.title });
    }
    notify({
      kind: failed ? 'warn' : 'success',
      title: `Cleanup ${scope === 'movie' ? 'movies' : 'shows'}`,
      body: `${ok} deleted${failed ? `, ${failed} failed` : ''}`,
    });
    setSelected(new Set());
    setTimeout(() => setBulkProgress(null), 1800);
    await load();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 pr-16 bg-panel border-b border-border sticky top-0 z-10">
        <Stat label={scope === 'movie' ? 'Movies' : 'Shows'} value={(data?.libraryCount ?? 0).toString()} />
        <Stat label="Candidates" value={(data?.candidateCount ?? 0).toString()} className="text-warn" />
        {scope === 'movie' && <Stat label="Reclaimable" value={humanSize(data?.totalSize ?? 0)} highlight />}
        <Stat label="Selected" value={`${selected.size} (${humanSize(selectedSize)})`} />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-text-dim">
            {data?.scannedAt ? new Date(data.scannedAt * 1000).toLocaleTimeString() : '—'}
          </span>
          <button
            onClick={() => load(true)}
            disabled={data?.scanning}
            className="px-3 py-1.5 bg-panel-2 hover:bg-border border border-border rounded-md text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={14} className={data?.scanning ? 'animate-spin' : ''} />
            {data?.scanning ? 'Scanning…' : 'Rescan'}
          </button>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-border bg-panel/60 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim" size={14} />
          <input
            type="search"
            placeholder="Filter by title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-panel-2 border border-border rounded-md text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <select
          value={showLib}
          onChange={(e) => setShowLib(e.target.value as any)}
          className="px-3 py-1.5 bg-panel-2 border border-border rounded text-sm"
        >
          <option value="candidates">Candidates only ({data?.candidateCount ?? 0})</option>
          <option value="all">Full library ({data?.libraryCount ?? 0})</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
          className="px-3 py-1.5 bg-panel-2 border border-border rounded text-sm"
        >
          <option value="size">Sort: size</option>
          <option value="title">Sort: title</option>
          <option value="year">Sort: year</option>
          <option value="rating">Sort: rating (low → high)</option>
          <option value="lastView">Sort: last viewed (old → new)</option>
        </select>
        <div className="text-xs text-text-dim">
          {visible.length} shown
        </div>
        <div className="ml-auto flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <button
                onClick={clearSelection}
                className="px-2.5 py-1 text-xs rounded border border-border hover:bg-panel-2"
              >
                Clear selection
              </button>
              <div className="relative" ref={bulkRef}>
                <button
                  onClick={(e) => { if (e.shiftKey) void runBulkDelete(); else setConfirmOpen((o) => !o); }}
                  disabled={!!bulkProgress}
                  className="px-3 py-1.5 bg-danger text-white font-semibold rounded text-xs flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                  title={`Delete ${selected.size} item(s). Shift+click skips this prompt.`}
                >
                  <Trash2 size={11} />
                  {bulkProgress
                    ? `${bulkProgress.done} / ${bulkProgress.total}`
                    : `Delete ${selected.size}`}
                </button>
                {confirmOpen && (
                  <div
                    role="dialog"
                    className="absolute right-0 top-full mt-2 w-[300px] bg-panel border border-border rounded-lg shadow-xl z-20"
                    style={{ animation: 'mvPopIn 120ms ease-out' }}
                  >
                    <div className="px-3.5 py-2.5 border-b border-border flex items-center justify-between">
                      <div className="text-sm font-display font-semibold tracking-tight">Confirm cleanup</div>
                      <button onClick={() => setConfirmOpen(false)} className="text-text-dim hover:text-text"><X size={13} /></button>
                    </div>
                    <div className="px-3.5 py-2.5 text-xs text-text-dim space-y-2">
                      <div>
                        Delete <span className="text-text font-mono">{selected.size}</span> {scope}{selected.size === 1 ? '' : 's'} ({humanSize(selectedSize)}) from Plex and disk.
                      </div>
                      <div className="text-warn">This cannot be undone.</div>
                      <div className="text-[10px] text-text-dim/80 pt-1">
                        Hold <kbd className="px-1 py-px bg-panel-2 border border-border rounded font-mono text-[10px]">Shift</kbd> next time to skip this prompt.
                      </div>
                    </div>
                    <div className="px-3 py-2 border-t border-border flex items-center justify-end gap-2 bg-panel-2/50">
                      <button onClick={() => setConfirmOpen(false)} className="px-2.5 py-1 text-xs rounded border border-border hover:bg-panel-2">Cancel</button>
                      <button onClick={runBulkDelete} className="px-2.5 py-1 text-xs rounded bg-danger text-white font-semibold hover:opacity-90 inline-flex items-center gap-1.5">
                        <Play size={11} /> Delete {selected.size}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          {visibleCandidates.length > 0 && selected.size < visibleCandidates.length && (
            <button
              onClick={selectAllVisible}
              className="px-2.5 py-1 text-xs rounded border border-border hover:bg-panel-2 inline-flex items-center gap-1.5"
            >
              Select all {visibleCandidates.length}
            </button>
          )}
        </div>
      </div>

      {bulkProgress && (
        <div className="px-4 py-2 bg-panel/60 border-b border-border">
          <div className="h-1 bg-panel-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-danger transition-[width] duration-150"
              style={{ width: `${bulkProgress.total ? Math.round((bulkProgress.done / bulkProgress.total) * 100) : 0}%` }}
            />
          </div>
          {bulkProgress.current && (
            <div className="mt-1 text-[11px] text-text-dim font-mono truncate" title={bulkProgress.current}>
              Deleting: {bulkProgress.current}
            </div>
          )}
        </div>
      )}

      <div className="p-4 max-w-6xl mx-auto">
        {data?.error && (
          <div className="bg-danger/10 border border-danger/40 text-danger p-3 rounded-md mb-3 text-sm">
            {data.error}
          </div>
        )}
        {!data && <p className="text-text-dim text-center py-12">Loading…</p>}
        {data && visible.length === 0 && (
          <div className="text-center py-16 text-sm text-text-dim">
            {showLib === 'candidates'
              ? <>No deletion candidates 🎉 — your <span className="text-text">{scope === 'movie' ? 'movie' : 'show'}</span> library passes all current rules.</>
              : <>No items match your filter.</>}
          </div>
        )}
        <div className="space-y-1.5">
          {visible.map((c, i) => (
            <CandidateRow
              key={c.ratingKey}
              c={c}
              scope={scope}
              checked={selected.has(c.ratingKey)}
              onToggle={() => toggleSel(c.ratingKey)}
              onIgnore={() => ignoreItem(c)}
              onUnIgnore={() => unIgnoreItem(c)}
              animDelayMs={Math.min(i * 12, 200)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight, className = '' }: { label: string; value: string; highlight?: boolean; className?: string }) {
  return (
    <div className={`text-xs ${className}`}>
      <span className="text-text-dim">{label}: </span>
      <span className={highlight ? 'text-warn font-mono font-semibold' : 'font-mono font-medium'}>{value}</span>
    </div>
  );
}

function CandidateRow({
  c, scope, checked, onToggle, onIgnore, onUnIgnore, animDelayMs,
}: {
  c: CleanupCandidate & { isCandidate: boolean; ignored?: boolean };
  scope: 'movie' | 'show';
  checked: boolean;
  onToggle: () => void;
  onIgnore: () => void;
  onUnIgnore: () => void;
  animDelayMs: number;
}) {
  const lastViewed = c.lastViewedAt ? new Date(c.lastViewedAt * 1000) : null;
  const hasException = c.matchedRules.some((r) => r.kind === 'exception');
  const sizeStr = scope === 'movie' && c.totalSize ? humanSize(c.totalSize) : null;
  return (
    <div
      className={`mv-fade-up bg-panel border rounded-lg p-3 flex items-center gap-3 transition-colors ${
        c.ignored
          ? 'border-text-dim/30 hover:border-text-dim/60 opacity-75'
          : c.isCandidate
          ? 'border-warn/40 hover:border-warn'
          : 'border-border hover:border-text-dim/40'
      }`}
      style={{ animationDelay: `${animDelayMs}ms` }}
    >
      <label className="inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          disabled={!c.isCandidate}
          checked={checked}
          onChange={onToggle}
          className="w-4 h-4 accent-warn cursor-pointer disabled:opacity-30"
          title={c.isCandidate ? 'Select for cleanup' : 'Not a candidate (ignored, no eligibility rule matched, or exception applies)'}
        />
      </label>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-display font-semibold tracking-tight text-[15px] truncate">{c.title}</div>
          {c.year && <span className="text-xs text-text-dim font-mono">({c.year})</span>}
          {c.ignored && (
            <span className="inline-flex items-center gap-1 text-[10px] bg-text-dim/15 text-text-dim px-1.5 py-0.5 rounded font-medium">
              <EyeOff size={10} /> ignored
            </span>
          )}
          {hasException && !c.ignored && (
            <span className="inline-flex items-center gap-1 text-[10px] bg-good/15 text-good px-1.5 py-0.5 rounded font-medium">
              <ShieldCheck size={10} /> protected
            </span>
          )}
          {c.isCandidate && (
            <span className="inline-flex items-center gap-1 text-[10px] bg-warn/15 text-warn px-1.5 py-0.5 rounded font-medium">
              <AlertTriangle size={10} /> candidate
            </span>
          )}
        </div>
        <div className="mt-1 text-[11px] text-text-dim flex flex-wrap gap-x-3 gap-y-0.5">
          <span className="text-text-dim">{c.sectionTitle}</span>
          {c.studio && <span>· {c.studio}</span>}
          {sizeStr && <span>· <span className="font-mono">{sizeStr}</span></span>}
          {c.rating != null && <span>· rating <span className="font-mono">{c.rating.toFixed(1)}</span></span>}
          {c.userRating != null && <span>· your <span className="font-mono">{c.userRating.toFixed(1)}</span></span>}
          <span>· played <span className="font-mono">{c.viewCount}×</span></span>
          {lastViewed && <span>· last <span className="font-mono">{lastViewed.toLocaleDateString()}</span></span>}
          {scope === 'show' && c.leafCount != null && (
            <span>· <span className="font-mono">{c.viewedLeafCount ?? 0}</span>/<span className="font-mono">{c.leafCount}</span> watched</span>
          )}
        </div>
        {c.matchedRules.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {c.matchedRules.map((r) => (
              <span
                key={r.id}
                className={`text-[10px] px-1.5 py-0.5 rounded border font-medium inline-flex items-center gap-1 ${
                  r.kind === 'exception'
                    ? 'bg-good/10 text-good border-good/30'
                    : 'bg-warn/10 text-warn border-warn/30'
                }`}
                title={r.kind === 'exception' ? 'Protected by exception rule' : 'Matched eligibility rule'}
              >
                {r.kind === 'exception' ? <ShieldCheck size={9} /> : <Sparkles size={9} />}
                {r.name}
              </span>
            ))}
          </div>
        )}
      </div>
      {c.ignored ? (
        <button
          onClick={onUnIgnore}
          className="text-text-dim hover:text-accent p-1.5 inline-flex items-center gap-1 text-[11px]"
          title="Remove from cleanup ignore list"
        >
          <EyeOff size={13} /> Restore
        </button>
      ) : (
        <button
          onClick={onIgnore}
          className="text-text-dim hover:text-text p-1.5"
          title="Never mark this item for cleanup"
        >
          <EyeOff size={14} />
        </button>
      )}
      <a
        href={`https://app.plex.tv/desktop#!/server/_/details?key=${encodeURIComponent('/library/metadata/' + c.ratingKey)}`}
        target="_blank"
        rel="noreferrer"
        className="text-text-dim hover:text-text p-1.5"
        title="Open in Plex"
      >
        <ExternalLink size={14} />
      </a>
    </div>
  );
}
