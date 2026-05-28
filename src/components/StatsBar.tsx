'use client';
import { humanSize } from '@/lib/format';
import type { DupItem } from '@/lib/types';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface Props {
  items: DupItem[];
  scannedAt: number | null;
  scanning: boolean;
  durationSec: number;
  onRescan: () => Promise<void>;
  /** Aggregate totals for the full filtered set; if absent, falls back to summing visible items. */
  totals?: { count: number; totalSize: number; savingsPotential: number };
}

export function StatsBar({ items, scannedAt, scanning, durationSec, onRescan, totals }: Props) {
  const [rescanLoading, setRescanLoading] = useState(false);
  const totalSize = totals
    ? totals.totalSize
    : items.reduce((a, x) => a + (x.totalSize || 0), 0);
  const savings = totals
    ? totals.savingsPotential
    : items.reduce((a, x) => a + (x.savingsPotential || 0), 0);
  const itemCount = totals ? totals.count : items.length;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 bg-panel border-b border-border sticky top-0 z-10">
      <Stat label="Items" value={itemCount.toString()} />
      <Stat label="Total dup size" value={humanSize(totalSize)} />
      <Stat label="Savings potential" value={humanSize(savings)} highlight />
      <Stat
        label="Last scan"
        value={
          scannedAt
            ? `${new Date(scannedAt * 1000).toLocaleString()} (${durationSec}s)`
            : 'never'
        }
      />
      <div className="ml-auto">
        <button
          disabled={scanning || rescanLoading}
          onClick={async () => {
            setRescanLoading(true);
            await onRescan();
            setTimeout(() => setRescanLoading(false), 1500);
          }}
          className="px-3 py-1.5 bg-panel-2 hover:bg-border border border-border rounded-md text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw size={14} className={scanning || rescanLoading ? 'animate-spin' : ''} />
          {scanning ? 'Scanning…' : 'Rescan'}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-xs">
      <span className="text-text-dim">{label}: </span>
      <span className={highlight ? 'text-warn font-semibold' : 'text-text font-medium'}>{value}</span>
    </div>
  );
}
