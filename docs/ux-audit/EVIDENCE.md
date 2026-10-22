# Inspection record and visual evidence

The primary deliverables are the [UI/UX plan](PLAN.md) and [annotated visual review](design-review.html).

Static mockups are also available:

- [Proposed desktop shell / Overview](proposed-shell.png)
- [Proposed Matches screen](proposed-matches.png)
- [Proposed mobile umpire journey](proposed-umpire-flow.png)

The HTML review runs locally with `mock-data.js` and `evidence/` beside it; it does not fetch tournament APIs. Only its desktop Overview/Matches switcher and search/category/status/stage/reset demonstrate interactions. Other actions are visual specimens. It is not an application implementation.

## Method and environment

Reviewed the actual repository, README, cloud setup and staff guide, routing/state/components, role guards, scoring presentation and existing tests. No repository or parent `AGENTS.md` was present. Used the documented cloud build and isolated local Wrangler runtime, Microsoft Edge through Playwright CLI, and safe practice data.

- Cloud build: `npm.cmd run build:cloud` succeeded; Vite reported its existing large-chunk advisory. No dependency change was made.
- Runtime: documented `wrangler dev --local`, port 8799, isolated `output/ux-audit/runtime`; all bindings local. No production deployment, account provisioning or tournament mutation.
- Initial rehearsal: 6 categories, 32 entries, 42 fixtures, 3 on-court games, 5 completed games. Based on `server/demo.js` practice pack, plus a two-player, 5-point singles category for a short complete scoring journey.
- A separate empty event was used for first-run/empty states and category creation → CSV preview/import → fixture generation. These writes occurred only in the new local runtime.
- Owner, additional organizer, umpire and display sessions were created using existing test helpers and local invitation redemption. The browser also exercised maintainer unlock → setup-link generation → new owner redemption → recovery acknowledgement → empty desk. No camera/physical QR scan was attempted.
- Screenshots cover 1440×1000 (or 900) desktop, 768×1024 tablet, 390×844 and 360×800 phone layouts. Some capture passes used height 900; measurements use their recorded viewport values. The initial overview screenshot was at the browser's default width before the systematic pass.
- Over 140 raw captures remain under `output/playwright/ux-audit/`. A curated portable selection is included here. Runtime state, session cookies and private links are **not** part of this deliverable; no authentication file was copied into `docs/ux-audit`.
- Several screenshots precede scoring; later screenshots show the same rehearsal after its league/final completed. Counts therefore differ intentionally. Mockups use the initial fixture snapshot, not the later runtime state.

## Page and role coverage

| Surface | Roles inspected in browser | Layouts | Evidence / findings |
|---|---|---|---|
| Overview `/` | Owner and additional organizer; empty owner | Desktop, tablet, 390, 360 | [Overview](evidence/owner-overview-desktop.png), [empty desk](evidence/empty-overview-390.png); court/status hierarchy, brand/header space |
| Tournaments `/tournaments` | Owner and additional organizer | Desktop, tablet, 390, 360 | [Category cards](evidence/owner-tournaments-desktop.png); draft/in-progress/ready and after-final states; locks and actions |
| Teams `/teams` | Owner and additional organizer; empty owner | Desktop, tablet, 390, 360 | [Phone table](evidence/owner-teams-mobile.png); long names, missing off-screen actions, search/import entry points |
| Matches `/matches` | Owner, organizer, umpire; empty owner | Desktop, tablet, 390, 360 | [Desktop](evidence/owner-matches-desktop.png), [tablet](evidence/owner-matches-tablet.png), [organizer phone](evidence/owner-matches-mobile.png), [umpire 360](evidence/umpire-matches-small-mobile-viewport.png) |
| History `/matches/history` | Owner, organizer, umpire | Desktop, tablet, 390, 360 | Completed rows and scores; [correction dialog](evidence/correction-review-390.png); source of current completed-only behavior |
| Standings `/standings` | Owner, organizer, umpire; empty owner | Desktop, tablet, 390, 360 | [Standings and bracket](evidence/owner-standings-desktop.png), [completed final](evidence/completed-bracket-390.png); group/round hierarchy, horizontal bracket scroll |
| Settings `/settings` | Owner and additional organizer; empty owner | Desktop, tablet, 390, 360 | [Cloud access column](evidence/owner-settings-desktop.png); owner recovery/import versus organizer differences, staff/control/preset/backup sections |
| Venue `/display` | Owner and display session | Desktop, tablet, 390, 360 | [Venue board](evidence/owner-display-desktop.png), [phone editor](evidence/display-editor-390.png); existing delayed-score state, widget scrolling and edit chrome |
| Cloud entry | No session; new owner private setup redemption | Phone | [No session](evidence/no-session-390.png), [loading](evidence/loading-390.png), [masked recovery](evidence/recovery-masked-390.png) |
| Maintainer `/maintainer` | Separate local maintainer session | Desktop and 390 | [Directory](evidence/maintainer-unlocked-390.png); wrong secret error, unlock, new setup link and private QR. No real credentials used |
| Unknown route | Owner | Desktop, tablet, 390, 360 | Existing Page not found shell and return action; raw captures `owner-not-a-page-*` |
| Scorer (local UI state, no dedicated route) | Umpire | 390 | [Before claim](evidence/scorer-unclaimed-390.png), [active](evidence/scorer-active-390.png), [offline](evidence/scorer-offline-390.png), [confirmed](evidence/scorer-result-confirmed-390.png) |

Role restrictions were mapped from `src/hooks/useDesk.jsx`, `src/cloud/CloudGate.jsx`, `cloud/event.js` and existing security/browser tests. This was not a new penetration test or a claim that every permission denial was re-executed.

## Workflows and states observed

| Journey / state | What was actually done | Result / evidence |
|---|---|---|
| First entry | Local maintainer unlock, generate private setup link, redeem in a new browser context, acknowledge recovery link | Working entry into an empty desk. Recovery/QR screenshots masked |
| Setup | Create a singles category via both form steps; upload 4-row CSV, inspect preview, import; confirm fixtures | Final local state verified: 1 category, 4 entries, 2 fixtures. [Preview](evidence/import-preview-390.png), [fixture review](evidence/generate-review-390.png), [created draw](evidence/setup-fixtures-created-390.png) |
| Category dialogs | Open new category steps, edit scoring, unlocked group editor, delete-unused-draft confirmation; cancel review-only forms | Dense/scrolling mobile form behavior observed. No practice category deleted |
| Match discovery | Search Asha, nonmatching search, select/view existing categories/statuses/stages; return from scoring with query | Current `?q=Asha` survived scorer return; [no-result mismatch](evidence/umpire-no-results-360.png), [full zero-results screen](evidence/no-results-full-390.png) |
| Start / schedule | Save 14:30, reopen, select the free Court 4, start | Existing independent schedule/start steps preserved; [dialog](evidence/umpire-start-dialog-390.png) |
| Point scoring | Open scorer, claim online, point, simulate offline, point, undo, reconnect, complete a 5-point game and confirm | Local pending status, synchronization and result confirmation observed. Existing button layout works |
| Advancement | Return to matches, open qualification review, create knockout; start final, enter 5–0 and confirm | [Qualification review](evidence/qualification-review-390.png), [completed bracket](evidence/completed-bracket-390.png) |
| Error and corrections | Try blank final scores, observe error; save explicit valid scores; open completed-result editor | [Blank-score rejection](evidence/blank-score-error-390.png); correction checkbox and impact text inspected without submitting a correction |
| Keyboard | Focus search, open result dialog, Escape, inspect returned focus | Focus returned to the exact Record result trigger. No full screen-reader audit performed |
| Loading / no session | Fresh context without session; delayed local state request while app opens | [Entry](evidence/no-session-390.png), [plain loading fallback](evidence/loading-390.png) |
| Venue editing | Open layout editor and examine phone controls | Existing Move/Width/Height/widget/pause/save controls retained; draft not saved |

## Measured observations

Measurements were read from browser `getBoundingClientRect`, computed styles and accessibility snapshots, not estimated from screenshots.

| Observation | Value | Interpretation |
|---|---|---|
| Match search wrapper / input | ~33.5 / 31.5 CSS px height | Below the proposed 44 px product touch target; not automatically a WCAG AA failure |
| Umpire 360 px: search / first match action | y≈472 / y≈800 | Repeated shortcuts consume initial viewport; action requires scrolling |
| Umpire 390 px: search / first match action | y≈454 / y≈782 | Similar friction despite no page overflow |
| Organizer 360 px: search / first match action | y≈683 / y≈1056 | Shell and repeated toolbar compound the problem |
| Organizer 768 px match table | x≈221…1086; actions start x≈846 | Essential controls are outside the initial viewport in an internal horizontal scroller |
| Umpire 768 px match table | x≈25…890 | Part of the action region is clipped until scrolled |
| Umpire nav foreground / canvas | `#A6BCC6` / `#F3F6F4`; 1.8156:1 | Low-contrast styling inherited from dark-sidebar nav rules |
| Umpire active nav | `aria-current` absent on both links | Current location lacks an explicit accessible state |
| Phone full match table/list | ~10,700–11,000 px for 42 fixtures | Compact cards and persistent filter context matter; pagination is not proposed |
| Document overflow | No page-level overflow in the recorded systematic role passes | Does not prove table actions or bracket contents are comfortably accessible |

The implementation contains default focus styling and transition utilities. The audit did **not** conclude “there is no animation” or “there is no accessibility.” It found gaps in consistency, target size, contrast, responsive composition and explicit reduced-motion handling.

## Source anchors

- Product/setup: `README.md`, `docs/CLOUD_SETUP.md`, `docs/STAFF_GUIDE.md`, `server/demo.js`.
- Shell and role presentation: `src/App.jsx`, `src/cloud/Umpire.jsx`, `src/cloud/CloudGate.jsx`, `src/cloud/Maintainer.jsx`.
- Search and ordering: `src/pages/Matches.jsx` (team-label predicate and shortcut scope), `src/hooks/useDesk.jsx` (derived lists), `shared/matches.js` (ready fixture order), `src/components/SearchField.jsx` (existing clear/focus).
- URL state: `src/stores/organizer.js`, `src/lib/navigation.js`, `src/components/PageLink.jsx`.
- Mobile/table behavior: `src/components/MatchTable.jsx`, `src/components/ui/table.jsx`, `src/styles/organizer.css` (700 px card rule; broad `nav` selectors; large title and logo overrides).
- Scorer: `src/cloud/Scorer.jsx` (claim screen and status presentation), `src/cloud/cloud.css`; storage/connection and shared reducer reviewed for preservation boundaries.
- Forms/stage transition: `src/forms/MatchForm.jsx`, `src/forms/TeamForm.jsx`, `src/forms/TournamentForm.jsx`, `src/TournamentFormatFields.jsx`, `src/components/StageActions.jsx`, `src/components/common.jsx`.
- Settings/access: `src/pages/SettingsPage.jsx`, `src/cloud/AccessPanel.jsx`, `cloud/event.js`.
- Venue: `src/VenueBoard.jsx`, `src/components/VenueGrid.jsx`, `src/useAutoScroll.js`, `src/stores/venue.js`, `src/venue-board.css`.

## External references: inspection type

1. [USTA Order of Play](https://customercare.usta.com/hc/en-us/articles/360060098272-Order-of-Play-in-Tournament-Desk-Sharing-the-match-schedule): official article and its [published court/list screenshot](https://customercare.usta.com/hc/article_attachments/20782028325268) viewed directly. Screenshot documents hierarchy, not a tested current private account.
2. [Tournify referee management](https://friends.tournifyapp.com/en/features/referee-management): public feature page and its [score-entry graphic](https://qigwxrdzmeiducozdjbl.supabase.co/storage/v1/object/public/landing-images/features/referee_management/score_submission.png) viewed directly; [manual scheduling help](https://help.tournifyapp.com/en/articles/9066653-schedule-matches-manually) and [referee scheduling help](https://help.tournifyapp.com/en/articles/9065030-schedule-referees) read. No Tournify account created or authenticated UI claimed.
3. [Badminton Umpire Score Keeper](https://play.google.com/store/apps/details?hl=en&id=com.lahiruchandima.badmintonumpire): publisher listing and phone screenshot viewed. App not installed. Its quick-match/history organization and score readability informed the study; new assignment or scoring features were not adopted.
4. [W3C contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): primary guidance for acceptance thresholds.

## Artifact checks and limitations

The review HTML was rendered in Edge. Its filters produced 3 of 42 for “Diya,” zero for an unknown name, 3 of 42 for On court, and 42 of 42 after reset. Images loaded. The review page itself fit 390, 768 and 1440 px without document overflow; its desktop design canvas intentionally has its own horizontal viewport on narrow screens. Reduced-motion emulation was checked. Static desktop and mobile-flow exports were visually reviewed after rendering.

No production `.jsx`, CSS, API, engine, configuration or dependency file was edited. The added repository files are under `docs/ux-audit/`; temporary runtime/test/preview files are under ignored `output/`. The full application test suite was not run because this is a documentation/design exercise; existing tests were read for workflow constraints.

Not directly exercised: every playoff preset/draw size, all byes and correction cascades, controller transfer conflicts, quota/storage exhaustion, XLSX error variants, physical phone keyboards, real QR-camera scan, iOS Safari, screen readers, production account data or production connectivity. These are acceptance checks for later implementation, not silent claims of completed testing.
