# ShuttleHub practice walkthrough

Open the organizer at **http://localhost:3000** and the venue screen at **http://localhost:3000/display** in two windows. For another device on the same Wi-Fi, use the LAN address shown in Club settings.

Five categories prefixed **Practice /** have been added beside your three existing categories. Your existing 12 entries and 12 fixtures are preserved. Existing entry labels now use player names. The practice pack adds 30 entries and 41 fixtures: five completed matches, three on-court matches, and upcoming league/knockout fixtures. There is no point-by-point scoring; enter scores only when a match finishes.

The screenshots below were taken in a separate test database, so their totals show only the practice pack. Testing did not change the practice matches loaded into your working dashboard.

## See both sides

**Organizer overview** ? court assignments, next calls, latest results, and controls to record a result.

![Organizer overview](output/playwright/practice-organizer.png)

**Venue screen** ? on-court opponents, four upcoming matches, three recent results, and full history. It updates automatically when organizers save changes.

![Venue screen](output/playwright/practice-venue.png)

**Final-result entry** ? a best-of-one semifinal; league examples use best-of-three and need two winning games.

![Final-result entry](output/playwright/practice-final-result.png)

More captured examples: [automatic player label](output/playwright/practice-player-entry.png), [delete confirmation](output/playwright/practice-delete.png), [knockout bracket](output/playwright/practice-bracket.png), [venue after a result](output/playwright/practice-venue-result.png), [1366 x 768 display](output/playwright/practice-venue-768.png).

## Try these cases

Use only Practice categories for destructive exercises. Start with the unused draft for entry/import testing, and delete it after those exercises.

| Case | What to do on the organizer side | Expected organizer behavior | Expected venue behavior |
| --- | --- | --- | --- |
| Practice overview | Open Overview; choose All tournaments. | Three practice matches occupy free courts; league and knockout fixtures are available. | On-court cards show player names and court numbers, without live points. |
| Automatic names | Tournaments > Practice / Unused draft > Manage teams > Add team. Enter Arun Kumar and Vijay Raj. | Preview and saved entry read `Arun Kumar - Vijay Raj`. No team-name field. | The same label appears when this entry has a fixture. |
| Edit players | Edit that entry and change a player before generating fixtures. | The entry label updates automatically. | Later fixtures use the updated label. |
| Spreadsheet import | Create a fresh doubles category and import [doubles.csv](examples/doubles.csv), or save that sheet as XLSX. | Preview four player-based labels and seeds; confirm once. No `team` column required. | Fixtures appear after generation. |
| Invalid import | Import the same rows again, or leave a required player missing. | A clear validation error; no partial import. | Nothing changes. |
| Start a match | Open an upcoming match, select a free court, then Start match. | Match moves on court; occupied courts cannot be selected. | New match appears automatically; it leaves the upcoming queue. |
| Invalid final result | Record result on a practice league match; try 21-20. | Error explains win-by-two. Match remains on court. | No new completed result appears. |
| Valid final result | On that match enter Game 1: 21-16, Add game, Game 2: 21-18, then Confirm final result. | Court becomes free; winner, final scores, and standings update. | Match leaves on-court cards and becomes the newest result without refreshing. |
| Match history | Open All results on the organizer, All match history on the venue. | All completed results can be searched/filtered. | History includes older results beyond the latest three. |
| Knockout advancement | Tournaments > Practice / Knockout rehearsal > Bracket. Start each semifinal on a free court and record 21-15. Then play the final. | Each semifinal winner fills its final slot automatically. The final cannot start until both opponents are known. Final winner becomes champion. | On-court and recent-result sections follow each semifinal/final. |
| Cancel deletion | Tournaments > Delete Practice / Unused draft > Cancel. | Confirmation shows the exact teams/fixtures/results affected; Cancel preserves them. | Category remains available. |
| Confirm deletion | Filter the venue to Practice / Unused draft, then delete that category from the organizer. | Category and associated entries/fixtures/results disappear. Other categories remain intact. | Deleted category disappears; its selected filter resets to All tournaments. |
| Delete on-court category | Try deleting a practice category that still has an on-court match. | Delete is disabled with an explanation; the server also rejects it. Finish the match first. | Match stays visible. |
| Simultaneous organizers | Open two organizer windows and make changes from both. | Changes synchronize; stale form revisions are rejected and latest data loaded for review. | Saved changes are reflected automatically. |
| Persistence | Refresh both windows; stop and restart the host server. | Saved categories, results, and deletions remain. | Screen reconnects and loads the saved state. |

For singles or 3v3 imports, use [singles.csv](examples/singles.csv) and [3v3.csv](examples/3v3.csv) in categories with the matching number of players per entry. Fixtures lock registration; reset only unplayed fixtures to reopen it.

## Verification performed

- `npm test`: **22 passing tests** covering round-robin draws, league-to-knockout progression, final-score validation, court/player conflicts, atomic imports, CSV/XLSX, automatic labels, deletion, practice-data preservation, revision conflicts, persistence, and migration.
- `npm run build`: passed. ExcelJS remains a large, separately loaded import bundle.
- Real-browser checks: loading the practice pack; manual player entry and automatic label; invalid and valid final results; automatic updates to a separate venue browser session; starting a knockout match and recording its result; cancellation and confirmation of draft deletion; automatic filter recovery after remote deletion; venue history; desktop display at 1920 x 1080 and 1366 x 768.
- Existing working data was checked by ID before and after loading practice: all three original categories, twelve entries, twelve fixtures, and their results were retained. Only entry labels were rebuilt from players.

## Flexible match calls

In **Matches**, the list now shows a global call number for every callable fixture. You can also open any upcoming match from Overview or the bracket to change its call position. Filters do not renumber calls. Planned times are only a guide; no fixture regeneration is needed to change the order.

| Case | Organizer action and expected result | Venue result |
| --- | --- | --- |
| Available players arrive | Find their match and click **Call next**. It becomes global call #1 even with a later planned time. | It becomes the first upcoming call immediately. |
| Reorder calls | Use the up/down arrows, or open a match and choose an exact call position. | Upcoming calls follow the same global order. |
| Players absent | Click **Hold**. Find the match again using Match status > On hold. | Match disappears from upcoming calls; its fixture is retained. |
| Players return | Click **Release**. It joins the end; use Call next if needed. | Appears when it reaches the visible next four calls. |
| Wrong match started | Before play begins, open the on-court match > Free court and put match on hold > Confirm. | Court card disappears, with no new completed result. |
| Resume a held match | Release it, assign a free court, and start it. | It becomes an on-court match. |
| Restore the original plan | Click **Use scheduled order**. Held matches remain held. | Eligible calls return to time/fixture order. |
| Filter a category | Filter Matches and the venue to the same category. | Global call numbers agree, even when there are gaps. |
| Restart host | Change call order and hold a match, then restart the server. | Saved order and holds remain after reconnection. |

The automatic tests cover queue ordering, holds/releases, invalid actions, conflict checks, return-to-hold, knockout eligibility, removal cleanup, persistence, and stale-revision rejection. Separate organizer/venue browser sessions verified reordering, hold/release, and freeing a court. Browser checks use an isolated database so your working tournaments are unchanged.

[Match call controls](output/playwright/flexible-calls.png) ? [Held matches](output/playwright/calls-on-hold.png) ? [Phone layout](output/playwright/calls-mobile.png)

## Finish testing

Delete practice categories individually after finishing their on-court matches. Confirmation removes that category's teams, fixtures, and results permanently. To load a fresh practice pack, remove all remaining Practice categories and choose **Tournaments > Load practice tournaments** again.
