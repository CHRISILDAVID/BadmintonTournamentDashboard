# Cloud setup and migration

The cloud code is implemented and tested locally. It has not been deployed to your Cloudflare account. No production credentials, local tournament database, or billing settings were changed.

## One-time maintainer setup

Use a Cloudflare **Workers Free** account. Keep that plan selected: these scripts do not enable paid services or automatic upgrades. No domain, email provider, authentication subscription, or database password is required. Tournament staff do not run these commands.

From this repository on Windows, with Node.js 24 installed:

```powershell
npm.cmd ci
npx.cmd wrangler login
npx.cmd wrangler whoami
```

Complete Cloudflare's browser login. If the account has several organizations, set the intended public Account ID in `wrangler.jsonc` as `account_id`, or use the `CLOUDFLARE_ACCOUNT_ID` environment variable. Check the account's Workers plan in the Cloudflare dashboard before deploying.

```powershell
npm.cmd run deploy:cloud
```

Wrangler builds the cloud frontend, uploads static assets, and creates the SQLite-backed `OwnerDirectory` and `TournamentEvent` Durable Object classes using the `v1` migration. Record the resulting HTTPS address, such as `https://shuttlehub.your-subdomain.workers.dev`. Provisioning remains disabled until the following secret is configured.

Generate a random 64-character hexadecimal secret in a password manager, save it privately, then:

```powershell
npx.cmd wrangler secret put PROVISIONING_SECRET
```

Paste that secret at Wrangler's private prompt. This is the only application-wide secret you supply. Do not put it in `wrangler.jsonc`, `VITE_*`, Git, a URL, chat, or a shared terminal log. Cloudflare stores it as a Worker secret. [Secret configuration](https://developers.cloudflare.com/workers/configuration/secrets/)

Wrangler's browser login is sufficient for deployment. A scoped `CLOUDFLARE_API_TOKEN` is an optional alternative for automated deployment, not a requirement for daily use. [Wrangler authentication](https://developers.cloudflare.com/workers/wrangler/commands/general/)

## Provision the primary organizer

Choose a permanent identity label, for example `venue-a-primary`. Keep your private mapping from that label to its organizer. The persistent directory enforces one event per label, including concurrent requests. Reusing it cannot create another event.

Read the provisioning secret without putting it into PowerShell history:

```powershell
$provisioningInput = Read-Host "Provisioning secret" -AsSecureString
$env:SHUTTLE_PROVISIONING_SECRET = [System.Net.NetworkCredential]::new('', $provisioningInput).Password
npm.cmd run provision -- https://shuttlehub.your-subdomain.workers.dev venue-a-primary
Remove-Item Env:\SHUTTLE_PROVISIONING_SECRET
```

The command prints a **private, single-use setup link**, valid for 24 hours. Deliver it privately to that organizer. On opening it, the browser receives a remembered session and displays a recovery link to save. Invitation material is removed from the address bar. Normal organizer sessions last up to 30 days and can be revoked earlier.

Do not provision a fresh identity merely because access was lost. The organizer can use their saved recovery link. Recovery revokes their previous owner sessions, transfers any owned controllers out of those sessions, and issues a replacement recovery link. Recovery links expire after one year and are single-use; rotate them in Settings when needed.

If both setup/recovery material is lost, the maintainer can use the same secret-loading steps and:

```powershell
npm.cmd run provision -- https://shuttlehub.your-subdomain.workers.dev venue-a-primary --recover
```

This creates a short-lived recovery link to the **existing event**. It does not create another event. The maintainer must verify the recipient. The system cannot establish that two independently provisioned identities belong to the same physical person.

## Migrate existing local data

No working data is imported automatically.

1. Preserve the source with `npm.cmd run backup:local`. This uses SQLite's backup API, including committed WAL changes, and writes a SQLite copy plus `event.json` into a timestamped `output/backups/` directory. The source database is opened read-only.
2. Open the intended owner's cloud event. In **Club settings → Import existing local event**, confirm the displayed destination Event ID.
3. Select the saved `event.json`. The server requires an empty destination and validates identifiers, references, scoring, results, occupied courts, and player conflicts. It never silently overwrites an existing event.
4. Compare categories, team/match IDs, completed results, current court assignments, and scoring settings. Keep the original SQLite backup and JSON export after migration.

An explicit source/destination folder is also supported:

```powershell
npm.cmd run backup:local -- "E:\path\shuttlehub.sqlite" "E:\path\private-backup"
```

The destination must be a new directory. The command refuses existing directories and the source location, so repeating it cannot overwrite a previous backup. JSON is read from the completed SQLite copy to keep the two exports consistent.

The cloud import request limit is 8 MiB, including its JSON envelope. A 200-team, 19,900-match single-group draw was tested. Larger payloads fail explicitly; they are not partially imported. Large snapshots are stored in chunks below SQLite's row-size limit. Importing existing legacy `match.live` fields does not alter the separate cloud scoring tables.

## Backups, restore, and updates

**Settings → Download event and scoring audit backup** exports tournament data, accepted action history, current scoring records, screen presets, and received reconciliation evidence. Credentials and secret hashes are excluded. Audit rows stream in bounded batches; accepted-action high-water marks keep later points out of that export.

The empty-destination importer also accepts a cloud backup within the import limit. It restores tournament state and retains prior scoring evidence as an archive; it deliberately does not reactivate old device controllers or sessions. Review any unfinished point scores before restarting play. Exported screen presets and active point-score restoration are currently manual recovery steps. A large audit export may exceed the import limit: retain the full archive and import its `state` as a `shuttlehub-v1` snapshot. This is a disaster-recovery path, not an archive-and-create control for organizers.

Back up before updating. Run `npm.cmd run deploy:cloud` for code updates. Preserve existing Durable Object class names and migration history. Do not delete namespaces or replace `wrangler.jsonc` with a fresh scaffold. Browser service workers wait for old tabs to close before activating an updated shell; finish/sync active scoring first.

## Local cloud development and tests

The cloud runtime is independent of `data/shuttlehub.sqlite`. To run isolated tests:

```powershell
npm.cmd run build:cloud
npx.cmd wrangler dev --local --port 8799 --persist-to output/cloud-test-state --var PROVISIONING_SECRET:local-test-secret
```

Leave that development terminal running. `local-test-secret` is a test-only value and must never be deployed. In a second terminal:

```powershell
npm.cmd test
npm.cmd run test:cloud
npm.cmd run test:runtime
npx.cmd playwright install chromium
npm.cmd run test:browser
npm.cmd run test:load
```

If Microsoft Edge is already installed on Windows, use `$env:PW_CHANNEL='msedge'` instead of downloading Chromium. Runtime persistence/expiry tests create their own temporary database and start a separate Worker on port 8801. Cloud integration/browser/load tests create isolated event identities on port 8799. They do not use the working local event.

`npm.cmd run dev:cloud` is the general cloud preview command. `npm.cmd run dev` and `npm.cmd start` retain the legacy local server for compatibility and maintenance.

## Architecture and operational boundaries

- The Worker validates origins, routes authenticated event access, and restricts maintainer provisioning.
- A singleton SQLite directory owns the unique primary-identity/event mapping. Each event has its own SQLite Durable Object, membership/session records, assignments, presets, tournament snapshot, and scoring audit.
- The tournament engine remains `server/engine.js`; point scoring uses a pure shared reducer. Final confirmation invokes the existing result-processing engine inside the same SQL transaction as the accepted action.
- Each match has a controller generation, action sequence, and scoring revision. Controller transfer, rule/status/opponent/result changes revoke the previous generation. Retries deduplicate by immutable action ID and envelope.
- Hibernating WebSockets deliver confirmed changes and scoped snapshots. No server timer writes every second. Foreground controller contact updates freshness without SQL heartbeat writes.
- IndexedDB stores phone work by event and session. Web Locks prevent competing tabs. The service worker caches only public application assets, never API responses. Cached private snapshots live under the event/session namespace.
- Offline revocation cannot erase already-stored information on a disconnected device. Once connected, revoked sessions lose HTTP and WebSocket access. Old queues cannot be replayed under another event/session.

Read [validation and free-tier capacity](CLOUD_VALIDATION.md) before using the system for an event. Provider-side hibernation, real-network latency, and real-device rehearsal remain deployment checks.
