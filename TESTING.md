# ShuttleHub testing walkthrough

Open the organizer at **http://localhost:3000** and the venue screen at **http://localhost:3000/display** in two windows. For another device on the same Wi-Fi, use the LAN address shown in Club settings.

For isolated practice, use a separate `DATA_DIR` when starting a test server. The sample pack is optional; no practice data is loaded automatically. Enter final scores only after a match finishes.

## Venue tournament board

Open `/display`. Use **Show N tournaments**, then choose a different category in each selector. Categories with unfinished fixtures are offered first. Existing finished categories can still be selected to view their results and champion. The browser remembers its own selection after refresh.

Each selected tournament shows:

- Standings split by league group, with current qualifying places shaded. The normal table shows played, wins, game difference, and point difference. Dense layouts use wins/played and point difference.
- Upcoming calls in their organizer-controlled global order. Held matches and unknown knockout opponents stay out of the list. Active court numbers appear beside the tournament name.
- All completed results split into independent Group A, Group B, etc. lists, newest first. Knockouts have their own list. Each list keeps a bounded height and scrolls for older matches; there is no three-result data limit.

The screen only offers tournament selection and fullscreen. Organizer actions remain in the tournament desk.

The screenshots below use an isolated test database, not the working tournament data:

![Two tournaments together](output/playwright/board-two-1080.png)

[One tournament](output/playwright/board-one-1080.png), [three tournaments](output/playwright/board-three-1080.png), [compact 1366 x 768 view](output/playwright/board-three-768.png), [four tournament grid](output/playwright/board-four-1080.png), [older results scrolled](output/playwright/board-results-scrolled.png), [phone view](output/playwright/board-mobile.png).

| Case | Action | Expected display behavior |
| --- | --- | --- |
| One category | Show 1 tournament and select a category. | One board with that category's group tables, calls, and results. |
| Multiple categories | Show 2 or 3 tournaments and choose each category. | All selected categories appear together, each with separate data. Duplicate category selections are disabled. |
| More categories | Show 4 or more. | The layout becomes a grid. Larger selections scroll as needed to retain readable text. |
| Remember selection | Refresh the display. | The count and selected categories remain. |
| Older results | Complete more than three matches in each group. Scroll one group's result list. | Every result is available; the other group stays in place. |
| New result | Record a final result from another organizer window. | Correct group standings and result list update without refreshing; the match leaves upcoming calls. |
| Opponent B wins | Enter a result where the second opponent wins. | The winner is named first and the score follows the winner's side. |
| Knockouts | Finish semifinal/final matches. | League rankings stay based on league play; knockout results appear separately and the champion is named. |
| No fixtures | Select a category that only has registrations. | Entries appear with draw-pending text; no invented group assignments or results. |
| Delete selected category | Delete an unused selected category from another organizer window. | Its board disappears; selection fills from remaining categories and count shrinks when necessary. |
| Empty event | Open a new test database without categories. | A clear empty board with no broken selectors. |
| Player controls | Inspect the display. | No score-entry, delete, or organizer navigation controls. |

Organizer examples: [player entry](output/playwright/practice-player-entry.png), [final-result entry](output/playwright/practice-final-result.png), [delete confirmation](output/playwright/practice-delete.png), [bracket](output/playwright/practice-bracket.png).

## Try these cases

Use only Practice categories for destructive exercises. Start with the unused draft for entry/import testing, and delete it after those exercises.

| Case | What to do on the organizer side | Expected organizer behavior | Expected venue behavior |
| --- | --- | --- | --- |
| Practice overview | Open Overview; choose All tournaments. | Three practice matches occupy free courts; league and knockout fixtures are available. | Selected tournament boards show standings, calls, grouped results, and active court badges. |
| Automatic names | Tournaments > Practice / Unused draft > Manage teams > Add team. Enter Arun Kumar and Vijay Raj. | Preview and saved entry read `Arun Kumar - Vijay Raj`. No team-name field. | The same label appears when this entry has a fixture. |
| Edit players | Edit that entry and change a player before generating fixtures. | The entry label updates automatically. | Later fixtures use the updated label. |
| Spreadsheet import | Create a fresh doubles category and import [doubles.csv](examples/doubles.csv), or save that sheet as XLSX. | Preview four player-based labels and seeds; confirm once. No `team` column required. | Fixtures appear after generation. |
| Invalid import | Import the same rows again, or leave a required player missing. | A clear validation error; no partial import. | Nothing changes. |
| Start a match | Open an upcoming match, select a free court, then Start match. | Match moves on court; occupied courts cannot be selected. | Court badge appears automatically; the match leaves the upcoming queue. |
| Invalid final result | Record result on a practice league match; try 21-20. | Error explains win-by-two. Match remains on court. | No new completed result appears. |
| Valid final result | On that match enter Game 1: 21-16, Add game, Game 2: 21-18, then Confirm final result. | Court becomes free; winner, final scores, and standings update. | Its court is freed; standings update and the result appears in the correct group without refreshing. |
| Match history | Open All results on the organizer, or scroll the relevant result group on the venue. | All completed results can be searched/filtered. | Every completed result is available in its group list. |
| Knockout advancement | Tournaments > Practice / Knockout rehearsal > Bracket. Start each semifinal on a free court and record 21-15. Then play the final. | Each semifinal winner fills its final slot automatically. The final cannot start until both opponents are known. Final winner becomes champion. | Court badges and the separate Knockouts result list follow each semifinal/final. |
| Cancel deletion | Tournaments > Delete Practice / Unused draft > Cancel. | Confirmation shows the exact teams/fixtures/results affected; Cancel preserves them. | Category remains available. |
| Confirm deletion | Filter the venue to Practice / Unused draft, then delete that category from the organizer. | Category and associated entries/fixtures/results disappear. Other categories remain intact. | Deleted category disappears and the display selection adapts to the remaining categories. |
| Delete on-court category | Try deleting a practice category that still has an on-court match. | Delete is disabled with an explanation; the server also rejects it. Finish the match first. | Match stays visible. |
| Simultaneous organizers | Open two organizer windows and make changes from both. | Changes synchronize; stale form revisions are rejected and latest data loaded for review. | Saved changes are reflected automatically. |
| Persistence | Refresh both windows; stop and restart the host server. | Saved categories, results, and deletions remain. | Screen reconnects and loads the saved state. |

For singles or 3v3 imports, use [singles.csv](examples/singles.csv) and [3v3.csv](examples/3v3.csv) in categories with the matching number of players per entry. Fixtures lock registration; reset only unplayed fixtures to reopen it.

## Verification performed

- `npm test`: **28 passing tests** covering round-robin draws, league-to-knockout progression, final-score validation, court/player conflicts, atomic imports, CSV/XLSX, automatic labels, deletion, practice-data preservation, revision conflicts, persistence, and migration.
- `npm run build`: passed. ExcelJS remains a large, separately loaded import bundle.
- Real-browser checks: loading the practice pack; manual player entry and automatic label; invalid and valid final results; automatic updates to a separate venue browser session; starting a knockout match and recording its result; cancellation and confirmation of draft deletion; automatic filter recovery after remote deletion; and desktop display at 1920 x 1080 and 1366 x 768. New board checks cover one to five selections, saved preferences, independent result scrolling, read-only controls, knockout/registration views, phone layout, and automatic result updates.
- Venue board unit checks cover exact and distinct selections, deletion recovery, complete grouped results, empty states, knockout separation, standings, winner score ordering, and ongoing category priority.

## Flexible match calls

In **Matches**, the list now shows a global call number for every callable fixture. You can also open any upcoming match from Overview or the bracket to change its call position. Filters do not renumber calls. Planned times are only a guide; no fixture regeneration is needed to change the order.

| Case | Organizer action and expected result | Venue result |
| --- | --- | --- |
| Available players arrive | Find their match and click **Call next**. It becomes global call #1 even with a later planned time. | It becomes the first upcoming call immediately. |
| Reorder calls | Use the up/down arrows, or open a match and choose an exact call position. | Upcoming calls follow the same global order. |
| Players absent | Click **Hold**. Find the match again using Match status > On hold. | Match disappears from upcoming calls; its fixture is retained. |
| Players return | Click **Release**. It joins the end; use Call next if needed. | Appears at the end of its tournament call list, available by scrolling. |
| Wrong match started | Before play begins, open the on-court match > Free court and put match on hold > Confirm. | Active court badge disappears, with no new completed result. |
| Resume a held match | Release it, assign a free court, and start it. | Its active court badge appears. |
| Restore the original plan | Click **Use scheduled order**. Held matches remain held. | Eligible calls return to time/fixture order. |
| Filter a category | Filter Matches and the venue to the same category. | Global call numbers agree, even when there are gaps. |
| Restart host | Change call order and hold a match, then restart the server. | Saved order and holds remain after reconnection. |

The automatic tests cover queue ordering, holds/releases, invalid actions, conflict checks, return-to-hold, knockout eligibility, removal cleanup, persistence, and stale-revision rejection. Separate organizer/venue browser sessions verified reordering, hold/release, and freeing a court. Browser checks use an isolated database so your working tournaments are unchanged.

[Match call controls](output/playwright/flexible-calls.png) - [Held matches](output/playwright/calls-on-hold.png) - [Phone layout](output/playwright/calls-mobile.png)

## Finish testing

Delete practice categories individually after finishing their on-court matches. Confirmation removes that category's teams, fixtures, and results permanently. To load a fresh practice pack, remove all remaining Practice categories and choose **Tournaments > Load practice tournaments** again.
