# Match-day UI review

Changes are local on `codex/courtside-ui-review`. Nothing was deployed or pushed. `main`, `wrangler.jsonc`, backend APIs, tournament/scoring rules, state stores and dependencies are unchanged.

## Preview

Run the supplied command from the repository root:

```powershell
npm.cmd run dev -- --port 8799 --persist-to output/local-review --var PROVISIONING_SECRET:local-test-secret --var ENABLE_TEST_TOOLS:true
```

Open http://127.0.0.1:8799. Use your local session, or open the generated `output/local-review/review-access.html` in a browser for the populated review event. That file contains a local invitation and is ignored by Git. The review event uses fictional fixture data; production records were not accessed.

## Changes to review

- The overview begins with all event courts, then a category-filtered match sheet. Counts and results share that filter. An open-court shortcut opens upcoming games with stale filters cleared.
- Category next steps lead to registration, fixture confirmation, match management, qualification review or final standings, using existing state and actions.
- Tournament cards show Entries, League, Knockouts and Finished. Existing edit, reset, scoring and deletion controls remain available. Manage games opens the category's fixtures.
- Desktop navigation exposes match history. Phone users reach it through More. Existing URL and browser navigation behavior remains in place.
- Phone match filters keep search, category and status visible. More filters exposes group, stage and sort. Arrival rules use a disclosure; local test tools sit below the match list.
- Venue automatic scrolling moves at 36 pixels per second, pauses for 2 seconds at either end, and updates on each animation frame. Manual interaction still pauses scrolling for 8 seconds.
- The visual system uses self-hosted Public Sans and Barlow Condensed, charcoal, white and muted court green. Shared tokens also update typography on other app surfaces. Scoring controls, loading media and venue layout behavior retain their existing implementation.

## Checks

| Check | Result |
| --- | --- |
| `npm.cmd test` | 142 passed |
| `npm.cmd run test:cloud`, local Worker with test tools enabled | 26 passed |
| `npm.cmd run test:browser`, Microsoft Edge, test tools enabled | 12 passed, including rerun after mobile filter changes |
| `npm.cmd run build` | Passed; existing ExcelJS bundle-size warning remains |
| Organizer Overview, Tournaments, Matches, Teams, Standings, Settings at 1440 / 768 / 390px | No horizontal page overflow or JavaScript errors |
| Focused navigation and workflow checks | 15 passed: filter scope, court shortcuts, mobile filter disclosure/reset, fixture confirmation, history navigation, stage indicators; history also checked at 320 / 360px |
| Empty-event flow | 320 / 390 / 1440px fit; first action opens tournament creation |

Existing browser coverage exercises offline points, undo, synchronization, result confirmation, scoring control, invitations, revocation, display updates, group moves/swaps and late entries. Tests were not weakened for this redesign.

Screenshots and local inspection reports are in `output/playwright/review/`. Start with `overview-1440.png`, `overview-390.png`, `tournaments-1440.png`, `matches-phone-final.png` and `empty-390.png`.

The taste inspection uses the skill's browser probes with a local authenticated session. Strong horizontal rules and green on-court borders are deliberate match-sheet cues; condensed headings carry the sports identity. Small type is limited to metadata and supporting labels. Font licenses are included in `public/fonts/`.

Review on a physical phone is still useful: browser checks use Edge viewport emulation. No deployment command has been run. Production remains pending your approval.
