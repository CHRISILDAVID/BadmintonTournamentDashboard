# Implementation prompt: ShuttleHub cloud hosting, isolated organizers, and live umpire scoring

Implement the following in the existing ShuttleHub Tournament Dashboard repository. This is an implementation handoff for the selected cloud architecture. Preserve existing tournament behavior and build the features below. Do not replace the application with a generic tournament starter.

## 1. Selected architecture and scope

Use a fully cloud-hosted application with isolated organizers. The earlier local-hotspot, offline-router, Tailscale, and laptop-tunnel proposals are superseded. Internet is required for communication with the cloud; temporary offline scoring must still work as described below.

Proposed stack:

- Keep the existing React/Vite interface and Zustand stores where suitable.
- Reuse the existing JavaScript tournament engine and shared scoring/standings rules.
- Cloudflare Workers Static Assets for the frontend and a Worker for API routing and access checks.
- One SQLite-backed Durable Object per event, owning that event's tournament state, scoring records, and coordinated mutations.
- A small persistent workspace/owner directory for provisioning, invitations, and access records, using the same free-tier stack where appropriate.
- WebSockets for live updates, using Durable Object WebSocket Hibernation support.
- IndexedDB for the phone's persistent pending scoring queue.
- A service worker and web app manifest for offline loading of the prepared scoring interface.
- Wrangler for local development and deployment.
- Single-use QR invitations and secure browser sessions instead of conventional accounts.

No laptop is the server. Organizer laptops, umpire phones, and display laptops independently connect to the same HTTPS website. Devices may use unrelated Wi-Fi networks or mobile data. Closing an organizer laptop must not interrupt other devices.

Verify current official Cloudflare capabilities, runtime compatibility, pricing, and limits before implementation. The proposal is technically viable, but do not present untested compatibility, capacity, or latency as guaranteed. Investigate and report any material blocker before substituting a different provider or adding a paid dependency.

## 2. Organizer isolation: exactly one event per organizer

This is a mandatory correction to the earlier multi-event proposal:

- Each primary organizer owns one private workspace with exactly one event desk.
- An organizer cannot create or own a second event. Enforce this on the server and in persistent storage, including concurrent provisioning requests. Do not enforce it only by hiding a UI button.
- Do not introduce an event switcher, multiple-event management, or an archive-and-create loophole.
- The event can contain multiple tournament categories: singles, doubles, mixed, custom categories, and the other formats the application already supports. These categories are not additional events.
- Existing category creation, history, and reuse within the single desk must remain available.
- An owner may invite additional organizers to manage that same event. For this version, organizer credentials/sessions must not provide management access to multiple events.
- Different primary organizers at different venues receive independent workspaces, event stores, court numbering, fixtures, players, scores, roles, and displays.

Conceptual structure:

    Cloud application
    - Organizer A -> Workspace A -> Event A -> Multiple tournament categories
    - Organizer B -> Workspace B -> Event B -> Multiple tournament categories

The event database and coordinator are separate per event. Workspace membership and authorization must also be enforced before accessing that coordinator. An event ID is a routing identifier, never an authorization credential.

No-account access cannot prove that two independently provisioned credentials belong to the same physical human. Enforce one event per provisioned organizer identity/workspace, and prevent unrestricted public owner/event provisioning. Do not claim stronger identity enforcement than the design actually provides.

## 3. User experience and authentication

Tournament staff must not install Node.js, Tailscale, a VPN, or a native app. They must not configure server IP addresses, firewall rules, port forwarding, tunnels, DNS, or the cloud provider.

No email registration, password, OTP, or social sign-in for day-to-day application use.

Main organizer:

1. Receives a private initial setup link through a controlled provisioning process.
2. Opens it once to establish their organizer session and access their single event.
3. Browser remembers access across ordinary reloads and restarts, subject to session expiry/revocation.
4. Uses the existing management dashboard.
5. Creates umpire invitations, assigns matches/courts, and shares display links.
6. Saves a private recovery link/code for restoring access on a new device or after browser storage is cleared.

Additional organizer:

- Scans a short-lived, single-use organizer invitation for the same event.
- Receives a remembered management session for that event only.

Umpire:

- Scans an individual short-lived, single-use invitation.
- Lands on `/matches` with a mobile scoring interface and permitted match list.
- Can score only assigned matches; assignment changes should not require scanning again.
- Cannot access overview, team management, settings, standings management, tournament setup, bulk testing tools, exports, or any other management operation.

Display operator:

- Opens a shareable read-only display link directly into `/display`.
- Clicks fullscreen if desired. Do not assume browsers allow automatic fullscreen without a user gesture.
- Does not need to open the management dashboard or obtain an organizer session.

Implement authorization on all relevant HTTP requests and WebSocket operations, not only navigation. Use high-entropy invitation/recovery secrets, store secret hashes where suitable, expire invitations, prevent reuse, and establish Secure/HttpOnly/SameSite sessions. Keep secrets out of logs and long-lived URLs; remove invitation material from the address bar after redemption. Protect mutations against cross-site requests and validate WebSocket origins.

Private organizer/recovery links grant authority to whoever possesses them. Do not describe them as harmless URLs. Provide revocation and recovery without creating a complicated tournament-day workflow. A revoked session must lose existing live-connection privileges as well as future HTTP access.

## 4. Preserve the existing application

Inspect the repository and applicable AGENTS.md instructions first. Check git status and preserve unrelated/uncommitted work.

The current application uses Express, Node's built-in SQLite, React/Vite, Zustand, server-sent events, and a largely separate tournament engine. Inspect the actual current code; do not assume every detail in this prompt still matches the checkout.

Replace/adapt cloud transport and persistence rather than rewriting tournament rules. Preserve:

- Tournament categories, supported team sizes, custom formats, imports and exports.
- CSV/XLSX validation and templates, team/player edits, groups, seeding, and fixtures.
- Court occupancy and player conflict checks across categories in the same event.
- League, playoffs, qualification, byes, knockout generation, advancement, and standings.
- Independent scoring rules by stage, best-of formats, golden point, deuce, and score caps.
- Existing permitted scoring-rule edits, including unfinished/on-court matches; handle their interaction with active scoring sessions explicitly.
- Manual final-score entry, result corrections, dependent-match resets, court release, and history.
- Existing organizer routes, URL filters, responsive behavior, display widgets, layout editing, visibility, scrolling, and preferences.
- Existing organizer actions that remain relevant; restrict testing/demo tools appropriately for real event use.

Current code treats non-display users as administrators and exposes unrestricted state/action endpoints. Replace these assumptions with real event-scoped permissions. Review existing startup migrations, including legacy live-field cleanup, so they cannot erase new scoring data.

Adapt runtime-specific imports and storage APIs for Workers. Audit runtime limits, payload sizes, transaction behavior, and large supported draws. Do not assume the current Express/Node SQLite server runs unchanged in a Worker.

Provide a non-destructive migration path for existing local data into one selected organizer's event, retaining IDs, results, and scoring settings. Validate the destination, preserve a backup, and never silently overwrite another event.

## 5. Point-by-point scoring

Build a phone-friendly scoring view under `/matches`. The reference design has:

- Court, match identifier, category, game number, and scoring target at the top.
- Large team scores and player names.
- Large point buttons for each team, plus Undo and Pause/Resume.
- Elapsed match time and a clear live/paused/connection status.
- Previous game scores and games won for best-of matches.
- Final-result confirmation.

Use actual team IDs for point attribution; do not confuse one doubles player's name with the whole team's identity. Do not invent unsupported serve/rotation rules; if serving indicators are added, implement and verify their rules explicitly.

Represent scoring actions as an ordered event history: award point, undo, pause/resume, game transitions as required, and final confirmation. Include unique action ID, event ID, match ID, controller/session generation, and per-session sequence/version data.

Required correctness:

- Persist each tap locally before reporting it as recorded; surface a local storage failure immediately.
- Apply the local score without waiting for a round trip, but distinguish pending from server-confirmed state.
- Deduplicate retries, including when the server saved an action but the acknowledgement was lost.
- Validate ordering, match ownership, match status, and current scoring rules on the server.
- Store accepted events and the authoritative score atomically before acknowledgement/broadcast.
- Use per-match scoring revisions so unrelated courts do not produce global revision conflicts.
- Keep scoring events/current match scores separate from the large tournament snapshot; avoid rewriting or broadcasting the entire event for every point.
- Preserve Undo in the audit history and ensure queued undo behaves correctly across reconnects.
- Reuse the existing final-result processing engine after validating the accepted game scores. Court release, standings, and advancement occur exactly once.
- Maintain coordinated event-wide checks for actions involving courts, players, brackets, and corrections.
- Do not write or broadcast a timer tick every second; clients calculate elapsed time from authoritative timing/pause state.

## 6. Controller ownership and conflicts

Only one active scoring controller may write to a match at a time. Prevent competing tabs/devices from independently controlling the same match.

- Claim/start a new scoring session while connected and authorized.
- Temporary disconnection must not automatically free the controller slot.
- An organizer can explicitly transfer control to another umpire/device.
- Transfer changes the controller generation and revokes the old writer.
- Late offline actions from a revoked controller must never overwrite the replacement controller's score. Retain them for explicit organizer reconciliation with clear status.
- Result corrections, return-to-upcoming actions, changed opponents, and changed scoring rules must invalidate/reconcile affected active sessions and their pending actions safely.
- Preserve the existing ability to make authorized corrections; do not silently remove it to simplify conflict handling.

## 7. Offline behavior and recovery

Cache the scoring shell through a service worker over HTTPS. Store assigned-match state and pending actions in IndexedDB. The phone must first load the app and match while connected; first-time offline access is not promised.

- Umpire offline: keep scoring the already-prepared match, show a conspicuous offline/pending count, and retain pending work across reload/reopen when browser storage is available.
- Reconnection: upload pending actions in order, deduplicate, reconcile against authoritative state, and acknowledge accepted progress without losing unresolved work.
- Do not rely exclusively on mobile background sync; synchronize while foregrounded, on reconnect, and when reopened.
- Offline match completion: show `Result pending sync`; do not advance the bracket or release the authoritative court until accepted.
- Display offline: keep its last confirmed board visible with a disconnected warning; resynchronize when connectivity returns.
- Umpire offline while display remains connected: mark that court's scoring updates as delayed based on controller-contact freshness, even when the score has not changed.
- Organizer laptop closed or hotspot lost: independent devices continue if their own internet still works.
- Provider failure or exhausted quota: preserve pending scoring locally, explain the unavailable state, and retry without falsely claiming server confirmation.

No architecture can deliver new live scores from a completely disconnected phone. Do not label stale scores as current. Browser storage can be cleared or evicted; do not promise unconditional offline data durability.

## 8. Multiple displays and live-score widget

Display laptops can be at different courts/venues and on different networks. Each opens its own event's `/display` link and connects to its monitor by HDMI or equivalent. No connection to an organizer laptop is required.

- Add Live scores to the existing movable/resizable display-widget system.
- Preserve Automatic / Always show / Hide behavior and existing widgets.
- Show court, match, category, players, current score, games won, previous games, and playing/paused state.
- Distinguish a disconnected display from an umpire whose updates are delayed.
- Broadcast confirmed match changes to relevant viewers; send a scoped snapshot after reconnect or missed updates.
- Support cloud-saved event-scoped screen presets such as Main screen, Courts 1-3, Courts 4-6, and Finals.
- Each preset has a shareable read-only link/QR. Organizer can configure the preset centrally; connected screens receive changes.
- Preserve current browser-specific layout capabilities; namespace all local preferences, caches, queued actions, and saved selections by event/profile to prevent collisions.
- Switching role/event or revoking access must not expose a previous organizer's private cached data or replay their queued actions under another identity.

## 9. Cost, latency, and setup requirements

Only free tiers are acceptable. No paid domain, paid email/SMS, paid authentication, required subscription, or automatic upgrade to a paid plan. Use the provider's free HTTPS subdomain.

Consult current official documentation rather than hardcoding remembered quotas. Track request units, rows read/written including index overhead, storage, connection/reconnect load, and active compute duration. Free-tier quotas are shared across all organizers/events under the same hosting account.

- Budget and load-test for multiple simultaneous venues, not only one event.
- Use hibernating connections, targeted updates, indexed reads, and appropriate heartbeat handling; avoid polling and periodic server work that defeats hibernation.
- Expose useful usage/capacity status and a practical export/backup path to organizers. Label estimates honestly; do not invent provider metrics the app cannot obtain.
- Establish a documented tested capacity with headroom. If expected use exceeds free limits, report that clearly rather than enabling billing or claiming unlimited capacity.
- Target under one second from a connected umpire action to a confirmed display update on healthy networks, and measure latency. This is a target, not an internet-independent guarantee or a claim that cloud is faster than a good LAN.

Deployment/provider account setup is a one-time maintainer task. Tournament staff must only need internet, a browser, and their role link/QR. Different connections avoid the main hotspot's device cap; devices that still share one hotspot remain subject to that hotspot's actual capacity.

## 10. Validation and deliverables

Use isolated test data, not working tournament data. Run the existing appropriate checks and add meaningful integration/browser tests for the new behavior.

At minimum verify:

- Two owners/events with identical court numbers and category names cannot read, mutate, subscribe to, export, or recover each other's data.
- Tampered event IDs, forged roles, reused/expired invitations, revoked sessions, and existing WebSocket connections cannot bypass permissions.
- Concurrent attempts cannot provision a second event for the same organizer identity.
- Umpires cannot access management features or modify unassigned matches through direct API calls.
- Several courts score concurrently without unrelated revision failures.
- Retry after a lost acknowledgement does not duplicate a point or finalization.
- Offline points, offline undo, offline completion, reload/reopen, and reconnection retain correct state.
- Controller takeover and later stale queued submissions cannot corrupt the new score.
- Cloud process restart/hibernation/redeploy does not lose accepted data; clients recover.
- Multiple independent display laptops show correct scoped updates and screen presets.
- Active-match rule changes, result corrections, dependent-match resets, and bracket advancement preserve current behavior.
- Existing imports, supported formats/large draws, history, manual final scoring, widgets, layout, navigation, and responsiveness still work.
- Rate/quota/storage failures do not create false success or silently lose queued actions.

Deliver working code, appropriate tests, deployment configuration, migration/backup instructions, a short organizer/umpire/display guide, and measured capacity/latency results with remaining limitations. State what is implemented, tested, deployed, and still requires provider access accurately.

Implement autonomously within the authorized scope, preserving unrelated work. Ask only for genuinely missing credentials or decisions that cannot be safely inferred. Keep progress updates and the final report concise. Do not claim zero bugs, zero delay, unlimited free capacity, or tournament readiness without evidence.
