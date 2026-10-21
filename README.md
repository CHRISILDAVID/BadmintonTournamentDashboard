# ShuttleHub Tournament Desk

ShuttleHub now includes a Cloudflare deployment with one isolated event per organizer identity, role invitations, mobile point scoring with a persistent offline queue, and independent live displays.

Start with [Cloud setup and migration](docs/CLOUD_SETUP.md), [Tournament-day guide](docs/STAFF_GUIDE.md), and [validation/capacity results](docs/CLOUD_VALIDATION.md). Cloud use requires internet for synchronization. Staff need only a browser and their role link.

Maintainers can open `/maintainer` on the deployed cloud website to create primary-organizer setup links/QRs and restore existing organizer access through a form. Unlock it with the private provisioning secret; organizers only need their individual link.

The original Express/SQLite server remains available for local-data backup and regression testing. The instructions below describe that **legacy local mode**, which has unrestricted local organizer access and must not be exposed as the cloud application.

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
- **Generate fixtures:** teams are assigned to balanced groups using snake seeding. Each pair plays once within its group. Existing seeds and format lock once fixtures exist. During the league, **Add team** or **Import teams** lets you choose an existing group; only missing pairings are generated. Filter **Teams & players** to a tournament and choose **New group** to import at least two teams into a new group with its own round-robin fixtures. **Edit players → Remove team** deletes that team's fixtures and results, frees any occupied court, and recalculates standings. Entry changes lock when the playoff or knockout draw is created. **Edit players** remains available until the final is completed; name corrections retain IDs, groups, fixtures, and scores. Duplicate-player and on-court conflict checks still apply. **Edit groups** lets you select teams directly from the group lists. Use **Move team** to choose a destination without a replacement, or **Swap teams** to exchange two selected teams. Moves replace the selected team's old fixtures with pairings against its new group; swaps retain fixture IDs and planned times. Both modes lock after the first completed match, and selected teams must first leave court. Only unplayed fixtures can be reset.
- **Match centre:** optionally schedule a match, assign a free court, and start it. Courts and players cannot be in simultaneous live matches. Scheduling is manual; there is no duration-based automatic timetable or rest-time optimizer.
- **Start any ready game:** in Matches, Overview, or the bracket, choose **Start game**, select a free court, and start when both teams are available. Upcoming games appear in fixture order for browsing, without call numbers, priority controls, or holds. Planned times are optional and never prevent another match from starting. Games awaiting opponents cannot start. Existing saved call orders and hold flags are retired automatically; those fixtures become visible again.
- **Accidental start:** if play has not begun, open the on-court game and choose **Undo start and free court**, then confirm. It returns directly to upcoming without recording a result or requiring a release action.
- **Final results:** there is no point-by-point live scoring. Mark a match as on court when it starts. When it finishes, record the completed game scores and confirm the result. The result updates standings and frees the court. Score fields start blank, use the numeric phone keyboard, and have visible up/down buttons. Enter zero explicitly; a blank score cannot be saved as zero. **Edit result** is available for completed league, playoff, and knockout games, including after the final. Existing scores are prefilled. Confirm the correction checkbox, then save. Standings, qualifiers, and the champion update automatically. Any later game whose opponents change returns to upcoming, with its old scores cleared and court freed; unaffected results and fixture IDs remain intact. A reopened final makes the tournament ongoing again. Byes cannot be scored or edited.
- **Scoring corrections:** each stage has independent rules, shown together in the setup summary. Use **Use league rules for every stage** when all stages should match. After fixtures exist, **Tournaments → Edit scoring** changes rules for unfinished games, including games on court. Completed results retain their original rules for later score corrections. Changing a winner can reopen dependent games, which then use the current rules. Scrolling over numeric fields does not change their values.
- **Standings:** ranked by match wins, game difference, point difference, then original seed. Seed is the explicit final tie-break (not head-to-head). Review this rule before play.
- **Knockouts:** recording the last league result opens a qualification review with **Create playoffs + bracket** or **Create knockouts**. You can cancel and use the same next-stage action directly in Overview, Matches, or Standings, including when another device finishes the league. Creation opens that category in Matches with the playoff/knockout stage selected. Use **Standings & bracket** to inspect the draw and **Manage games** to return. The stage filter keeps league history accessible. Direct qualification takes the top configured number per group. Playoff formats generate group qualification matches and the main knockout draw together; winners automatically fill their named knockout slots. Ready matches can still be started in any order; matches awaiting opponents cannot start. League statistics remain based only on league matches.
- **Venue display:** select the categories to show on `/display`. Each tournament has independent League standings, Up next (including live courts), Latest results, Playoffs, and Knockouts widgets. Automatic visibility follows the tournament phase; the layout editor can override it at any time. Results include league and postseason games. The display remains read-only for tournament data.

In the display's **Edit layout** mode, set **Live scores → Above tournaments · all matches** to move live scores into one shared strip. It includes on-court matches from every tournament allowed by the screen preset, even when only one tournament panel is selected. Choose **Horizontal scroll** for a single row with previous/next arrows and touch scrolling, or **Wrap cards** for multiple rows. Automatic scrolling follows the display's pause/resume control. Save, Cancel, and Reset apply to this setting with the rest of the layout; screen presets can copy the saved layout. Per-tournament Live scores widgets return when placement is set to **Inside tournaments**.

On the cloud match screen, **Point scoring** shortcuts show both team names and the court. Live match cards and table rows also offer **Open scorer** beside **Record result**, for organizers and umpires.

## Customize a venue screen

Use the **pencil icon beside fullscreen** to edit. Drag a tournament's top grip to move its whole panel, or drag a widget's grip to move just that section. Resize either from its bottom-right corner. Each widget's minus button hides it; **Widgets** opens the visibility controls:

- **Automatic:** follows the normal league/playoff/knockout transitions.
- **Always show:** stays visible at every stage, so standings and completed playoffs can remain alongside knockouts. A section without fixtures shows an explanatory empty state.
- **Hide:** stays hidden until you restore it. Hiding a widget never deletes tournament data.

Keyboard users can focus a widget grip and use arrow keys to move it (up/down reorder), or **Shift + arrow keys** to resize it. Whole panels retain Move earlier/later and Width/Height controls. Minimum dimensions keep widgets readable; small screens stack them and allow manual vertical scrolling.

- **Save layout** commits panel arrangements, widget sizes/positions, and visibility together in this browser.
- **Cancel** (X) restores the committed arrangement.
- **Reset layout** (circular arrow) restores automatic visibility and default arrangements in the draft. Save makes the reset permanent.
- Tournament selectors are disabled during editing. Deleting a selected tournament from the desk repairs the selection and exits editing.

Layouts are saved per selection of tournament IDs. Panel layouts adapt to desktop, tablet, and phone widths; each tournament's widgets adapt to that panel's available width. Returning to a selection restores its layout. Tournament renames preserve identity. The latest 30 selection layouts are retained. Version 2 preferences import existing whole-panel layouts and legacy selections. Blocked/full storage shows an error and retains the draft; corrupt positions recover to safe defaults. Different browsers, devices, ports, or hostnames have separate preferences.

Each widget has one scrolling surface, with thin scrollbars. The full screen and tournament panel containers only scroll manually. Automatic scrolling pauses during editing and for eight seconds after touch, wheel, or keyboard interaction. Use the **pause/play icon** beside the pencil to stop/resume automatic scrolling for the current view. Large brackets retain readable text and scroll vertically/horizontally instead of shrinking the entire draw into tiny cards. Brackets remeasure when resized. Fullscreen and live connection indicators remain available.

## Organizer navigation

Organizer pages have real URLs: `/`, `/tournaments`, `/teams`, `/matches`, `/matches/history`, `/standings`, and `/settings`. Navigation links support opening in another tab. Browser Back/Forward and refresh restore the page and URL filters. Tournament selection uses `?tournament=...`; team/match search uses `q`, with `status` and `stage` for matches. Typing replaces the current history entry so Back does not step through every keystroke. Background score updates retain searches and filters. Category-specific actions navigate to the relevant page in one history step. Unknown paths show a recovery link to the overview.

## Qualification and knockout board

New tournaments use **Direct qualification**. Set the group count and qualifiers per group in **Format & scoring**. Intermediate and Beginner presets have been retired from setup. Saved tournaments retain their original qualification rules, playoff fixtures, scoring, and results.

The venue Knockouts widget is a pannable, zoomable board. It starts with the entire draw fitted to the widget, including large draws. Drag to pan, scroll or pinch to zoom around a point, or use the minus/plus controls. **100%** centres the nearest match at actual size; **Fit** restores the whole draw. Focus the board and use arrow keys to pan, **+ / -** to zoom, and **0** or **Home** to fit. Each tournament has its own view; score updates keep the current view. While fitted, resizing the widget fits the draw again; after manual navigation, resizing preserves the point at the centre.

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

Excel imports load a locally served reader at `/vendor/exceljs.min.js`, emitted by the Vite build and served by the development middleware. Failed reader loads can be retried by selecting the same file again; CSV imports work independently of that reader. Builds preserve previous hashed assets so already-open organizer/display tabs can finish loading them. Refresh tabs after updating the app; restart the server after backend changes. Missing asset requests return 404 rather than the application HTML.

### Frontend organization

The frontend uses **React + JSX, React Grid Layout, Zustand, Tailwind CSS 4, and shadcn/ui**. JavaScript remains the project language (`components.json` sets `tsx: false`). Express, SQLite, REST endpoints, and server-sent events are unchanged by this migration. All assets and dependencies are served locally after building; no hosted UI service, font service, or database SDK is required.

| Location | Responsibility |
| --- | --- |
| `src/App.jsx` | Organizer shell, navigation, modal routing; lazy-loaded venue screen |
| `src/pages/` | Overview, tournaments, teams, matches, standings, settings |
| `src/forms/` | Tournament setup, registration/import, match editing, confirmations; unsaved inputs stay local |
| `src/components/ui/` | Locally owned shadcn buttons, inputs, labels, selects, tables, dialogs, badges, Sonner notifications |
| `src/components/` | Shared match cards/tables, stage actions, modal helpers, venue grid/editor |
| `src/stores/tournament.js` | Snapshots, monotonic revisions, actions, loading state, one shared SSE lifecycle per app tab |
| `src/stores/organizer.js` | Navigation, category/search/stage/status filters, dialogs, notifications |
| `src/stores/venue.js` | Versioned browser persistence for selection and committed layouts; transient editor drafts |
| `src/lib/venue-layout.js`, `src/lib/venue-widgets.js` | Panel/widget defaults, visibility, responsive bounds recovery, keyboard ordering |
| `src/lib/navigation.js`, `src/components/PageLink.jsx` | URL parsing, filter serialization, browser navigation |
| `src/VenueBoard.jsx`, `src/VenueBracket.jsx` | Read-only tournament panels and measured bracket rendering |

`src/hooks/useDesk.jsx` adapts the focused stores for organizer pages. Forms keep their original revision while editing; a conflicting save refreshes the snapshot and asks the organizer to review/retry without replacing typed values. The connection store cleans up listeners and ignores responses from a closed subscription. Only venue preferences are persisted client-side.

### Theme and component customization

Change the green/navy palette, system font, radii, and semantic colors in **`src/theme.css`**. Tailwind runs through `@tailwindcss/vite` in `vite.config.js`; `@/` aliases `src/`. Use Tailwind utilities in JSX and edit the owned components under `src/components/ui/` to change shared control behavior. `components.json` configures the shadcn CLI for future JavaScript components. Dialogs use Radix focus trapping and keyboard dismissal, while score numerals use tabular figures.

`src/styles/organizer.css` consolidates the former overlapping organizer styles into a component layer so Tailwind utilities can override them. Scoped venue/bracket, grid, group-editor, and score-input CSS retains the specialized geometry and scrolling. The logo remains `assets/logo.jpg`. No runtime internet connection is needed for these styles or components.

The UI uses the actual `assets/logo.jpg` throughout and as its browser icon. Court numbers, scoreboards, and the match queue lead the layout, with navy and green taken from the ShuttleHub branding. Existing saved data is migrated automatically: event dates and unused password records are removed, previous scheduled dates retain their time of day, and all teams, fixtures, final scores, and results are preserved. Existing entry labels are rebuilt from their player names without changing team IDs or fixtures. Unused point-by-point scores from older versions are removed; final game scores are retained. Internal result timestamps remain for ordering the match history; calendar dates are not shown in the interface.
