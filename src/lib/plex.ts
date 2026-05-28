import type { PlexSection } from './types';

const PLEX = process.env.PLEX_BASE_URL ?? 'http://172.18.0.1:32400';
const TOKEN = process.env.PLEX_TOKEN ?? '';

async function plexFetch(path: string, params: Record<string, string> = {}, timeoutMs = 60_000): Promise<any> {
  const url = new URL(path, PLEX);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url.toString(), {
      signal: ac.signal,
      headers: {
        'X-Plex-Token': TOKEN,
        Accept: 'application/json',
      },
    });
    if (!r.ok) throw new Error(`Plex ${r.status}: ${path}`);
    return r.json();
  } finally {
    clearTimeout(t);
  }
}

export async function listSections(): Promise<PlexSection[]> {
  const j = await plexFetch('/library/sections');
  return j?.MediaContainer?.Directory ?? [];
}

export async function listDuplicateMovies(sectionKey: string): Promise<any[]> {
  const j = await plexFetch(`/library/sections/${sectionKey}/all`, { duplicate: '1' }, 180_000);
  return j?.MediaContainer?.Metadata ?? [];
}

/** Returns every duplicate episode in a TV/Anime library in one call (type=4 = episode). */
export async function listDuplicateEpisodesInSection(sectionKey: string): Promise<any[]> {
  const j = await plexFetch(`/library/sections/${sectionKey}/all`, { duplicate: '1', type: '4' }, 180_000);
  return j?.MediaContainer?.Metadata ?? [];
}

export async function getItemMeta(ratingKey: string): Promise<any | null> {
  const j = await plexFetch(`/library/metadata/${ratingKey}`);
  return j?.MediaContainer?.Metadata?.[0] ?? null;
}

/** All movies in a section with watch + rating metadata (one Plex call). */
export async function listMoviesInSection(sectionKey: string): Promise<any[]> {
  const j = await plexFetch(
    `/library/sections/${sectionKey}/all`,
    { type: '1', includeGuids: '1' },
    180_000,
  );
  return j?.MediaContainer?.Metadata ?? [];
}

/** All shows in a section. */
export async function listShowsInSection(sectionKey: string): Promise<any[]> {
  const j = await plexFetch(
    `/library/sections/${sectionKey}/all`,
    { type: '2', includeGuids: '1' },
    180_000,
  );
  return j?.MediaContainer?.Metadata ?? [];
}

/** Delete a whole item (movie or show) and every file behind it. */
export async function deleteItem(ratingKey: string): Promise<{ ok: boolean; msg: string }> {
  const url = new URL(`/library/metadata/${ratingKey}`, PLEX);
  const r = await fetch(url.toString(), {
    method: 'DELETE',
    headers: { 'X-Plex-Token': TOKEN },
  });
  return { ok: r.status === 200 || r.status === 204, msg: `HTTP ${r.status}` };
}

export async function deleteMedia(ratingKey: string, mediaId: string): Promise<{ ok: boolean; msg: string }> {
  const url = new URL(`/library/metadata/${ratingKey}/media/${mediaId}`, PLEX);
  const r = await fetch(url.toString(), {
    method: 'DELETE',
    headers: { 'X-Plex-Token': TOKEN },
  });
  return { ok: r.status === 200 || r.status === 204, msg: `HTTP ${r.status}` };
}

export async function refreshItem(ratingKey: string): Promise<boolean> {
  const url = new URL(`/library/metadata/${ratingKey}/refresh`, PLEX);
  const r = await fetch(url.toString(), {
    method: 'PUT',
    headers: { 'X-Plex-Token': TOKEN },
  });
  return r.status === 200 || r.status === 204;
}
