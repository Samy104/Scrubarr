'use client';
import { useEffect, useRef, useState } from 'react';
import { Bell, Check, CheckCheck, Trash2, AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { useNotifications, type Notification } from '@/lib/notifications';

function relTime(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function KindIcon({ kind, size = 14 }: { kind: Notification['kind']; size?: number }) {
  if (kind === 'success') return <CheckCircle2 size={size} className="text-good" />;
  if (kind === 'warn') return <AlertTriangle size={size} className="text-warn" />;
  if (kind === 'error') return <AlertCircle size={size} className="text-danger" />;
  return <Info size={size} className="text-accent" />;
}

export function NotificationBell() {
  const { items, unread, markRead, markAllRead, clear } = useNotifications();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div ref={root} className="fixed top-3 right-4 z-30">
      <button
        onClick={() => setOpen((o) => !o)}
        title={unread ? `${unread} unread notifications` : 'Notifications'}
        aria-label="Notifications"
        className={`relative w-9 h-9 inline-flex items-center justify-center rounded-md border transition-colors ${
          open
            ? 'bg-panel-2 border-text-dim/40 text-text'
            : 'bg-panel border-border text-text-dim hover:text-text hover:bg-panel-2'
        }`}
      >
        <Bell size={16} strokeWidth={1.8} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-danger text-white text-[10px] font-mono font-semibold border-2 border-bg">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[380px] max-w-[90vw] bg-panel border border-border rounded-lg shadow-xl overflow-hidden flex flex-col">
          <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-border">
            <div className="text-sm font-display font-semibold tracking-tight">Notifications</div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="px-2 py-1 text-[11px] text-text-dim hover:text-text inline-flex items-center gap-1 rounded hover:bg-panel-2"
                  title="Mark all as read"
                >
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
              {items.length > 0 && (
                <button
                  onClick={clear}
                  className="px-2 py-1 text-[11px] text-text-dim hover:text-danger inline-flex items-center gap-1 rounded hover:bg-panel-2"
                  title="Clear all"
                >
                  <Trash2 size={12} /> Clear
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-text-dim">
                No notifications yet.
                <div className="text-[11px] mt-1">Delete results, auto-clean batches and errors will show up here.</div>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => (
                  <li
                    key={n.id}
                    onClick={() => !n.read && markRead(n.id)}
                    className={`px-3.5 py-2.5 flex gap-2.5 cursor-pointer transition-colors ${
                      n.read ? 'opacity-65 hover:bg-panel-2/60' : 'bg-accent/[0.04] hover:bg-accent/[0.08]'
                    }`}
                  >
                    <div className="mt-0.5"><KindIcon kind={n.kind} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="text-sm font-medium truncate">{n.title}</div>
                        <div className="text-[10px] text-text-dim whitespace-nowrap font-mono">{relTime(n.createdAt)}</div>
                      </div>
                      {n.body && <div className="text-xs text-text-dim mt-0.5 break-words">{n.body}</div>}
                    </div>
                    {!n.read && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                        className="self-start text-text-dim hover:text-text"
                        title="Mark as read"
                      >
                        <Check size={13} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
