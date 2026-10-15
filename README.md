# ShuttleHub Tournament Desk

A local badminton tournament dashboard for organizers and a venue screen. Runs on one host laptop; phones, laptops, and the screen connect over the same Wi-Fi or Ethernet. Nothing is deployed online. No external fonts, analytics, or runtime internet services are used.

## Start

Requires Node.js **24 LTS** (uses built-in SQLite). Internet is needed once to install dependencies, then normal operation is offline.

```powershell
npm ci
npm run build
npm start
```

Or run `./Start-ShuttleHub.ps1` from PowerShell. The host listens on port 3000. Keep the terminal open and prevent the host laptop from sleeping.

1. On the host laptop open **http://localhost:3000**.
2. Choose **Set up your event** and create an organizer password (at least 8 characters). Initial password creation is restricted to the host's localhost address.
3. Open **Event settings** to set the name, venue, date, number of courts, and screen announcement. It also lists LAN links for other devices.
4. Connect every device to the same trusted network. Organizers open `http://HOST-LAN-IP:3000` and sign in with the shared password. The screen opens `http://HOST-LAN-IP:3000/display`, which is read-only and needs no password.
5. Use the fullscreen button on the display, or the browser's fullscreen shortcut. If another device cannot connect, allow Node.js on **Private networks** in Windows Firewall and check that router client/AP isolation is disabled. No port forwarding is needed.

The app uses local HTTP, so use a trusted event network. Organizer sessions last 24 hours and are cleared when the server restarts. Match updates reconnect automatically; a disconnected display explicitly shows that scores may be stale. Updates use server-sent events and revision checks to avoid overwriting another organizer's changes.

## Tournament workflow

- **New tournament:** choose singles, doubles, mixed, 3v3, or a custom name and team size. Create as many categories as needed.
- **Format:** choose 1, 2, 4, or 8 groups, qualifiers per group, best of 1/3/5 games, points per game, and score cap. Groups × qualifiers must be 2, 4, 8, or 16. All games use win-by-two until the cap. A bracket with 8 entrants starts at quarterfinals; 4 starts at semifinals; 2 at the final; 16 at the round of 16.
- **Teams & players:** manually add/edit/remove entries or import CSV/XLSX. Download a category-specific CSV template from the import dialog. Preview imports before saving. Headers: `team,player1,player2,seed` (player columns match team size; seed optional). XLSX uses the first worksheet. Older `.xls` files must be saved as `.xlsx`. Imports validate all rows atomically. Seeds and player names must be unique within a category. Use consistent full names across categories for conflict detection.
- **Generate fixtures:** teams are assigned to balanced groups using snake seeding. Each pair plays once within its group. Teams and format lock once fixtures exist. Unplayed fixtures can be reset to reopen registration; fixtures with started/completed matches cannot be reset.
- **Match centre:** optionally schedule a match, assign a free court, and start it. Courts and players cannot be in simultaneous live matches. Scheduling is manual; there is no duration-based automatic timetable or rest-time optimizer.
- **Live scores:** publish the current game's points. At the end, record all completed game scores and confirm the result. The result updates standings and frees the court. Completed results are locked in this version.
- **Standings:** ranked by match wins, game difference, point difference, then original seed. Seed is the explicit final tie-break (not head-to-head). Review this rule before play.
- **Knockouts:** after all league matches in a category finish, create its bracket from the top configured number per group. Winners automatically advance. Qualifiers are ordered by group position, then group letter, and placed using standard bracket seeding.
- **Venue display:** live scores (three cards at a time, rotating every 12 seconds when more courts are active), the next four fixtures, three latest completed matches, category filter, all-match history, and announcement. Upcoming matches are ordered by scheduled time, with unscheduled fixtures following in fixture order. Times use each device's local timezone; keep all devices in the same tournament timezone (e.g. Asia/Kolkata).

## Sample data

After signing in to an empty event, choose **Explore a sample event**. Sample data is visibly marked and includes three categories, live matches, and results. **Clear sample & start your event** removes the entire sample event, including edits to it. Clear it before entering real tournament data.

## Storage and backups

Data and the hashed organizer password are stored in `data/shuttlehub.sqlite` on the host. SQLite commits each change before broadcasting it and uses WAL journaling. Refreshing a page or restarting the server retains the event. Do not delete `data/`.

**Event settings → Export event data** downloads a readable JSON snapshot of event data without passwords. JSON re-import is not included. For a restorable backup, stop the server with Ctrl+C, then copy the entire `data` directory to another location. To restore, stop the server, retain a copy of the existing directory, and replace it with the backup before starting. Do not copy only the `.sqlite` file while the server is running, because recent writes may be in its WAL file.

The first version uses one shared organizer role. It does not include individual accounts, result corrections, walkovers/withdrawals, print exports, or player ID matching beyond normalized names.

## Development and verification

```powershell
npm run dev
npm test
npm run build
```

`npm run dev` uses the same server and data directory with Vite middleware. `PORT` changes the listener port; `DATA_DIR` selects a separate database directory (use this for QA). `server/engine.js` holds validated tournament operations; `shared/standings.js` is shared by client and server. Tests cover fixtures, scores, progression, court/player conflicts, atomic registration, CSV, and actual XLSX import.

The UI follows the navy/green/teal direction of the supplied ShuttleHub logo. Its inline shuttle emblem is a local vector interpretation; the supplied raster logo was not available as a filesystem asset.
