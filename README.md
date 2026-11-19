# ShuttleHub Tournament Desk

This repository contains one application: the website and API deployed as the Cloudflare Worker **shuttlehub**. Organizers, umpires, maintainers, and venue displays use the same application with different permissions.

The former Express/LAN application and laptop SQLite database are removed. Production events live in Cloudflare's SQLite-backed Durable Objects. Browser storage remains necessary for pending offline scores, sessions, and display preferences.

See [Cloud setup](docs/CLOUD_SETUP.md), the [tournament-day guide](docs/STAFF_GUIDE.md), and [testing instructions](TESTING.md).

## Development

Requires Node.js 24 and npm:

```powershell
npm ci
npm run dev
```

This builds the production frontend and previews the same Worker through Wrangler, normally at http://localhost:8787. Local preview uses isolated development storage under the ignored `.wrangler/` directory. Rebuild/restart after source changes. See [isolated testing](TESTING.md) for provisioning local test access.

`npm start` runs the same Cloudflare preview. The `dev:cloud`, `build:cloud`, and `deploy:cloud` commands are aliases retained for existing deployment settings.

## Build and deployment

```powershell
npm run build
npm run deploy
```

`wrangler.jsonc` selects `cloud/worker.js`, frontend assets in `dist/`, and the `OwnerDirectory` / `TournamentEvent` Durable Object bindings. Both build commands produce the authenticated cloud app and offline scoring shell.

GitHub stores source, tests, examples, and documentation. Cloudflare packages the Worker dependency graph and built frontend assets. The Git integration configured in Cloudflare handles pushes to `main`; this repository has no GitHub Actions deployment workflow. Existing commands such as `npm run build:cloud` and `npm run deploy:cloud` continue to work. Tracked files are not separate deployed apps.

## Storage and backups

Use **Settings > Download event and scoring audit backup** in the cloud app. Restore a saved JSON backup only into an empty destination event. There is no laptop database or local SQLite backup command.

Wrangler may create local databases for development; these and their journals are ignored by Git. Stop the preview before removing `.wrangler/state/` to reset development data. Preserve production Durable Object bindings, class names, and migration history. The browser's offline scoring queue remains part of the production app.

## Tournament workflow

- **New tournament:** choose singles, doubles, mixed, 3v3, or a custom name and team size. Create as many categories as needed.
- **League cum knockouts** supports any whole group count from 1 to 256, including 3, 5, 6, or 37. Direct qualification accepts 1–256 qualifiers per group, with 2–4096 total knockout places. Each group needs at least two teams and enough teams for its qualifiers. Uneven entries are balanced across groups. Draws use automatic byes to reach the next power of two, and byes need no scores. Qualifier order is league place, then group order (A, B, etc.). Earlier qualifiers receive byes. Opening games pair different groups when possible. Group labels continue after Z as AA, AB, etc. Configure points, best of 1/3/5, and golden point or capped deuce separately for league and main knockout, plus playoffs when applicable. An 8-slot bracket starts at quarterfinals, 4 at semifinals, 2 at the final, and 16 at the round of 16.
- For **Knockouts**, choose the format in **Format & scoring**, register at least two teams, and select **Generate bracket**. Every team enters the single-elimination bracket by seed. Empty slots give the highest seeds automatic byes. Use **Edit knockouts** to swap eligible teams or add a team to an available bye. Player names can be edited until the final is completed. You can reset the bracket before any game is on court or has a result, even if teams have advanced by bye.
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

## Custom games

Organizers can choose **New custom game** from Overview or Matches, enter singles or doubles players, and set best-of, points and finish rules. Start the game on a free court, then score it through the umpire/organizer scorer or record its final result from the organizer match desk. Custom games share court and player availability checks with tournament matches.

Use the **Custom** filter in Matches and Match history to find these games. They keep their own players and scoring rules, with no tournament category, group, standings or knockout draw. The venue display includes live custom games even without any tournaments; screens restricted to specific tournament categories continue to show only those categories. Completed custom games are retained in match history and included in event backups. Games, backups and saved links from before the rename remain supported.

Live-score cards separate **Points** in the current game from **Games won** in the match. Single-game matches omit the games-won column. Best-of-three and best-of-five matches show how many games are needed to win, with completed game scores below the players. Game-point and match-point labels follow the match's scoring rules. Courts without a scoring record show **Awaiting score** and dashes; offline or delayed displays retain the last received score with a clear status.

## Organizer navigation

Organizer pages have real URLs: `/`, `/tournaments`, `/teams`, `/matches`, `/matches/history`, `/standings`, and `/settings`. Navigation links support opening in another tab. Browser Back/Forward and refresh restore the page and URL filters. Tournament selection uses `?tournament=...`; team/match search uses `q`, with `status` and `stage` for matches. Typing replaces the current history entry so Back does not step through every keystroke. Background score updates retain searches and filters. Category-specific actions navigate to the relevant page in one history step. Unknown paths show a recovery link to the overview.

## Qualification and knockout board

New tournaments use **Direct qualification**. Set the group count and qualifiers per group in **Format & scoring**. Intermediate and Beginner presets have been retired from setup. Saved tournaments retain their original qualification rules, playoff fixtures, scoring, and results.

The venue Knockouts widget is a pannable, zoomable board. It starts with the entire draw fitted to the widget, including large draws. Drag to pan, scroll or pinch to zoom around a point, or use the minus/plus controls. **100%** centres the nearest match at actual size; **Fit** restores the whole draw. Focus the board and use arrow keys to pan, **+ / -** to zoom, and **0** or **Home** to fit. Each tournament has its own view; score updates keep the current view. While fitted, resizing the widget fits the draw again; after manual navigation, resizing preserves the point at the centre.

## Verification and code layout

```powershell
npm test
npm run build
npx wrangler deploy --dry-run
```

See [TESTING.md](TESTING.md) for cloud API, browser, and runtime checks. Sample CSV files are in [examples](examples). Sample generators live only under `tests/fixtures/`; production has no local sample/practice mode.

| Location | Responsibility |
| --- | --- |
| `cloud/` | Worker routing, access checks, event storage, scoring, history |
| `shared/tournament.js` | Validated tournament operations used by the Worker and tests |
| `shared/` | Scoring, standings, draws, teams, and display rules |
| `src/cloud/` | Authentication, WebSocket transport, offline queue, scoring, maintainer tools |
| `src/stores/` | Tournament snapshots, navigation, and venue preferences |
| `src/pages/`, `src/forms/`, `src/components/` | Organizer pages, forms, venue widgets, and shared UI |

The frontend uses React/JSX, Zustand, React Grid Layout, Tailwind CSS, and shadcn/ui. Customize colors and component tokens in `src/theme.css`; edit owned UI components under `src/components/ui/`. Excel imports use the bundled reader at `/vendor/exceljs.min.js`. Builds retain previous hashed assets for already-open tabs.
