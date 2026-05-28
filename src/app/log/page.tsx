'use client';
import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { humanSize } from '@/lib/format';

interface LogEntry {
  id: number;
  ratingKey: string;
  title: string | null;
  showTitle: string | null;
  seasonEpisode: string | null;
  file: string | null;
  size: string | null;
  resolution: string | null;
  videoCodec: string | null;
  quality: string[];
  deletedAt: string;
  status: string;
  error: string | null;
  triggeredBy: string | null;
}

interface Resp {
  totalFreedBytes: string;
  totalSuccessCount: number;
  totalFailedCount: number;
  entries: LogEntry[];
}

export default function LogPage() {
  const [resp, setResp] = useState<Resp | null>(null);
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/log?limit=1000').then((r) => r.json()).then(setResp);
  }, []);

  if (!resp) return <p className="text-text-dim text-center py-12">Loading…</p>;
  const freed = humanSize(Number(resp.totalFreedBytes));

  const entries = resp.entries
    .filter((e) => (filter === 'all' ? true : e.status === filter))
    .filter((e) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        (e.title ?? '').toLowerCase().includes(q) ||
        (e.showTitle ?? '').toLowerCase().includes(q) ||
        (e.file ?? '').toLowerCase().includes(q)
      );
    });

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Trash2 size={20} className="text-text-dim" />
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-xl font-semibold">Deletion log</h1>
          <p className="text-sm text-text-dim">
            All version deletions are recorded here. Failures are kept too so you can retry.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Stat label="Freed" value={freed} highlight />
          <Stat label="Success" value={resp.totalSuccessCount.toString()} />
          <Stat label="Failed" value={resp.totalFailedCount.toString()} />
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <input
          placeholder="Filter title or filename…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="px-2.5 py-1.5 bg-panel-2 border border-border rounded text-sm"
        >
          <option value="all">all</option>
          <option value="success">success only</option>
          <option value="failed">failed only</option>
        </select>
      </div>

      <div className="text-xs text-text-dim mb-2">{entries.length} entries</div>

      <div className="overflow-x-auto bg-panel border border-border rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-panel-2">
            <tr className="text-left">
              <th className="p-2.5">When</th>
              <th className="p-2.5">Title</th>
              <th className="p-2.5">Quality</th>
              <th className="p-2.5">Size</th>
              <th className="p-2.5">Status</th>
              <th className="p-2.5">File</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-border align-top">
                <td className="p-2.5 whitespace-nowrap text-text-dim">{new Date(e.deletedAt).toLocaleString()}</td>
                <td className="p-2.5">
                  {e.showTitle && <span className="text-text-dim">{e.showTitle} · {e.seasonEpisode} · </span>}
                  <span className="font-medium">{e.title}</span>
                </td>
                <td className="p-2.5">
                  <div className="flex flex-wrap gap-1">
                    {e.resolution && <Tag>{e.resolution}</Tag>}
                    {e.videoCodec && <Tag>{e.videoCodec}</Tag>}
                    {e.quality.map((q) => <Tag key={q}>{q}</Tag>)}
                  </div>
                </td>
                <td className="p-2.5 whitespace-nowrap">{e.size ? humanSize(Number(e.size)) : '-'}</td>
                <td className="p-2.5">
                  <span className={e.status === 'success' ? 'text-good' : 'text-danger'}>{e.status}</span>
                  {e.error && <div className="text-text-dim text-[10px] mt-0.5">{e.error}</div>}
                </td>
                <td className="p-2.5 font-mono text-text-dim break-all max-w-md">{e.file}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 && <p className="text-text-dim text-center py-10 text-sm">No entries match.</p>}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-xs whitespace-nowrap">
      <span className="text-text-dim">{label}: </span>
      <span className={highlight ? 'text-warn font-semibold' : 'text-text font-medium'}>{value}</span>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-1.5 py-0.5 border border-border bg-panel-2 rounded text-[10px]">
      {children}
    </span>
  );
}
