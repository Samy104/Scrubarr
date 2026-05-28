'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { humanSize } from '@/lib/format';
import type { CleanupCandidate, CleanupRuleDTO } from '@/lib/types';
import { RefreshCw, ShieldCheck, Trash2, Search, AlertTriangle, Sparkles, ExternalLink, EyeOff, Wand2, X } from 'lucide-react';
import { useNotifications } from '@/lib/notifications';
import { useConfirm } from '@/lib/confirm';

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
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
  const { notify } = useNotifications();
  const confirm = useConfirm();
  const searchParams = useSearchParams();
  const router = useRouter();
  const ruleIdRaw = Number(searchParams?.get('rule') ?? '');
  const activeRuleId = Number.isFinite(ruleIdRaw) && ruleIdRaw > 0 ? ruleIdRaw : null;
  const [rule, setRule] = useState<CleanupRuleDTO | null>(null);

  useEffect(() => {
    if (!activeRuleId) { setRule(null); return; }
    fetch(`/api/cleanup/rules?scope=${scope}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((all: CleanupRuleDTO[]) => setRule(all.find((x) => x.id === activeRuleId) ?? null))
      .catch(() => setRule(null));
  }, [activeRuleId, scope]);

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

  const visible = useMemo(() => {
    if (!data) return [];
    let list = showLib === 'candidates' ? data.candidates.filter((x) => x.isCandidate) : data.candidates;
    if (activeRuleId) {
      list = list.filter((x) => x.matchedRules.some((r) => r.id === activeRuleId));
    }
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
  }, [data, query, sort, showLib, activeRuleId]);

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

  const runBulkDeleteList = async (list: typeof visible, triggeredBy: string) => {
    if (list.length === 0) return;
    setBulkProgress({ done: 0, total: list.length, ok: 0, failed: 0 });
    let ok = 0, failed = 0;
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      try {
        const r = await fetch('/api/cleanup/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ratingKey: item.ratingKey, scope, triggeredBy }),
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

  const runBulkDelete = async (e?: React.MouseEvent) => {
    const list = data?.candidates.filter((x) => selected.has(x.ratingKey)) ?? [];
    if (list.length === 0) return;
    const totalBytes = list.reduce((a, x) => a + (x.totalSize || 0), 0);
    if (!e?.shiftKey) {
      const ok = await confirm({
        title: `Delete ${list.length} ${scope}${list.length === 1 ? '' : 's'}`,
        body: (
          <>
            Remove <span className="font-mono">{list.length}</span> {scope}
            {list.length === 1 ? '' : 's'} (<span className="font-mono">{humanSize(totalBytes)}</span>) from Plex and disk.
          </>
        ),
        danger: true,
        confirmLabel: `Delete ${list.length}`,
        hint: <>Hold <Kbd>Shift</Kbd> while clicking next time to skip this prompt.</>,
      });
      if (!ok) return;
    }
    await runBulkDeleteList(list, 'cleanup-bulk');
  };

  const processRule = async (e: React.MouseEvent) => {
    if (!rule) return;
    const list = (data?.candidates ?? []).filter((x) => x.isCandidate && x.matchedRules.some((r) => r.id === rule.id));
    if (list.length === 0) {
      notify({ kind: 'info', title: 'Nothing to process', body: `No active candidates match rule ${rule.name}.` });
      return;
    }
    const totalBytes = list.reduce((a, x) => a + (x.totalSize || 0), 0);
    if (rule.kind === 'exception') {
      notify({ kind: 'info', title: 'Exception rule', body: 'Nothing to do — exception rules only protect items, they do not delete.' });
      return;
    }
    if (!e.shiftKey) {
      const ok = await confirm({
        title: `Process rule: ${rule.name}`,
        body: (
          <>
            Delete every active candidate matched by this eligibility rule —{' '}
            <span className="font-mono">{list.length}</span> {scope}
            {list.length === 1 ? '' : 's'} (<span className="font-mono">{humanSize(totalBytes)}</span>) from Plex and disk.
          </>
        ),
        danger: true,
        confirmLabel: `Delete ${list.length}`,
        hint: <>Hold <Kbd>Shift</Kbd> while clicking next time to skip this prompt.</>,
      });
      if (!ok) return;
    }
    await runBulkDeleteList(list, `cleanup-rule:${rule.id}`);
  };

  const clearRuleFilter = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.delete('rule');
    const qs = params.toString();
    router.push(qs ? `?${qs}` : (typeof window !== 'undefined' ? window.location.pathname : ''));
  };

  const ruleMatchCount = useMemo(() => {
    if (!data || !activeRuleId) return 0;
    return data.candidates.reduce((a, x) => a + (x.matchedRules.some((r) => r.id === activeRuleId) ? 1 : 0), 0);
  }, [data, activeRuleId]);

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

      {activeRuleId && (
        <CleanupRuleBanner
          rule={rule}
          ruleId={activeRuleId}
          itemCount={ruleMatchCount}
          progress={bulkProgress}
          onProcess={processRule}
          onClear={clearRuleFilter}
          backHref="/cleanup/rules"
        />
      )}

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
              <button
                onClick={runBulkDelete}
                disabled={!!bulkProgress}
                className="px-3 py-1.5 bg-danger text-white font-semibold rounded text-xs flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                title={`Delete ${selected.size} item(s). Shift+click skips this prompt.`}
              >
                <Trash2 size={11} />
                {bulkProgress
                  ? `${bulkProgress.done} / ${bulkProgress.total}`
                  : `Delete ${selected.size}`}
              </button>
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

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="px-1 py-px bg-panel-2 border border-border rounded font-mono text-[10px]">{children}</kbd>;
}

function CleanupRuleBanner({
  rule, ruleId, itemCount, progress, onProcess, onClear, backHref,
}: {
  rule: CleanupRuleDTO | null;
  ruleId: number;
  itemCount: number;
  progress: BulkProgress | null;
  onProcess: (e: React.MouseEvent) => void;
  onClear: () => void;
  backHref: string;
}) {
  const isException = rule?.kind === 'exception';
  const wrapCls = isException
    ? 'bg-good/8 border-b border-good/30 px-4 py-3'
    : 'bg-warn/8 border-b border-warn/30 px-4 py-3';
  const iconCls = isException
    ? 'w-7 h-7 inline-flex items-center justify-center rounded-md bg-good/20 text-good flex-shrink-0'
    : 'w-7 h-7 inline-flex items-center justify-center rounded-md bg-warn/20 text-warn flex-shrink-0';
  const labelCls = isException
    ? 'text-[10px] uppercase tracking-[0.16em] text-good font-medium'
    : 'text-[10px] uppercase tracking-[0.16em] text-warn font-medium';
  const linkCls = isException
    ? 'text-[10px] text-good/80 hover:text-good underline underline-offset-2'
    : 'text-[10px] text-warn/80 hover:text-warn underline underline-offset-2';
  return (
    <div className={wrapCls}>
      <div className="flex items-start gap-3 flex-wrap">
        <div className={iconCls}>
          {isException ? <ShieldCheck size={14} /> : <Sparkles size={14} />}
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <div className={labelCls}>Filtered by rule</div>
            <Link href={backHref} className={linkCls}>all rules ↗</Link>
          </div>
          <div className="font-display font-semibold tracking-tight text-[15px] mt-0.5">{rule?.name ?? `Rule #${ruleId}`}</div>
          {rule?.description && <div className="text-xs text-text-dim mt-0.5">{rule.description}</div>}
          <div className="text-[11px] text-text-dim mt-1 flex flex-wrap gap-x-3">
            <span>kind: <span className="font-mono text-text">{rule?.kind ?? '?'}</span></span>
            <span><span className="font-mono text-text">{itemCount}</span> matched item{itemCount === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClear}
            className="px-2.5 py-1.5 text-xs rounded border border-border hover:bg-panel-2 inline-flex items-center gap-1.5"
          >
            <X size={11} /> Clear filter
          </button>
          {!isException && (
            <button
              onClick={onProcess}
              disabled={!!progress || itemCount === 0}
              className="px-3 py-1.5 text-xs rounded bg-danger text-white font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
              title="Delete every active candidate that matches this rule. Shift+click skips the prompt."
            >
              <Wand2 size={12} />
              {progress ? `${progress.done} / ${progress.total}` : `Process rule (${itemCount})`}
            </button>
          )}
        </div>
      </div>
      {progress && (
        <div className="mt-2 h-1 bg-panel-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-danger transition-[width] duration-150"
            style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
          />
        </div>
      )}
      {progress?.current && (
        <div className="mt-1 text-[11px] text-text-dim font-mono truncate" title={progress.current}>Deleting: {progress.current}</div>
      )}
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
