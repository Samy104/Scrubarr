export type MediaType = 'movie' | 'show' | 'episode';

export interface PlexSection {
  key: string;
  title: string;
  type: 'movie' | 'show' | 'artist' | 'photo';
  agent: string;
}

export interface ParsedQuality {
  tags: string[];
  isRemux: boolean;
  isBluray: boolean;
  isWebDl: boolean;
  hdr: 'none' | 'hdr10' | 'hdr10plus' | 'dv' | 'dv+hdr10';
  resolution: '480p' | '720p' | '1080p' | '2160p' | 'unknown';
}

export interface MediaVersion {
  id: string;
  size: number;
  sizeHuman: string;
  resolution: string;
  videoCodec: string;
  audioCodec: string;
  audioChannels?: number;
  bitrate: number;
  durationMin: number;
  container?: string;
  file: string;
  quality: string[];
  partCount: number;
  videoFrameRate?: string;
}

export interface DupItem {
  ratingKey: string;
  parentRatingKey?: string;
  grandparentRatingKey?: string;
  type: MediaType;
  title: string;
  year?: number;
  showTitle?: string;
  seasonEpisode?: string;
  section: string;
  sectionKey: string;
  sectionType: 'movie' | 'show';
  collections: string[];
  genres: string[];
  studios: string[];
  media: MediaVersion[];
  totalSize: number;
  totalSizeHuman: string;
  savingsPotential: number;
  savingsHuman: string;
  versionCount: number;
  thumb?: string;
}

export interface RuleMatch {
  titleRegex?: string;
  yearMin?: number;
  yearMax?: number;
  genres?: string[];        // any-of
  collections?: string[];   // any-of
  studios?: string[];       // any-of
  libraries?: string[];     // restrict to library names
}

export interface RuleAction {
  kind: 'prefer_resolution' | 'prefer_largest' | 'prefer_codec' | 'ignore' | 'mark_review';
  value?: string;           // for prefer_*: "2160p" / "x265" / etc.
}

export interface RuleDTO {
  id: number;
  name: string;
  description?: string;
  scope: 'movie' | 'show' | 'anime' | 'all';
  priority: number;
  enabled: boolean;
  match: RuleMatch;
  action: RuleAction;
  appliedCount: number;
}

export interface ScanCache {
  scannedAt: number | null;
  scanning: boolean;
  count: number;
  items: DupItem[];
  error: string | null;
  durationSec: number;
  offset?: number;
  limit?: number;
  hasMore?: boolean;
}
