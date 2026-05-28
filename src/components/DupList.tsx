'use client';
import { useEffect, useState, useMemo } from 'react';
import { StatsBar } from './StatsBar';
import { DupCard } from './DupCard';
import type { DupItem, ScanCache } from '@/lib/types';
import { Search } from 'lucide-react';
import { useNotifications } from '@/lib/notifications';

interface Props {
  /** restrict to a section type */
  filterSection?: 'movie' | 'show' | 'anime' | 'episodes';
  emptyTitle?: string;
  /** extra control rendered into the filter toolbar (e.g. library dropdown) */
  libraryFilter?: React.ReactNode;
}

export function DupList({ filterSection, emptyTitle, libraryFilter }: Props) {
  const [cache, setCache] = useState<ScanCache | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'savings' | 'title' | 'versions' | 'size'>('savings');
  const [showOnlyRec, setShowOnlyRec] = useState(false);
  const { notify } = useNotifications();

  const [pageSize, setPageSize] = useState(200);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (filterSection) params.set('library', filterSection);
      params.set('limit', String(pageSize));
      const r = await fetch(`/api/dupes?${params}`, { cache: 'no-store' });
      if (r.ok) setCache(await r.json());
    } catch {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [filterSection, pageSize]);

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
