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

1. Open **http://localhost:3000** on the host laptop. The organizer controls are available immediately; there are no accounts, passwords, or sign-in steps.
2. Open **Club settings** to set the scoreboard title, venue, number of courts, and announcement. It also lists LAN links for other devices.
3. Organizers on the same network open `http://HOST-LAN-IP:3000`. The venue screen opens `http://HOST-LAN-IP:3000/display` for the read-only scoreboard.
4. Use the fullscreen button on the display, or the browser's fullscreen shortcut. If another device cannot connect, allow Node.js on **Private networks** in Windows Firewall and check that router client/AP isolation is disabled. No port forwarding is needed.

The desk is reusable: there is no event date or calendar setup. Match schedules use an optional start time only. New tournaments can be added whenever needed, and completed results remain in history. The app is intended for your organizing team's local network; any device that opens the organizer URL can make changes. The display route hides editing controls, but it is not an account permission boundary.

Match updates reconnect automatically; a disconnected display explicitly shows that match information may be stale. Updates use server-sent events and revision checks to avoid overwriting another organizer's changes.

## Tournament workflow

- **New tournament:** choose singles, doubles, mixed, 3v3, or a custom name and team size. Create as many categories as needed.
- **Format:** choose 1, 2, 4, or 8 groups, qualifiers per group, best of 1/3/5 games, points per game, and score cap. Groups × qualifiers must be 2, 4, 8, or 16. All games use win-by-two until the cap. A bracket with 8 entrants starts at quarterfinals; 4 starts at semifinals; 2 at the final; 16 at the round of 16.
- **Teams & players:** manually add/edit/remove entries or import CSV/XLSX. Download a category-specific CSV template from the import dialog. Preview imports before saving. Team labels are automatically made from player names, for example `Arun Kumar - Vijay Raj`; there is no separate team-name field. Headers: `player1,player2,seed` (player columns match team size; seed optional). A legacy `team` column is ignored. XLSX uses the first worksheet. Older `.xls` files must be saved as `.xlsx`. Imports validate all rows atomically. Seeds and player names must be unique within a category. Use consistent full names across categories for conflict detection.
- **Delete tournament:** each category card has a Delete tournament action. Confirmation lists the teams, fixtures, and completed results that will be permanently removed. Other categories are preserved. Finish any matches currently on court before deleting.
- **Generate fixtures:** teams are assigned to balanced groups using snake seeding. Each pair plays once within its group. Teams and format lock once fixtures exist. Unplayed fixtures can be reset to reopen registration; fixtures with started/completed matches cannot be reset.
- **Match centre:** optionally schedule a match, assign a free court, and start it. Courts and players cannot be in simultaneous live matches. Scheduling is manual; there is no duration-based automatic timetable or rest-time optimizer.
- **Flexible calls:** in Matches, use Call next, move up/down, or choose an exact call position in the match desk. Calls are shared across categories and devices. Manual order overrides planned times; any ready match can still be started on a free court. Hold removes an unavailable match from venue calls; the On hold filter finds it again. Release adds it to the end. Use scheduled order restores time-based sorting without releasing held matches. Fixtures awaiting knockout opponents are not called.
- **Accidental start:** if play has not begun, open the on-court match and choose Free court and put match on hold, then confirm. This frees its court without recording a result. Release and call it again when ready.
- **Final results:** there is no point-by-point live scoring. Mark a match as on court when it starts. When it finishes, record the completed game scores and confirm the result. The result updates standings and frees the court. Score fields start blank, use the numeric phone keyboard, and have visible up/down buttons. Enter zero explicitly; a blank score cannot be saved as zero. Completed results are locked in this version.
- **Standings:** ranked by match wins, game difference, point difference, then original seed. Seed is the explicit final tie-break (not head-to-head). Review this rule before play.
- **Knockouts:** after all league matches in a category finish, create its bracket from the top configured number per group. Winners automatically advance. Qualifiers are ordered by group position, then group letter, and placed using standard bracket seeding.
- **Venue display:** choose **Show 1, 2, 3... tournaments**, then select a distinct category in each selector. Each tournament has its own group leaderboards, upcoming call list, and complete result history split by group during league play. Once its knockout fixtures are created, that category automatically switches to league group standings above a connected knockout bracket, replacing its separate calls and results sections. Brackets show advancing winners, pending opponents, active courts, final scores, and the champion. Other categories can continue showing league play alongside it. Standings lead the layout; active court numbers are small badges. Results, overflowing standings, and upcoming calls scroll automatically in a repeating loop, with pauses at the start and end. Manual touch, keyboard, or scrolling pauses cycling for eight seconds, then it resumes. Large brackets scroll through every row before panning across to later rounds, then repeat. Extra league groups also cycle within their area above the bracket. Rounded court-green scrollbars with striped grips style every display scroll area. Results retain all matches with no three-match cap. Upcoming calls retain global call numbers. Selection is remembered in that display browser. Small screens use compact stats; more categories use a grid with scrolling when needed. The player view uses a compact logo/title header, connection status, screen selectors, and fullscreen. It has no clock, announcement footer, table legends, organizer navigation, or editing controls. Times use each device's local timezone; keep devices in the same tournament timezone (e.g. Asia/Kolkata).

## Practice tournaments

Choose **Tournaments > Load practice tournaments** to append five clearly named practice categories to an existing desk. This preserves existing tournaments and club settings. The pack contains 30 entries, 41 fixtures, five completed results, and up to three on-court matches (subject to court availability and player conflicts). It includes men's doubles, women's singles, mixed doubles, a ready-made semifinal/final rehearsal, and an unused draft for deletion testing. The knockout rehearsal is best-of-one for quick testing.

Delete each practice category when finished. A second pack cannot load while any practice category remains. The practice pack does not enable point-by-point scoring.

See [TESTING.md](TESTING.md) for the organizer/venue walkthrough, screenshots, and expected results. Sample CSV files are in [examples](examples).

## Sample data

From an empty desk, choose **Explore a sample event**. Sample data is visibly marked and includes three categories, live matches, and results. **Clear sample & start your event** removes the entire sample event, including edits to it. Clear it before entering real tournament data.

## Storage and backups

Tournament data is stored in `data/shuttlehub.sqlite` on the host. SQLite commits each change before broadcasting it and uses WAL journaling. Refreshing a page or restarting the server retains the event. Do not delete `data/`.

**Event settings → Export event data** downloads a readable JSON snapshot of tournament data. JSON re-import is not included. For a restorable backup, stop the server with Ctrl+C, then copy the entire `data` directory to another location. To restore, stop the server, retain a copy of the existing directory, and replace it with the backup before starting. Do not copy only the `.sqlite` file while the server is running, because recent writes may be in its WAL file.

Accounts are intentionally omitted. Result corrections, walkovers/withdrawals, print exports, and player ID matching beyond normalized names are not included in this version.

## Development and verification

```powershell
npm run dev
npm test
npm run build
```

`npm run dev` uses the same server and data directory with Vite middleware. `PORT` changes the listener port; `DATA_DIR` selects a separate database directory (use this for QA). `server/engine.js` holds validated tournament operations; `shared/standings.js` is shared by client and server. Tests cover fixtures, scores, progression, court/player conflicts, atomic registration, CSV, and actual XLSX import.

The UI uses the actual `assets/logo.jpg` throughout and as its browser icon. Court numbers, scoreboards, and the match queue lead the layout, with navy and green taken from the ShuttleHub branding. Existing saved data is migrated automatically: event dates and unused password records are removed, previous scheduled dates retain their time of day, and all teams, fixtures, final scores, and results are preserved. Existing entry labels are rebuilt from their player names without changing team IDs or fixtures. Unused point-by-point scores from older versions are removed; final game scores are retained. Internal result timestamps remain for ordering the match history; calendar dates are not shown in the interface.
