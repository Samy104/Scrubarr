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

## How it works

1. On startup, Scrubarr asks Plex for every library section.
2. For movie libraries, it queries `/library/sections/{key}/all?duplicate=1` to get items with multiple Media versions.
3. For TV libraries (including any library whose name contains "anime"), it walks `/library/metadata/{showKey}/allLeaves` per show with duplicate episodes and surfaces each duplicated episode individually under **By episode** plus a per-series summary under **By series**.
4. Each Media version is enriched with parsed quality tags from its filename (REMUX, BluRay, WEB-DL, HDR, HDR10, DV, Atmos, MULTI, FRENCH, PROPER, and more).
5. For Cleanup, every title in the configured libraries is evaluated against every cleanup rule — eligibility rules mark candidates, exception rules veto them. The result set is cached and refreshed on every rescan.
6. The result is served to the UI as JSON. The cache is also reconciled on every rescan: items that no longer qualify (no duplicates left, no matching cleanup rule, etc.) are removed.

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

Rules are evaluated in priority order (lower number first). The first matching rule sets the recommended action for a duplicate item.

### Match fields

| Field | Type | Meaning |
|---|---|---|
| `titleRegex` | string | Case-insensitive JavaScript regex tested against the item title |
| `yearMin`, `yearMax` | number | Inclusive year range |
| `libraries` | string[] | Restrict to specific Plex library names (e.g. `["Movies"]`) |
| `genres` | string[] | Any-of match against the item's Plex genres |
| `collections` | string[] | Any-of match against Plex collection memberships |
| `studios` | string[] | Any-of match against studio |

### Action kinds

| Kind | Value | Effect |
|---|---|---|
| `prefer_resolution` | `2160p`, `1080p`, `720p`, `480p` | Recommend the largest version at that resolution |
| `prefer_largest` | (none) | Recommend the largest version overall |
| `prefer_codec` | substring of `videoCodec` like `x265` | Recommend the largest version matching that codec |
| `mark_review` | (none) | Just flag the item with the rule name in the UI |
| `ignore` | (none) | Hide the item from the duplicate list |

### Example: keep 4K for the Marvel Cinematic Universe

```json
{
  "name": "Marvel keeps 4K",
  "scope": "movie",
  "priority": 10,
  "match": { "collections": ["Marvel Cinematic Universe"] },
  "action": { "kind": "prefer_resolution", "value": "2160p" }
}
```

### Example: keep 1080p for older catalog

```json
{
  "name": "Catalog keeps 1080p",
  "scope": "movie",
  "priority": 50,
  "match": { "yearMax": 1990 },
  "action": { "kind": "prefer_resolution", "value": "1080p" }
}
```

### Example: auto-ignore subbed anime before 2010

```json
{
  "name": "Pre-2010 anime ignored",
  "scope": "anime",
  "priority": 5,
  "match": { "yearMax": 2010 },
  "action": { "kind": "ignore" }
}
```

## API

All endpoints return JSON. The API is meant for the bundled UI but is fully usable from scripts.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/dupes` | GET | Current cached duplicates plus scan state |
| `/api/rescan` | POST | Start a fresh Plex scan in the background |
| `/api/dupes/{ratingKey}/media/{mediaId}` | DELETE | Delete a single Media version |
| `/api/ignore` | GET / POST / DELETE | List, add, or remove ignored items (dedupe) |
| `/api/rules` | GET / POST / DELETE | List, upsert, or delete dedupe rules |
| `/api/cleanup` | GET | Cleanup candidates plus protected items |
| `/api/cleanup/rules` | GET / POST / DELETE | List, upsert, or delete cleanup rules |
| `/api/cleanup/ignore` | GET / POST / DELETE | List, add, or remove ignored cleanup items |
| `/api/series-preference` | GET / POST / DELETE | List, upsert, or delete per-series preferences |
| `/api/shows` | GET | Per-series summary with auto-clean counts |
| `/api/shows/{ratingKey}/auto-clean` | POST | Run auto-clean on one show |
| `/api/shows/bulk-clean` | POST | Bulk auto-clean across many shows |
| `/api/log` | GET | Paginated deletion log with totals |
| `/api/health` | GET | Liveness probe |

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
