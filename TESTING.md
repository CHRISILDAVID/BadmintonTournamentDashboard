# Testing the Cloudflare app

All previews use the same Worker and frontend as production. There is no separate Express app or laptop database.

## Build and unit checks

```powershell
npm ci
npm test
npm run build
npx wrangler deploy --dry-run
```

Unit tests cover tournament rules, imports, draws, scoring, corrections, court/player conflicts, stores, navigation, and venue layouts. Sample generators are test fixtures under `tests/fixtures/events.js`.

## Isolated integration tests

Start a local Worker in one terminal:

```powershell
npm run build
npx wrangler dev --local --port 8799 --persist-to output/cloud-test-state --var PROVISIONING_SECRET:local-test-secret
```

All bindings and databases are local. The secret above is only for tests. In another terminal:

```powershell
npm run test:cloud
npm run test:runtime
npx playwright install chromium
npm run test:browser
```

On Windows with Microsoft Edge installed, set `$env:PW_CHANNEL='msedge'` instead of downloading Chromium. API/browser tests use port 8799 and create isolated events. Keep them pointed at the local Worker: they create and change data. Runtime checks start a separate Worker on port 8801, verify restart persistence, then remove their temporary database.

To test random completion, restart the Worker with `--var ENABLE_TEST_TOOLS:true`, set `$env:CLOUD_TEST_TOOLS='true'`, then rerun cloud/browser tests. Without that flag, the suites verify random completion is disabled. `npm run test:load` exercises multiple local events, controllers, and displays.

## Browser walkthrough

1. Open `http://127.0.0.1:8799/maintainer`, unlock with the test secret, create a setup link, and open it in a separate browser context. Save the recovery link.
2. Create a category, add/import teams, generate groups, start a match, and verify court/player conflict messages.
3. Invite an umpire and display into separate contexts. Check permissions, scoring control, live updates, results, standings, and knockout advancement.
4. Prepare scoring online, disconnect the browser, record points, undo, reload, reconnect, and verify queued points synchronize once.
5. Check searches/filters, Back/Forward, phone/tablet layouts, venue widgets, bracket pan/zoom, and fullscreen.
6. Export and restore a backup into an empty event. Check IDs/results and rejection of imports into populated events.
7. Revoke access and verify HTTP/WebSocket denial while accepted results remain saved.

Stop Wrangler before removing `output/cloud-test-state/` to discard integration data, or `.wrangler/state/` to reset a normal preview. Neither is tracked by Git; removing them does not affect Cloudflare production.
