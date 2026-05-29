# Scrubarr

A web app for finding and removing duplicate movies, episodes, and anime in a Plex library, plus a Cleanup module that uses watched-state and rating rules to surface entire titles you can safely retire from disk.

Scrubarr scans Plex for items that have multiple file versions (1080p plus 4K, multiple language variants, REMUX vs WEB-DL, and so on), shows them in a sortable list, and lets you delete the version you don't want with two clicks. Rules can flag a recommended version automatically (for example, keep 4K for Marvel movies), or, in the Cleanup module, mark whole titles eligible for deletion when nobody has watched them and the ratings are bad.

It is meant to replace selexin/cleanarr, which is unmaintained and tends to time out on large libraries.

## What is new

- **Two distinct sections**, **Dedupe** and **Cleanup**, each with their own Movies / Shows / Rules / Ignored pages. Routes moved under `/dedupe/*` and `/cleanup/*` so the URL tells you which module you are in.
- **Cover art on every row** — posters from Plex now appear on dedupe rows, cleanup candidates, ignored items, and inside the info modal.
- **Info modal** with the Plex/Letterboxd shape — backdrop hero, overlapping poster, title plus metadata line, summary, genre chips, and a cast row. Click the info icon next to any poster to open it.
- **Resolution-mix filter** with bulk actions: filter by exact resolution shape (`1080p only`, `1080p + 720p (no 4K)`, `4K + 1080p (no 720p)`, `4K + 1080p + 720p`, `Has any 4K version`, `Has any 720p version`) and then bulk-apply **Keep 1080p** or **Drop 720p** across every matching item.
- **Notification bell** with persistent history, color-coded by kind (success / info / warn / error), unread badge on the icon.
- **Global confirm dialog** for every destructive action — bulk deletes, auto-clean, rule processing — all share one modal with danger styling.
- **Per-series preferences with live re-annotation**: set Westworld to 1080p REMUX, every episode is re-evaluated, and only episodes that have the preferred version become auto-clean targets.

## Screenshots

### Dedupe — Movies
The Movies list shows every title that has more than one file in Plex, sorted by savings potential. Cover thumbnails come straight from Plex. The resolution-mix dropdown filters down to a specific shape and, when applicable, surfaces a bulk **Drop 720p** or **Keep 1080p** action next to it.

![Dedupe movies](screenshots/01-dedupe-movies.png)

### Dedupe — Movies, one row expanded
Each version shows its size, codec, resolution, parsed quality tags from the filename, and a **Keep only this** button that deletes every other version with one click. **Delete this** removes just that version. **Go with recommendation** acts on whatever a rule has annotated.

![Dedupe movies expanded](screenshots/02-dedupe-movies-expanded.png)

### Dedupe — By episode
TV and Anime are merged into one list of duplicated episodes. The library dropdown narrows it to TV-only or Anime-only when needed.

![Dedupe episodes](screenshots/03-dedupe-episodes.png)

### Dedupe — By series, with resolution-mix bucket and per-show Auto-clean
Set a preferred version per series (e.g. **Westworld = 1080p REMUX**). Episodes that have the preferred version are marked **auto-clean** and you can run a bulk delete with the per-show button on the right. Episodes that lack the preferred version stay in the **By episode** list for manual review. The resolution-mix dropdown narrows the show list to a specific shape — here `4K + 1080p (no 720p)`, which is the "manual review" territory where the right answer depends on the title.

![Dedupe shows filter](screenshots/04-dedupe-shows-filter.png)

### Dedupe — By series, manual review territory
The same view with the dropdown set to `4K + 1080p (no 720p)`. These series can't be bulk-cleaned because the right answer depends on whether 4K is worth keeping for each title.

![Dedupe shows manual review](screenshots/05-dedupe-shows-manual-review.png)

### Dedupe — By series with preference editor expanded
With the preference state filter set to **With preference**, each card shows the inline editor for preferred resolution, preferred codec, and **Prefer REMUX**. Shift+click **Auto-clean** to skip the confirmation popover.

![Dedupe shows preference](screenshots/06-dedupe-shows-preference.png)

### Dedupe — Rules
Create rules that highlight a recommended version. Rules never auto-delete; they annotate the list so you can act on it. Each rule card shows the active match count and a **View matches** button.

![Dedupe rules](screenshots/07-dedupe-rules.png)

### Info modal
Click the info icon next to any poster on any dedupe or cleanup row. The modal pulls Plex metadata: backdrop hero, overlapping poster, title plus year and runtime, summary, genre chips, and the cast row.

![Info modal](screenshots/08-dedupe-info-modal.png)

### Dedupe — Ignored
Titles you do not want to consider for deduplication are stored persistently and can be restored at any time.

![Dedupe ignored](screenshots/09-dedupe-ignored.png)

### Cleanup — Movies
The Cleanup module is a different angle: instead of duplicates, it surfaces entire titles that match an **eligibility** rule (e.g. unwatched + poorly rated + N years old) and are not covered by any **exception** rule (e.g. "always keep Marvel"). Cover thumbnails, matched-rule chips, and the candidate / protected badges are on every row. The header shows savings totals for the current selection and a toggle for **Candidates only** vs the full library.

![Cleanup movies](screenshots/10-cleanup-movies.png)

### Cleanup — Movies, filtered to a single rule
Clicking **View matches** on any cleanup rule deep-links to the candidates page filtered to that rule. The rule banner at the top includes a **Process rule** button that bulk-deletes every active candidate matched by the rule.

![Cleanup movies rule](screenshots/11-cleanup-movies-rule-filter.png)

### Cleanup — Rules
Two rule kinds: **exception** rules (green) protect titles from deletion no matter what; **eligibility** rules (orange) make titles deletion candidates. Each card shows live match counts and a **View matches** link into the filtered candidates page.

![Cleanup rules](screenshots/12-cleanup-rules.png)

### Cleanup — Ignored
Titles you have explicitly skipped from cleanup. Restorable any time, just like the dedupe ignore list.

![Cleanup ignored](screenshots/13-cleanup-ignored.png)

### Notification bell
Every bulk action, every auto-clean run, every rule process, every delete is written to a persistent notification history. The bell badge counts unread; the dropdown is color-coded by kind (success, info, warn, error).

![Notification bell](screenshots/14-notification-bell.png)

### Confirm dialog
Every destructive action — single delete, **Keep only this**, **Auto-clean**, **Process rule**, bulk **Drop 720p**, bulk **Keep 1080p** — routes through one global confirm dialog with danger styling and explicit count in the action label.

![Confirm dialog](screenshots/15-confirm-dialog.png)

### Status
Plex health, scan timing, item counts at a glance.

![Status](screenshots/16-status.png)

### Light theme
Toggle in the sidebar's top-right corner. Background is a warm light grey rather than solid white so cards have hierarchy. All accents recompute for legibility, including a more saturated blue for buttons and a deeper warm tone for savings badges.

![Light dedupe movies](screenshots/17-light-dedupe-movies.png)
![Light dedupe shows](screenshots/18-light-dedupe-shows.png)
![Light cleanup movies](screenshots/19-light-cleanup-movies.png)

## Application structure

```
Scrubarr
├── Dedupe                     same item, multiple files
│   ├── Movies                 movie duplicates
│   ├── By episode             TV + Anime duplicates merged
│   ├── By series              per-show preferences + auto-clean
│   ├── Rules                  annotate dup items with a "keep this" recommendation
│   └── Ignored                items excluded from dedupe scans
└── Cleanup                    whole items, based on watch + ratings
    ├── Movies                 candidate movies for deletion
    ├── Shows                  candidate shows for deletion
    ├── Rules                  exception (always keep) + eligibility (mark candidate)
    └── Ignored                items exempted from cleanup
```

The two modules answer different questions. **Dedupe** is about a single library item that holds more than one file on disk — a movie with both a 1080p and a 4K version, an episode with both a REMUX and a WEB-DL — and the action is to pick which file to keep and delete the rest. **Cleanup** is about whole items: titles that exist exactly once but, based on your watch history and ratings, can be retired from the library entirely.

They share UI primitives (the resolution-mix dropdown, the info modal, the confirm dialog, the notification bell, the ignore-list pattern) but the data models, the rule schemas, and the destructive endpoints are separate.

## Features

- **Dedupe and Cleanup as separate modules**, each with Movies, Shows, Rules, and Ignored pages under `/dedupe/*` and `/cleanup/*`.
- **Per-version actions**: delete a specific version, keep one and delete every other version, or apply the rule's recommendation in one click.
- **Bulk resolution actions**: filter the list by a resolution-mix bucket then apply **Keep 1080p** or **Drop 720p** to every matching item.
- **Per-series preferences**: pin a preferred resolution / codec / REMUX flag per show. Matching episodes become auto-clean targets; non-matching ones stay in the manual review list.
- **Dedupe rules engine**: write conditions (title regex, year range, genres, collections, studios) and an action (prefer a resolution, prefer the largest file, prefer a codec, ignore the title, flag for review). Rules annotate the dedupe list with a recommended "keep this" version; they never auto-delete.
- **Cleanup rules engine**: write eligibility rules that mark whole titles as deletion candidates based on watched state, rating, year, library, genres, collections, studios. Exception rules protect titles from any cleanup rule, regardless of priority.
- **Ignore lists** for both modules, stored persistently, restorable at any time.
- **Deletion log**: every delete attempt is recorded (file path, size, resolution, codec, tags, success or failure, error reason). Filter and search across the full history.
- **Notification center**: every action lands a persistent notification, color-coded by kind.
- **Global confirm dialog** for every destructive action — single delete, bulk delete, auto-clean, rule processing.
- **Info modal** on every row: backdrop, poster, summary, genres, cast.
- **Self-cleaning cache**: items that no longer have at least two versions are dropped from the dedupe list automatically; cleanup candidates re-evaluate on every rescan.
- **Responsive UI**: works on desktop and mobile, dark and light theme.
- **Auto-rescan**: pulls fresh data from Plex every 15 seconds while you have the page open. Trigger a full rescan on demand from the header.

## Cleanup module

Cleanup walks the full movie and show libraries (not just the duplicates) and evaluates every title against the cleanup rule set. The output is a list of **candidates** you can delete in bulk, with **protected** titles (matched by an exception rule) shown alongside so it is clear why a title is safe.

### Rule kinds

Cleanup rules come in two kinds, and the order matters:

- **Exception** rules protect items. If any exception rule matches a title, that title is **never** a candidate, regardless of how many eligibility rules also match it. Exception always wins, priority is irrelevant for that decision.
- **Eligibility** rules nominate items. An eligibility rule needs both its match clauses and its watched-state condition to be satisfied before the title becomes a candidate.

A title becomes a candidate when at least one eligibility rule matches and **no** exception rule matches. Items on the cleanup ignore list are excluded before any rule runs.

### Match clauses

Match clauses are the same shape for both rule kinds:

| Field | Type | Meaning |
|---|---|---|
| `titleRegex` | string | Case-insensitive JS regex tested against the title |
| `yearMin`, `yearMax` | number | Inclusive year range |
| `libraries` | string[] | Plex library names to restrict to |
| `genres` | string[] | Any-of match against Plex genres |
| `collections` | string[] | Any-of match against Plex collection memberships |
| `studios` | string[] | Any-of match against studio |
| `contentRatings` | string[] | Any-of match against `contentRating` (`PG-13`, `TV-MA`, ...) |

`studios` and `collections` are evaluated as "either of": a single rule that lists both `studios: ["DC Comics"]` and `collections: ["DC Extended Universe"]` matches titles that are tagged with the DC studio **or** belong to the DCEU collection. This is the most common shape for "always keep this franchise" rules.

### Eligibility conditions

Eligibility rules add a `condition` block on top of the match clauses. All fields are optional; the ones that are set are AND-ed together.

| Field | Type | Meaning |
|---|---|---|
| `viewCountMin`, `viewCountMax` | number | Inclusive range over Plex `viewCount` |
| `daysSinceLastViewMin`, `daysSinceLastViewMax` | number | Days since `lastViewedAt`; never-viewed items pass `min` but fail `max` |
| `neverViewed` | boolean | Title has no `lastViewedAt` |
| `ratingMin`, `ratingMax` | number | Third-party `rating` (IMDb / Rotten Tomatoes critic), 0..10 |
| `userRatingMin`, `userRatingMax` | number | Your own `userRating`, 0..10 |
| `audienceRatingMin`, `audienceRatingMax` | number | Audience rating, 0..10 |
| `showCompletionMin`, `showCompletionMax` | number | For shows only: `viewedLeafCount / leafCount`, 0..1 |

### Default seeded rules

A fresh database is seeded with a sensible starting set:

- **Always keep Marvel** — exception, `studios` contains `Marvel`
- **Always keep DC** — exception, `studios` contains `DC` **or** `collections` contains `DC Extended Universe`
- **Always keep Marvel TV** — exception, show scope, `studios` contains `Marvel`
- **Unwatched and poorly rated** — eligibility, `neverViewed: true` + `ratingMax: 5`
- **Watched once, poorly rated** — eligibility, `viewCount` in `1..1` + `ratingMax: 5`
- **Stale shows never finished** — eligibility, show scope, `daysSinceLastViewMin: 365` + `showCompletionMax: 0.5`

Delete any rule you don't want; they are not enforced as system rules.

### Candidate list flow

The candidate list is one row per title. Each row has:

- a checkbox for multi-select
- the Plex poster and title
- one or more matched-rule chips, color-coded by kind (green = exception, orange = eligibility) so the reason a title is on the list (or protected) is visible at a glance
- a per-row delete action
- a per-row **Ignore** action (eye-off icon) that moves the title to the cleanup ignore list

The page header shows the total reclaimable size for the current selection and a toggle to view **Candidates only** or the full library with annotations. The bulk-delete button takes the multi-select set through the global confirm modal, streams progress, and pushes a notification per delete. Shift-click skips the prompt.

### View matches and process rule

Every rule card has a **View matches** link that opens the candidate list filtered to that single rule. A banner at the top of the filtered view shows the rule name, description, action, current match count, a **Clear filter** link, and a **Process rule (N)** button. Clicking **Process rule** deletes every active candidate the rule currently matches in one streamed pass. For exception rules the Process button is hidden — exception rules only protect, they don't delete.

### Cleanup ignore list

Items moved to the cleanup ignore list are excluded from candidate evaluation entirely, regardless of how many eligibility rules they match. Restore is one click and immediately re-runs the evaluation.

## Series preferences

The **By series** page lets you pin a preferred version per show: a resolution (`2160p` / `1080p` / `720p` / `480p`), an optional codec substring (`x265`, `h264`, `av1`, ...), and a **Prefer REMUX** flag. Each preference is stored per `ratingKey` and re-applied on every render of the page.

### Resolution normalization

Plex reports resolution as a mix of `4k`, `uhd`, `2160`, `2160p`, `1080`, `1080p`, and so on. Internally Scrubarr normalizes these so `4k`, `uhd`, and `2160p` all collapse to `2160` before comparison. Preferences are stored in the normalized form.

### autoClean vs needsReview

Once a preference is set, every episode of the series is annotated:

- **autoClean** — the preferred version exists, the other versions can be safely deleted on the next auto-clean run.
- **needsReview** — no version matches the preference. The episode is left for manual review in the **By episode** list.

The summary card for the series shows both counts plus the total reclaimable size.

### Prefer REMUX is a soft tiebreaker

**Prefer REMUX is not a hard filter.** If the show has at least one REMUX version at the preferred resolution, that REMUX wins. If no REMUX exists at the preferred resolution, the largest non-REMUX at the preferred resolution still wins and the episode is still `autoClean`. This is intentional — making REMUX a hard filter caused a class of "lost everything to needs-review" failures where a show without any REMUX masters would have zero auto-cleanable episodes despite a clear best version being available.

### Auto-clean and the popover

The per-show **Auto-clean** button streams an NDJSON response from `/api/shows/{ratingKey}/auto-clean`: `start` with the total count, a `progress` event per episode (with `current` and the episode title), and a final `done` event with success / failure counts. The UI shows a progress bar plus the current episode title.

The confirmation popover is anchored to the button so the action is local to the row. Click for the prompt; Shift-click to skip it entirely. Saving a preference collapses the inline editor automatically, so you can blast through a list of shows without bouncing back and forth.

## Rule-process flow

Both the dedupe rules page and the cleanup rules page wire each rule card to the same **View matches** + **Process rule** pattern.

- **View matches** deep-links to the corresponding candidates page (`/dedupe/movies?ruleId=...` or `/cleanup/movies?ruleId=...`) with a filter applied.
- The filtered view shows a banner with the rule name, description, action, current match count, **Clear filter**, and **Process rule (N)** buttons.

What Process does depends on the rule kind:

| Rule type | Action | Process behavior |
|---|---|---|
| Dedupe | `prefer_resolution`, `prefer_codec`, `prefer_largest` | Per item: keep the recommended version, delete the rest |
| Dedupe | `ignore` | Bulk-add every matched item to the dedupe ignore list |
| Dedupe | `mark_review` | No-op, the rule is annotation-only |
| Cleanup eligibility | (n/a) | Delete every active candidate the rule matches |
| Cleanup exception | (n/a) | Process button is hidden |

Shift-click on **Process rule** skips the confirm prompt. Progress streams in via NDJSON and is rendered as a bar with the per-item title under the banner.

## Resolution-mix bulk actions

The **Resolution mix** dropdown on `/dedupe/movies`, `/dedupe/episodes`, and `/dedupe/shows` slices the visible list by the exact resolution shape each item holds. Buckets:

| Bucket | Meaning |
|---|---|
| `all` | No filter |
| `1080p only` | Every version is 1080p |
| `720p only` | Every version is 720p |
| `1080p + 720p (no 4K)` | Mix of 1080p and 720p, nothing higher |
| `4K + 1080p (no 720p)` | One 4K plus one 1080p, no 720p |
| `4K + 1080p + 720p` | All three present |
| `Has any 4K version` | At least one 4K version |
| `Has any 720p version` | At least one 720p version |

Counts next to each option are live and reflect the cache after the title search and any preference filters have been applied.

Two bulk actions appear conditionally next to the dropdown:

- **Keep 1080p (N)** — visible on `/dedupe/shows` when the filter is set to `1080p + 720p (no 4K)`. Streams a multi-show NDJSON bulk-clean (`/api/shows/bulk-clean`) that keeps the largest 1080p version of each duplicated episode and deletes everything else.
- **Drop 720p (where 1080p+ exists)** — visible on `/dedupe/movies` and `/dedupe/episodes`. For each matched item, deletes only the 720p version, and only if a 1080p or 2160p sibling exists. Single-version items are protected by that guard.

Both actions go through the global confirm modal with the Shift-skip shortcut. The `4K + 1080p (no 720p)` bucket intentionally has no bulk action because the call between 4K and 1080p is per-title and not bulk-safe; surfacing the bucket on its own is the point — it's where to focus when reviewing manually.

## Notification bell

The bell in the top-right shows an unread badge with the count of unread notifications. The dropdown panel renders the last 50 events. Each entry has:

- a kind icon (success, info, warn, error)
- the title
- a relative timestamp
- an optional body line
- a per-item check icon to mark that single notification read
- a **Mark all read** footer
- a **Clear all** action

Notifications are persisted to `localStorage` and so do **not** sync across browsers or devices. They are written automatically on every destructive action: deletes, keep-only operations, ignore moves, preference saves, per-show and bulk auto-clean batches, rule-process runs, and cleanup deletes. They replace every native `alert()` call.

## Confirm dialog

Destructive actions route through `useConfirm()`, a single centralized modal. The dialog is rendered into a portal, centered on the viewport, backed by a blurred and dimmed backdrop. Escape and click-outside cancel; Enter confirms; focus is trapped while it's open.

Two variants:

- **danger** — destructive actions, red accent, used for delete, keep-only, drop 720p, keep 1080p, process rule, auto-clean batches, cleanup delete
- **accent** — neutral confirmations, app accent color

**Shift-click on any destructive action button skips the confirm entirely.** The shortcut works on **Process rule**, **Auto-clean**, every bulk delete, **Drop 720p**, **Keep 1080p**, per-version **Delete this**, **Keep only this**, and **Go with recommendation**. The dialog replaces every native `confirm()` call.

## Info modal

Triggered by the info icon next to every poster on dedupe and cleanup rows. The shape mirrors Plex and Letterboxd:

- 16:7 backdrop hero at the top, sourced from Plex art
- 2:3 poster overlapping the bottom-left of the backdrop
- title in Outfit, large
- meta line: year, content rating, runtime, studio, critic rating, audience rating, release date
- italic tagline with an accent left border
- summary
- genre chips
- two columns for director and writer
- circular cast portraits with name + role

The modal is portal-rendered to escape the transform-based containing blocks above it — without that, the cleanup row's fade-up animation clips the modal inside the row. It closes on backdrop click, the X icon, and Escape, and animates in through the existing `mvPopIn` keyframe.

## Posters and the thumb proxy

Posters are served by Scrubarr, not directly by Plex, via `/api/thumb/{ratingKey}` (poster) and `/api/thumb/{ratingKey}/art` (backdrop). The proxy:

- holds the Plex token server-side — it never reaches the browser
- returns `Cache-Control: max-age=86400, stale-while-revalidate=604800`, so the browser caches the poster for a day and can keep serving the stale copy for a week while refreshing
- falls back to a deterministic colored tile with the title initial when Plex has no thumb for the item

For episode rows the show's poster is used, not the per-episode thumbnail. Scene stills don't help when you're scrubbing the list visually.

## How it works

1. On startup, Scrubarr asks Plex for every library section.
2. For movie libraries, it queries `/library/sections/{key}/all?duplicate=1` to get items with multiple Media versions.
3. For TV libraries (including any library whose name contains "anime"), it walks `/library/metadata/{showKey}/allLeaves` per show with duplicate episodes and surfaces each duplicated episode individually under **By episode** plus a per-series summary under **By series**.
4. Each Media version is enriched with parsed quality tags from its filename (REMUX, BluRay, WEB-DL, HDR, HDR10, DV, Atmos, MULTI, FRENCH, PROPER, and more).
5. For Cleanup, every title in the configured libraries is evaluated against every cleanup rule — eligibility rules mark candidates, exception rules veto them. The result set is cached and refreshed on every rescan.
6. The result is served to the UI as JSON. The cache is also reconciled on every rescan: items that no longer qualify (no duplicates left, no matching cleanup rule, etc.) are removed.
7. For cleanup, Scrubarr fetches the full movie library via `/library/sections/{key}/all?type=1` and the full show library via `type=2`, including watch state (`viewCount`, `lastViewedAt`) and ratings (`rating`, `userRating`, `audienceRating`).
8. Each item is evaluated against the loaded `CleanupRule` set. Exception rules carve out protected items; eligibility rules nominate them. Items in the cleanup ignore list are never candidates.
9. The same library snapshot is reused across requests until a manual refresh (`POST /api/cleanup/refresh`) or the 12-second polling interval expires.

Deletions use the Plex API endpoint `DELETE /library/metadata/{ratingKey}/media/{mediaId}` (per-version, dedupe) or `DELETE /library/metadata/{ratingKey}` (whole title, cleanup). This removes the metadata and the files from disk (Plex must have "Empty trash automatically after every scan" enabled, or you can call refresh manually).

## Running with Docker

The simplest path is the bundled `docker-compose.yml`. Copy `config/.env.example` to `config/.env`, fill in your Plex token, and run:

```bash
docker compose up -d
```

The container will:

- Apply the Prisma schema to `/db/scrubarr.db` on startup
- Serve the UI on port 8080
- Connect to Plex at `PLEX_BASE_URL` (default `http://172.18.0.1:32400` for docker bridge access on the same host)

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PLEX_BASE_URL` | `http://172.18.0.1:32400` | URL the container uses to reach Plex |
| `PLEX_TOKEN` | (required) | A Plex X-Plex-Token with admin access |
| `DATABASE_URL` | `file:/db/scrubarr.db` | SQLite database file path |
| `LOG_LEVEL` | `INFO` | `INFO` or `DEBUG` |
| `VIRTUAL_HOST` | `scrubarr.selfcollapse.com` | Used by jwilder/nginx-proxy if you front Scrubarr with it |
| `LETSENCRYPT_HOST` | same as `VIRTUAL_HOST` | Used by acme-companion for cert provisioning |
| `LETSENCRYPT_EMAIL` | (none) | Email for Let's Encrypt account |

### Where to find your Plex token

In Plex Web, click any item, open the three-dot menu, choose "Get Info", click "View XML". The token is the `X-Plex-Token` query parameter in the URL bar.

## Rules

Scrubarr has two independent rule engines. **Dedupe rules** annotate items in the duplicate list with a recommended "keep this" version; **Cleanup rules** mark whole items as candidates for deletion (or protect them from being marked). The schemas are different and the engines run on different data.

### Dedupe rules

Dedupe rules are evaluated in priority order (lower number first). The first matching rule sets the recommended action for a duplicate item. Dedupe rules **never auto-delete** — they only annotate a `recommended` version on each duplicate item. To act on the annotation, click **Go with recommendation** on the row, or use the rule-process flow described above.

#### Match fields

| Field | Type | Meaning |
|---|---|---|
| `titleRegex` | string | Case-insensitive JavaScript regex tested against the item title |
| `yearMin`, `yearMax` | number | Inclusive year range |
| `libraries` | string[] | Restrict to specific Plex library names (e.g. `["Movies"]`) |
| `genres` | string[] | Any-of match against the item's Plex genres |
| `collections` | string[] | Any-of match against Plex collection memberships |
| `studios` | string[] | Any-of match against studio |

#### Action kinds

| Kind | Value | Effect |
|---|---|---|
| `prefer_resolution` | `2160p`, `1080p`, `720p`, `480p` | Recommend the largest version at that resolution |
| `prefer_largest` | (none) | Recommend the largest version overall |
| `prefer_codec` | substring of `videoCodec` like `x265` | Recommend the largest version matching that codec |
| `mark_review` | (none) | Just flag the item with the rule name in the UI |
| `ignore` | (none) | Hide the item from the duplicate list |

#### Example: keep 4K for the Marvel Cinematic Universe

```json
{
  "name": "Marvel keeps 4K",
  "scope": "movie",
  "priority": 10,
  "match": { "collections": ["Marvel Cinematic Universe"] },
  "action": { "kind": "prefer_resolution", "value": "2160p" }
}
```

#### Example: keep 1080p for older catalog

```json
{
  "name": "Catalog keeps 1080p",
  "scope": "movie",
  "priority": 50,
  "match": { "yearMax": 1990 },
  "action": { "kind": "prefer_resolution", "value": "1080p" }
}
```

#### Example: auto-ignore subbed anime before 2010

```json
{
  "name": "Pre-2010 anime ignored",
  "scope": "anime",
  "priority": 5,
  "match": { "yearMax": 2010 },
  "action": { "kind": "ignore" }
}
```

### Cleanup rules

Cleanup rule schema (match clauses, eligibility conditions, exception vs eligibility kinds, default seeded rules) is documented in the **Cleanup module** section above. The endpoint is `/api/cleanup/rules` and the data model is `CleanupRule` rather than the dedupe `Rule`.

## API

All endpoints return JSON unless noted. The API is meant for the bundled UI but is fully usable from scripts.

### Dedupe

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/dupes` | GET | Current cached duplicates plus scan state |
| `/api/rescan` | POST | Start a fresh Plex scan in the background |
| `/api/dupes/{ratingKey}/media/{mediaId}` | DELETE | Delete a single Media version |
| `/api/ignore` | GET / POST / DELETE | List, add, or remove ignored items (dedupe) |
| `/api/rules` | GET / POST / DELETE | List, upsert, or delete dedupe rules |

### Cleanup

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/cleanup/candidates` | GET | `scope=movie\|show`, returns the full annotated library plus `isCandidate` per row |
| `/api/cleanup/refresh` | POST | Trigger a Plex re-fetch for the cleanup snapshot |
| `/api/cleanup/rules` | GET / POST / DELETE | List, upsert, or delete cleanup rules |
| `/api/cleanup/delete` | POST | Per-item delete plus a `DeletionLog` row |
| `/api/cleanup/ignore` | GET / POST / DELETE | List, add, or remove ignored cleanup items |

### Shows and series preferences

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/shows` | GET | Per-series summary; re-applies preferences on every call |
| `/api/shows/{ratingKey}/auto-clean` | POST | NDJSON stream of progress events for one show |
| `/api/shows/bulk-clean` | POST | Multi-show NDJSON bulk-clean (Keep 1080p backend) |
| `/api/series-preference` | GET / POST / DELETE | Per-show preferred resolution, codec, and REMUX flag |

### Metadata and assets

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/thumb/{ratingKey}` | GET | Server-side Plex thumb proxy (poster) |
| `/api/thumb/{ratingKey}/art` | GET | Server-side Plex art proxy (backdrop) |
| `/api/metadata/{ratingKey}` | GET | Slim Plex metadata payload for the info modal |

### Operations

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/log` | GET | Paginated deletion log with totals |
| `/api/health` | GET | Liveness probe |

`/api/shows/{ratingKey}/auto-clean` and `/api/shows/bulk-clean` emit NDJSON with `{ type: 'start' | 'progress' | 'done' }` events that the UI streams progress from. Rule-process endpoints under both modules use the same NDJSON shape.

## Development

```bash
npm install
cp config/.env config/.env.local   # add your Plex token
npm run db:push                    # apply schema to local sqlite
npm run dev                        # http://localhost:3000
```

Stack: Next.js 14 App Router, TypeScript, Tailwind, Prisma, SQLite. Single-process Node server, no background workers, no external state.

## License

MIT.

---

For contributors: the internal architecture write-up lives at `/opt/mangavault/docs/SCRUBARR.md` on the deployment host. It covers data flow, the Plex client wrapper, the rule evaluator, and the cache layer in more detail than this README.
