# ShuttleHub UI/UX audit and upgrade plan

**Implementation update (22 October 2026):** the UI upgrade is implemented as one integrated change. See [the implementation record, verification results and application screenshots](IMPLEMENTATION.md).

**Review date:** 21 October 2026 (Asia/Calcutta)  
**Scope:** presentation, navigation, responsiveness, accessibility and interaction feedback only.  
**Decision:** retain the existing workflows, role permissions, scoring interactions, tournament engine, API contracts and data model. No assignment feature, new backend capability, automatic scheduling, new scoring mode or broad production rewrite is proposed.

Open [the annotated visual review and mockups](design-review.html). The [evidence index](EVIDENCE.md) links the captured screens and documents inspection coverage. All names and results in these artifacts are repository practice data or isolated audit fixtures.

## 1. Assessment

ShuttleHub needs a more coherent **operations interface**, with its strongest visual emphasis on the match, court, state and next available action. It already has a recognizable navy/green foundation, a working responsive scorer, reusable controls, URL-backed navigation, sensible conflict handling and good result-confirmation safeguards. These should survive the redesign.

The principal problem is inconsistent allocation of attention. The organizer shell spends considerable space on branding and global creation actions. Tables prioritize compactness over readable metadata. The umpire shell inherits styles intended for the dark sidebar and duplicates live matches above its search. The result is a visually sparse interface that still requires excessive scanning and scrolling.

This is **not a finding that every phone screen overflows**. The examined pages mostly fit the viewport, and match rows already turn into cards below 700 px. However, actions are poorly positioned, navigation is faint, intermediate widths retain oversized tables, and long lists have little orientation. Responsiveness must be judged by whether staff can complete their work comfortably, not just by document width.

### Strong existing behavior to retain

- The scorer has large opposing point buttons, tabular scores, Undo, Pause, Swap sides, explicit claim and final confirmation, persistent pending work, and distinct offline/sync messages.
- Native links and `PageLink` support URL navigation. Category, match query, status and stage already serialize into URLs. Browser history is already connected to Zustand.
- Radix dialogs trap focus, dismiss with Escape and restore trigger focus; this was checked in a match dialog.
- Imports preview entries before saving and validate atomically. Result corrections explain their downstream effects and require confirmation. Blank scores are rejected rather than silently interpreted as zero.
- Stage actions are available beyond the original final-league-result dialog. Venue display already provides pause, fullscreen, layout editing and accessible keyboard alternatives.

## 2. What the product actually does

### Facts from code and rendered application

**Sport and structure.** This is a badminton tournament desk. A cloud owner has one event containing multiple categories called “tournaments” in the UI. Presets include singles, doubles, mixed and 3v3; custom team sizes exist. Team labels derive from player names. Group round robin leads to optional qualification playoffs and a knockout bracket. Do not invent event calendars, player check-in, referee rosters, billing or sports analytics.

**Time and readiness.** Scheduling stores an optional time of day, not a calendar or duration-based plan. Upcoming fixtures retain their browsing order. A scheduled time does not enforce a start order. Opponents, occupied courts and player conflicts remain governed by existing validation. A UI layout must not imply automatic allocation, estimated start times or a new queue priority.

**Scoring and advancement.** Stage-specific best-of/points/finish rules exist. Final results drive standings and release courts. Cloud point scoring is additional to the final-score editor. League ranking is wins → game difference → point difference → seed. Corrections can reopen dependent games. The README's long local-mode section is not a description of cloud scoring: the cloud staff guide and implementation are authoritative for this audit.

**Roles.** There is no separate role named `admin`. `useDesk().admin` means owner or organizer; `/maintainer` is a separate provisioning surface. Every umpire can manage event matches, including scheduling, starting, final results, corrections and knockout creation. Assignments exist internally but are not supplied to the umpire snapshot or exposed as its current workflow. Following the user's clarification, **do not add “Assigned to me,” “My scoring,” or an assignment API**. Keep All matches and the current saved-work recovery section.

| Role | Existing destinations and responsibilities | Design priority |
|---|---|---|
| Owner | Overview, Tournaments, Teams, Matches, History, Standings, Settings, Display; primary recovery and empty-event import | Run the venue; distinguish event operations from access/recovery controls |
| Additional organizer | Same operational pages; primary-owner-only controls remain restricted | Consistent shell, fast court/match access, contextual category actions |
| Umpire | `/matches`, `/matches/history`, `/standings`; scorer and match dialogs | Find the correct match, see court/opponents, start or score, safely return |
| Display | `/display`, scoped by screen preset; tournament data is read-only | Distance readability, freshness and continuity; retain layout editor behavior |
| Maintainer | `/maintainer`, secret unlock, primary-organizer setup/restoration and browser locking | Clear identity and consequences; visibly separate from event management |
| No session | Private-link entry/error; owner recovery-link acknowledgement after redemption | Explain the current state and next step without introducing a login form |

### Lifecycle priorities

| Phase | Staff must understand | Appropriate visual emphasis |
|---|---|---|
| Before play | Category format, teams/seeds, group membership, independent scoring rules, readiness to generate fixtures | Setup card with existing next action; compact rules summary and visible lock explanations |
| During league | On-court identity, free courts, upcoming opponents, planned time, score/sync state | Court and match information above decorative headings; prominent Open scorer / Start game |
| Between stages | Whether league results are complete, qualification ranking, consequence of creating the draw | Existing qualification review as a clear decision panel; maintain all confirmation steps |
| During knockout | Stage, known/unknown opponents, current match, corrected-result consequences | Legible round headings, explicit awaiting-opponent state, accessible return to Matches |
| After final | Winner, completed scores, history, corrections and backup | Completed state and history remain easy to reach; do not turn the desk into a decorative analytics page |

**Assumptions:** desktop operators monitor several courts; phone umpires need fast, readable controls under time pressure, consistent with the user's description. Actual event size, phone models, venue lighting and assistive-technology usage were not supplied. Recommendations cover the existing data range without inventing additional operational rules.

### Architecture and ownership

| Layer | Actual repository paths | Implication |
|---|---|---|
| React 19 / JSX + Vite | `src/main.jsx`, `src/App.jsx`, `vite.config.js` | Keep JavaScript and the current application structure |
| State/navigation | `src/stores/organizer.js`, `src/stores/tournament.js`, `src/hooks/useDesk.jsx`, `src/lib/navigation.js`, `src/components/PageLink.jsx` | Retain URL/filter semantics, revision handling and live subscription lifecycle |
| Design primitives | `src/theme.css`, `src/components/ui/*` | Tailwind 4, owned shadcn/Radix controls, Lucide and Sonner already cover requirements |
| Layout CSS | `src/styles/organizer.css`, `src/cloud/cloud.css`, `src/tournament-format.css`, `src/group-editor.css` | Broad selectors and repeated overrides require scoped consolidation, with visual regression checks |
| Reused operations | `src/components/{SearchField,MatchTable,MatchCard,StageActions,common}.jsx`, `src/forms/*` | Fix shared presentation once, then verify both role shells |
| Cloud surfaces | `src/cloud/{CloudGate,Umpire,Scorer,AccessPanel,Maintainer}.jsx` | Apply the same tokens without merging authorization or scorer state machines |
| Venue | `src/VenueBoard.jsx`, `src/VenueBracket.jsx`, `src/components/VenueGrid.jsx`, venue CSS/stores | Preserve the specialized grid, measured bracket and saved layout contracts |
| Protected logic | `server/engine.js`, `shared/*`, `cloud/{worker,event,security}.js`, cloud storage/connection modules | No planned edits to rules, reducer, authorization, persistence or API payloads |

No `AGENTS.md` was found in the repository or its workspace parent. Setup followed `docs/CLOUD_SETUP.md`; existing Node 24 and installed dependencies were used. The cloud build succeeded. Wrangler ran locally on port 8799 with all bindings local and fresh persistence at `output/ux-audit/runtime`. Existing `.env` contents were not printed or included in artifacts; no deployment or real-record changes were made.

## 3. Prioritized findings

Severity means task impact: **High** materially obstructs or confuses a frequent operation; **Medium** adds friction or weakens understanding; **Low** is polish. It does not imply broken tournament logic.

| ID / priority | Observed issue and impact | Role / device | Fix and affected paths |
|---|---|---|---|
| U01 · High | At 768 px the organizer table extends from x≈221 to x≈1086; actions start at x≈846. They are available through internal scrolling but outside the initial view. Teams similarly hide group/actions on phones. [Evidence](evidence/owner-matches-tablet.png) | Organizer, umpire / tablet; Teams on phone | Use content-width-based match/team cards below a usable table width, including 768 px. Keep every existing action visible in its card. `MatchTable.jsx`, `Teams.jsx`, organizer CSS, table primitive |
| U02 · High | Umpire nav uses `#A6BCC6` on `#F3F6F4`, about 1.8:1 contrast, and has no `aria-current`. Global `nav` rules leak dark-shell styling. [Evidence](evidence/umpire-matches-small-mobile-viewport.png) | Umpire / all | Scope sidebar styles; add role-specific nav active/focus states and full text labels. `Umpire.jsx`, organizer/cloud CSS |
| U03 · High | Three live shortcuts precede search; at 360 px search begins around y=472, table at y=617 and first row actions at y=800. Organizer first row actions begin around y=1056. [Evidence](evidence/umpire-matches-small-mobile-viewport.png) | All operators / phone | Compact page header; put find/filter controls first; use the existing on-court status view and row actions as the main list. Preserve shortcuts as a compact collapsible section, not another long match list. `Matches.jsx`, shells |
| U04 · High | No-result search says “No matches here yet” and tells an umpire to add teams/generate fixtures. Existing records are present. Live shortcuts remain visible despite the query, further confusing scope. [Evidence](evidence/umpire-no-results-360.png) | All / all | Distinguish no fixtures, no results and no filtered matches. Display result count, query and Clear search / Reset filters. Label shortcuts explicitly as all on-court matches in the selected category. `Matches.jsx`, `MatchTable.jsx`, `Teams.jsx`, `common.jsx` |
| U05 · High | Claim screen shows court/category/short ID but no opponent names; status already says “Playing” before this device claims. [Evidence](evidence/scorer-unclaimed-390.png) | Umpire / phone | Before the unchanged Claim action, render opponents and existing match/rules information; separate match status from this device's control state. Change presentation only. `Scorer.jsx`, cloud CSS |
| U06 · Medium | Search wrapper is ~33.5 px tall; input ~31.5 px. Mobile font observed at 14 px. Control rows mix sizes, and search has no persistent visible label. | All / touch | 44 px minimum controls, 48 px primary phone actions, 16 px mobile form text, visible Search players label. Reuse current controlled input and clear/focus behavior. `SearchField.jsx`, UI input/button/select, CSS |
| U07 · Medium | Mobile main navigation is a horizontally scrolling strip. Destinations disappear off-screen; logo/header/actions consume much of the first viewport. [Evidence](evidence/owner-matches-mobile.png) | Organizer / phone | Bottom navigation for Overview, Matches, Standings, More; More contains existing setup/settings/display destinations. Maintain all routes and permissions. `App.jsx`, `PageLink.jsx`, CSS |
| U08 · Medium | Desktop logo is inside a 143 px-high white block; event name truncates while multiple brand captions repeat. [Evidence](evidence/owner-overview-desktop.png) | Organizer / all | Compact aligned brand row and a separate wrapping event label. Retain the actual JPG; contain it in a small neutral tile. Remove redundant brand slogans. `common.jsx`, `App.jsx`, CSS |
| U09 · Medium | Page headings use very large uppercase type (49 px on phone), while metadata often uses 9–11 px. New tournament and Venue display recur on unrelated task pages. | Organizer / all | Sentence-case 30/26 px headings, 13 px secondary text, 14–16 px content. Emphasize contextual actions; keep New tournament in Tournaments/creation entry points and Display in shell utility navigation. Existing workflows remain available. |
| U10 · Medium | Club settings places venue fields beside a very long access column containing invitations, controller release/restart, presets, revocation, reconciliation and backup. [Evidence](evidence/owner-settings-desktop.png) | Owner/organizer / all | In-page section navigation with readable full-width sections; separate destructive controls visually and preserve existing confirmations. Avoid hiding urgent reconciliation work. `SettingsPage.jsx`, `AccessPanel.jsx` |
| U11 · Medium | Disabled category/group/knockout actions often rely on `title`, which is poorly discoverable on phones. Some stage rules are small and dense. | Organizer / touch | Render existing lock reasons as helper text next to action groups; show the stage summary before editable detail. Do not alter enable/disable conditions. `Tournaments.jsx`, `Teams.jsx`, format/scoring forms |
| U12 · Medium | Long forms scroll as one dialog; heading and final action can leave view. Score errors appear at the end. [Evidence](evidence/blank-score-error-390.png) | All / phone and keyboard | Sticky dialog title/footer around one scroll body; field-associated error text plus existing alert summary. Keep typed values and conflict revision handling. `common.jsx`, UI dialog, forms |
| U13 · Medium | Scorer replaces the application view without a new URL. Its Matches button closes local state. Filters survived the inspected return, but reload does not represent an open scorer and the page lacks an explicit match breadcrumb. | All scorers / all | Retain scorer invocation. Improve the visible return label/context and restore list focus/scroll to its trigger. Treat browser Back as a documented current limitation; route-based scorer changes are not included in this UI plan. |
| U14 · Medium | Live, upcoming, completed, bye and pending score states do not have a consistent visual language. Overview live cards emphasize court but do not present the cloud point record like the display does. | All / all | Standard state badge tokens with text/icons; style the current data only. Avoid calling a match score “live” solely because it is on court. Scorer/venue freshness must remain distinct from match status. |
| U15 · Medium | Standings can become a very long multi-category page; bracket lies far below tables. Abbreviations and qualification meaning require reading small notes. [Evidence](evidence/owner-standings-desktop.png) | Organizer/umpire / phone | Keep category selector visible; add in-page anchors for existing groups/playoffs/bracket sections; define P/W/L/GD/PD accessibly; retain group order and ranking. `Standings.jsx`, `MatchCard.jsx` |
| U16 · Medium | 42 fixture rows form an approximately 11,000 px phone list; no result count or persistent filter context. There is no existing user-controlled sort or pagination. | All / long lists | Result count, compact cards, labelled sections and sticky filter summary. Keep existing complete list and sorting in this phase; do not silently introduce pagination, virtualized rows or bulk mutation. |
| U17 · Medium | Generic connection status can coexist with confirmed result state after a simulated connection interruption. It refers to stream connectivity while result acceptance succeeded. [Evidence](evidence/scorer-result-confirmed-390.png) | Umpire / reconnecting | Lay out connectivity, pending work and authoritative result as separate labelled facts using current signals. Do not change retry or controller logic, or suppress a real disconnect. |
| U18 · Low | Feedback exists (toasts, dialog transitions, button colors) but there is no app-authored reduced-motion rule; copy success is silent on the recovery page. | All / keyboard, reduced motion | Standardize restrained feedback; announce copy outcome; respect reduced motion for new effects. Preserve manual pause on display and add a preference-aware default without removing control. |
| U19 · Medium | Additional-organizer Settings renders revoke controls for the primary owner, although `cloud/event.js` rejects that operation for this role. This is a misleading affordance, not evidence of an authorization bypass. | Additional organizer / all | Hide or disable only the already-forbidden owner-revocation controls, with an explanation. Keep server guards and all legitimate organizer actions unchanged. `AccessPanel.jsx` |

**Search diagnosis:** the current search is a real controlled input with an icon, clear action and focus-within style; it is not entirely missing design. Its weaknesses are size, labelling, placement, composition with filters and feedback. Do not replace it with a command palette.

## 4. Reference study and applicable lessons

These are **public documentation, published UI screenshots and marketing excerpts**, not authenticated hands-on competitor accounts. ShuttleHub itself was inspected directly in the browser. The reference screenshots were opened visually; none is a claim about the competitor's current private UI.

| Reference | What was inspected | Applicable lesson / limit |
|---|---|---|
| [USTA Tournament Desk: Order of Play](https://customercare.usta.com/hc/en-us/articles/360060098272-Order-of-Play-in-Tournament-Desk-Sharing-the-match-schedule) | Official help article and screenshot showing on-court cards, match tabs, filters, reset and result range | Separate live court context from the browsable list; keep filters and counts adjacent. Adapt that hierarchy to ShuttleHub's existing states. Do not import dates, multi-facility scheduling, SMS, auto assignment or bulk scheduling. |
| [Tournify: referee management](https://friends.tournifyapp.com/en/features/referee-management), [manual schedule](https://help.tournifyapp.com/en/articles/9066653-schedule-matches-manually) | Public feature page, score-submission graphic and help documentation | Opponent names and score actions belong together; specialist operations need a clear home. Use grouping and clarity, not its branding or drag-to-schedule feature. Referee assignments are outside this UI-only scope. |
| [Badminton Umpire Score Keeper](https://play.google.com/store/apps/details?hl=en&id=com.lahiruchandima.badmintonumpire) | Publisher app listing and published phone screenshot with quick matches and historical game-score cards | Pair names with per-game score columns and a clear winner. Keep existing undo and large point controls. Do not import court-position tracking, announcements, charts, extra match setup or its dark/yellow styling. |

The design deliberately stays close to the current navy/green identity. No dashboard reference justifies adding decorative charts, artificial KPIs, match-duration forecasts or a new scheduling engine.

## 5. Recommended direction: a clear courtside desk

Use a **navy structural frame, white working surfaces and a disciplined green action color**. Energy comes from decisive type, court numbers, a slim green active marker and strong match hierarchy. Reserve expansive dark panels for live court summaries; avoid making every card dark.

### Reusable foundations

| Foundation | Concrete specification |
|---|---|
| Typeface | Retain locally available `Segoe UI, system-ui, Arial, sans-serif`; no new font service. Use 400 body, 600 labels, 700 titles/numbers. Enable tabular numerals for scores, courts, times and counts. |
| Type scale | Page title 30/36 desktop, 26/32 phone; section title 20/28; card/team title 16/24; body/control 14/20 desktop, 16/24 phone; secondary 13/18; labels 12/16 only where comfortably readable. Retain scorer's large responsive numeral scale. |
| Color roles | Navy `#102F3E` text/shell; action green `#087C5C`; canvas `#F3F6F4`; surface white; secondary text `#52665F`; border `#CBD7D1`; focus `#087C5C` with a contrasting offset. Dark-surface text `#FFFFFF` / `#CBDAD8`. |
| Match status | On court: green text `#075E46` on `#E4F4EC`; Upcoming: navy on `#EDF2F5`; Completed: muted navy on `#EDF2F5` with check icon; Bye: neutral with explicit label. Status always includes words. |
| Operational state | Pending/offline: amber `#795000` on `#FFF4D6`; failure/conflict/destructive: red `#A12B32` on `#FDECEF`. Do not reuse warning amber for ordinary upcoming matches. Separate match, sync and control states. |
| Spacing | 4 px base; 8 within paired metadata, 12 in compact groups, 16 card padding, 24 between sections, 32 desktop canvas gutters. Phone gutters 16; never squeeze cards below readable text widths. |
| Density | Desktop rows about 72–88 px where both opponents and metadata need two lines; phone cards about 180–230 px depending on names/actions. Allow content growth. Operational controls minimum 44 px; phone main actions 48 px. |
| Surface | 1 px border, 10–12 px card radius, 8 px input radius. Very light shadow only for floating menus/dialogs/sticky chrome. Avoid shadows on every table cell. |
| Icons | Existing Lucide, consistent 18–20 px stroke icons; label frequent actions. Icon-only buttons require visible tooltip plus accessible name and 44 px touch area. No emoji status system. |
| Logo | Preserve `assets/logo.jpg`. Use a 44–48 px contained tile next to ShuttleHub text in desktop header; 36–40 px on phone. Do not crop/recreate the mark or distort its square ratio. Event title gets its own line and space to wrap. |
| Components | Primary, outline secondary, ghost tertiary and destructive buttons. Inputs: default/focus/filled/error/disabled; busy buttons keep width and expose `aria-busy`; badges are not interactive; success text supplements toasts. |

Existing Tailwind, Radix, Lucide, Sonner and `tw-animate-css` are sufficient. **No new runtime dependency is justified.** Use owned primitives and CSS, not a new UI kit, animation framework, router migration or table library.

### Shell and navigation

**Desktop ≥1100 px:** approximately 232 px fixed sidebar, compact brand and event block. Group existing links as “Match day” (Overview, Matches, Standings) and “Setup” (Tournaments, Teams & players). Settings and Venue display sit in a utility section. These group labels organize the UI; they are not permission groups or new pages. Header carries role, connection and event context. Page header contains its relevant action. Keep one primary action per task region.

**Tablet 701–1099 px:** replace the full sidebar with a labelled menu trigger and compact header; the same destinations open in an accessible drawer. Match and team cards use available content width; do not preserve the desktop table merely because the viewport is wider than 700 px. Two columns are allowed only if names and action buttons still fit; default to one at 768 px.

**Organizer phone ≤700 px:** compact event header plus bottom navigation: **Overview · Matches · Standings · More**. More opens a labelled sheet with **Tournaments, Teams & players, Club settings, Venue display**. Show full text, current destination and safe-area padding. Setup pages mark More active and show their actual page title. Venue display remains an explicitly labelled external/new-tab action as today. Never place a destructive action in the bottom nav.

**Umpire phone:** **Matches · History · Standings** in a three-item bottom bar. All three already exist. Keep the current default landing on Matches. The saved-work reconciliation section remains prominent whenever it exists. Scoring retains its focused full-screen surface and current controls; no bottom nav is added inside it.

**Breadcrumb/back behavior:** main pages use a simple event/page label, not a fake multi-level breadcrumb. History shows “Matches / History” with a real Matches link. From a category's Manage teams or Bracket, keep the existing selected category visible and provide a contextual return to Tournaments. Dialog close/Escape returns to its trigger. Scorer's existing return should preserve query/category/status/stage and restore focus/scroll to its source match. If the match has moved out of the current result set, focus the result summary and announce that change. No automatic redirect after scoring.

## 6. Matches: detailed UI specification

1. **Order and hierarchy.** Page title “Matches”; show connection in shell. Under it, show any existing stage action or unresolved saved-work alert with clear scope. A filter block precedes the list. Replace the long expanded point-scoring toolbar with a compact labelled disclosure, “On-court shortcuts · 3,” using the existing shortcuts and category scope. The default list already puts live matches first; do not duplicate the full live list above search.
2. **Searchable fields.** Preserve the current case-insensitive substring search over the two team labels. Those labels already contain player names. Label it **Search players** and use placeholder “e.g. Diya Patel or Karthik Rao.” Do not promise court, time, stage, match ID, seed or category search: the current predicate does not search those fields. Category and stage use their existing selectors. Do not alter matching semantics or add backend search in this phase.
3. **Placement and size.** Desktop visible label above a 44 px input, flexible width 320–480 px. Category, status and stage align beside/below it without shrinking the input. Phone search occupies its own full-width row with a 44 px clear target; category occupies the next full-width row; status and stage occupy two labelled columns or stack when text requires. A Filters disclosure may collapse the existing selectors after use; show the applied summary while collapsed.
4. **Clear/reset.** The X clears only query and restores focus, as now. A separate “Reset filters” clears query and returns category/status/stage to All through the existing store setters. Disable or omit reset when nothing is applied. Keep History's completed-only meaning; resetting there must never expose unfinished matches.
5. **Counts/scope.** Display “8 of 42 matches” where numerator is the current rendered result count and denominator is the selected category's matches (all categories when All tournaments). History counts only completed matches. Announce count changes politely after typing settles; update filtering immediately using existing local data. This is presentation over current arrays, not a new query contract.
6. **Filter interaction.** Preserve category AND status AND stage AND query behavior in Matches. History currently applies category/query to completed results and has no stage/status controls; retain that. Status can become a segmented control on wide screens only if it writes the same values (`all/live/upcoming/completed`). Otherwise keep the select. All defaults stay unchanged.
7. **Sorting.** Retain on-court matches by court number, upcoming in fixture order, awaiting-opponent matches after ready fixtures, and completed most recent first. No clickable column headers suggesting unsupported sort. Optional explanatory text “On court first, then fixture order” describes rather than changes this behavior. Planned time remains a label, not a hidden ordering rule.
8. **Rows/cards.** Opponents on separate lines; category and stage/group below. Court or readiness is prominent. Planned time includes “Planned”; missing time reads “Not scheduled” where useful. Primary action is Start game for upcoming, Open scorer for live cloud matches, Edit result for completed; Record result stays beside Open scorer as a secondary action. Awaiting opponents/bye retain their existing restrictions. All supported actions remain reachable without horizontal scrolling.
9. **No matches versus no results.** If fixtures exist but filters yield zero: “No matches match these filters” plus query and Clear search / Reset filters. If no fixtures: organizer gets a route to the existing Tournaments page; umpire gets “No matches available yet. Ask your organizer to create fixtures.” History with no completed results explains that results appear after confirmation. Do not fabricate an error from an empty list.
10. **Return state.** Preserve current URL-backed state. Closing a match editor or scorer must keep the current filters. Test Matches → History → browser Back, Matches → Standings → Back, and reload. Avoid promising cross-device preference storage: it does not exist. Restore local list position and focus without writing tournament data.
11. **Long lists.** Keep the current full list. Improve card density and a sticky, compact filter summary; allow scroll-to-top via a labelled control for long pages. No new pagination, sorting, bulk action or virtualization in the approved phase. If performance later demands windowing, scope and test it separately because focus and live updates require careful handling.

## 7. Recommendations by existing page/surface

| Existing page | Specific redesign | Preserved behavior |
|---|---|---|
| Overview `/` | Compact venue/court strip first; three live court cards with names and clear Open scorer/Record result actions; existing summary counts secondary. Keep upcoming and recent results in distinct panels. Label category-filtered sections versus whole-event counts. | Same court selection/start paths, count definitions, stage actions and fixture order; no estimated readiness or extra statistics |
| Tournaments `/tournaments` | Smaller category cards with state, entry count, groups, stage rules and one emphasized existing next action; place remaining actions in a consistent secondary group. Show lock reasons. Deletion stays visually separate. | Same setup two-step form, locks, fixture/reset/delete confirmations and draw creation |
| Teams `/teams` | Label search; show count and selected category. Responsive team rows show seed, full player-derived label, group and visible Edit players/Change group actions. Keep Add/Import/New group contexts explicit. | Same automatic names, uniqueness checks, atomic import, group edit limits and registration locks |
| Matches `/matches` | Implement the specification above. Give operational status more hierarchy than category decoration. | Same query predicate, filters, sequence, actions and validation |
| History `/matches/history` | Present as a Matches child; highlight opponent/winner and per-game scores with tabular columns; show Edit result clearly. Use no-result search copy rather than “No results yet” when filters caused it. | Existing completed-only list, ordering and correction checkbox |
| Standings `/standings` | Category filter and in-page section links; larger team names and readable rank/stat labels. Qualification legend includes words and icon, not color alone. Bracket rounds retain visible titles while scrolling. | Exact standings comparator, qualifier calculations, bracket structure, pending opponents and stage actions |
| Settings `/settings` | In-page navigation: Venue & courts, Staff access, Scoring control, Screens, Backup & usage. Render existing owner-only recovery/import controls in an access subsection. Use current role to show only already-authorized controls. | Same permissions, revocation, preset scope, backup/export, import rules, browser sign-out and controller actions |
| Umpire desk | Strong event identity and high-contrast nav; existing saved-work alert above filters when present; current all-matches list with phone cards. No assigned-only workflow. | Umpires keep full existing event-match permissions and existing landing route |
| Scorer | Before claim, show names, court, category and rules from current props. After claim, only align typography/status styling and return context. Separate stream connection, pending count and confirmed result. | Point button geometry, side identity, swap behavior, tap persistence order, undo/pause, locks, retries and confirmation remain intact |
| Cloud entry/recovery | Small branded access card; distinct loading, no-session, expired-link and recovery acknowledgement states using actual response. Copy link gets success/failure feedback. | Private-link authentication; no email/password, new account flow or recovery rule changes |
| Maintainer `/maintainer` | Reuse typography/form tokens, identify privileged context, make existing-directory restore and new identity sections unmistakable; destructive locking/recovery consequences stay explicit. | Separate auth, existing pagination, single-use links, expiries and restoration semantics |
| Venue `/display` | Keep venue-first layout; use shared semantic tokens, readable stale-update labels, clear fullscreen/edit/pause names. Improve scroll affordance and focus rings in widget editor. | Grid geometry, preset filtering, independent layouts, automatic visibility, drag and keyboard alternatives, read-only tournament data |
| Not found | Existing recovery link becomes a primary “Go to overview” action, with main navigation retained. | No new routes or permission bypass |

**Forms and dialogs:** preserve field order where staff have learned it. Keep category setup steps and per-stage scoring sections. The longer second step gets an anchored title and action footer, not another wizard. Keep the import preview/table and show file/row count immediately above Import. Show destructive impact counts at the top of confirmation. Keep errors beside relevant fields and at the form summary; use `aria-describedby` without discarding the existing `role=alert`. On stale revisions, retain inputs and the current review/retry requirement.

## 8. Purposeful feedback and motion

| Trigger | Behavior | Purpose and guardrail |
|---|---|---|
| Navigate to a different existing page | Move active indicator immediately; update title/focus. Optional 120 ms opacity transition on new content only. | Orientation; never delay navigation or animate the entire app sideways |
| Type/change filter | Update local results immediately; after ~200 ms idle announce count. At most 100 ms subtle row/background update. | Explain changed results without animating dozens of moving rows or stealing input focus |
| Open filters, rules detail or shortcut disclosure | `aria-expanded`, 120–160 ms opacity/short size transition; maintain focused trigger | Reveal hierarchy without losing position; instant expansion under reduced motion |
| Open/close dialog or mobile More drawer | Existing Radix focus trap; 120–160 ms opacity, optional 4 px translation; restore focus | Preserve context; never bounce or require swipe-only dismissal |
| Save/schedule/start/import | Keep button width, show “Saving…”/“Starting…” with busy state; disable duplicate submission only as currently appropriate | Confidence that action is processing; success only after current action promise confirms |
| Success | Existing Sonner toast with specific existing action result; small inline confirmation for copy/settings when useful | A transient toast supplements visible state, not the only proof of a result |
| Error/conflict | Persistent inline alert, focusable summary if submission failed, retained inputs and retry path | Errors must not disappear automatically or be communicated only by red |
| Data loading | Stable card/row placeholders after a brief delay to avoid flash; mark region busy; avoid repeated spinners on live snapshots | Reduce layout movement without pretending a mutation succeeded |
| Live snapshot changes | Optional 600 ms pale background highlight on changed non-scoring row; do not reorder beyond existing sort | Help desktop staff locate updates; no flashing scores or animated counters |
| Point tap | Retain existing storage-before-visible-score behavior; ordinary pressed button color only | Do not delay or queue animation between rapid points; no score tweening, celebratory effects or new haptics dependency |
| Reduced-motion preference | Disable translation/size/row effects; use immediate state changes. Respect it when choosing default automatic display motion; keep user pause/resume | Honor the user's preference while maintaining all information and manual controls |

## 9. Implementation phases and file boundaries

Effort is a planning estimate for one frontend engineer with design review, not a delivery commitment. Changes should land in small reviewable PRs. Production code was not modified during this audit.

| Phase | Scope / affected files | Dependencies, estimate and exit condition |
|---|---|---|
| 0 · Baseline | Capture the documented roles/screens; retain current fixture and journey checks. Add approved screenshots to visual review. | Completed as audit evidence. Pin current behavior before implementation. |
| 1 · Quick usability wins | `SearchField.jsx`, `Matches.jsx`, `MatchTable.jsx`, `Teams.jsx`, `Umpire.jsx`, `theme.css`, scoped organizer/cloud CSS | ~2–3 days. Fix nav contrast/current state, search size/label, no-results copy/count and visible lock reasons. No API or state-schema change. |
| 2 · Foundations and shell | `App.jsx`, `common.jsx`, `PageLink.jsx`, UI primitives, theme/CSS | ~3–5 days. Compact logo/header; desktop groups; tablet drawer; phone navigation. Use current Radix package for drawer/menu behavior. Keep routes and filter serialization. |
| 3 · Operational layouts | `MatchTable.jsx`, `MatchCard.jsx`, `Matches.jsx`, `Overview.jsx`, `Teams.jsx`, `Standings.jsx`, `Umpire.jsx`, presentation portion of `Scorer.jsx` | ~4–6 days. Responsive cards, filter composition, contextual back/focus/scroll, preclaim identity. Preserve all scoring and match action functions. |
| 4 · Setup/admin consistency | `Tournaments.jsx`, `SettingsPage.jsx`, `AccessPanel.jsx`, `Maintainer.jsx`, `CloudGate.jsx`, `common.jsx`, forms/format/group CSS | ~3–5 days. Long-form chrome, field errors, settings section navigation and action hierarchy; identical payloads and lock conditions. |
| 5 · Feedback and acceptance | Shared styles/controls, venue presentation CSS; existing browser test files plus focused regression coverage | ~2–3 days. Reduced motion, keyboard/mobile validation, real-device rehearsal. No geometry or persistence rewrite of venue grid. |

Proposed shared presentation components: `DeskBrand`, `PageHeader`, `RoleNavigation`, `ConnectionStatus`, `FilterBar`, `FilterSummary`, `MatchStatusBadge`, `ResponsiveMatchList`, `FormActions`, `EmptyState`. Create only where at least two surfaces need the same behavior; avoid replacing every existing component. Prefer evolving `SearchField`, `MatchTable`, `MatchCard`, `Modal` and `Pill` first.

**Hard boundaries:** do not edit `server/engine.js`, `shared/standings.js`, `shared/live-scoring.js`, API handlers, authorization checks, cloud score storage/flush/claim logic, event/session namespace, invitation semantics or request payloads. UI-only state such as whether a filter drawer is expanded belongs in component state. Existing navigation/filter stores remain the source of truth for their current values.

**Explicitly excluded:** assignment UI/API, new searchable metadata, new sorting, automatic schedules/rest calculations, operational bulk actions, scoring simplification, permission narrowing, new dashboards/charts, tournament archive features, additional login methods and production deployment. Such work would be separate product changes, not this redesign.

## 10. Acceptance criteria

### Responsive and legible

- Verify 360×800, 390×844, 768×1024, 1024×768 and 1440×900, portrait/landscape, plus 320 CSS px reflow and text zoom. No page-level horizontal overflow. Deliberate standings/bracket scroll regions have visible affordance and keyboard access.
- Match/team primary actions are visible without horizontal scrolling at every listed width. Long doubles names wrap fully. Cards do not rely on hover. On a normal 390 px Matches screen with three live matches and no exceptional saved-work alert, search and the first match action fit within the initial 844 px viewport.
- Every frequent touch action is at least 44×44 CSS px; primary phone actions 48 px high. Mobile form text is at least 16 px. This is the product usability target, stricter than WCAG 2.2 AA's 24 px minimum-with-exceptions rule. [W3C target guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- Use `dvh`, safe-area padding and a single dialog scroll region. Verify the virtual keyboard does not obscure the focused field or make submission unreachable on real Android Chrome and iOS Safari; desktop resizing alone is insufficient.

### Accessibility

- Normal text contrast ≥4.5:1, large text ≥3:1; controls/focus indicators remain discernible. Check actual composited colors, not just token definitions. Text/icon labels supplement status colors. [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- Provide a skip link, one clear page heading, labelled navigation, `aria-current`, explicit search/filter names, associated errors and polite count announcements. Preserve table headers on desktop; phone card labels supply the missing column context.
- Keyboard-only users reach every action; drawers/dialogs trap and restore focus; Escape closes only the active overlay. No hidden focused controls behind sticky chrome. No automatic focus movement from incoming match updates.
- With reduced motion, all workflows remain complete with transitions removed. Existing display scrolling has a reachable pause. Reflow testing follows the 320 CSS px criterion while respecting genuinely two-dimensional table/bracket regions. [W3C reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- Run an accessibility scan plus manual keyboard and screen-reader spot checks; passing automation alone is not a conformance claim. This audit did not perform a formal WCAG certification.

### Navigation and feedback

- All existing destinations remain reachable by their authorized roles; selected page and selected category are always apparent. More is not an unlabeled icon. No umpire link leads to organizer-only setup.
- Query/category/status/stage survive supported navigation and reload exactly as today. Match dialog/scorer return retains filters and restores relevant focus/scroll. History remains a clear child of Matches.
- Search X only clears search; Reset filters resets exactly the documented scope. Zero matches is distinguishable from zero fixtures and zero completed results. Counts agree with rendered rows.
- Busy/success/error/disabled states explain the current action. A confirmed result is never inferred from a local point tap or pending queue. Offline, pending, conflict and confirmed status remain distinguishable.

### Existing functionality remains unchanged

- Compare requests before/after: action names, payloads, role guards, revision values and confirmation requirements must match.
- Rehearse category → registration/import → groups → fixtures → scheduling/court/start → point scoring/final-score entry → qualification review → knockout/final → history/correction. Include byes, unavailable opponents, occupied courts, player conflicts and stage-specific rules.
- Retain atomic imports, group/registration locks, blank-score rejection, seed tie-breaks, completed-rule snapshots, downstream correction effects and court release.
- Umpires retain all currently permitted match actions; owner recovery/import remains owner-only; maintainer authorization stays separate; display cannot mutate tournament data.
- Preserve offline queue durability, deduplication, single-controller/tab restrictions, transfer/reconciliation and storage-error behavior. Scorer tap controls do not move, reverse identity or wait for animation.
- Run `npm test`, `npm run build:cloud`, `npm run test:cloud` and relevant existing browser tests against isolated local state when implementing. These are future acceptance gates; the full suite was not run for this documentation-only audit. Existing browser coverage in `tests/browser/cloud.spec.js`, group/entry/maintainer specs and `tests/venue-widgets-navigation.test.js` supplies a starting point.

### Remaining validation limits

Browser inspection used Microsoft Edge automation at desktop/tablet/phone viewport sizes. It is not a substitute for finger input, a phone keyboard, iOS service-worker behavior, poor venue connectivity or screen-reader testing. Local offline simulation covered pending points, undo, reconnect and confirmed results; transfer conflicts, quota exhaustion and browser-storage eviction were source/test-reviewed, not all reproduced during this audit. Production may run an earlier build. No production account was needed because safe local role accounts were available.
