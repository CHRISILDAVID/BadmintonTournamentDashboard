# Maintainer event history

Open `/maintainer`, unlock with the existing maintainer secret, and choose **Event history**. This is a read-only view across the event directory. Organizer, umpire, and venue-display access remain separate.

## Browsing

- **All events:** ten events per page, ordered by permanent organizer identifier. Each event shows its venue and counts of sub-tournaments, completed finals, and archived sub-tournaments.
- **Event:** ten sub-tournaments per page, in stable history-record order. Cards show completion status, entries, finished matches, winner and runner-up.
- **Sub-tournament:** recorded match opponents, stage/group, court when retained by the existing match data, confirmed game scores, winner, scheduled time, and completion time. Switch to **Entries** for player names, seeds and groups. Both lists load twenty rows per page.
- **Previous / Next** show the current range, total and page. Back buttons preserve the parent page. Refresh restarts the current list at page one. No background fetching of subsequent pages occurs.

First and second place come exclusively from a completed final. League rankings and semifinal losers never imply a podium. Correcting the final updates its winner and runner-up; reopening a final clears those placings. An unfinished category shows **Awaiting final**; an archived category without a completed final has no awarded podium. There is no third-place field or UI.

## Retention and boundaries

The current model has one persistent event per organizer, containing many sub-tournaments. This feature follows that model; it does not create separate event editions or an edit-by-edit timeline. Event names and venue reflect current event settings. Sub-tournaments removed after this feature is deployed retain their last recorded summary, entries and matches, including the original event name and archive timestamp. Their removal from the organizer desk still follows existing rules.

Existing sub-tournaments are indexed on first history access. Records deleted before this feature cannot be reconstructed. Archived records persist in the event's Durable Object across restarts and deployments; existing organizer export/import contracts are unchanged and do not transfer these maintainer archives to a different event. Live point-by-point scoring, controller credentials, sessions, invitation tokens and private recovery links are excluded from history responses.

## API and storage

All endpoints require the existing `sh_maintainer` session and return `Cache-Control: no-store`:

| GET endpoint | Page |
| --- | --- |
| `/api/maintainer/history?limit=10&after=…` | Events; maximum ten, fan-out limited to this page |
| `/api/maintainer/history/:eventId?limit=10&after=…&revision=…` | Sub-tournament summaries; maximum fifty |
| `/api/maintainer/history/:eventId/tournaments/:id?view=matches&limit=20&after=…&revision=…` | Confirmed match records; maximum fifty |
| Same endpoint with `view=entries` | Entries; maximum fifty |

Responses contain `items`, `total`, `limit` and `nextCursor` (`null` at the end). Treat cursors as opaque. Event/category responses include the event revision; subsequent requests send it back. If tournament data changes while paging, the server returns 409 and the UI asks the maintainer to refresh instead of silently mixing revisions. Newly provisioned identifiers before an event-list cursor appear after refreshing that list.

Additive SQLite tables `history_categories`, `history_entries` and `history_matches` live inside each existing event Durable Object. Current summaries/details form a revision-keyed read projection; row comparisons avoid rewriting unchanged records. Queries use indexed, bounded pages. On removal, the retained category is captured in the same synchronous storage transaction as the original state write, following the existing [Durable Object transaction model](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/#transactions). No new service, binding, dependency or class migration is required.

## Validation

- `npm test`: completed/corrected/reopened finals, absent podiums, pagination validation, and existing tournament/scoring checks.
- `npm run test:cloud`: maintainer-only authorization, event isolation, response limits and nonoverlapping cursors at every level, invalid requests, archive retention, revision conflicts, and credential exclusion.
- `npm run test:runtime`: actual local runtime restart retains an archived podium, match pages and entries; secret rotation invalidates history access.
- `npm run build:cloud` and existing browser regression suite.
- Browser review at 1440, 768, 390 and 360 px: bounded pages with a 13-category/279-match/24-entry local fixture; parent-page restoration; archived empty state; retry after a simulated 503; lock clears private history; no horizontal overflow; touch targets at least 44 px.

Browser evidence is saved locally under `output/playwright/history-*.png` (ignored). No production records were modified and deployment is separate.
