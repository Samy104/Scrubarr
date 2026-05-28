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
  /** Aggregate totals over the full filtered set (before pagination). */
  totals?: { count: number; totalSize: number; savingsPotential: number };
}

export interface SeriesPreferenceDTO {
  id: number;
  showRatingKey: string;
  showTitle: string;
  sectionTitle: string | null;
  preferredResolution: string | null;
  preferredCodec: string | null;
  preferRemux: boolean;
  enabled: boolean;
  notes: string | null;
}

export interface CleanupRuleDTO {
  id: number;
  name: string;
  description: string | null;
  scope: 'movie' | 'show';
  kind: 'exception' | 'eligibility';
  priority: number;
  enabled: boolean;
  match: CleanupRuleMatch;
  conditions: CleanupRuleConditions;
}

export interface CleanupRuleMatch {
  titleRegex?: string;
  yearMin?: number;
  yearMax?: number;
  libraries?: string[];
  genres?: string[];
  collections?: string[];
  studios?: string[];
  contentRatings?: string[];
}

export interface NumRange { min?: number; max?: number }

export interface CleanupRuleConditions {
  viewCount?: NumRange;
  daysSinceLastView?: NumRange;
  neverViewed?: boolean;
  rating?: NumRange;
  userRating?: NumRange;
  audienceRating?: NumRange;
  showCompletion?: NumRange; // viewedLeafCount / leafCount (0..1)
}

export interface CleanupCandidate {
  ratingKey: string;
  title: string;
  year: number | null;
  sectionTitle: string;
  scope: 'movie' | 'show';
  studio: string | null;
  genres: string[];
  collections: string[];
  viewCount: number;
  lastViewedAt: number | null;
  rating: number | null;
  userRating: number | null;
  audienceRating: number | null;
  contentRating: string | null;
  totalSize: number;
  /// Show-only
  leafCount?: number;
  viewedLeafCount?: number;
  /// All media versions for this item (movies have 1+, shows have many via children — not loaded here)
  media: MediaVersion[];
  matchedRules: { id: number; name: string; kind: 'exception' | 'eligibility' }[];
}

export interface ShowSummary {
  showRatingKey: string;
  showTitle: string;
  sectionTitle: string;
  sectionType: 'show';
  episodeCount: number;
  totalSize: number;
  totalSizeHuman: string;
  savingsPotential: number;
  savingsHuman: string;
  resolutionMix: Record<string, number>; // e.g. { "1080": 12, "2160": 3 }
  preference: SeriesPreferenceDTO | null;
  autoCleanCount: number;
  needsReviewCount: number;
}
