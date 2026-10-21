import { test, expect } from "@playwright/test";
import { owner, request, invitation, importFixture, fixture, origin } from "../cloud/helpers.js";

async function prepare(browser) {
  const o = await owner(), state = await importFixture(o, fixture(1));
  const m = state.matches.find(m => m.status === "live"), inv = await invitation(o, "umpire", "Test umpire");
  await request("assign", { matchId: m.id, profile: inv.profile }, o.cookie);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(inv.url);
  await expect(page.getByRole("heading", { name: "Your matches" })).toBeVisible();
  await page.getByRole("button", { name: /Open scorer/ }).click();
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
  await expect(page.getByRole("heading", { name: "Your matches" })).toBeVisible();
  await page.getByRole("button", { name: /Open scorer/ }).click();
  await expect(page.getByRole("status")).toContainText("3 pending");
  await expect(page.locator(".score-team").first().locator("strong")).toHaveText("2");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: /^Point for/ }).first().click();
  await page.getByRole("button", { name: "Confirm final result" }).click();
  await expect(page.getByRole("status")).toContainText("Result pending sync");
  expect((await request("state", undefined, o.cookie)).data.matches.find(x => x.id === m.id).status).toBe("live");
  await context.setOffline(false);
  await page.getByRole("button", { name: "Sync now" }).click();
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
  await second.getByRole("button", { name: /Open scorer/ }).click();
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
  await expect(page.getByRole("heading", { name: "Your matches" })).toBeVisible();
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
  await request("assign", { matchId: otherMatch.id, profile: inv.profile }, other.cookie);
  await page.goto(inv.url);
  await page.getByRole("button", { name: /Open scorer/ }).click();
  await expect(page.getByRole("button", { name: "Claim scoring control" })).toBeVisible();
  await page.getByRole("button", { name: "Claim scoring control" }).click();
  await expect(page.locator(".score-team").first().locator("strong")).toHaveText("0");
  await expect(page.getByRole("status")).toContainText("0 pending");
  expect((await request("live", undefined, o.cookie)).data.live.find(r => r.matchId === m.id).score.points).toEqual([0, 0]);
  await context.close();
});

test("assignment changes refresh an open umpire list without rescanning; final acknowledgement recovers after reopen", async ({ browser }) => {
  const o = await owner(), state = await importFixture(o, fixture(1)), m = state.matches.find(m => m.status === "live");
  const inv = await invitation(o, "umpire");
  const context = await browser.newContext(), page = await context.newPage();
  await page.goto(inv.url);
  await expect(page.getByText("No assigned matches yet.", { exact: false })).toBeVisible();
  await request("assign", { matchId: m.id, profile: inv.profile }, o.cookie);
  await page.getByRole("button", { name: /Open scorer/ }).click();
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
  await context.close();
});
