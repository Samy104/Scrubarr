'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Star, Clock, Calendar, Building2, ShieldAlert, AlertCircle, Loader2 } from 'lucide-react';

/**
 * Slim shape returned by /api/metadata/[ratingKey]. Keep in sync with the
 * server route -- the only field type we relax here is the `type` discriminant
 * so the modal can deal with an unexpected value gracefully.
 */
export interface PlexMetadataSlim {
  ratingKey: string;
  type: 'movie' | 'show' | 'episode' | 'season';
  title: string;
  year: number | null;
  summary: string | null;
  tagline: string | null;
  studio: string | null;
  contentRating: string | null;
  duration: number | null;
  originallyAvailableAt: string | null;
  rating: number | null;
  audienceRating: number | null;
  genres: string[];
  directors: string[];
  writers: string[];
  actors: { name: string; role: string | null; thumb: string | null }[];
  thumbPath: string;
  artPath: string | null;
  showTitle?: string;
  showRatingKey?: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

interface Props {
  /** Plex ratingKey to fetch metadata for. The modal does its own fetch on open. */
  ratingKey: string;
  /** Whether the modal is mounted. Parent owns this state. */
  open: boolean;
  /** Close callback fired by X, backdrop click, or Escape. */
  onClose: () => void;
}

/**
 * Information-only modal for movies / shows / episodes. Non-destructive, no
 * action buttons -- it exists so the user can see a bigger cover, the title
 * metadata, and the description without clicking through to Plex.
 *
 * Layout is intentionally Plex/Letterboxd-shaped: backdrop hero at the top
 * with the poster overlapping the bottom-left edge, then title meta, tagline,
 * summary, genres, cast. Closes on Escape, X, or backdrop click.
 */
export function InfoModal({ ratingKey, open, onClose }: Props) {
  const [data, setData] = useState<PlexMetadataSlim | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [artFailed, setArtFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setData(null);
    setError(null);
    setArtFailed(false);
    setPosterFailed(false);
    setLoading(true);
    fetch(`/api/metadata/${encodeURIComponent(ratingKey)}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          if (r.status === 404) throw new Error('not-found');
          throw new Error(`http-${r.status}`);
        }
        return r.json();
      })
      .then((j: PlexMetadataSlim) => {
        if (!cancelled) setData(j);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || 'fetch-failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, ratingKey]);

  useEffect(() => {
    if (!open) return;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    // Lock body scroll so the page underneath doesn't bleed-scroll while the
    // modal's own overflow-y handles its content.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  // Some parents (the cleanup row uses `mv-fade-up` which animates `transform`)
  // create a containing block for position:fixed descendants, which would
  // otherwise clip the modal to the row. Portal to <body> so the overlay
  // always covers the full viewport.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={data?.title ?? 'Item details'}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ background: 'rgb(0 0 0 / 0.55)', backdropFilter: 'blur(3px)' }}
    >
      <div
        className="relative w-full max-w-3xl bg-panel border border-border rounded-xl shadow-2xl overflow-hidden my-auto"
        style={{ animation: 'mvPopIn 160ms ease-out', maxHeight: '90vh' }}
      >
        <button
          ref={closeBtn}
          onClick={onClose}
          aria-label="Close"
          className="absolute top-2.5 right-2.5 z-10 w-8 h-8 inline-flex items-center justify-center rounded-full bg-black/45 text-white/90 hover:bg-black/65 backdrop-blur-sm transition"
        >
          <X size={16} />
        </button>

        <div className="overflow-y-auto" style={{ maxHeight: '90vh' }}>
          {loading && !data && <LoadingState />}
          {error && !loading && <ErrorState code={error} />}
          {data && <ModalBody data={data} artFailed={artFailed} setArtFailed={setArtFailed} posterFailed={posterFailed} setPosterFailed={setPosterFailed} />}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-24 text-text-dim">
      <Loader2 className="animate-spin" size={20} />
      <div className="text-xs">Loading details…</div>
    </div>
  );
}

function ErrorState({ code }: { code: string }) {
  const isNotFound = code === 'not-found';
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-20 px-6 text-center">
      <div
        className={`w-10 h-10 inline-flex items-center justify-center rounded-full ${
          isNotFound ? 'bg-warn/15 text-warn' : 'bg-danger/15 text-danger'
        }`}
      >
        {isNotFound ? <AlertCircle size={18} /> : <ShieldAlert size={18} />}
      </div>
      <div className="font-display font-semibold tracking-tight">
        {isNotFound ? 'Item not found' : 'Could not load details'}
      </div>
      <div className="text-xs text-text-dim max-w-md">
        {isNotFound
          ? 'This rating key is not in your Plex library anymore. It may have been deleted between scans.'
          : 'The Plex metadata endpoint returned an error. Check that the server is reachable.'}
      </div>
    </div>
  );
}

function ModalBody({
  data,
  artFailed,
  setArtFailed,
  posterFailed,
  setPosterFailed,
}: {
  data: PlexMetadataSlim;
  artFailed: boolean;
  setArtFailed: (v: boolean) => void;
  posterFailed: boolean;
  setPosterFailed: (v: boolean) => void;
}) {
  const minutes = data.duration ? Math.round(data.duration / 60_000) : null;
  const dateStr = data.originallyAvailableAt
    ? new Date(data.originallyAvailableAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;
  const showArt = !!(data.artPath && !artFailed);
  const kindLabel = labelForType(data);

  return (
    <div>
      {/* Hero / backdrop */}
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: '16 / 7', background: 'linear-gradient(135deg, rgb(var(--panel-2)) 0%, rgb(var(--panel)) 100%)' }}
      >
        {showArt && data.artPath && (
          <img
            src={data.artPath}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setArtFailed(true)}
          />
        )}
        {/* Tint + bottom fade so the title row reads on top of a busy backdrop */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgb(0 0 0 / 0.10) 0%, rgb(0 0 0 / 0.25) 55%, rgb(var(--panel)) 100%)',
          }}
        />
        {kindLabel && (
          <div className="absolute top-3 left-4 z-[1] text-[10px] font-mono tracking-[0.18em] uppercase text-white/85 bg-black/35 backdrop-blur-sm px-2 py-1 rounded">
            {kindLabel}
          </div>
        )}
      </div>

      {/* Title block with overlapping poster */}
      <div className="relative px-4 sm:px-6 pt-0">
        <div className="flex items-end gap-4 -mt-16 sm:-mt-20">
          <div
            className="relative shrink-0 overflow-hidden rounded-md border border-border bg-panel-2 shadow-2xl"
            style={{ width: 116, aspectRatio: '2 / 3' }}
          >
            {!posterFailed ? (
              <img
                src={data.thumbPath}
                alt={data.title}
                className="block w-full h-full object-cover"
                onError={() => setPosterFailed(true)}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center font-display font-semibold text-text-dim select-none"
                style={{ fontSize: 44, letterSpacing: '-0.02em' }}
              >
                {(data.title || '?').trim().charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pb-1.5">
            {data.showTitle && (
              <div className="text-xs uppercase tracking-[0.14em] text-text-dim mb-1 truncate">
                {data.showTitle}
                {data.seasonNumber != null && data.episodeNumber != null && (
                  <span className="ml-1.5 font-mono text-text-dim/80">
                    S{String(data.seasonNumber).padStart(2, '0')}E
                    {String(data.episodeNumber).padStart(2, '0')}
                  </span>
                )}
              </div>
            )}
            <h2 className="font-display font-semibold tracking-tight text-[22px] sm:text-[26px] leading-tight">
              {data.title}
            </h2>
          </div>
        </div>

        {/* Meta line */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-dim">
          {data.year != null && (
            <span className="inline-flex items-center gap-1">
              <Calendar size={11} /> <span className="font-mono">{data.year}</span>
            </span>
          )}
          {data.contentRating && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-border bg-panel-2 text-[10px] font-mono uppercase tracking-wider text-text-dim">
              {data.contentRating}
            </span>
          )}
          {minutes != null && (
            <span className="inline-flex items-center gap-1">
              <Clock size={11} /> <span className="font-mono">{formatDuration(minutes)}</span>
            </span>
          )}
          {data.studio && (
            <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
              <Building2 size={11} /> <span className="truncate">{data.studio}</span>
            </span>
          )}
          {data.rating != null && (
            <span className="inline-flex items-center gap-1 text-warn">
              <Star size={11} className="fill-warn/80" /> <span className="font-mono">{data.rating.toFixed(1)}</span>
              <span className="text-text-dim/70">critic</span>
            </span>
          )}
          {data.audienceRating != null && data.rating !== data.audienceRating && (
            <span className="inline-flex items-center gap-1 text-accent">
              <Star size={11} className="fill-accent/70" /> <span className="font-mono">{data.audienceRating.toFixed(1)}</span>
              <span className="text-text-dim/70">audience</span>
            </span>
          )}
          {dateStr && (
            <span className="inline-flex items-center gap-1">
              <span className="text-text-dim/70">released</span> <span className="font-mono">{dateStr}</span>
            </span>
          )}
        </div>

        {data.tagline && (
          <div className="mt-3 text-sm italic text-text-dim border-l-2 border-accent/40 pl-3">
            {data.tagline}
          </div>
        )}

        {/* Summary */}
        {data.summary ? (
          <p className="mt-4 text-sm leading-relaxed text-text/90 whitespace-pre-line">
            {data.summary}
          </p>
        ) : (
          <p className="mt-4 text-sm italic text-text-dim">No summary available.</p>
        )}

        {/* Genres */}
        {data.genres.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {data.genres.map((g) => (
              <span
                key={g}
                className="text-[11px] px-2 py-0.5 rounded-full border border-accent/30 bg-accent/8 text-accent"
              >
                {g}
              </span>
            ))}
          </div>
        )}

        {/* Directors / writers */}
        {(data.directors.length > 0 || data.writers.length > 0) && (
          <div className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            {data.directors.length > 0 && (
              <div>
                <div className="uppercase text-[10px] tracking-[0.16em] text-text-dim/80 mb-1">
                  {data.directors.length === 1 ? 'Director' : 'Directors'}
                </div>
                <div className="text-text">{data.directors.join(', ')}</div>
              </div>
            )}
            {data.writers.length > 0 && (
              <div>
                <div className="uppercase text-[10px] tracking-[0.16em] text-text-dim/80 mb-1">
                  {data.writers.length === 1 ? 'Writer' : 'Writers'}
                </div>
                <div className="text-text">{data.writers.slice(0, 6).join(', ')}</div>
              </div>
            )}
          </div>
        )}

        {/* Cast */}
        {data.actors.length > 0 && (
          <div className="mt-5">
            <div className="uppercase text-[10px] tracking-[0.16em] text-text-dim/80 mb-2">Cast</div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {data.actors.slice(0, 8).map((a, i) => (
                <ActorChip key={`${a.name}-${i}`} actor={a} />
              ))}
            </div>
          </div>
        )}

        <div className="h-6" />
      </div>
    </div>
  );
}

function ActorChip({ actor }: { actor: { name: string; role: string | null; thumb: string | null } }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="shrink-0 w-[88px] flex flex-col items-center text-center">
      <div
        className="w-[64px] h-[64px] rounded-full overflow-hidden border border-border bg-panel-2 mb-1.5 relative"
      >
        {actor.thumb && !failed ? (
          <img
            src={actor.thumb}
            alt={actor.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-display text-text-dim text-lg">
            {actor.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="text-[11px] font-medium leading-tight line-clamp-2">{actor.name}</div>
      {actor.role && (
        <div className="text-[10px] text-text-dim leading-tight mt-0.5 line-clamp-2">{actor.role}</div>
      )}
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function labelForType(data: PlexMetadataSlim): string | null {
  switch (data.type) {
    case 'movie':
      return 'Movie';
    case 'show':
      return 'Series';
    case 'season':
      return 'Season';
    case 'episode': {
      if (data.seasonNumber != null && data.episodeNumber != null) {
        return `Episode S${String(data.seasonNumber).padStart(2, '0')}E${String(data.episodeNumber).padStart(2, '0')}`;
      }
      return 'Episode';
    }
    default:
      return null;
  }
}
