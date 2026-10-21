# Cloud validation and capacity

Checked on 20 October 2026. Implementation and local verification are complete for the scenarios listed below. No deployment to the user's Cloudflare account, paid plan, or production-data migration has been performed.

## Recorded verification

| Check | Result |
|---|---|
| Existing engine/UI-store/import/layout suite plus point-scoring and migration-backup tests | 99 passed |
| Workers-runtime HTTP/WebSocket integration scenarios | 7 passed |
| Browser scenarios in installed Microsoft Edge, including a 390 × 844 phone viewport | 6 passed |
| Separate workerd restart/expiry check | Passed |
| Cloud Vite build | Passed; existing Excel library emits a large-chunk advisory |
| Visual review | Mobile scorer and desktop live-score board inspected |

The cloud scenarios verify concurrent one-event provisioning; distinct events with identical labels/court numbers; tampered event/session routing; cross-origin HTTP/WebSocket rejection; single-use invitations; recovery rotation; unassigned/management denial; independent court revisions; lost-ack deduplication; one-time finalization; stale-controller evidence; rule-change invalidation; read-only display access; live revocation; and a 200-team/19,900-fixture migration/export beyond SQLite's individual-row limit.

Browser scenarios verify offline points, undo, completion, reload and reconnect; two independent displays; competing-tab locks; simulated local-storage failure; lost HTTP acknowledgements; HTTP 429/503 failures; role-route restrictions; event switching without replay; central screen updates; assignment changes without rescanning; and reopening a final confirmation whose acknowledgement was lost. The restart check also verifies real invitation expiry and persistence of sessions, accepted scores, deduplication records, and owner uniqueness.

The original suite continues to cover CSV/XLSX handling, player conflicts, category/team formats, large grouped draws, stage scoring, standings, playoff/knockout advancement, byes, result corrections and dependent resets, navigation, and layout persistence. This is not a claim that every existing UI workflow was exhaustively retested on every browser.

## Measured multi-venue burst

See [the recorded machine-readable result](cloud-load-results.json). The test used local Wrangler/workerd on Windows over loopback. Other isolated regression checks ran concurrently on the same machine.

| Dimension | Observed |
|---|---:|
| Separate events / venues | 4 |
| Courts per event | 4 |
| Scoring controllers | 16 |
| Independent display connections | 8 |
| Total WebSocket connections | 24 |
| Accepted point actions | 480 |
| Test scoring interval | 4.26 seconds |
| Aggregate accepted actions/second | 112.6 |
| Action start → receipt by both event displays, p50 / p95 / p99 | 76.3 / 108.8 / 124.8 ms |
| Maximum observed display receipt latency | 127.2 ms |
| HTTP acknowledgement p95 | 168.1 ms |
| Observed SQL rows written | 1,920 |
| Observed SQL rows read | 10,568 |
| Aggregate event database size after this fixture | 835,584 bytes |

The display measurement ends on WebSocket message receipt, not screen paint. The test does not measure mobile radio latency, geographical distance, Cloudflare routing, quota enforcement, or sustained full-day load. A burst rate is not an approved production capacity. The under-one-second target still needs measurements from real phones and displays after deployment.

## Free-tier budget

Official developer documentation currently lists the following shared account allowances:

| Meter | Free allowance |
|---|---:|
| Worker requests | 100,000/day |
| Durable Object request units | 100,000/day |
| Durable Object duration | 13,000 GB-s/day |
| Durable Object SQL rows read | 5 million/day |
| Durable Object SQL rows written | 100,000/day |
| Durable Object stored data | 5 GB total |

Daily Durable Object allowances reset at midnight UTC (05:30 in India). A WebSocket connection consumes a request; incoming application messages use a 20:1 request-unit ratio. Outgoing WebSocket messages are not charged as requests. Static asset serving has separate free allowances. Exhausted free quotas cause failures; remaining on Workers Free does not activate paid overages. [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Static Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)

The measured point path wrote **4 SQL rows per action**, including index overhead. Therefore 25,000 ordinary point actions would consume the entire 100,000-row daily allowance before provisioning, corrections, finalization, claims, presets, or other operations. That is a hard arithmetic warning, not a usable event budget.

For planning, reserve at least 30% of the write allowance for other work and variance: at this measured rate, that leaves at most 17,500 ordinary scoring actions/day across the account. Further reduce that estimate for complex corrections, large snapshot writes, retries that produce reconciliation evidence, and unrelated Workers/DO applications in the same account. Pause, resume, and undo also create audit writes.

Example: four venues × four courts × ten matches × 100 scoring actions = 16,000 actions, approximately 64,000 point-path rows. This leaves 36,000 rows for everything else, but it is **not** a tested full-day configuration. A larger schedule can exceed the free tier even when instantaneous latency looks healthy.

Each accepted action uses an HTTP Worker request plus an event-object request. A connected controller sends freshness contact every 15 seconds while its scorer is foregrounded; 16 controllers over eight hours produce about 30,720 contact messages, or about 1,536 DO request units before other traffic. These contacts read authorization/state and broadcast freshness but do not write SQL. Reconnects, snapshots, invitations, exports, and management actions add load.

The application exposes event action counts, database size, socket counts, and SQL cursor observations since the current object wake. Those observations reset on hibernation/redeploy. Measured handler wall milliseconds are neither Cloudflare CPU milliseconds nor billed duration. Use Cloudflare's account dashboard for actual shared request, SQL, storage, and duration consumption.

## Runtime and remaining deployment checks

- SQLite-backed Durable Objects and WebSocket Hibernation are supported on Free. The implementation uses `acceptWebSocket`, serialized attachments, and auto-response support, with no periodic server timer. Provider-side hibernation and redeployment recovery still need a deployed smoke test. Local process restart was tested. [WebSocket guidance](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- The Worker router remains small; tournament engine work runs inside the event object. Node filesystem persistence is not deployed. The retained `node:crypto` engine import uses Workers' Node compatibility flag and passed workerd tests.
- Workers' memory/request limits and DO row/CPU limits remain applicable. Large tournament snapshots are chunked, while individual scoring records and actions stay separate. The tested large draw is 200 teams/19,900 fixtures; larger practical capacity has not been established. [Runtime limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
- Actual quota exhaustion was not induced against a Cloudflare account. Browser-injected 429/503 responses verified queue preservation. SQL transactions coordinate accepted action/current score/finalization, but provider outage behavior must also be rehearsed.
- Browser tests used Edge on Windows, including mobile emulation. Real Android/iOS browsers, battery suspension, OS eviction, and long offline periods remain device-rehearsal checks. A phone must prepare the scoring shell/match online first.
- Offline data is browser-local, not an unconditional backup. Recovery/role switching never grants access to another session's queue. Reconciliation retains unresolved work rather than silently adopting it.
- Cloud-backup restore retains tournament results and historical scoring evidence but does not automatically resume previous controllers, screen links, or in-progress point sessions. The local-data migration path retains IDs/results/settings and never overwrites a populated destination.
- `workers.dev` supplies free HTTPS, but Cloudflare describes it as intended for personal/hobby projects rather than business-critical hosting. No tournament-availability SLA is claimed. [workers.dev guidance](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)

Before tournament use, deploy to the intended Free account, provision isolated rehearsal events, test independent phone/display networks, measure action-to-screen latency and quota use for the expected schedule, and rehearse recovery and export. If those measurements exceed free limits, report the mismatch and reduce the supported schedule; do not enable billing automatically.
