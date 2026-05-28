'use client';
import { useEffect, useMemo, useState } from 'react';
import { EyeOff, RotateCcw, Search, ExternalLink } from 'lucide-react';
import { useNotifications } from '@/lib/notifications';

interface Row {
  id: number;
  ratingKey: string;
  scope: 'movie' | 'show';
  title: string | null;
  sectionTitle: string | null;
  reason: string | null;
  ignoredAt: string;
}

export default function CleanupIgnoredPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'movie' | 'show'>('all');
  const { notify } = useNotifications();

  const load = async () => {
    const r = await fetch('/api/cleanup/ignore', { cache: 'no-store' });
    if (r.ok) setRows(await r.json());
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (scope !== 'all' && r.scope !== scope) return false;
      if (query && !(r.title ?? '').toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [rows, query, scope]);

  const restore = async (row: Row) => {
    await fetch(`/api/cleanup/ignore?ratingKey=${encodeURIComponent(row.ratingKey)}`, { method: 'DELETE' });
    notify({ kind: 'info', title: 'Restored to cleanup pool', body: row.title ?? row.ratingKey });
    await load();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 pr-16 bg-panel border-b border-border sticky top-0 z-10">
        <h1 className="font-display font-semibold text-base tracking-tight">Cleanup ignore list</h1>
        <div className="text-xs text-text-dim">
          <span className="text-text font-mono">{rows.length}</span> protected item{rows.length === 1 ? '' : 's'}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim" size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter title…"
              className="pl-8 pr-3 py-1.5 bg-panel-2 border border-border rounded text-sm w-56"
            />
          </div>
          <select value={scope} onChange={(e) => setScope(e.target.value as any)} className="px-3 py-1.5 bg-panel-2 border border-border rounded text-sm">
            <option value="all">All scopes</option>
            <option value="movie">Movies</option>
            <option value="show">Shows</option>
          </select>
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto">
        <p className="text-sm text-text-dim mb-4 max-w-3xl">
          Items here are never marked as cleanup candidates, regardless of which eligibility rules match.
          Restore an item to put it back into the normal rule evaluation.
        </p>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-text-dim">
            <EyeOff size={20} className="mx-auto mb-2 opacity-60" />
            Nothing on the ignore list yet. Use the eye-off icon on any cleanup candidate to add one.
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((row) => (
              <div key={row.id} className="mv-fade-up bg-panel border border-border rounded-lg p-3 flex items-center gap-3">
                <EyeOff size={14} className="text-text-dim flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-display font-semibold tracking-tight text-[15px] truncate">{row.title ?? row.ratingKey}</div>
                    <span className="text-[10px] uppercase tracking-wider text-text-dim font-mono">{row.scope}</span>
                  </div>
                  <div className="text-[11px] text-text-dim mt-0.5 flex flex-wrap gap-x-3">
                    {row.sectionTitle && <span>{row.sectionTitle}</span>}
                    <span>since <span className="font-mono">{new Date(row.ignoredAt).toLocaleString()}</span></span>
                    {row.reason && <span>· {row.reason}</span>}
                  </div>
                </div>
                <a
                  href={`https://app.plex.tv/desktop#!/server/_/details?key=${encodeURIComponent('/library/metadata/' + row.ratingKey)}`}
                  target="_blank" rel="noreferrer"
                  className="text-text-dim hover:text-text p-1.5"
                  title="Open in Plex"
                >
                  <ExternalLink size={14} />
                </a>
                <button
                  onClick={() => restore(row)}
                  className="px-2.5 py-1.5 text-xs rounded border border-border hover:border-accent hover:bg-accent/10 hover:text-accent inline-flex items-center gap-1.5"
                >
                  <RotateCcw size={12} /> Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
