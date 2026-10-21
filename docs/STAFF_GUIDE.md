# Tournament-day guide

Every device opens the same HTTPS website using its own internet connection. Organizer laptops do not serve the application and may be closed. No staff member needs Node.js, a VPN, IP addresses, or firewall changes.

## Primary and additional organizers

The maintainer creates a primary organizer's private setup link/QR from `/maintainer`. Primary organizers only open their link and save the recovery link; they do not run provisioning commands or receive the maintainer secret. Additional organizers are invited from the existing event desk.

1. Open your private setup/invitation link. Save the primary organizer's recovery link securely. Anyone with that link can recover organizer access.
2. Manage categories, players, groups, fixtures, standings, and results using the existing dashboard. The desk contains one event with multiple categories.
3. Start a ready match and assign its court using **Matches**, or let an umpire do this from their match desk.
4. In **Club settings → Cloud access & screens**, create an individual umpire invitation/QR. Every umpire can manage event matches, start them on a free court, and claim scoring control without an assignment.
5. Create additional organizer invitations for staff who need management access to this same event. Staff invitations expire after 15 minutes and can be used once.
6. Export a backup periodically. The usage panel reports event-local observations, not the entire Cloudflare account's remaining allowance.

Testing/demo tools are disabled in the cloud deployment.

## Changing team entries during the league

In **Teams & players**, select the tournament first:

1. **Add team** or **Import teams**: choose an existing group. New fixtures pair the added teams with each other and all retained teams in that group. Existing results and schedules are preserved.
2. **New group**: import a CSV or Excel file containing at least two teams. The group and its round-robin fixtures are created together. Further teams can be added to it later.
3. **Edit players → Remove team**: review and confirm deletion of all that team's fixtures, including completed results. Any court it occupies is freed and standings recalculate immediately. Other teams' matches remain intact.

These entry changes are available until the playoff or knockout draw is created. Qualification places and playoff rank pairings stay as configured. Teams below the playoff cutoff are eliminated; a missing playoff opponent gives the available higher-ranked team direct qualification. Smaller groups contribute only their available qualifiers, and the knockout bracket adapts with byes.

## Umpires

1. Scan your individual invitation. You land on **Event matches**, using the same match desk as the organizer: search, category/status/stage filters, scheduling, court selection, results, corrections, match history, and knockout creation. **Standings & brackets** opens the qualification review.
2. For an upcoming match, select **Start game**, choose a free court, and confirm **Start game**. You can also save its scheduled time. Then select **Open scorer** and **Claim scoring control** while online. Wait for **Offline shell prepared on this browser** before relying on offline reopening.
3. Tap the appropriate team's large **+ Point** button. Each accepted local tap is written to device storage before the visible score changes. **Undo point** removes the last point in score calculation while retaining its audit history.
4. Use **Swap sides** to match the teams' positions on court. Names, points, games won, and previous-game scores move together on this screen; recorded team identities and results stay in their original order. The choice survives reloads in this browser tab. Use **Pause / Resume** as needed. Best-of games advance automatically according to that match's rules. The timer is calculated locally from recorded timing information.
5. Confirm the final result after the required games. **Result pending sync** means the cloud has not confirmed it; the authoritative court and bracket remain unchanged until acceptance.

Keep the scoring tab open when practical. If internet drops, keep scoring the already-prepared match. The status shows pending actions. Foreground reopening and reconnection retry in order; **Sync now** provides a manual retry.

After reopening, **Saved work to synchronize or reconcile** includes unfinished acknowledgements even if the server already completed the match or transferred scoring control. Open it to finish synchronization. Do not clear browser storage while work is pending. Storage may be cleared or evicted by the browser; offline durability is not unconditional.

If a storage error appears, the failed tap was not recorded locally. Resolve storage availability before continuing. If the cloud is unavailable or quota-limited, pending work stays on the phone.

## Controller transfer and corrections

Only one controller writes to a match. Disconnection does not release it.

To move scoring to another umpire or device, the organizer uses **Release controller**. The replacement opens the match and claims the authoritative score while online. Match assignments are not required.

Scoring-rule changes, result corrections, changed opponents, and returning a match to upcoming invalidate affected active scorers. Existing manual final-score entry and result correction remain available. Review the audit and use **Reconcile / restart at 0–0** when a fresh point session is appropriate.

Late actions from an old controller never overwrite the replacement score. The phone retains unresolved work and can export it. Settings lists rejected submissions received by the server; the organizer records a reconciliation decision. Only after that review should the umpire use **Archive reviewed work & claim current score**. The complete old phone record is retained locally as an archive, and a downloadable copy should be kept when relevant.

## Display operators

The organizer creates a named screen preset, then a **Read-only display** link/QR for it. Open that link on each display laptop; it lands directly on `/display`. Connect the monitor by HDMI or equivalent. Select fullscreen with the onscreen button if desired.

Presets support category selection, court filtering for Live scores, a Finals live-score filter, and centrally saved layouts. Blank category/court selections mean all. Standings and brackets retain category context. The organizer can edit a preset while screens are connected.

The existing layout editor and widget **Automatic / Always show / Hide** controls remain available. Browser-specific layouts are isolated by event/profile/preset. For a central layout, arrange and save it in the organizer's display tab, then select **Use this browser's saved display layout** when saving the preset in Settings.

- **Display disconnected**: this screen shows its last confirmed board and is waiting to reconnect.
- **Umpire updates delayed**: the screen is connected, but the controller has not contacted the cloud recently (45 seconds).
- **Awaiting organizer reconciliation**: the match/rules/controller changed and the score needs review.

A disconnected phone cannot send new live scores to a connected display. Display links are read-only, shareable for up to 30 days, and revocable from Settings.

## Lost access

Ask the organizer for a new staff invitation. The primary organizer can use their private recovery link; recovery replaces their previous sessions and supplies a new link to save. For a lost recovery link, contact the maintainer. Switching access in one browser also changes its shared session cookie; use separate browser profiles when operating different roles independently.
