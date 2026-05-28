'use client';
import { useState } from 'react';

interface Props {
  /** Plex ratingKey to fetch the poster for. For episode rows this should be
   * the show's ratingKey (grandparentRatingKey), not the episode's. */
  ratingKey?: string | null;
  /** Title used for fallback initials + alt text. */
  title: string;
  /** kind only changes the fallback hue: movies skew warn, shows skew accent. */
  kind?: 'movie' | 'show';
  /** Width in px. Height is derived from the 2:3 poster aspect ratio. */
  width?: number;
  /** Optional extra classes for the outer wrapper. */
  className?: string;
}

/**
 * Compact, lazy-loaded Plex poster. Falls back to a colored tile with the
 * first letter of the title if Plex has no thumb or the proxy fails.
 *
 * The component never embeds the Plex token client-side — the <img> hits
 * /api/thumb/<ratingKey>, which proxies + caches the bytes server-side.
 */
export function MediaPoster({
  ratingKey,
  title,
  kind = 'movie',
  width = 40,
  className = '',
}: Props) {
  const [failed, setFailed] = useState(false);
  const height = Math.round(width * 1.5);

  const showImg = ratingKey && !failed;
  const initial = (title || '?').trim().charAt(0).toUpperCase() || '?';

  // Deterministic hue from title so adjacent placeholder tiles don't all blur
  // into the same color in dense lists.
  const hue = hashHue(title);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-md border border-border bg-panel-2 ${className}`}
      style={{ width, height }}
      aria-hidden={!showImg}
    >
      {showImg ? (
        <img
          src={`/api/thumb/${encodeURIComponent(ratingKey!)}`}
          alt={title}
          width={width}
          height={height}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="block w-full h-full object-cover"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center font-display font-semibold text-text-dim select-none"
          style={{
            background: `linear-gradient(140deg, hsl(${hue} 25% 22% / 0.55), hsl(${(hue + 40) % 360} 25% 14% / 0.85))`,
            fontSize: Math.max(12, Math.round(width * 0.45)),
            letterSpacing: '-0.02em',
            color: kind === 'movie' ? 'rgb(var(--warn) / 0.85)' : 'rgb(var(--accent) / 0.85)',
          }}
          title={title}
        >
          {initial}
        </div>
      )}
    </div>
  );
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 360;
}
