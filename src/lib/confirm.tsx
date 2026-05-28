'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { X, AlertTriangle, Trash2, Play } from 'lucide-react';

export interface ConfirmOpts {
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Footer hint shown below the body, useful for "Hold Shift to skip" reminders. */
  hint?: React.ReactNode;
}

type Pending = { opts: ConfirmOpts; resolve: (v: boolean) => void } | null;

const ConfirmCtx = createContext<{ confirm: (opts: ConfirmOpts) => Promise<boolean> } | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending>(null);

  const confirm = useCallback((opts: ConfirmOpts): Promise<boolean> => {
    return new Promise<boolean>((resolve) => setPending({ opts, resolve }));
  }, []);

  const close = useCallback((value: boolean) => {
    setPending((cur) => {
      if (cur) cur.resolve(value);
      return null;
    });
  }, []);

  return (
    <ConfirmCtx.Provider value={{ confirm }}>
      {children}
      {pending && <ConfirmDialog opts={pending.opts} onCancel={() => close(false)} onConfirm={() => close(true)} />}
    </ConfirmCtx.Provider>
  );
}

export function useConfirm(): (opts: ConfirmOpts) => Promise<boolean> {
  const c = useContext(ConfirmCtx);
  if (!c) throw new Error('useConfirm must be used inside ConfirmProvider');
  return c.confirm;
}

function ConfirmDialog({ opts, onCancel, onConfirm }: { opts: ConfirmOpts; onCancel: () => void; onConfirm: () => void }) {
  const confirmBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Focus the confirm button on open so Enter triggers it
    confirmBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{ background: 'rgb(0 0 0 / 0.45)', backdropFilter: 'blur(2px)' }}
    >
      <div
        className="w-full max-w-md bg-panel border border-border rounded-xl shadow-2xl overflow-hidden"
        style={{ animation: 'mvPopIn 140ms ease-out' }}
      >
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <div className={`w-7 h-7 inline-flex items-center justify-center rounded-full ${
            opts.danger ? 'bg-danger/15 text-danger' : 'bg-accent/15 text-accent'
          }`}>
            {opts.danger ? <AlertTriangle size={15} /> : <Play size={14} />}
          </div>
          <div className="font-display font-semibold tracking-tight flex-1">{opts.title}</div>
          <button onClick={onCancel} className="text-text-dim hover:text-text" aria-label="Cancel"><X size={15} /></button>
        </div>
        {(opts.body || opts.hint) && (
          <div className="px-4 py-3 text-sm text-text-dim space-y-2">
            {opts.body && <div className={opts.danger ? 'text-text' : ''}>{opts.body}</div>}
            {opts.hint && <div className="text-[11px] text-text-dim/80">{opts.hint}</div>}
          </div>
        )}
        <div className="px-3 py-2.5 border-t border-border bg-panel-2/40 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded border border-border hover:bg-panel-2"
          >
            {opts.cancelLabel ?? 'Cancel'}
          </button>
          <button
            ref={confirmBtn}
            onClick={onConfirm}
            className={`px-3 py-1.5 text-sm rounded font-semibold inline-flex items-center gap-1.5 ${
              opts.danger
                ? 'bg-danger text-white hover:opacity-90'
                : 'bg-accent text-accent-ink hover:opacity-90'
            }`}
          >
            {opts.danger ? <Trash2 size={13} /> : <Play size={13} />}
            {opts.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
