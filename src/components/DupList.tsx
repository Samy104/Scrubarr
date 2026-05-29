'use client';
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { StatsBar } from './StatsBar';
import { DupCard } from './DupCard';
import type { DupItem, MediaVersion, ScanCache, RuleDTO } from '@/lib/types';
import { Search, Sparkles, Play, X, Wand2, Layers, Scissors } from 'lucide-react';
import { useNotifications } from '@/lib/notifications';
import { useConfirm } from '@/lib/confirm';
import { humanSize } from '@/lib/format';
import { normRes } from '@/lib/seriesPref';
import {
  RESOLUTION_BUCKETS, countBuckets, matchesBucket, tiersFromResolutions,
  type ResolutionBucket,
} from '@/lib/resolutionFilter';

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

  // Bucket counts are derived from the search/recommendation-narrowed set, so
  // narrowing the search bar also adjusts the (N) tallies in the dropdown.
  const preBucketItems = useMemo(() => {
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
    return out;
  }, [cache, query, showOnlyRec]);

  const bucketCounts = useMemo(
    () => countBuckets(preBucketItems, (it) => tiersFromResolutions(it.media.map((m) => m.resolution))),
    [preBucketItems],
  );

  const items = useMemo(() => {
    let out = preBucketItems;
    if (resFilter !== 'all') {
      out = out.filter((x) => matchesBucket(tiersFromResolutions(x.media.map((m) => m.resolution)), resFilter));
    }
    const sorts: Record<typeof sort, (a: DupItem, b: DupItem) => number> = {
      savings: (a, b) => b.savingsPotential - a.savingsPotential,
      title: (a, b) => a.title.localeCompare(b.title),
      versions: (a, b) => b.versionCount - a.versionCount,
      size: (a, b) => b.totalSize - a.totalSize,
    };
    return [...out].sort(sorts[sort]);
  }, [preBucketItems, sort, resFilter]);

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

  /** Pick the largest version that satisfies normRes(m.resolution) === tier. */
  const pickLargestByTier = (media: MediaVersion[], tier: string): MediaVersion | null => {
    const candidates = media.filter((m) => normRes(m.resolution) === tier);
    if (candidates.length === 0) return null;
    return [...candidates].sort((a, b) => (b.size ?? 0) - (a.size ?? 0))[0];
  };

  /** Pick versions where the normalized tier is <= 720 (i.e. 720 or 480). */
  const pickLowResVersions = (media: MediaVersion[]): MediaVersion[] =>
    media.filter((m) => {
      const t = normRes(m.resolution);
      return t === '720' || t === '480';
    });

  const runBulkAcrossItems = async (
    targets: DupItem[],
    decide: (it: DupItem) => { keepId?: string; deleteIds: string[] },
    triggerLabel: string,
  ): Promise<{ done: number; ok: number; failed: number; freedBytes: number }> => {
    setBulk({ done: 0, total: targets.length, ok: 0, failed: 0 });
    let ok = 0, failed = 0, freedBytes = 0;
    for (let i = 0; i < targets.length; i++) {
      const it = targets[i];
      const plan = decide(it);
      if (plan.deleteIds.length === 0) {
        setBulk({ done: i + 1, total: targets.length, ok, failed, current: it.title });
        continue;
      }
      let perItemFail = 0;
      for (const mediaId of plan.deleteIds) {
        const m = it.media.find((x) => x.id === mediaId);
        const r = await fetch(`/api/dupes/${it.ratingKey}/media/${mediaId}`, { method: 'DELETE' });
        const d = await r.json().catch(() => ({ ok: false }));
        if (d.ok) {
          freedBytes += m?.size ?? 0;
        } else {
          perItemFail++;
        }
      }
      if (perItemFail === 0) ok++; else failed++;
      setBulk({ done: i + 1, total: targets.length, ok, failed, current: it.title });
    }
    notify({
      kind: failed ? 'warn' : 'success',
      title: triggerLabel,
      body: `${ok} item${ok === 1 ? '' : 's'} processed${failed ? `, ${failed} failed` : ''} · ${humanSize(freedBytes)} freed`,
    });
    setTimeout(() => setBulk(null), 1800);
    await load();
    return { done: targets.length, ok, failed, freedBytes };
  };

  const onKeep1080 = async (skipPrompt: boolean) => {
    // Items in the current filtered set that match 1080-720 pattern.
    const targets = items.filter((x) =>
      matchesBucket(tiersFromResolutions(x.media.map((m) => m.resolution)), '1080-720'),
    );
    if (targets.length === 0) {
      notify({ kind: 'info', title: 'Nothing to clean', body: 'No items currently match the 1080p + 720p pattern.' });
      return;
    }
    // Pre-compute the per-item plan + size estimate.
    let estimateBytes = 0;
    let estimateDeletes = 0;
    for (const it of targets) {
      const keep = pickLargestByTier(it.media, '1080');
      if (!keep) continue;
      for (const m of it.media) {
        if (m.id === keep.id) continue;
        estimateBytes += m.size ?? 0;
        estimateDeletes++;
      }
    }
    if (!skipPrompt) {
      const ok = await confirm({
        title: 'Keep 1080p across items',
        body: (
          <>
            Delete <span className="font-mono">{estimateDeletes}</span> non-1080p version
            {estimateDeletes === 1 ? '' : 's'} across <span className="font-mono">{targets.length}</span> item
            {targets.length === 1 ? '' : 's'}. Estimated <span className="font-mono">{humanSize(estimateBytes)}</span> freed.
          </>
        ),
        danger: true,
        confirmLabel: `Keep 1080p on ${targets.length}`,
        hint: <>Hold <Kbd>Shift</Kbd> while clicking next time to skip this prompt.</>,
      });
      if (!ok) return;
    }
    await runBulkAcrossItems(
      targets,
      (it) => {
        const keep = pickLargestByTier(it.media, '1080');
        if (!keep) return { deleteIds: [] };
        return {
          keepId: keep.id,
          deleteIds: it.media.filter((m) => m.id !== keep.id).map((m) => m.id),
        };
      },
      `Bulk Keep 1080p`,
    );
  };

  /** Drop 720p (and lower) versions on items that still have a 1080p+ version available. */
  const onDrop720 = async (skipPrompt: boolean) => {
    const targets = items.filter((x) => {
      const tiers = tiersFromResolutions(x.media.map((m) => m.resolution));
      // require a 720 (or lower) and at least one 1080+
      const hasLow = tiers.has('720') || tiers.has('480');
      const hasHigh = tiers.has('1080') || tiers.has('2160');
      return hasLow && hasHigh;
    });
    if (targets.length === 0) {
      notify({ kind: 'info', title: 'Nothing to drop', body: 'No items in the current filter have both a 720p and a 1080p+ version.' });
      return;
    }
    let estimateBytes = 0;
    let estimateDeletes = 0;
    for (const it of targets) {
      for (const m of pickLowResVersions(it.media)) {
        estimateBytes += m.size ?? 0;
        estimateDeletes++;
      }
    }
    if (!skipPrompt) {
      const ok = await confirm({
        title: 'Drop 720p where 1080p+ exists',
        body: (
          <>
            Delete <span className="font-mono">{estimateDeletes}</span> low-res version
            {estimateDeletes === 1 ? '' : 's'} across <span className="font-mono">{targets.length}</span> item
            {targets.length === 1 ? '' : 's'}. Single-version items are skipped. Estimated{' '}
            <span className="font-mono">{humanSize(estimateBytes)}</span> freed.
          </>
        ),
        danger: true,
        confirmLabel: `Drop 720p on ${targets.length}`,
        hint: <>Hold <Kbd>Shift</Kbd> while clicking next time to skip this prompt.</>,
      });
      if (!ok) return;
    }
    await runBulkAcrossItems(
      targets,
      (it) => ({ deleteIds: pickLowResVersions(it.media).map((m) => m.id) }),
      'Bulk Drop 720p',
    );
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
        <select
          value={resFilter}
          onChange={(e) => setResFilter(e.target.value as ResolutionBucket)}
          className="px-3 py-1.5 bg-panel-2 border border-border rounded-md text-sm focus:outline-none focus:border-accent"
          title="Filter by resolution mix"
        >
          {RESOLUTION_BUCKETS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label} ({bucketCounts[b.value]})
            </option>
          ))}
        </select>
        {resFilter === '1080-720' && (
          <BulkActionButton
            kind="keep"
            label={`Keep 1080p (${bucketCounts['1080-720']})`}
            count={bucketCounts['1080-720']}
            busy={!!bulk}
            progress={bulk}
            onClick={(e) => onKeep1080(!!(e as React.MouseEvent).shiftKey)}
            disabledHint="No items in the current filter match the 1080p + 720p pattern."
          />
        )}
        {bucketCounts['720-any'] > 0 && (
          <BulkActionButton
            kind="drop"
            label={`Drop 720p (${bucketCounts['720-any']})`}
            count={bucketCounts['720-any']}
            busy={!!bulk}
            progress={bulk}
            onClick={(e) => onDrop720(!!(e as React.MouseEvent).shiftKey)}
            disabledHint="No items in the current filter have a 720p version alongside a 1080p+ version."
          />
        )}
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

      {!activeRuleId && bulk && (
        <div className="px-4 py-2 border-b border-border bg-accent/8">
          <div className="flex items-center gap-3 flex-wrap">
            <Layers size={14} className="text-accent flex-shrink-0" />
            <div className="text-[11px] uppercase tracking-[0.16em] text-accent font-medium">
              Bulk action
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

function BulkActionButton({
  kind, label, count, busy, progress, onClick, disabledHint,
}: {
  kind: 'keep' | 'drop';
  label: string;
  count: number;
  busy: boolean;
  progress: BulkProgress | null;
  onClick: (e: React.MouseEvent) => void;
  disabledHint: string;
}) {
  const disabled = busy || count === 0;
  const baseTitle = kind === 'keep'
    ? 'Across the matching items, delete every non-1080p version and keep the largest 1080p. Shift+click skips the prompt.'
    : 'Across the matching items, delete every 720p (or lower) version where a 1080p or 2160p version is also present. Single-version items are skipped. Shift+click skips the prompt.';
  const title = count === 0 ? disabledHint : baseTitle;
  const classes = kind === 'keep'
    ? 'bg-accent/15 text-accent border border-accent/40 hover:bg-accent/25'
    : 'bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-3 py-1.5 text-xs rounded font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${classes}`}
    >
      {kind === 'keep' ? <Wand2 size={12} /> : <Scissors size={12} />}
      {progress ? `${progress.done} / ${progress.total}` : label}
    </button>
  );
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
