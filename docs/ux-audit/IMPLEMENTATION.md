# UI upgrade implementation

Implemented 22 October 2026 as one integrated frontend update against [the audit plan](PLAN.md).

## Delivered experience

- **Application shell:** compact logo and event identity, grouped desktop navigation, a tablet navigation drawer, and organizer phone navigation for Overview, Matches, Standings and More. More opens an accessible bottom sheet containing the existing destinations. History has a real Matches breadcrumb. Page headings are smaller and sentence case; New tournament appears in its relevant page and existing setup entry points.
- **Matches and history:** visibly labelled search, tournament/status/stage controls, consistent touch sizing, counts, a sticky result summary, a return-to-filters link, clear/reset feedback and correct empty states. The search continues to use the existing player/team-label substring logic. Existing ordering and URL filter semantics are preserved. On-court shortcuts are in a labelled disclosure that explains their filter scope.
- **Responsive match and team lists:** container queries switch to cards below 900 px of usable content width. Every existing row action remains in its card, including Start game, Record result, Open scorer and corrections. Team cards expose tournament, group and existing edit-lock explanations.
- **Umpire desk:** readable connection/event context, phone navigation for Matches, Match history and Standings, the same responsive filters and cards, and named saved-work recovery entries. No assigned-match view or assignment capability was added.
- **Scorer presentation:** opponents, court and existing scoring rules are visible before claiming control. Connection, pending work and scoring status are separate facts. The return label reflects the originating page; list query, status, focus and scroll position survive a scoring visit. Point buttons, swaps, undo, pause, claims, synchronization and confirmation logic are unchanged.
- **Overview and tournaments:** consistent density and hierarchy, readable court states, contextual category actions and lock explanations. On-court cards display the existing server-confirmed point record when available and distinguish delayed/disconnected updates from match status.
- **Standings:** category/group/playoff/bracket anchors, defined statistics and readable responsive tables. Rankings, qualification rules, group ordering and brackets retain their existing behavior.
- **Settings and access:** one readable column with section navigation, persistent labels, confirmed action/copy feedback and visually separated controls. Owner revocation controls are disabled for additional organizers to reflect the existing server permission. Recovery, import, presets and reconciliation retain their workflows.
- **Forms and accessibility:** fixed dialog header, one scrolling body, sticky action rows, larger close/score-step targets, associated score-validation text, busy status, skip links, visible focus and active navigation semantics. Navigation sheets and scorer return restore focus deliberately.
- **Motion and specialized screens:** brief surface/control transitions respect reduced motion. Venue automatic scrolling starts paused when reduced motion is requested; manual pause/resume and saved layout contracts remain available. Maintainer and private-link/recovery screens receive consistent typography, surfaces and control sizing.

## Screenshots

These are the implemented local application using isolated audit data, not mockups.

| Screen | Capture |
|---|---|
| Organizer overview, 1440 px | [Desktop shell](implementation/overview-desktop.png) |
| Matches, 1440 px | [Desktop matches](implementation/matches-desktop.png) |
| Matches, 390 px | [Phone matches](implementation/matches-phone.png) |
| Umpire, 360 px | [Phone umpire desk](implementation/umpire-phone.png) |
| Scorer before claiming | [Match identity and readiness](implementation/scorer-claim.png) |
| Phone navigation | [More sheet](implementation/mobile-navigation.png) |
| Tablet navigation | [Navigation drawer](implementation/tablet-navigation.png) |
| Teams, 768 px | [Tablet team cards](implementation/teams-tablet.png) |
| Settings, 390 px | [Phone settings](implementation/settings-phone.png) |
| Blank-score validation | [Phone match dialog](implementation/match-dialog.png) |

## Code ownership

The integrated presentation layer is `src/styles/desk.css`, imported after the existing styles. It scopes organizer/umpire changes away from the venue's measured grid and established point controls. The legacy sheet's bare navigation selectors are now sidebar-scoped.

New shared pieces are `src/components/DeskNavigation.jsx`, `src/components/LiveMatchSummary.jsx` and `src/hooks/useScorerReturn.js`. Existing `SearchField`, `MatchTable`, `MatchCard`, common dialog/field components, pages and cloud views use the same foundations. No runtime dependency was added.

No changes were made to `server/`, `shared/`, `cloud/` backend code, APIs, payload contracts, tournament/scoring reducers, authorization, database schema, scoring persistence or network retry logic. No real tournament records were modified and nothing was deployed.

## Validation

| Check | Result |
|---|---|
| `npm test` | 116 passed |
| `npm run test:cloud` | 14 passed against local Wrangler |
| `npm run test:browser` with Microsoft Edge | 11 passed; one test-tools-only case skipped because test tools are disabled in this configuration |
| Targeted umpire schedule/start/score/history journey after navigation refinements | Passed |
| `npm run build:cloud` | Passed |
| Legacy production build to an isolated output directory | Passed |
| Organizer pages at 320, 360, 390, 768, 1024 and 1440 px | No page overflow; no off-screen match/team action buttons; search controls measured 46 px high |
| Umpire Matches, History and Standings at 360, 390 and 768 px | Fit viewport and expose exactly one active role navigation destination |
| Focused browser interaction checks | 29 checks passed: no-results feedback, clear focus, scorer identity/status, retained filters, restored scorer focus/scroll, sheet focus, field-error association, role navigation, owner restrictions and reduced-motion default |
| Final visual review | Desktop, tablet and phone screenshots reviewed; sticky result summary and tablet drawer focus return checked |

Existing offline scoring, delayed acknowledgements, storage failures, revocation, side swaps, result confirmation, late entries, group edits, presets and maintainer workflows passed their browser coverage. Existing tests were not weakened or rewritten for the redesign.

The build retains its pre-existing large-chunk warning for ExcelJS. Browser checks used desktop Edge viewport emulation; physical iOS/Android keyboards, outdoor lighting and screen-reader operation were not directly tested. Scoring retains its existing non-route invocation: browser Back is not a new scorer-close operation. The visible return control is the supported path back to the originating view.

## Animated branding update

The splash now starts deliberately after its playback handlers attach, so its entrance cannot finish during a slow bootstrap. It plays on desktop even when the operating system reports reduced motion, as explicitly requested. The shuttle enters from the left of the viewport once per document load. When startup takes longer than four seconds, a separate clip containing only seconds 2–4 loops until the actual screen is ready.

All in-app image logos use the shared `AnimatedLogo` component, including the organizer sidebar, reconnect view and venue header. Compact logos use the supplied icon-only video's breathing segment; larger logos use the wordmark version. The two-second clips are cropped and encoded for their display sizes, with native video looping. Navigation never repeats the entrance. Clicking or keyboard-activating a logo pauses/resumes the brand animation, and the pause choice survives navigation within the page. Static posters remain as media-failure fallbacks; favicons and installed-app icons retain their required image formats.

Validation: cloud build passed; 24 focused browser checks passed, covering both desktop motion settings, phone playback, the single entrance, native breathing loops, navigation, pause/resume, venue branding and media failure. The existing browser suite passed all 11 enabled tests; the disabled test-tools case remains skipped. No business rules, scoring behavior, data contracts or permissions changed.
