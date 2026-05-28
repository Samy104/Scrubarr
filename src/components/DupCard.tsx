'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, EyeOff, Trash2, Check, Sparkles, Wand2 } from 'lucide-react';
import { humanSize } from '@/lib/format';
import type { DupItem, MediaVersion } from '@/lib/types';
import { useConfirm } from '@/lib/confirm';
import { MediaPoster } from './MediaPoster';

interface Props {
  item: DupItem;
  onDelete: (mediaId: string) => Promise<void>;
  onKeepOnly: (mediaId: string) => Promise<void>;
  onIgnore: () => Promise<void>;
}

export function DupCard({ item, onDelete, onKeepOnly, onIgnore }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const maxSize = Math.max(...item.media.map((m) => m.size), 1);
  const confirm = useConfirm();

  const recommendedVersion = item.recommended?.keepMediaId
    ? item.media.find((m) => m.id === item.recommended!.keepMediaId)
    : null;

  return (
    <div className="bg-panel border border-border rounded-lg p-4 mb-2.5 hover:border-text-dim/40 transition-colors">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown size={18} className="text-text-dim" /> : <ChevronRight size={18} className="text-text-dim" />}
        <MediaPoster
          ratingKey={item.posterRatingKey ?? (item.type === 'episode' ? item.grandparentRatingKey : item.ratingKey)}
          title={item.showTitle || item.title}
          kind={item.type === 'movie' ? 'movie' : 'show'}
          width={40}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold truncate">
              {item.showTitle ? (
                <>
                  <span className="text-text-dim">{item.showTitle}</span>
                  {item.seasonEpisode && <span className="text-text-dim"> · {item.seasonEpisode} · </span>}
                </>
              ) : null}
              {item.title}
            </h2>
            {item.year && <span className="text-text-dim text-sm">({item.year})</span>}
            {item.recommended && (
              <span className="inline-flex items-center gap-1 text-xs bg-accent/15 text-accent px-2 py-0.5 rounded-md">
                <Sparkles size={11} />
                rule: {item.recommended.ruleName}
              </span>
            )}
            {item.seriesPref?.status === 'autoClean' && (
              <span className="inline-flex items-center gap-1 text-xs bg-good/15 text-good px-2 py-0.5 rounded-md">
                <Sparkles size={11} />
                auto-clean
              </span>
            )}
            {item.seriesPref?.status === 'needsReview' && (
              <span className="inline-flex items-center gap-1 text-xs bg-warn/15 text-warn px-2 py-0.5 rounded-md">
                <Sparkles size={11} />
                review (no match)
              </span>
            )}
          </div>
          <div className="text-xs text-text-dim mt-1">
            {item.section} · {item.versionCount} versions · total {humanSize(item.totalSize)}
          </div>
        </div>
        <div className="text-warn text-xs font-mono font-semibold px-2.5 py-1 rounded-md whitespace-nowrap border border-warn/30 bg-warn/10">
          save {humanSize(item.savingsPotential)}
        </div>
        {recommendedVersion && (
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (e.shiftKey) {
                setBusy('rec');
                await onKeepOnly(recommendedVersion.id);
                setBusy(null);
                return;
              }
              const others = item.media.filter((x) => x.id !== recommendedVersion.id);
              const ok = await confirm({
                title: 'Go with recommendation',
                body: (
                  <>
                    Keep the <span className="font-mono">{recommendedVersion.resolution}</span>{' '}
                    {recommendedVersion.videoCodec} ({humanSize(recommendedVersion.size)}) version and delete the{' '}
                    <span className="font-mono">{others.length}</span> other version{others.length === 1 ? '' : 's'} of{' '}
                    <span className="font-medium text-text">{item.title}</span> per rule{' '}
                    <span className="text-accent">{item.recommended!.ruleName}</span>.
                  </>
                ),
                danger: true,
                confirmLabel: `Delete ${others.length}`,
                hint: <>Hold <Kbd>Shift</Kbd> while clicking next time to skip this prompt.</>,
              });
              if (!ok) return;
              setBusy('rec');
              await onKeepOnly(recommendedVersion.id);
              setBusy(null);
            }}
            disabled={busy !== null}
            className="text-xs px-2.5 py-1.5 bg-accent text-accent-ink font-semibold rounded-md flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
            title={`Apply rule: keep ${recommendedVersion.resolution} ${recommendedVersion.videoCodec}, delete the rest. Shift+click to skip the prompt.`}
          >
            <Wand2 size={12} /> {busy === 'rec' ? 'Applying…' : 'Go with recommendation'}
          </button>
        )}
        <button
          onClick={async (e) => {
            e.stopPropagation();
            const ok = await confirm({
              title: `Ignore "${item.title}"?`,
              body: <>This item won't be considered for future duplicate scans. You can restore it from the Ignored page.</>,
              confirmLabel: 'Ignore',
            });
            if (!ok) return;
            setBusy('ignore');
            await onIgnore();
            setBusy(null);
          }}
          disabled={busy !== null}
          className="text-xs px-2 py-1 border border-border hover:border-danger hover:bg-danger/10 hover:text-danger rounded-md flex items-center gap-1 disabled:opacity-50"
        >
          <EyeOff size={12} /> Ignore
        </button>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-border space-y-2.5">
          {item.media.map((m) => (
            <VersionRow
              key={m.id}
              m={m}
              maxSize={maxSize}
              recommended={
                item.recommended?.keepMediaId === m.id || item.seriesPref?.keepMediaId === m.id
              }
              disabled={busy !== null}
              onDelete={async () => {
                const ok = await confirm({
                  title: 'Delete this version',
                  body: (
                    <>
                      Remove the <span className="font-mono">{m.resolution}</span> {m.videoCodec} version (
                      <span className="font-mono">{humanSize(m.size)}</span>) of{' '}
                      <span className="font-medium text-text">{item.title}</span> from Plex and disk.
                      <div className="mt-2 text-[11px] font-mono text-text-dim break-all">{m.file}</div>
                    </>
                  ),
                  danger: true,
                  confirmLabel: 'Delete',
                });
                if (!ok) return;
                setBusy(`del-${m.id}`);
                await onDelete(m.id);
                setBusy(null);
              }}
              onKeep={async () => {
                const others = item.media.filter((x) => x.id !== m.id);
                const ok = await confirm({
                  title: 'Keep only this version',
                  body: (
                    <>
                      Delete the <span className="font-mono">{others.length}</span> other version
                      {others.length === 1 ? '' : 's'} and keep only{' '}
                      <span className="font-mono">{m.resolution}</span> ({humanSize(m.size)}).
                    </>
                  ),
                  danger: true,
                  confirmLabel: `Delete ${others.length}`,
                });
                if (!ok) return;
                setBusy(`keep-${m.id}`);
                await onKeepOnly(m.id);
                setBusy(null);
              }}
              loadingKey={busy}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="px-1 py-px bg-panel-2 border border-border rounded font-mono text-[10px]">{children}</kbd>;
}

function VersionRow({
  m,
  maxSize,
  recommended,
  disabled,
  onDelete,
  onKeep,
  loadingKey,
}: {
  m: MediaVersion;
  maxSize: number;
  recommended: boolean;
  disabled: boolean;
  onDelete: () => Promise<void>;
  onKeep: () => Promise<void>;
  loadingKey: string | null;
}) {
  const pct = (m.size / maxSize) * 100;
  const resClass = resolutionClass(m.resolution);

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-[110px_1fr_auto] gap-3 items-start p-2.5 rounded-md ${
        recommended ? 'bg-accent/10 border border-accent/30' : 'border border-transparent'
      }`}
    >
      <div className="flex flex-col gap-1.5">
        <div className="text-base font-semibold">{humanSize(m.size)}</div>
        <div className="h-1 bg-panel-2 rounded">
          <div className="h-full bg-accent rounded" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge className={resClass}>{m.resolution}</Badge>
          <Badge>{m.videoCodec}</Badge>
          {m.audioCodec && (
            <Badge>
              {m.audioCodec}
              {m.audioChannels ? ` ${m.audioChannels}ch` : ''}
            </Badge>
          )}
          {m.quality.map((q) => (
            <Badge key={q} className={qualityClass(q)}>
              {q}
            </Badge>
          ))}
        </div>
      </div>
      <div className="text-xs text-text-dim font-mono break-all leading-relaxed">{m.file}</div>
      <div className="flex flex-col gap-1.5 self-center">
        <button
          onClick={onDelete}
          disabled={disabled}
          className="text-xs px-2.5 py-1.5 border border-border hover:border-danger hover:bg-danger/10 hover:text-danger rounded-md flex items-center gap-1 disabled:opacity-50 whitespace-nowrap"
        >
          <Trash2 size={12} /> {loadingKey === `del-${m.id}` ? 'deleting…' : 'Delete this'}
        </button>
        <button
          onClick={onKeep}
          disabled={disabled}
          className="text-xs px-2.5 py-1.5 bg-accent text-accent-ink hover:opacity-90 font-semibold rounded-md flex items-center gap-1 disabled:opacity-50 whitespace-nowrap"
        >
          <Check size={12} /> {loadingKey === `keep-${m.id}` ? 'working…' : 'Keep only this'}
        </button>
      </div>
    </div>
  );
}

function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border border-border bg-panel-2 text-text-dim ${className}`}>
      {children}
    </span>
  );
}

function resolutionClass(res: string): string {
  const r = res.toUpperCase();
  if (r === '2160P' || r === '4K') return 'bg-accent/15 text-accent border-accent/30';
  if (r === '1080P') return 'bg-good/12 text-good border-good/30';
  if (r === '720P') return 'bg-warn/15 text-warn border-warn/30';
  return '';
}

function qualityClass(q: string): string {
  if (['HDR', 'HDR10', 'HDR10+', 'DV', 'DOLBYVISION'].includes(q)) return 'bg-warn/15 text-warn border-warn/30';
  if (q === 'REMUX') return 'bg-danger/15 text-danger border-danger/30';
  if (['ATMOS', 'TRUEHD', 'DTS-HD', 'DTS-X'].includes(q)) return 'bg-accent/15 text-accent border-accent/30';
  return '';
}
