'use client';
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { StatsBar } from './StatsBar';
import { DupCard } from './DupCard';
import type { DupItem, ScanCache, RuleDTO } from '@/lib/types';
import { Search, Sparkles, Play, X, Wand2 } from 'lucide-react';
import { useNotifications } from '@/lib/notifications';
import { useConfirm } from '@/lib/confirm';

interface Props {
  /** restrict to a section type */
  filterSection?: 'movie' | 'show' | 'anime' | 'episodes';
  emptyTitle?: string;
  /** extra control rendered into the filter toolbar (e.g. library dropdown) */
  libraryFilter?: React.ReactNode;
}

interface BulkProgress { done: number; total: number; ok: number; failed: number; current?: string }

export function DupList({ filterSection, emptyTitle, libraryFilter }: Props) {
  const [cache, setCache] = useState<ScanCache | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'savings' | 'title' | 'versions' | 'size'>('savings');
  const [showOnlyRec, setShowOnlyRec] = useState(false);
  const { notify } = useNotifications();
  const confirm = useConfirm();
  const searchParams = useSearchParams();
  const router = useRouter();
  const ruleId = Number(searchParams?.get('rule') ?? '');
  const activeRuleId = Number.isFinite(ruleId) && ruleId > 0 ? ruleId : null;

  const [rule, setRule] = useState<RuleDTO | null>(null);
  const [bulk, setBulk] = useState<BulkProgress | null>(null);

  const [pageSize, setPageSize] = useState(200);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (filterSection) params.set('library', filterSection);
      params.set('limit', String(pageSize));
      if (activeRuleId) params.set('rule', String(activeRuleId));
      const r = await fetch(`/api/dupes?${params}`, { cache: 'no-store' });
      if (r.ok) setCache(await r.json());
    } catch {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [filterSection, pageSize, activeRuleId]);

  // Fetch rule details when ?rule=<id> is set
  useEffect(() => {
    if (!activeRuleId) { setRule(null); return; }
    fetch('/api/rules', { cache: 'no-store' })
      .then((r) => r.json())
      .then((all: RuleDTO[]) => setRule(all.find((x) => x.id === activeRuleId) ?? null))
      .catch(() => setRule(null));
  }, [activeRuleId]);

  const items = useMemo(() => {
    if (!cache) return [];
    let out = cache.items;
    if (query) {
      const q = query.toLowerCase();
      out = out.filter(
        (x) =>
          x.title.toLowerCase().includes(q) ||
          (x.showTitle ?? '').toLowerCase().includes(q) ||
          x.media.some((m) => (m.file ?? '').toLowerCase().includes(q)),
      );
    }
    if (showOnlyRec) out = out.filter((x) => x.recommended);
    const sorts: Record<typeof sort, (a: DupItem, b: DupItem) => number> = {
      savings: (a, b) => b.savingsPotential - a.savingsPotential,
      title: (a, b) => a.title.localeCompare(b.title),
      versions: (a, b) => b.versionCount - a.versionCount,
      size: (a, b) => b.totalSize - a.totalSize,
    };
    return [...out].sort(sorts[sort]);
  }, [cache, query, sort, showOnlyRec, filterSection]);

  const handleDelete = async (rk: string, mediaId: string) => {
    const item = cache?.items.find((x) => x.ratingKey === rk);
    const r = await fetch(`/api/dupes/${rk}/media/${mediaId}`, { method: 'DELETE' });
    const d = await r.json();
    if (!d.ok) {
      notify({ kind: 'error', title: 'Delete failed', body: `${item?.title ?? rk}: ${d.msg ?? 'unknown error'}` });
      return;
    }
    notify({ kind: 'success', title: 'Version deleted', body: item?.title ?? rk });
    await load();
  };

  const handleKeepOnly = async (rk: string, keepMediaId: string) => {
    if (!cache) return;
    const item = cache.items.find((x) => x.ratingKey === rk);
    if (!item) return;
    let ok = 0, fail = 0;
    for (const m of item.media) {
      if (m.id === keepMediaId) continue;
      const r = await fetch(`/api/dupes/${rk}/media/${m.id}`, { method: 'DELETE' });
      const d = await r.json().catch(() => ({ ok: false }));
      if (d.ok) ok++; else fail++;
    }
    notify({
      kind: fail ? 'warn' : 'success',
      title: `Kept one version of ${item.title}`,
      body: `${ok} deleted${fail ? `, ${fail} failed` : ''}`,
    });
    await load();
  };

  const handleIgnore = async (rk: string, title: string, type: string) => {
    await fetch('/api/ignore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ratingKey: rk, title, type }),
    });
    notify({ kind: 'info', title: 'Added to ignore list', body: title });
    await load();
  };

  const handleRescan = async () => {
    await fetch('/api/rescan', { method: 'POST' });
    setTimeout(load, 2000);
  };

  const processRule = async (skipPrompt: boolean) => {
    if (!rule || !cache) return;
    const targets = cache.items.filter((x) => x.recommended?.ruleId === rule.id);
    if (targets.length === 0) {
      notify({ kind: 'info', title: 'Nothing to process', body: `No items currently match rule ${rule.name}.` });
      return;
    }

    if (!skipPrompt) {
      const ok = await confirm({
        title: `Process rule: ${rule.name}`,
        body: (
          <>
            Apply this rule to <span className="font-mono">{targets.length}</span> matched item{targets.length === 1 ? '' : 's'}.{' '}
            {rule.action.kind === 'ignore' ? (
              <>Each item will be added to the dedupe ignore list.</>
            ) : rule.action.kind === 'mark_review' ? (
              <>This rule only flags items for review — there's nothing to process.</>
            ) : (
              <>For each item, the recommended version is kept and every other version is deleted from Plex and disk.</>
            )}
          </>
        ),
        danger: rule.action.kind !== 'mark_review' && rule.action.kind !== 'ignore',
        confirmLabel: `Process ${targets.length}`,
        hint: <>Hold <Kbd>Shift</Kbd> while clicking next time to skip this prompt.</>,
      });
      if (!ok) return;
    }

    if (rule.action.kind === 'mark_review') {
      notify({ kind: 'info', title: 'Mark-review rule', body: 'No destructive action to perform.' });
      return;
    }

    setBulk({ done: 0, total: targets.length, ok: 0, failed: 0 });
    let ok = 0, failed = 0;
    for (let i = 0; i < targets.length; i++) {
      const it = targets[i];
      try {
        if (rule.action.kind === 'ignore') {
          await fetch('/api/ignore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ratingKey: it.ratingKey, title: it.title, type: it.type }),
          });
          ok++;
        } else {
          const keepId = it.recommended?.keepMediaId;
          if (!keepId) { failed++; continue; }
          let perItemFail = 0;
          for (const m of it.media) {
            if (m.id === keepId) continue;
            const r = await fetch(`/api/dupes/${it.ratingKey}/media/${m.id}`, { method: 'DELETE' });
            const d = await r.json().catch(() => ({ ok: false }));
            if (!d.ok) perItemFail++;
          }
          if (perItemFail === 0) ok++; else failed++;
        }
      } catch {
        failed++;
      }
      setBulk({ done: i + 1, total: targets.length, ok, failed, current: it.title });
    }
    notify({
      kind: failed ? 'warn' : 'success',
      title: `Processed rule: ${rule.name}`,
      body: `${ok} item${ok === 1 ? '' : 's'} processed${failed ? `, ${failed} failed` : ''}`,
    });
    setTimeout(() => setBulk(null), 1800);
    await load();
  };

  const clearRule = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.delete('rule');
    const qs = params.toString();
    router.push(qs ? `?${qs}` : (typeof window !== 'undefined' ? window.location.pathname : ''));
  };

  return (
    <div>
      <StatsBar
        items={items}
        scannedAt={cache?.scannedAt ?? null}
        scanning={cache?.scanning ?? false}
        durationSec={cache?.durationSec ?? 0}
        onRescan={handleRescan}
        totals={cache?.totals}
      />

      {activeRuleId && (
        <RuleBanner
          rule={rule}
          ruleId={activeRuleId}
          itemCount={cache?.count ?? 0}
          progress={bulk}
          onProcess={(e) => processRule(!!(e as React.MouseEvent).shiftKey)}
          onClear={clearRule}
          backHref="/dedupe/rules"
        />
      )}

      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border bg-panel/50">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim" size={14} />
          <input
            type="search"
            placeholder="Filter by title or filename…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-panel-2 border border-border rounded-md text-sm focus:outline-none focus:border-accent"
          />
        </div>
        {libraryFilter}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="px-3 py-1.5 bg-panel-2 border border-border rounded-md text-sm focus:outline-none focus:border-accent"
        >
          <option value="savings">Sort: savings</option>
          <option value="title">Sort: title</option>
          <option value="versions">Sort: version count</option>
          <option value="size">Sort: total size</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-text-dim cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyRec}
            onChange={(e) => setShowOnlyRec(e.target.checked)}
            className="accent-accent"
          />
          Only items with rule recommendation
        </label>
        <div className="ml-auto text-xs text-text-dim">
          {items.length} shown of {cache?.count ?? 0}
        </div>
      </div>
      <div className="p-4 max-w-6xl mx-auto">
        {cache?.error && (
          <div className="bg-danger/10 border border-danger/40 text-danger p-3 rounded-md mb-3 text-sm">
            Scan error: {cache.error}
          </div>
        )}
        {!cache && <p className="text-text-dim text-center py-12">Loading…</p>}
        {cache && items.length === 0 && (
          <p className="text-text-dim text-center py-16 text-sm">{emptyTitle ?? 'No duplicates 🎉'}</p>
        )}
        {items.map((item) => (
          <DupCard
            key={item.ratingKey}
            item={item}
            onDelete={(mediaId) => handleDelete(item.ratingKey, mediaId)}
            onKeepOnly={(mediaId) => handleKeepOnly(item.ratingKey, mediaId)}
            onIgnore={() => handleIgnore(item.ratingKey, item.title, item.type)}
          />
        ))}
        {(cache?.hasMore || (cache && pageSize < cache.count)) && (
          <div className="text-center py-6">
            <button
              onClick={() => setPageSize((s) => s + 200)}
              className="px-4 py-2 bg-panel-2 hover:bg-border border border-border rounded-md text-sm"
            >
              Load 200 more ({Math.max((cache?.count ?? 0) - items.length, 0)} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="px-1 py-px bg-panel-2 border border-border rounded font-mono text-[10px]">{children}</kbd>;
}

export function RuleBanner({
  rule, ruleId, itemCount, progress, onProcess, onClear, backHref,
}: {
  rule: { id: number; name: string; description?: string | null; action?: { kind: string; value?: string } } | null;
  ruleId: number;
  itemCount: number;
  progress: BulkProgress | null;
  onProcess: (e: React.MouseEvent) => void;
  onClear: () => void;
  backHref: string;
}) {
  const actionLabel = rule?.action
    ? rule.action.kind + (rule.action.value ? `:${rule.action.value}` : '')
    : null;
  return (
    <div className="bg-accent/8 border-b border-accent/30 px-4 py-3">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-accent/20 text-accent flex-shrink-0">
          <Sparkles size={14} />
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[10px] uppercase tracking-[0.16em] text-accent font-medium">Filtered by rule</div>
            <Link href={backHref} className="text-[10px] text-accent/80 hover:text-accent underline underline-offset-2">all rules ↗</Link>
          </div>
          <div className="font-display font-semibold tracking-tight text-[15px] mt-0.5">{rule?.name ?? `Rule #${ruleId}`}</div>
          {rule?.description && <div className="text-xs text-text-dim mt-0.5">{rule.description}</div>}
          <div className="text-[11px] text-text-dim mt-1 flex flex-wrap gap-x-3">
            {actionLabel && <span>action: <span className="font-mono text-text">{actionLabel}</span></span>}
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
          <button
            onClick={onProcess}
            disabled={!!progress || itemCount === 0}
            className="px-3 py-1.5 text-xs rounded bg-accent text-accent-ink font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
            title="Apply this rule to every matched item. Shift+click to skip the prompt."
          >
            <Wand2 size={12} />
            {progress ? `${progress.done} / ${progress.total}` : `Process rule (${itemCount})`}
          </button>
        </div>
      </div>
      {progress && (
        <div className="mt-2 h-1 bg-panel-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-[width] duration-150"
            style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
          />
        </div>
      )}
      {progress?.current && (
        <div className="mt-1 text-[11px] text-text-dim font-mono truncate" title={progress.current}>Processing: {progress.current}</div>
      )}
    </div>
  );
}
