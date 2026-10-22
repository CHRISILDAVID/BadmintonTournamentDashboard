import { test, expect } from "@playwright/test";
import { owner, request, invitation, importFixture, fixture, origin } from "../cloud/helpers.js";

async function prepare(browser) {
  const o = await owner(), state = await importFixture(o, fixture(1));
  const m = state.matches.find(m => m.status === "live"), inv = await invitation(o, "umpire", "Test umpire");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(inv.url);
  await expect(page.getByRole("heading", { name: "Event matches" })).toBeVisible();
  const a = state.teams.find(t => t.id === m.a).name, b = state.teams.find(t => t.id === m.b).name;
  await expect(page.locator(".point-scoring-match")).toContainText(`${a} vs ${b}`);
  await expect(page.getByRole("button", { name: /^Record result:|^Edit result:/ })).toHaveCount(0);
  await page.getByRole("button", { name: /^Open scorer:/ }).click();
  await page.getByRole("button", { name: "Claim scoring control" }).click();
  await expect(page.getByRole("button", { name: /^Point for/ }).first()).toBeEnabled();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.screenshot({ path: "output/playwright/mobile-scorer.png", fullPage: true });
  return { o, state, m, context, page };
}

test("mobile offline points, undo, completion and reload retain queue; two screens update after reconnect", async ({ browser }) => {
  const { o, state, m, context, page } = await prepare(browser);
  const preset = (await request("preset", { name: "Main screen" }, o.cookie)).data;
  const invite = await invitation(o, "display", "Main", preset.id);
  const screens = [];
  for (let i = 0; i < 2; i++) {
    const ctx = await browser.newContext(), screen = await ctx.newPage();
    await screen.goto(invite.url);
    await expect(screen.locator('[data-widget="live"]')).toBeVisible();
    const fits = await screen.locator(".live-score-card").first().evaluate(card => {
      const area = card.closest(".venue-widget-content").getBoundingClientRect();
      return card.getBoundingClientRect().bottom <= area.bottom;
    });
    expect(fits).toBe(true);
    if (!i) await screen.screenshot({ path: "output/playwright/live-display.png", fullPage: true });
    screens.push({ ctx, screen });
  }
  const point = page.getByRole("button", { name: /^Point for/ }).first();
  await point.click(); await expect(page.getByRole("status")).toContainText("0 pending");
  await context.setOffline(true);
  await point.click(); await point.click(); await page.getByRole("button", { name: "Undo point" }).click();
  await expect(page.getByRole("status")).toContainText("3 pending");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Event matches" })).toBeVisible();
  await page.getByRole("button", { name: /^Open scorer:/ }).click();
  await expect(page.getByRole("status")).toContainText("3 pending");
  await expect(page.locator(".score-team").first().locator("strong")).toHaveText("2");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: /^Point for/ }).first().click();
  await page.getByRole("button", { name: "Confirm final result" }).click();
  await expect(page.getByRole("status")).toContainText("Result pending sync");
  expect((await request("state", undefined, o.cookie)).data.matches.find(x => x.id === m.id).status).toBe("live");
  await context.setOffline(false);
  // Reconnection flushes automatically; the button may already be disabled.
  await expect(page.getByRole("status")).toContainText("Result confirmed");
  const final = (await request("state", undefined, o.cookie)).data.matches.find(x => x.id === m.id);
  expect(final.games).toEqual([[5, 0]]);
  for (const { ctx, screen } of screens) {
    await expect(screen.locator('[data-widget="results"]')).toContainText(state.teams.find(t => t.id === m.a).name);
    await ctx.close();
  }
  await context.close();
});

test("lost acknowledgement retries once; storage failure never reports a recorded point; competing tabs are locked", async ({ browser }) => {
  const { o, m, context, page } = await prepare(browser);
  let dropped = false;
  await page.route("**/api/score", async route => {
    if (!dropped) { dropped = true; await route.fetch(); await route.abort(); }
    else await route.continue();
  });
  await page.getByRole("button", { name: /^Point for/ }).first().click();
  await expect(page.getByRole("status")).toContainText("1 pending");
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(page.getByRole("status")).toContainText("0 pending");
  const live = (await request("live", undefined, o.cookie)).data.live.find(r => r.matchId === m.id);
  expect(live.score.points).toEqual([1, 0]);
  const second = await context.newPage(); await second.goto(`${origin}/matches`);
  await second.getByRole("button", { name: /^Open scorer:/ }).click();
  await expect(second.getByRole("alert")).toContainText("another tab");
  await second.close();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    globalThis.restorePut = () => { IDBObjectStore.prototype.put = original; };
    IDBObjectStore.prototype.put = function () { throw new DOMException("Simulated storage full", "QuotaExceededError"); };
  });
  await page.getByRole("button", { name: /^Point for/ }).first().click();
  await expect(page.getByRole("alert")).toContainText("storage");
  await expect(page.locator(".score-team").first().locator("strong")).toHaveText("1");
  expect((await request("live", undefined, o.cookie)).data.live[0].score.points[0]).toBe(1);
  await page.evaluate(() => globalThis.restorePut());
  await context.close();
});

test("revocation closes an existing socket; umpire URL cannot expose organizer routes", async ({ browser }) => {
  const { o, context, page } = await prepare(browser);
  await page.goto(`${origin}/settings`);
  await expect(page.getByRole("heading", { name: "Event matches" })).toBeVisible();
  expect(page.url()).toContain("/matches");
  expect(await page.getByRole("heading", { name: "Club settings" }).count()).toBe(0);
  const sessions = (await request("access", undefined, o.cookie)).data.sessions;
  const umpire = sessions.find(s => s.role === "umpire");
  await request("revoke", { sessionId: umpire.id }, o.cookie);
  await expect(page.getByText("Access expired or was revoked.", { exact: false })).toBeVisible();
  await context.close();
});

test("organizer settings render invitations and presets; display preset changes arrive live", async ({ browser }) => {
  const o = await owner(), state = await importFixture(o);
  const ctx = await browser.newContext();
  await ctx.addCookies([{ name: "sh_session", value: o.cookie.slice("sh_session=".length), url: origin, httpOnly: true, secure: true, sameSite: "Strict" }]);
  const page = await ctx.newPage(); await page.goto(`${origin}/settings`);
  await expect(page.getByRole("heading", { name: "Cloud access & screens" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Scoring control", exact: true })).toBeVisible();
  await expect(page.getByLabel(/^Assign match/)).toHaveCount(0);
  await page.getByLabel("Screen name").fill("Courts 1");
  await page.getByLabel("Screen courts").fill("1");
  await page.getByRole("button", { name: "Save screen preset", exact: true }).click();
  await expect(page.getByLabel("Edit preset").locator("option")).toHaveCount(2);
  const access = (await request("access", undefined, o.cookie)).data, preset = access.presets[0];
  const invite = await invitation(o, "display", "Screen", preset.id);
  const displayContext = await browser.newContext(), screen = await displayContext.newPage();
  await screen.goto(invite.url);
  await expect(screen.locator(".live-score-card")).toHaveCount(1);
  await expect(screen.locator(".live-score-card")).toContainText("Court 1");
  await request("preset", { ...preset, courts: [2], categories: [state.tournaments[1].id] }, o.cookie);
  await expect(screen.locator(".live-score-card")).toHaveCount(1);
  await expect(screen.locator(".live-score-card")).toContainText("Court 2");
  await displayContext.close(); await ctx.close();
});

test("429 and provider failure preserve pending points; switching event never replays the old queue", async ({ browser }) => {
  const { o, m, context, page } = await prepare(browser);
  for (const status of [429, 503]) {
    await page.route("**/api/score", route => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: "Cloud unavailable. Pending work is retained." }) }));
    await page.getByRole("button", { name: /^Point for/ }).first().click();
    await expect(page.getByRole("alert")).toContainText("Pending work is retained");
    await page.unroute("**/api/score");
  }
  await expect(page.getByRole("status")).toContainText("2 pending");
  expect((await request("live", undefined, o.cookie)).data.live.find(r => r.matchId === m.id).score.points).toEqual([0, 0]);
  const other = await owner(), otherState = await importFixture(other, fixture(1));
  const otherMatch = otherState.matches.find(m => m.status === "live"), inv = await invitation(other, "umpire");
  await page.goto(inv.url);
  await page.getByRole("button", { name: /^Open scorer:/ }).click();
  await expect(page.getByRole("button", { name: "Claim scoring control" })).toBeVisible();
  await page.getByRole("button", { name: "Claim scoring control" }).click();
  await expect(page.locator(".score-team").first().locator("strong")).toHaveText("0");
  await expect(page.getByRole("status")).toContainText("0 pending");
  expect((await request("live", undefined, o.cookie)).data.live.find(r => r.matchId === m.id).score.points).toEqual([0, 0]);
  await context.close();
});

test("umpire starts and schedules matches from the shared match desk", async ({ browser }) => {
  const o = await owner(), state = await importFixture(o, fixture(1));
  const m = state.matches.find(m => m.status === "live");
  expect((await request("action", { action: "returnMatch", revision: state.revision, payload: { matchId: m.id } }, o.cookie)).status).toBe(200);
  const inv = await invitation(o, "umpire");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage();
  await page.goto(inv.url);
  await expect(page.getByRole("button", { name: /^Start game:/ })).toHaveCount(state.matches.length);
  await expect(page.getByLabel("Filter by tournament")).toBeVisible();
  await page.getByLabel("Match status", { exact: true }).selectOption("upcoming");
  await page.getByRole("button", { name: /^Start game:/ }).first().click();
  await page.getByLabel("Optional scheduled start").fill("14:30");
  await page.getByRole("button", { name: "Save schedule", exact: true }).click();
  await expect(page.locator(".match-table tbody tr").first()).toContainText("Planned 2:30 pm");
  await page.getByRole("button", { name: /^Start game:/ }).first().click();
  await page.getByRole("dialog").getByRole("combobox").selectOption("2");
  await page.getByRole("button", { name: "Start game", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Match status", { exact: true }).selectOption("live");
  await expect(page.locator(".match-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".match-table")).toContainText("Court 2");
  await page.getByRole("button", { name: /^Open scorer:/ }).click();
  await page.getByRole("button", { name: "Claim scoring control" }).click();
  await page.getByRole("button", { name: /^Point for/ }).first().click();
  await expect(page.getByRole("status")).toContainText("0 pending");
  const remote = (await request("state", undefined, o.cookie)).data.matches.find(x => x.id === m.id);
  expect(remote.status).toBe("live"); expect(remote.court).toBe(2);
  await page.getByRole("button", { name: /Matches/ }).click();
  await page.getByRole("link", { name: "Match history", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Match history", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Match history", exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "Umpire navigation" }).getByRole("link", { name: "Standings & brackets" }).click();
  await expect(page.locator(".standing-table")).toBeVisible();
  await context.close();
});

test("side swap keeps points, game scores and the final winner attached to their teams", async ({ browser }) => {
  const { o, state, m, context, page } = await prepare(browser);
  const a = state.teams.find(t => t.id === m.a).name, b = state.teams.find(t => t.id === m.b).name;
  await page.getByRole("button", { name: `Point for ${a}`, exact: true }).click();
  await page.getByRole("button", { name: `Point for ${a}`, exact: true }).click();
  await expect(page.getByRole("status")).toContainText("0 pending");
  const before = (await request("live", undefined, o.cookie)).data.live[0];
  await context.setOffline(true);
  await page.getByRole("button", { name: "Swap sides", exact: true }).click();
  await expect(page.locator(".score-team").first().locator("h2")).toHaveText(b);
  await expect(page.locator(".score-team").last().locator("strong")).toHaveText("2");
  await page.getByRole("button", { name: `Point for ${b}`, exact: true }).click();
  await expect(page.getByRole("status")).toContainText("1 pending");
  await page.reload();
  await page.getByRole("button", { name: /^Open scorer:/ }).click();
  await expect(page.getByRole("button", { name: "Swap sides", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".score-team").first().locator("strong")).toHaveText("1");
  await expect(page.locator(".score-team").last().locator("strong")).toHaveText("2");
  expect((await request("live", undefined, o.cookie)).data.live[0].revision).toBe(before.revision);
  await context.setOffline(false);
  // Reconnection flushes automatically; the button may already be disabled.
  await expect(page.getByRole("status")).toContainText("0 pending");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: `Point for ${a}`, exact: true }).click();
  await expect(page.locator(".score-games")).toContainText("1–5");
  await expect(page.locator(".score-team").last()).toContainText("1 games won");
  await page.getByRole("button", { name: "Confirm final result" }).click();
  await expect(page.getByRole("status")).toContainText("Result confirmed");
  const final = (await request("state", undefined, o.cookie)).data.matches.find(x => x.id === m.id);
  expect(final.games).toEqual([[5, 1]]); expect(final.winner).toBe(m.a);
  await page.getByRole("button", { name: "Swap sides", exact: true }).click();
  await expect(page.locator(".score-team").first().locator("h2")).toHaveText(a);
  await expect(page.locator(".score-games")).toContainText("5–1");
  await context.close();
});

test("all event fixtures appear without assignment; final acknowledgement recovers after reopen", async ({ browser }) => {
  const o = await owner();
  const inv = await invitation(o, "umpire");
  const context = await browser.newContext(), page = await context.newPage();
  await page.goto(inv.url);
  await expect(page.getByText("No matches here yet", { exact: false })).toBeVisible();
  const state = await importFixture(o, fixture(1)), m = state.matches.find(m => m.status === "live");
  await expect(page.locator(".match-table tbody tr")).toHaveCount(state.matches.length);
  await expect(page.getByRole("button", { name: /^Start game:/ })).toHaveCount(state.matches.filter(m => m.status === "upcoming").length);
  await page.getByRole("button", { name: /^Open scorer:/ }).click();
  await page.getByRole("button", { name: "Claim scoring control" }).click();
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: /^Point for/ }).first().click();
  await expect(page.getByRole("status")).toContainText("0 pending");
  await page.route("**/api/score", async route => { await route.fetch(); await route.abort(); });
  await page.getByRole("button", { name: "Confirm final result" }).click();
  await expect(page.getByRole("status")).toContainText("Result pending sync");
  await page.reload();
  await page.unroute("**/api/score");
  await page.getByRole("button", { name: /Open saved scoring work/ }).click();
  await expect(page.getByRole("status")).toContainText("Result confirmed");
  expect((await request("state", undefined, o.cookie)).data.matches.find(x => x.id === m.id).games).toEqual([[5, 0]]);
  await page.reload();
  await expect(page.locator(".match-table").getByText("5–0", { exact: true })).toBeVisible();
  await expect(page.locator(".match-table tbody tr")).toHaveCount(state.matches.length);
  await context.close();
});
