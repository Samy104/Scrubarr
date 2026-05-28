'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type NotificationKind = 'success' | 'info' | 'warn' | 'error';

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  createdAt: number;
  read: boolean;
}

interface Ctx {
  items: Notification[];
  unread: number;
  notify: (n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

const NotificationCtx = createContext<Ctx | null>(null);
const KEY = 'scrubarr-notifications';
const MAX = 50;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Notification[]>([]);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
  }, [items]);

  const notify = useCallback<Ctx['notify']>((n) => {
    setItems((cur) => {
      const next: Notification = {
        ...n,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        read: false,
      };
      return [next, ...cur].slice(0, MAX);
    });
  }, []);

  const markRead = useCallback((id: string) => {
    setItems((cur) => cur.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllRead = useCallback(() => {
    setItems((cur) => cur.map((n) => ({ ...n, read: true })));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const unread = useMemo(() => items.reduce((a, n) => a + (n.read ? 0 : 1), 0), [items]);

  return (
    <NotificationCtx.Provider value={{ items, unread, notify, markRead, markAllRead, clear }}>
      {children}
    </NotificationCtx.Provider>
  );
}

export function useNotifications(): Ctx {
  const c = useContext(NotificationCtx);
  if (!c) throw new Error('useNotifications must be used inside NotificationProvider');
  return c;
}
