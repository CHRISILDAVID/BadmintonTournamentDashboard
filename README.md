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
- **Format:** choose direct qualification or one of the qualification playoff presets below. Enter any whole group count from 1 to 256, including 3, 5, 6, or 37. Direct qualification also accepts 1-256 qualifiers per group, with 2-4096 total knockout places. Each group needs at least two teams and enough teams for its qualifiers. Uneven entries are balanced across groups. Non-power-of-two draws use automatic byes to reach the next power of two; byes do not need scores. Qualifier order is league place, then group order (A, B, etc.); earlier qualifiers receive byes. Opening games pair different groups when possible. Group labels continue after Z as AA, AB, etc. Configure points, best of 1/3/5, and golden point or capped deuce separately for league and main knockout, plus playoffs when applicable. A bracket with 8 entrants starts at quarterfinals; 4 starts at semifinals; 2 at the final; 16 at the round of 16.
- **Teams & players:** manually add/edit/remove entries or import CSV/XLSX. Download a category-specific CSV template from the import dialog. Preview imports before saving. Team labels are automatically made from player names, for example `Arun Kumar - Vijay Raj`; there is no separate team-name field. Headers: `player1,player2,seed` (player columns match team size; seed optional). A legacy `team` column is ignored. XLSX uses the first worksheet. Older `.xls` files must be saved as `.xlsx`. Imports validate all rows atomically. Seeds and player names must be unique within a category. Use consistent full names across categories for conflict detection.
- **Delete tournament:** each category card has a Delete tournament action. Confirmation lists the teams, fixtures, and completed results that will be permanently removed. Other categories are preserved. Finish any matches currently on court before deleting.
- **Generate fixtures:** teams are assigned to balanced groups using snake seeding. Each pair plays once within its group. Adding/removing teams, seeds, and format lock once fixtures exist. **Edit players** remains available in Teams & players until the final is completed, including while games are on court. Name corrections retain team IDs, groups, fixtures, and scores; duplicate-name and on-court conflict checks still apply. Names are matched across categories, so correct each relevant category entry consistently. Use **Edit groups** on a tournament card, or filter **Teams & players** to that tournament, to swap teams between groups. Swaps retain the exact group sizes and update opponents without losing fixture IDs or planned times. Group editing locks after the first completed match in that tournament. On-court teams must first return their match to waiting; unrelated on-court matches do not prevent swaps. Unplayed fixtures can be reset to reopen registration; fixtures with started/completed matches cannot be reset.
- **Match centre:** optionally schedule a match, assign a free court, and start it. Courts and players cannot be in simultaneous live matches. Scheduling is manual; there is no duration-based automatic timetable or rest-time optimizer.
- **Start any ready game:** in Matches, Overview, or the bracket, choose **Start game**, select a free court, and start when both teams are available. Upcoming games appear in fixture order for browsing, without call numbers, priority controls, or holds. Planned times are optional and never prevent another match from starting. Games awaiting opponents cannot start. Existing saved call orders and hold flags are retired automatically; those fixtures become visible again.
- **Accidental start:** if play has not begun, open the on-court game and choose **Undo start and free court**, then confirm. It returns directly to upcoming without recording a result or requiring a release action.
- **Final results:** there is no point-by-point live scoring. Mark a match as on court when it starts. When it finishes, record the completed game scores and confirm the result. The result updates standings and frees the court. Score fields start blank, use the numeric phone keyboard, and have visible up/down buttons. Enter zero explicitly; a blank score cannot be saved as zero. **Edit result** is available for completed league, playoff, and knockout games, including after the final. Existing scores are prefilled. Confirm the correction checkbox, then save. Standings, qualifiers, and the champion update automatically. Any later game whose opponents change returns to upcoming, with its old scores cleared and court freed; unaffected results and fixture IDs remain intact. A reopened final makes the tournament ongoing again. Byes cannot be scored or edited.
- **Standings:** ranked by match wins, game difference, point difference, then original seed. Seed is the explicit final tie-break (not head-to-head). Review this rule before play.
- **Knockouts:** recording the last league result opens a qualification review with **Create playoffs + bracket** or **Create knockouts**. You can cancel and use the same next-stage action directly in Overview, Matches, or Standings, including when another device finishes the league. Creation opens that category in Matches with the playoff/knockout stage selected. Use **Standings & bracket** to inspect the draw and **Manage games** to return. The stage filter keeps league history accessible. Direct qualification takes the top configured number per group. Playoff formats generate group qualification matches and the main knockout draw together; winners automatically fill their named knockout slots. Ready matches can still be started in any order; matches awaiting opponents cannot start. League statistics remain based only on league matches.
- **Venue display:** choose **Show 1, 2, 3... tournaments**, then select a distinct category in each selector. Each tournament has its own group leaderboards, upcoming game list, and complete result history split by group during league play. Once its knockout fixtures are created, that category switches to the connected draw, replacing its separate upcoming games and results sections. League standings remain visible only while qualification playoffs are unfinished. After the last playoff, both its playoff list and league standings disappear, leaving the knockout bracket to fill the panel. Categories with direct qualification show the bracket alone as soon as their draw is created. Brackets show advancing winners, pending opponents, active courts, final scores, and the champion. Other categories can continue showing league play alongside it. Display text is enlarged for venue viewing: player names, scores, headings and supporting labels are larger in every responsive layout. Active court numbers are badges. The original soft green theme and score styling are retained. Tables wrap into readable columns as more groups are added. For a 24-inch monitor, fullscreen with one or two categories gives players the most readable view; large draws still shrink to keep every match visible. Results, overflowing standings, and upcoming games scroll automatically in a repeating loop, with pauses at the start and end. Manual touch, keyboard, or scrolling pauses cycling for eight seconds, then it resumes. Qualification Playoffs has its own automatically scrolling list of every group playoff. That section disappears only when all playoffs in the category are completed. The separate Knockouts section scales the entire connected bracket to fit, with no scrolling or panning. Desktop panels put these sections side by side; phones stack them. Once playoffs finish, the bracket expands into all the space freed by the standings and playoff list. Cards and connectors spread through the available height; the complete draw stays visible. While playoffs remain unfinished, extra league groups cycle within their area above the bracket. Rounded court-green scrollbars with striped grips style every display scroll area. Results retain all matches with no three-match cap. Upcoming games have no call numbers or implied priority. Selection is remembered in that display browser. Small screens use compact stats; more categories use a grid with scrolling when needed. The player view uses a compact logo/title header, connection status, screen selectors, and fullscreen. It has no clock, announcement footer, table legends, organizer navigation, or editing controls. Times use each device's local timezone; keep devices in the same tournament timezone (e.g. Asia/Kolkata).

## Qualification playoff presets

In **New tournament**, select **2v2 Intermediate men** or **2v2 Beginner men**. You can also choose their qualification format in the second setup step. These are reusable formats; category names can be changed. Enter **any whole group count from 1 to 256** in **Format & scoring**. Intermediate requires exactly 5 doubles entries per group; Beginner requires 6. The setup preview shows the required entries, starting knockout round, and total match count before fixtures are generated. Registration remains editable until then.

| Format | League | Qualification playoffs in each group | Main knockout |
| --- | --- | --- | --- |
| Intermediate | Any group count, 5 teams each; top 3 advance directly | 4th vs 5th; winner earns slot 4 | Four qualifiers per group; see draw sizes below |
| Beginner | Any group count, 6 teams each; top 2 advance directly | 3rd vs 6th earns slot 3; 4th vs 5th earns slot 4 | Four qualifiers per group; see draw sizes below |

| Groups | Intermediate entries / total matches | Beginner entries / total matches | Knockout draw |
| --- | --- | --- | --- |
| 1 | 5 / 14 | 6 / 20 | 4 teams, semifinals |
| 2 | 10 / 29 | 12 / 41 | 8 teams, quarterfinals |
| 3 | 15 / 44 | 18 / 62 | 12 qualifiers, Round of 16 with 4 byes |
| 4 | 20 / 59 | 24 / 83 | 16 teams, Round of 16 |
| 8 | 40 / 119 | 48 / 167 | 32 teams, Round of 32 |

The table shows examples; other group counts are supported. Match totals exclude automatic byes. For around 200 teams, direct qualification can use 37 balanced groups (five or six teams each), or Intermediate can use 40 groups of five. Use direct qualification when entries do not fit the fixed playoff group sizes. CSV/XLSX imports accept up to 256 teams per batch.

One group opens with 1st vs 4th and 2nd vs 3rd. Multiple groups use seeded cross-group opening matches. Existing tournaments keep their saved group count. Change the format before generating fixtures; group swaps after generation keep the fixed group sizes.

Both presets use **15 points, golden point** for league and qualification playoffs: at 14–14 the next point wins. Main knockout games use **21 points, win by two, capped at 30**. Each stage defaults to one game; best of three or five can be selected independently before generating fixtures. Scoring settings are shown in the match desk and validated on the server.

For the default two-group format, quarterfinals: **A1 vs B4**, **B2 vs A3**, **B1 vs A4**, **A2 vs B3**. The first two feed one semifinal; the last two feed the other. Playoff winners keep these slots, even when the lower league rank wins; they are not re-ranked. With two groups, Intermediate has 29 matches total; Beginner has 41.

Standings distinguish direct places, pending playoffs, playoff qualifiers, and eliminated teams. The venue shows group playoff cards in a separate section alongside the main draw (stacked on phones), including their scoring rules and pending knockout sources. Completed playoff results remain available in organizer match history after their display section disappears. Existing tournaments retain their original formats and scoring; no practice data is added automatically.

## Practice tournaments

For testing, **Matches → Testing: complete unfinished matches** fills all unfinished fixtures with valid random scores. Select a tournament first to limit it to that category, or choose **All tournaments**. The confirmation covers every stage, including on-court games and later rounds waiting for winners; search, status, and stage filters do not limit this action. Completed results stay saved, courts are freed, and standings and advancement update. It completes existing fixtures only: create playoffs/knockouts normally, then use the testing action again to finish that draw. Generate fixtures first for draft categories.

This temporary feature is enabled by default. Before a real event, set `$env:DISABLE_TEST_TOOLS="1"` in PowerShell and start the server with `npm start`; this hides the button and blocks its API operation. Restart the server after changing this setting. This feature will be removed for production.

Choose **Tournaments > Load practice tournaments** to append five clearly named practice categories to an existing desk. This preserves existing tournaments and club settings. The pack contains 30 entries, 41 fixtures, five completed results, and up to three on-court matches (subject to court availability and player conflicts). It includes men's doubles, women's singles, mixed doubles, a ready-made semifinal/final rehearsal, and an unused draft for deletion testing. The knockout rehearsal is best-of-one for quick testing.

Delete each practice category when finished. A second pack cannot load while any practice category remains. The practice pack does not enable point-by-point scoring.

See [TESTING.md](TESTING.md) for the organizer/venue walkthrough, screenshots, and expected results. Sample CSV files are in [examples](examples).

## Sample data

From an empty desk, choose **Explore a sample event**. Sample data is visibly marked and includes three categories, live matches, and results. **Clear sample & start your event** removes the entire sample event, including edits to it. Clear it before entering real tournament data.

## Storage and backups

Tournament data is stored in `data/shuttlehub.sqlite` on the host. SQLite commits each change before broadcasting it and uses WAL journaling. Refreshing a page or restarting the server retains the event. Do not delete `data/`.

**Event settings → Export event data** downloads a readable JSON snapshot of tournament data. JSON re-import is not included. For a restorable backup, stop the server with Ctrl+C, then copy the entire `data` directory to another location. To restore, stop the server, retain a copy of the existing directory, and replace it with the backup before starting. Do not copy only the `.sqlite` file while the server is running, because recent writes may be in its WAL file.

## Reset the database

Use this after a rehearsal run to wipe all tournament data and start a clean slate for the real event.

> [!CAUTION]
> This permanently deletes **all** tournaments, teams, fixtures, results, and settings. Back up the `data/` folder first if you want to keep anything.

```powershell
# 1. Stop the server (Ctrl+C in the server terminal), then run:
Remove-Item -Recurse -Force data
npm start
```

The server recreates a fresh `data/` directory and an empty database on next start. Club settings (venue name, courts, announcement) will also be reset to defaults.

Accounts are intentionally omitted. Walkovers/withdrawals, print exports, and player ID matching beyond normalized names are not included in this version.

## Development and verification

```powershell
npm run dev
npm test
npm run build
```

Disable with $env:DISABLE_TEST_TOOLS="1" before starting the server.

`npm run dev` uses the same server and data directory with Vite middleware. `PORT` changes the listener port; `DATA_DIR` selects a separate database directory (use this for QA). `server/engine.js` holds validated tournament operations; `shared/standings.js` is shared by client and server. Tests cover fixtures, scores, progression, court/player conflicts, atomic registration, CSV, and actual XLSX import.

The UI uses the actual `assets/logo.jpg` throughout and as its browser icon. Court numbers, scoreboards, and the match queue lead the layout, with navy and green taken from the ShuttleHub branding. Existing saved data is migrated automatically: event dates and unused password records are removed, previous scheduled dates retain their time of day, and all teams, fixtures, final scores, and results are preserved. Existing entry labels are rebuilt from their player names without changing team IDs or fixtures. Unused point-by-point scores from older versions are removed; final game scores are retained. Internal result timestamps remain for ordering the match history; calendar dates are not shown in the interface.
