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
| One category | Show 1 tournament and select a category. | One board with that category's group tables, upcoming games, and results. |
| Multiple categories | Show 2 or 3 tournaments and choose each category. | All selected categories appear together, each with separate data. Duplicate category selections are disabled. |
| More categories | Show 4 or more. | The layout becomes a grid. Larger selections scroll as needed to retain readable text. |
| Remember selection | Refresh the display. | The count and selected categories remain. |
| Older results | Complete more than three matches in each group and leave the display untouched. | Group lists scroll through every result, pause, return to the newest, and repeat. |
| New result | Record a final result from another organizer window. | Correct group standings and result list update without refreshing; the match leaves upcoming games. |
| Opponent B wins | Enter a result where the second opponent wins. | The winner is named first and the score follows the winner's side. |
| Knockout transition | Create knockout fixtures while that category is visible. | Without refreshing, its league upcoming/results layout becomes the draw. Qualification playoff formats keep group standings until all playoffs finish; direct qualification shows the bracket alone. Other league categories retain their usual sections. |
| Advancing winners | Finish one semifinal, then the other, then the final. | Each winner fills the correct final slot; pending slots name their feeder match. Final scores stay beside the correct opponents, and the champion appears. League rankings do not change. |
| Bracket sizes | Try 2, 4, 8, and 16 qualifiers. | Draw starts at Final, Semifinal, Quarterfinal, or Round of 16 respectively, with ordered rounds and aligned connections. |
| Large draw | Show a large bracket in a narrow tournament panel. | Every card and connector fits inside the Knockouts section. Mouse wheel, touch and timers do not scroll the bracket; it shrinks when necessary. |
| Bracket spacing | View 1-4 categories at 1366 x 768, then on a phone. | Tables and bracket occupy separate areas with visible spacing. Overflow stays inside the relevant area; no horizontal page overflow. |
| Display scrollbars | Scroll standings, history, upcoming games, qualification playoffs, and the tournament grid. | Green rounded rails and striped thumbs appear. The main knockout bracket has no scrollbar. |
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

- `npm test`: **52 passing tests** covering round-robin draws, league-to-knockout progression, final-score validation, court/player conflicts, atomic imports, CSV/XLSX, automatic labels, deletion, practice-data preservation, revision conflicts, persistence, and migration.
- `npm run build`: passed. ExcelJS remains a large, separately loaded import bundle.
- Real-browser checks: loading the practice pack; manual player entry and automatic label; invalid and valid final results; automatic updates to a separate venue browser session; starting a knockout match and recording its result; cancellation and confirmation of draft deletion; automatic filter recovery after remote deletion; and desktop display at 1920 x 1080 and 1366 x 768. New board checks cover one to five selections, saved preferences, independent result scrolling, repeated automatic loops, manual pause/resume, a compact display without clock/footer/legends, read-only controls, knockout/registration views, phone layout, automatic result updates, and mobile score entry.
- Venue board unit checks cover exact and distinct selections, deletion recovery, complete grouped results, empty states, knockout separation, standings, winner score ordering, and ongoing category priority.

## Direct game starts and next-stage navigation

Calls, reordering, and holds have been removed. Ready games appear in fixture order for browsing; any may start when its teams and a court are available.

| Case | Action | Expected behavior |
| --- | --- | --- |
| Start any fixture | Open Matches, choose any **Start game**, select a court and start. | The game moves on court across devices and leaves Up next. No call number is displayed. |
| Legacy saved event | Load an event with hold flags and manual call order. | These fields are removed; all ready upcoming fixtures reappear. Teams, groups, scores, fixture IDs and active courts are preserved. |
| Accidental start | Open an on-court game, choose **Undo start and free court**, confirm. | The court is freed and the game immediately returns to upcoming. Standings stay unchanged. |
| Court/player conflict | Try starting on an occupied court, or with a player already competing. | Server rejects the start. Unknown opponents also prevent starting. |
| Final league result | Record the category's last league result. | A group-by-group qualification review opens with the next-stage creation action. No trip to Tournaments is required. |
| Cancel review | Close the review, then visit Overview, Matches or Standings. | The creation action remains available until a draw exists. |
| Another device finishes league | Record the last result from a second organizer device. | Next-stage actions appear automatically in the first device. Other categories retain their own stage. |
| Create next stage | Confirm **Create playoffs + bracket** or **Create knockouts**. | That category opens in Matches filtered to playoffs/knockouts. Duplicate creation is prevented. |
| Switch views | Choose **Standings & bracket**, then **Manage games**. | The tournament selection stays in place. Match stage can switch back to League or All stages. |
| Phone | Open a ready match at 390px width. | Court selection and Start game are accessible; no call/hold controls or horizontal page overflow. |

Verified with 52 automated tests and isolated browser checks for Intermediate, Beginner and direct qualification, including result entry, undo start, legacy migration, cross-device venue updates, all three next-stage entry points and mobile controls. Build passes with the existing ExcelJS size warning.

Previews: [upcoming games without numbers](output/playwright/games-upcoming-no-calls.png), [league completion review](output/playwright/league-complete-review.png), [postseason matches](output/playwright/postseason-direct-start.png), [mobile start](output/playwright/mobile-start-game.png).

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
| Pending opponents | Try starting a knockout with an unknown playoff winner. | Start game is disabled until both opponents are known. Ready fixtures remain flexible. |
| Undo start | Return an accidentally started playoff to upcoming. | It is immediately available to start again; no winner advances until a valid final result is saved. |
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
| Fixture metadata | Set planned times before swapping. | Fixture IDs and times survive; only the swapped teams' opponents change. |
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

- Player names, final scores, headings, group labels, tournament selectors and supporting text are larger across desktop and mobile layouts. Main league names/results/upcoming games use 20px or larger at 1920px with two tournaments. Bracket names scale with the full draw (approximately 22px for two quarterfinal draws at 1920 x 1080).
- Complete all but one qualification playoff: league standings must remain visible. Complete the last playoff from another organizer window: both league standings and Qualification Playoffs disappear without refreshing. Knockouts fills the remaining panel and stays fully visible without a scrollbar.
- Show two categories in different phases: finishing one category's playoffs must not hide the other category's standings. Completed league results and standings remain available in the organizer.
- For direct qualification, creating the knockout draw immediately switches that category to its bracket alone.

Verified with all 45 automated tests, the production build, and isolated browser checks at 1920 x 1080, 1366 x 768 and 390px phone width. Checks cover one to four selected categories, a 16-qualifier draw, automatic phase changes, and all bracket cards/connectors fitting their panels.

Updated previews: [larger league and playoff text](output/playwright/readability-mixed-1920.png), [knockouts only](output/playwright/readability-knockouts-1920.png), [compact venue display](output/playwright/readability-1366-2.png).


## Custom group counts and display layout

Both playoff formats accept **any whole group count from 1 to 256** in Format & scoring. Existing presets start at two groups. Intermediate keeps five teams per group; Beginner keeps six. Four teams qualify from each group, with automatic byes filling the next power-of-two main draw when needed.

- Switch between both qualification formats and all four group counts. Verify the required entries, total match count and starting round against the README table. Save and reopen the tournament; the chosen count must persist. Changing qualification format must preserve the selected group count.
- Generate fixtures with exactly the required entries; one too few or too many must fail without partial fixtures. Every group must contain its fixed number of teams and every league pair must meet once.
- Complete league games and create the draw. Every group must have its playoff matches in organizer Standings and on the venue screen. Lower-ranked playoff winners must reach the correct named slots without changing league rankings. Qualifier totals must use 4 times the group count, including 32 for eight groups.
- Complete the entire draw through a champion. One-group semifinals are 1st vs 4th and 2nd vs 3rd; multiple-group opening matches pair different groups. Round of 32 must feed Round of 16, quarterfinals, semifinals and final.
- Display theme rollback: the original soft green qualification shading, amber playoff shading, court badges, result scores, champion styling and striped green scrollbar are restored. Custom group counts, responsive tables and large-draw fitting remain available.
- At 1920 x 1080 and 1366 x 768, select one and two tournaments. Four/eight group tables wrap into readable columns and automatically cycle. A 32-team draw retains all 31 matches and fits without scrolling. At 390px, check that the page has no horizontal overflow. Large draws scale down; fullscreen with one tournament gives the clearest view on a 24-inch monitor.

Verified: **53 automated tests pass**, including eight full progression tests covering both formats at every group count. Production build passes with the existing ExcelJS bundle-size warning. Isolated browser checks covered form options/previews/scoring/persistence, all eight playoff groups, qualifier totals, 31-card bracket fitting, desktop/mobile layouts, and the previous highlight styling (subsequently reverted at user request). All QA used a separate database.

Previews from before the theme rollback: [group setup](output/playwright/custom-groups-setup.png), [league highlights](output/playwright/monitor-league-1920.png), [mixed tournament phases](output/playwright/monitor-mixed-1920.png), [32-team draw](output/playwright/monitor-32-draw-1920.png).


## Player corrections, result corrections, and arbitrary groups

- In **Matches**, use **Testing: complete unfinished matches**. Cancel once and verify nothing changes, then confirm. Only the selected tournament should complete; **All tournaments** should complete every existing unfinished fixture. Check valid stage scores, freed courts, unchanged completed results, and automatically filled knockout rounds. Create the next stage normally and use the button again to reach a champion. Restart with `DISABLE_TEST_TOOLS=1`; the button must disappear and a direct `randomComplete` API request must return 403. Automated coverage is in `tests/random.test.js`.

- Generate fixtures, then use **Teams & players > Edit players** before a match, while on court, and after recording results. Names and entry labels should update everywhere; seeds are disabled and Remove team is hidden. Completed finals lock names. Duplicate names and edits introducing simultaneous player appearances must fail without saving partial changes.
- Open a completed game using **Edit result**. Scores must be prefilled, including zeroes. Save stays disabled until the correction checkbox is checked. Correct points without changing the winner: later knockout results should remain. Change a knockout winner: the affected later games return to upcoming, scores disappear, their courts are freed, and a stale champion disappears. Finish the updated final and correct its winner; the champion should update.
- Correct a league score after drawing the knockouts: standings and qualification slots must reflect all corrected league results. In playoff formats, also verify the playoff opponents and the named winner slots. Unaffected results and fixture IDs should stay saved. Refresh both organizer and venue to verify persistence.
- Enter 3, 5, 6, or 37 groups directly. With 200 teams / 37 groups / 2 qualifiers, expect 15 groups of six and 22 of five, 445 league games, 74 qualifiers, a Round of 128 bracket, 54 automatic byes, and 73 played knockout games. Groups after Z must read AA through AK. Ready games can start; byes advance automatically and never request scores.
- Try 200 teams / 40 Intermediate groups: expect 400 league games, 40 qualification playoffs, 160 qualifiers, 96 byes, and 159 played knockout games. Beginner still requires exactly six teams per group. Invalid, fractional, or empty group counts and insufficient registrations must be rejected.

Automated regression coverage: `tests/corrections.test.js`, including complete 200-team tournaments, corrections through the final, persistence round trips, atomic name validation, and cross-category court conflicts.

## Frontend migration and venue layouts (20 October 2026)

Validated with **85 passing tests** (`npm test`) and a successful production build (`npm run build`). The build retains the existing size warning for the lazy-loaded ExcelJS import chunk; the venue grid is also lazy-loaded. Startup commands and the backend/API contract are unchanged.

New automated coverage in `tests/frontend-stores.test.js` verifies:

- Monotonic snapshot/action revisions, stale-form conflicts, and refresh ordering.
- One shared SSE subscription, reference-counted cleanup, reconnect races, browser offline/online events, and removal of network listeners.
- Legacy selection migration, versioned persistence, independent selection/breakpoint layouts, draft Save/Cancel/Reset, and failed storage saves retaining the draft.
- Corrupt storage, invalid sizes/coordinates, deleted/new panel IDs, overlap recovery, and empty-event recovery without render loops.

Browser checks used a separate database at `output/migration-qa-data` on port 3110; the real `data/` directory was not used. Chromium checks included:

- Tournament creation with three groups; CSV import preview/save; manual registration/removal; player-name correction during a tournament; group swaps; fixture generation/reset; optional scheduling; start/undo-start; final scores and completed-result corrections.
- Practice-pack loading, temporary random completion, knockout creation/byes, completed brackets, settings, and category deletion. Two organizer pages confirmed a stale save reports a conflict while retaining typed player names.
- Venue pointer dragging/resizing, keyboard reordering and sequential numeric entry, selection locking, Save/Cancel/Reset, refresh persistence, returning to a previous selection, fullscreen, and selected-category deletion while editing.
- Storage quota failure displays an error and retains the draft. Automatic list scrolling pauses during editing. Completing playoffs removes their list and league standings while keeping the measured bracket.
- Organizer pages at 390px, 820px, and 1440px widths; venue panels at 390 × 844, 820 × 1180, 1920 × 1080, and 3840 × 2160. Four selected categories retain two columns; panel rectangles and editor controls were checked for overlap/overflow. Long names and a 200-team / 37-group draw were included.
- The production app loads through the host's LAN address with external requests blocked. Browser offline/online transitions update the connection indicator and recover with one SSE subscription. Engine/API tests also cover server restart persistence and concurrent revisions.

Screenshots and browser scripts are local, ignored artifacts under `output/playwright/`, including `final-venue-phone.png`, `final-venue-tablet.png`, `final-venue-1080.png`, `final-venue-4k.png`, `final-venue-four.png`, `large-league-*.png`, `large-bracket-*.png`, and `organizer-*.png`.

These were browser viewport and host-LAN checks, not a physical TV/multi-device venue rehearsal. The widget revision below replaces the earlier full-bracket shrinking behavior.

## Individual venue widgets and organizer routes (20 October 2026)

Validated with **92 passing tests**, a successful production build, and no Chromium console errors. The existing lazy ExcelJS chunk-size warning remains. QA reused the isolated `output/migration-qa-data` database; production tournament data was not changed.

New coverage in `tests/venue-widgets-navigation.test.js` checks:

- Automatic widget visibility through tournament phases and explicit Show/Hide overrides after the final.
- Version 1 panel-layout migration into version 2 preferences; widget Save/Cancel/Reset, refresh restoration, hidden-widget size retention, and storage failures.
- Invalid widget coordinates/sizes, collision recovery, responsive bounds, and keyboard reordering/resizing.
- URL encoding/parsing, deep links, search replacement without extra history entries, browser history restoration, and navigation-listener cleanup.

Production-browser checks:

- Pencil and fullscreen share the existing toolbar; the match search has one outer border and no inner border.
- Widget pointer dragging/resizing and keyboard resizing; inner edits do not move or resize the tournament panel.
- Hide, restore, Save, Cancel, Reset, refresh, selection locking, and returning to a previously selected tournament.
- Standings, results, and completed playoffs remain visible alongside knockouts when set to Always show.
- One automatic scrolling surface per widget; no nested or whole-board automatic scrolling. Pause/play and edit-mode suspension verified.
- Phone 390 × 844, tablet 820 × 1180, 1080p, and 4K, in viewing and editing modes. Checked two and four categories, long player names, all 127 bracket cards in the 200-team/37-group draw, widget minimum widths, overlap, and horizontal overflow. Breakpoint changes remount the grid to avoid carrying incompatible column sizes between breakpoints.
- Direct organizer URLs, all navigation links, refresh and Back/Forward with tournament/search/status filters, match-history navigation with a live-match filter, and unknown-page recovery.
- Mobile organizer navigation and search, plus long-name wrapping in venue standings.

The current display keeps large-bracket text readable and allows scrolling through the draw. Its outer screen and panel containers scroll manually; only widget contents cycle automatically. Automatic phase visibility remains the default and can be overridden per widget. This supersedes earlier notes about always hiding standings after playoffs, fitting the entire bracket without scrolling, and striped scrollbars.

Local scripts and screenshots are under ignored `output/playwright/`: `widgets-check.js`, `widgets-responsive.js`, `widgets-scroll.js`, `routes-check.js`, `history-check.js`, `widgets-1080.png`, `widgets-4k.png`, `widgets-edit-phone.png`, `widgets-overrides.png`, and `navigation-matches-desktop.png`.
