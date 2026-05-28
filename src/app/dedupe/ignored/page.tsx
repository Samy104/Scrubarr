'use client';
import { useEffect, useState } from 'react';
import { Trash2, EyeOff } from 'lucide-react';
import { useConfirm } from '@/lib/confirm';
import { useNotifications } from '@/lib/notifications';

interface Ignored {
  id: number;
  ratingKey: string;
  title: string | null;
  type: string | null;
  ignoredAt: string;
  reason: string | null;
}

export default function IgnoredPage() {
  const [items, setItems] = useState<Ignored[]>([]);
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();
  const { notify } = useNotifications();

  const load = async () => {
    setLoading(true);
    const r = await fetch('/api/ignore');
    setItems(await r.json());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const unignore = async (rk: string, title: string | null) => {
    const ok = await confirm({
      title: 'Restore item',
      body: <>Put <span className="font-medium text-text">{title ?? rk}</span> back into the dedupe list.</>,
      confirmLabel: 'Restore',
    });
    if (!ok) return;
    await fetch(`/api/ignore?ratingKey=${rk}`, { method: 'DELETE' });
    notify({ kind: 'info', title: 'Restored to dedupe pool', body: title ?? rk });
    await load();
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <EyeOff size={20} className="text-text-dim" />
        <div>
          <h1 className="text-xl font-semibold">Ignored items</h1>
          <p className="text-sm text-text-dim">These are hidden from the duplicates list. The next rescan won't re-add them.</p>
        </div>
      </div>
      {loading ? (
        <p className="text-text-dim text-center py-12">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-text-dim text-center py-12 text-sm">Nothing ignored yet.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((i) => (
            <div key={i.id} className="bg-panel border border-border rounded p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{i.title ?? `(rating key ${i.ratingKey})`}</div>
                <div className="text-xs text-text-dim">
                  {i.type ?? 'item'} · ignored {new Date(i.ignoredAt).toLocaleString()}
                  {i.reason && ` · ${i.reason}`}
                </div>
              </div>
              <button
                onClick={() => unignore(i.ratingKey, i.title)}
                className="px-2.5 py-1 border border-border hover:border-accent hover:bg-accent/10 hover:text-accent rounded text-xs flex items-center gap-1"
              >
                <Trash2 size={12} /> Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
