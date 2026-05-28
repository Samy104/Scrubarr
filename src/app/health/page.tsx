'use client';
import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { humanSize } from '@/lib/format';

interface Status {
  status: string;
  service: string;
  version: string;
}

interface Cache {
  scannedAt: number | null;
  scanning: boolean;
  count: number;
  durationSec: number;
  error: string | null;
}

export default function HealthPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [cache, setCache] = useState<Cache | null>(null);

  useEffect(() => {
    const load = async () => {
      const [s, d] = await Promise.all([
        fetch('/api/health').then((r) => r.json()),
        fetch('/api/dupes').then((r) => r.json()),
      ]);
      setStatus(s);
      setCache({ scannedAt: d.scannedAt, scanning: d.scanning, count: d.count, durationSec: d.durationSec, error: d.error });
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <Activity size={20} className="text-good" />
        <h1 className="text-xl font-semibold">Status</h1>
      </div>
      <div className="bg-panel border border-border rounded-lg p-4 space-y-3 text-sm">
        <Row label="Service">{status?.service ?? '…'} v{status?.version ?? '?'}</Row>
        <Row label="Health">{status?.status ?? '…'}</Row>
        <Row label="Plex URL">{process.env.NEXT_PUBLIC_PLEX_URL ?? 'configured in env'}</Row>
        <hr className="border-border" />
        <Row label="Cached duplicates">{cache?.count ?? 0}</Row>
        <Row label="Last scan">
          {cache?.scannedAt
            ? `${new Date(cache.scannedAt * 1000).toLocaleString()} (took ${cache.durationSec}s)`
            : 'never'}
        </Row>
        <Row label="Scanning now">{cache?.scanning ? 'yes' : 'no'}</Row>
        {cache?.error && <Row label="Last error"><span className="text-danger">{cache.error}</span></Row>}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-text-dim">{label}</span>
      <span className="font-mono">{children}</span>
    </div>
  );
}
