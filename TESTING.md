# ShuttleHub testing walkthrough

Open the organizer at **http://localhost:3000** and the venue screen at **http://localhost:3000/display** in two windows. For another device on the same Wi-Fi, use the LAN address shown in Club settings.

For isolated practice, use a separate `DATA_DIR` when starting a test server. The sample pack is optional; no practice data is loaded automatically. Enter final scores only after a match finishes.

## Venue tournament board

Open `/display`. Use **Show N tournaments**, then choose a different category in each selector. Categories with unfinished fixtures are offered first. Existing finished categories can still be selected to view their results and champion. The browser remembers its own selection after refresh.

During league play, each selected tournament shows:

- Standings split by league group, with current qualifying places shaded. The normal table shows played, wins, game difference, and point difference. Dense layouts use wins/played and point difference.
- Upcoming calls in their organizer-controlled global order. Held matches and unknown knockout opponents stay out of the list. Active court numbers appear beside the tournament name.
- All completed results split into independent Group A, Group B, etc. lists, newest first. Each list keeps a bounded height and automatically cycles through older matches; there is no three-result data limit.

Once the organizer creates a category's knockout fixtures, only that category switches to its draw. **League standings + Qualification Playoffs + Knockouts** remain visible while qualification playoffs are unfinished; after the last playoff, only **Knockouts** remains. Direct qualification categories show only Knockouts as soon as the draw is created. Its separate upcoming/results sections disappear. League rankings remain unchanged by knockout results. The connected draw shows every round, final scores beside each opponent, highlighted winners, active courts, and placeholders naming the match that supplies an unknown opponent. The final stays centered between its feeder matches, including when long player names wrap. Completed tournaments retain the bracket and show their champion.

The Knockouts section scales every round into its available space without scrolling. Qualification Playoffs is a separate, automatically scrolling list, alongside Knockouts on desktop and above it on phones. It lists all group playoffs until the last one finishes, then disappears together with the league standings and the bracket expands to fill the panel. While playoffs remain unfinished, group tables stay in a bounded area above the draw; extra groups cycle automatically. The display uses rounded green scrollbars with a subtle striped grip for vertical and horizontal scrolling.

[Mixed league and knockout display](output/playwright/knockout-mixed-1080.png), [compact bracket](output/playwright/knockout-1-768.png), [16-qualifier draw](output/playwright/knockout-sixteen-768.png), [phone bracket](output/playwright/knockout-mobile.png), and [completed final](output/playwright/knockout-champion-1080.png). These screenshots use a separate test database.

Verification: all 45 automated tests and the production build pass. Browser checks covered mixed league/knockout categories, bracket creation and winner advancement through server updates, unchanged league tables, 1-4 categories at 1366 x 768, a 16-qualifier draw, phone overflow, scrollbar styling, and full-bracket fitting without scroll or pan. All test result entry used a separate database on port 3002; the working event was only viewed.

The compact header shows only the logo, title, and connection status. There is no clock, footer, or table legend. The screen offers tournament selection and fullscreen; organizer actions remain in the tournament desk.

Overflowing standings, results, and call lists scroll automatically, pause at the end, return to the beginning, and repeat. Manual touch, keyboard input, or scrolling pauses the movement for eight seconds before it resumes.

[Compact display](output/playwright/board-compact-header.png) and [mobile score entry](output/playwright/mobile-score-entry-blank.png).

The screenshots below use an isolated test database, not the working tournament data:

![Two tournaments together](output/playwright/board-two-1080.png)

[One tournament](output/playwright/board-one-1080.png), [three tournaments](output/playwright/board-three-1080.png), [compact 1366 x 768 view](output/playwright/board-three-768.png), [four tournament grid](output/playwright/board-four-1080.png), [older results scrolled](output/playwright/board-results-scrolled.png), [phone view](output/playwright/board-mobile.png).

| Case | Action | Expected display behavior |
| --- | --- | --- |
| One category | Show 1 tournament and select a category. | One board with that category's group tables, calls, and results. |
| Multiple categories | Show 2 or 3 tournaments and choose each category. | All selected categories appear together, each with separate data. Duplicate category selections are disabled. |
| More categories | Show 4 or more. | The layout becomes a grid. Larger selections scroll as needed to retain readable text. |
| Remember selection | Refresh the display. | The count and selected categories remain. |
| Older results | Complete more than three matches in each group and leave the display untouched. | Group lists scroll through every result, pause, return to the newest, and repeat. |
| New result | Record a final result from another organizer window. | Correct group standings and result list update without refreshing; the match leaves upcoming calls. |
| Opponent B wins | Enter a result where the second opponent wins. | The winner is named first and the score follows the winner's side. |
| Knockout transition | Create knockout fixtures while that category is visible. | Without refreshing, its league calls/results layout becomes the draw. Qualification playoff formats keep group standings until all playoffs finish; direct qualification shows the bracket alone. Other league categories retain their usual sections. |
| Advancing winners | Finish one semifinal, then the other, then the final. | Each winner fills the correct final slot; pending slots name their feeder match. Final scores stay beside the correct opponents, and the champion appears. League rankings do not change. |
| Bracket sizes | Try 2, 4, 8, and 16 qualifiers. | Draw starts at Final, Semifinal, Quarterfinal, or Round of 16 respectively, with ordered rounds and aligned connections. |
| Large draw | Show a large bracket in a narrow tournament panel. | Every card and connector fits inside the Knockouts section. Mouse wheel, touch and timers do not scroll the bracket; it shrinks when necessary. |
| Bracket spacing | View 1-4 categories at 1366 x 768, then on a phone. | Tables and bracket occupy separate areas with visible spacing. Overflow stays inside the relevant area; no horizontal page overflow. |
| Display scrollbars | Scroll standings, history, calls, qualification playoffs, and the tournament grid. | Green rounded rails and striped thumbs appear. The main knockout bracket has no scrollbar. |
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

- `npm test`: **45 passing tests** covering round-robin draws, league-to-knockout progression, final-score validation, court/player conflicts, atomic imports, CSV/XLSX, automatic labels, deletion, practice-data preservation, revision conflicts, persistence, and migration.
- `npm run build`: passed. ExcelJS remains a large, separately loaded import bundle.
- Real-browser checks: loading the practice pack; manual player entry and automatic label; invalid and valid final results; automatic updates to a separate venue browser session; starting a knockout match and recording its result; cancellation and confirmation of draft deletion; automatic filter recovery after remote deletion; and desktop display at 1920 x 1080 and 1366 x 768. New board checks cover one to five selections, saved preferences, independent result scrolling, repeated automatic loops, manual pause/resume, a compact display without clock/footer/legends, read-only controls, knockout/registration views, phone layout, automatic result updates, and mobile score entry.
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


## Qualification playoff formats

Create these only in a separate test database (`DATA_DIR`), or use the presets for a new real tournament when ready. Fixture generation requires exactly 10 Intermediate or 12 Beginner doubles entries. Existing tournaments are not converted automatically.

| Case | Action | Expected behavior |
| --- | --- | --- |
| Intermediate setup | Choose the Intermediate preset in New tournament. | 2 groups of 5; top 3 direct; 4th vs 5th plays for slot 4. League and playoffs use 15/golden point; main knockout uses 21/deuce/cap 30. |
| Beginner setup | Choose the Beginner preset. | 2 groups of 6; top 2 direct; 3rd vs 6th earns slot 3, 4th vs 5th earns slot 4. Both preliminary stages use 15/golden point. |
| Stage game counts | Select different best-of settings for league, playoff and main knockout, save and reopen setup. | Each setting persists independently and the match desk uses the appropriate stage's value. |
| Wrong entrant count | Try generating with 9 or 11 Intermediate entries, or 10/11/13 Beginner entries. | Clear exact-count error; no fixtures or group assignments are saved. |
| Incomplete league | Try creating playoffs before every league game finishes. | Action is disabled in the UI and rejected by the server. |
| Generate postseason | Finish the league, review standings, select Playoffs + bracket and confirm. | 2 Intermediate or 4 Beginner group playoffs plus 7 main knockout fixtures appear; 29 or 41 matches total including league. |
| Golden-point boundary | Save 15–14 in league/playoffs; try 16–14 or 21–19. | 15–14 succeeds; scores above 15 fail without finishing or advancing the match. |
| Deuce boundary | In a quarterfinal try 15–14, 21–20, then 22–20 or 30–29. | First two fail; the latter two succeed. |
| Upset winner | Let 5th beat 4th (Intermediate), or 6th beat 3rd (Beginner). | Winner earns A4/B4 or A3/B3 respectively; there is no reseeding. Loser is marked eliminated. League ranking, wins and differences remain unchanged. |
| Cross-group draw | Finish all qualification playoffs. | QFs are A1–B4, B2–A3, B1–A4, A2–B3. QF1/2 feed SF1; QF3/4 feed SF2. Winners advance through final. |
| Pending opponents | Try starting/calling a quarterfinal with an unknown playoff winner. | It cannot start or enter the calls. Ready fixtures remain flexible, including ones that need no playoff winner. |
| Hold/return | Hold a playoff, release it, or return an accidental start to hold. | Existing call controls work; no winner advances until a valid final result is saved. |
| Venue update | Keep both categories on display while creating playoffs and saving results elsewhere. | Each category switches independently. Group playoff cards have their own section, including their scoring rules. Named pending slots fill through server updates. Finishing one category's playoffs removes only its playoff section. |
| Display movement | Leave a narrow display unattended, then manually scroll. | The qualification playoff list scrolls through all its matches and repeats; manual interaction pauses then resumes movement. The main knockout bracket stays completely visible and stationary. |
| Persistence | Restart the test server after playoff results. | Scores, qualifying slots, feeder references and stage rules remain intact. |

Browser previews: [setup](output/playwright/playoff-setup-desktop.png), [mobile score entry](output/playwright/playoff-mobile-score.png), [organizer playoffs and bracket](output/playwright/playoff-organizer-bracket.png), [two categories on display](output/playwright/playoff-both-categories-1920.png), [phone display](output/playwright/playoff-both-categories-390.png). These use isolated QA data.

## Mobile final-score checks

| Case | Action | Expected behavior |
| --- | --- | --- |
| Blank start | Open an on-court match at phone width. | Fields show Score placeholders; no zero is prefilled. |
| Typing and clearing | Type 21, clear the field, then type again. | Field stays blank when cleared; no leading zero is forced back in. |
| Visible arrows | Tap the up/down controls beside each field. | Visible buttons change the correct score and stay between zero and the configured cap. |
| Missing score | Enter one score, leave its opponent blank, and confirm. | Required-score error; blank does not become zero. |
| Explicit zero | Enter 21 and 0, then confirm a best-of-one result. | Numeric result 21-0 is saved successfully. |
| More games | In a best-of-three match, add another game. | Both new fields start blank and require explicit scores. |


## Edit groups after fixtures

Open **Tournaments > Edit groups**, or **Teams & players > select a tournament > Edit groups**. You can also select **Change group** beside any assigned team; this preselects that team and works with All tournaments selected. Pick a team from another group, review the destinations, and select **Swap teams**. Repeat as needed. Swapping preserves each group's existing capacity, including balanced groups of unequal sizes in standard formats. After an app update, refresh the browser to load the new controls; HTML pages use `Cache-Control: no-store`.

| Case | Action | Expected result |
| --- | --- | --- |
| Intermediate / Beginner | Swap two teams across groups after generation. | Still 5/5 or 6/6; updated group rosters and round-robin opponents appear immediately. Every pair in each revised group plays exactly once. |
| Calls and holds | Set planned times, move a call and hold a match before swapping. | Fixture IDs, times, holds and call positions survive; only the swapped teams' opponents change. |
| On-court player | Open the editor while a match is on court. | Its participants cannot be selected. Other teams can swap. Returning the match to waiting makes its participants eligible again. |
| First completed match | Keep the editor open on one device and complete the tournament's first match on another. | Editor controls and both Edit groups entry points disable immediately. Server rejects further swaps. |
| Independent categories | Complete a match in another tournament. | The untouched category's group editor remains available. |
| Invalid swap | Try the same group, an unknown team, or a team from another category through the API. | Request rejected without partial changes. |
| Phone | Open the editor at 390px, select two teams and swap. | All names, counts, selectors and actions remain accessible without horizontal page overflow. |
| Separate postseason sections | Show two categories with unfinished playoffs. | Each has standings, Qualification Playoffs and Knockouts. Playoff lists cycle independently; all main bracket cards fit without scrolling. |
| Last playoff | Complete playoffs one by one from another device. | Standings and playoffs remain after partial completion; both disappear after that category's last playoff. Its bracket fills the panel; other categories retain their own unfinished playoffs and standings. |

Latest verification: 45 automated tests pass and production build passes (existing ExcelJS bundle-size warning). Isolated browser checks cover desktop/mobile group swaps, fixed counts, persisted changes, on-court restrictions, locking an already-open editor after a remote result, both disabled entry points, 1-4 tournament selections at 1920/1366px, phone layout, a 16-qualifier draw, playoff auto-scrolling, independent section removal and bracket expansion. No test entries were added to the working database.

Previews: [group editor](output/playwright/group-editor-desktop.png), [separate playoff and knockout sections](output/playwright/group-layout-1920-2.png), [after playoffs finish](output/playwright/playoffs-finished-fit.png).


## Venue readability and knockout-only view

- Player names, final scores, headings, group labels, tournament selectors and supporting text are larger across desktop and mobile layouts. Main league names/results/calls use 20px or larger at 1920px with two tournaments. Bracket names scale with the full draw (approximately 22px for two quarterfinal draws at 1920 x 1080).
- Complete all but one qualification playoff: league standings must remain visible. Complete the last playoff from another organizer window: both league standings and Qualification Playoffs disappear without refreshing. Knockouts fills the remaining panel and stays fully visible without a scrollbar.
- Show two categories in different phases: finishing one category's playoffs must not hide the other category's standings. Completed league results and standings remain available in the organizer.
- For direct qualification, creating the knockout draw immediately switches that category to its bracket alone.

Verified with all 45 automated tests, the production build, and isolated browser checks at 1920 x 1080, 1366 x 768 and 390px phone width. Checks cover one to four selected categories, a 16-qualifier draw, automatic phase changes, and all bracket cards/connectors fitting their panels.

Updated previews: [larger league and playoff text](output/playwright/readability-mixed-1920.png), [knockouts only](output/playwright/readability-knockouts-1920.png), [compact venue display](output/playwright/readability-1366-2.png).
