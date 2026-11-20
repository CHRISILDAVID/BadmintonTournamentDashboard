import { test, expect } from "@playwright/test";
import { owner, request, invitation, importFixture, fixture, origin } from "../cloud/helpers.js";
import { applyAction, emptyState } from "../../shared/tournament.js";

async function prepare(browser, draw = fixture(1)) {
  const o = await owner(), state = await importFixture(o, draw);
  const m = state.matches.find(m => m.status === "live"), inv = await invitation(o, "umpire", "Test umpire");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(inv.url);
  await expect(page.getByRole("heading", { name: "Event matches" })).toBeVisible();
  const a = state.teams.find(t => t.id === m.a).name, b = state.teams.find(t => t.id === m.b).name;
  await expect(page.locator(".point-scoring-card")).toContainText(`${a} vs ${b}`);
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
  await point.click();
  await expect(page.locator(".score-team").first().locator("strong")).toHaveText("1");
  await expect(page.getByRole("status")).toContainText("0 pending");
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
  await expect(page.getByText("Result recorded", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Event matches" })).toBeVisible();
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
  await expect(page.locator(".score-team").first().locator("strong")).toHaveText("2");
  await expect(page.getByRole("status")).toContainText("0 pending");
  const before = (await request("live", undefined, o.cookie)).data.live[0];
  await page.route("**/api/score", route => route.abort("internetdisconnected"));
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
  await page.unroute("**/api/score");
  await context.setOffline(false);
  // Reconnection flushes automatically; the button may already be disabled.
  await expect(page.getByRole("status")).toContainText("0 pending");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: `Point for ${a}`, exact: true }).click();
  await expect(page.locator(".score-games")).toContainText("1–5");
  await expect(page.locator(".score-team").last()).toContainText("1 games won");
  await page.getByRole("button", { name: "Swap sides", exact: true }).click();
  await expect(page.locator(".score-team").first().locator("h2")).toHaveText(a);
  await expect(page.locator(".score-games")).toContainText("5–1");
  const confirmResult = page.getByRole("button", { name: "Confirm final result" });
  await expect(confirmResult).toBeInViewport({ ratio: 1 });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.locator(".score-sticky-header")).toBeInViewport({ ratio: 1 });
  await expect(page.locator(".score-compact strong")).toHaveText(["5", "1"]);
  await confirmResult.click();
  await expect(page.getByText("Result recorded", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Event matches" })).toBeVisible();
  const final = (await request("state", undefined, o.cookie)).data.matches.find(x => x.id === m.id);
  expect(final.games).toEqual([[5, 1]]); expect(final.winner).toBe(m.a);
  await context.close();
});

test("umpire corrects Game 1 during Game 2 and confirms a changed winner", async ({ browser }) => {
  const { o, state, m, context, page } = await prepare(browser, fixture(1, 5, 3));
  const [a, b] = [m.a, m.b].map(id => state.teams.find(team => team.id === id).name);
  const pointA = page.getByRole("button", { name: `Point for ${a}`, exact: true });
  const pointB = page.getByRole("button", { name: `Point for ${b}`, exact: true });
  for (let i = 0; i < 5; i++) await pointA.click();
  for (let i = 0; i < 2; i++) await pointB.click();
  const scores = page.locator(".score-compact strong");
  await expect(scores).toHaveText(["0", "2"]);
  await expect(page.getByRole("status")).toContainText("0 pending");

  const game = page.getByRole("button", { name: "Correct Game 1 score" });
  const dialog = page.getByRole("dialog", { name: "Correct Game 1 score" });
  await page.route("**/api/score", route => route.abort("internetdisconnected"));
  await game.click();
  await dialog.getByLabel(b, { exact: true }).fill("2");
  await dialog.getByRole("button", { name: "Save correction" }).click();
  await expect(game).toContainText("5–2");
  await expect(scores).toHaveText(["0", "2"]);
  await expect(page.getByRole("status")).toContainText("1 pending");
  expect((await request("live", undefined, o.cookie)).data.live[0].score.games).toEqual([[5, 0]]);
  await page.unroute("**/api/score");
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(page.getByRole("status")).toContainText("0 pending");
  expect((await request("live", undefined, o.cookie)).data.live[0].score.games).toEqual([[5, 2]]);

  await game.click();
  await dialog.getByLabel(a, { exact: true }).fill("2");
  await dialog.getByLabel(b, { exact: true }).fill("5");
  await expect(dialog).toContainText("New games-won tally: 0–1");
  const save = dialog.getByRole("button", { name: "Save correction" });
  await expect(save).toBeDisabled();
  await dialog.getByLabel("Confirm winner change").check();
  await save.click();
  await expect(game).toContainText("2–5");
  await expect(scores).toHaveText(["0", "2"]);
  await page.getByRole("button", { name: "Undo point" }).click();
  await expect(scores).toHaveText(["0", "1"]);
  await expect(game).toContainText("2–5");
  for (let i = 0; i < 4; i++) await pointB.click();
  await page.getByRole("button", { name: "Confirm final result" }).click();
  await expect(page.getByText("Result recorded", { exact: true })).toBeVisible();
  const final = (await request("state", undefined, o.cookie)).data.matches.find(match => match.id === m.id);
  expect(final.games).toEqual([[2, 5], [0, 5]]);
  expect(final.winner).toBe(m.b);
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
  await expect(page.getByText("Result recorded", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Event matches" })).toBeVisible();
  expect((await request("state", undefined, o.cookie)).data.matches.find(x => x.id === m.id).games).toEqual([[5, 0]]);
  await page.reload();
  await expect(page.locator(".match-table").getByText("5–0", { exact: true })).toBeVisible();
  await expect(page.locator(".match-table tbody tr")).toHaveCount(state.matches.length);
  await context.close();
});

test("organizer Quick scoring returns to the filtered Matches page with a recorded result", async ({ context, page }) => {
  const organizer = await owner();
  const draw = fixture(1);
  const match = draw.matches.find(match => match.status === "live");
  const state = await importFixture(organizer, applyAction(draw, "teamArrival", {
    tournamentId: match.tournamentId, teamId: match.a, arrived: true,
  }));
  const tournamentId = state.tournaments[0].id;
  await context.addCookies([{ name: "sh_session", value: organizer.cookie.slice("sh_session=".length), url: origin, httpOnly: true, secure: true, sameSite: "Strict" }]);
  await page.goto(`${origin}/teams?tournament=${tournamentId}`);
  const arrival = page.getByLabel("Filter by arrival");
  const teamRows = page.locator(".teams-table tbody tr");
  await expect(arrival.getByRole("option")).toHaveText(["All teams (4)", "Arrived (1)", "Not arrived (3)"]);
  await arrival.selectOption("arrived");
  await expect(teamRows).toHaveCount(1);
  await expect(teamRows.first()).toContainText(state.teams.find(team => team.id === match.a).name);
  await arrival.selectOption("not-arrived");
  await expect(teamRows).toHaveCount(3);
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(teamRows).toHaveCount(4);
  const url = `${origin}/matches?tournament=${tournamentId}`;
  await page.goto(url);
  const quickScoring = page.getByRole("region", { name: /On court/ });
  await expect(quickScoring).toContainText("Court 1");
  await expect(page.locator('[data-match-status="live"]')).toHaveCSS("background-color", "rgb(237, 247, 240)");
  const liveOpponents = page.locator('[data-match-status="live"] .match-opponents');
  await expect(liveOpponents.getByRole("img", { name: "Arrived" })).toHaveCount(1);
  const opponentWithIcon = liveOpponents.locator(":scope > span").filter({ has: page.getByRole("img", { name: "Arrived" }) });
  await expect(opponentWithIcon).toContainText(state.teams.find(team => team.id === match.a).name);
  await expect(page.locator('[data-match-status="upcoming"]').first()).toHaveCSS("background-color", "rgb(245, 247, 251)");
  await quickScoring.getByRole("button", { name: /^Open scorer for / }).click();
  await page.getByRole("button", { name: "Claim scoring control" }).click();
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: /^Point for/ }).first().click();
  await page.getByRole("button", { name: "Confirm final result" }).click();
  await expect(page.getByText("Result recorded", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Match centre" })).toBeVisible();
  await expect(page).toHaveURL(url);
  await expect(page.locator('[data-match-status="completed"]')).toContainText("5–0");
});

test("tournament scoring fields stay blank when cleared and accept multi-digit values", async ({ context, page }) => {
  const organizer = await owner();
  const state = await importFixture(organizer, fixture(1));
  const tournamentId = state.tournaments[0].id;
  await context.addCookies([{ name: "sh_session", value: organizer.cookie.slice("sh_session=".length), url: origin, httpOnly: true, secure: true, sameSite: "Strict" }]);
  await page.goto(`${origin}/tournaments?tournament=${tournamentId}`);
  await page.getByRole("button", { name: "Edit scoring" }).click();
  const dialog = page.getByRole("dialog", { name: "Correct tournament scoring" });
  const points = dialog.getByLabel("League points", { exact: true });
  const cap = dialog.getByLabel("League score cap", { exact: true });
  await points.fill("");
  await expect(points).toHaveValue("");
  await points.pressSequentially("021");
  await expect(points).toHaveValue("21");
  await cap.fill("");
  await expect(cap).toHaveValue("");
  await cap.pressSequentially("27");
  await expect(cap).toHaveValue("27");
  await dialog.getByRole("button", { name: "Save scoring" }).click();
  await expect(dialog).toBeHidden();
  const saved = (await request("state", undefined, organizer.cookie)).data.tournaments[0];
  expect(saved.scoring.league).toMatchObject({ points: 21, cap: 27 });
});

test("organizer previews and saves two late teams into a fresh knockout draw", async ({ context, page }) => {
  const organizer = await owner();
  let draw = applyAction(emptyState(), "tournament", { name: "Walk-in doubles", size: 2, format: "knockouts", points: 21, cap: 30, bestOf: 1 });
  const tournamentId = draw.tournaments[0].id;
  draw = applyAction(draw, "teams", { tournamentId, teams: Array.from({ length: 6 }, (_, i) => ({
    players: [`Original ${i + 1} A`, `Original ${i + 1} B`],
  })) });
  const before = await importFixture(organizer, applyAction(draw, "generate", { tournamentId }));
  await context.addCookies([{ name: "sh_session", value: organizer.cookie.slice("sh_session=".length), url: origin, httpOnly: true, secure: true, sameSite: "Strict" }]);
  await page.goto(`${origin}/tournaments?tournament=${tournamentId}`);
  await page.getByRole("button", { name: "Edit knockouts" }).click();
  const editor = page.getByRole("dialog", { name: "Edit knockouts" });
  await editor.getByRole("button", { name: "Add late teams" }).click();
  await expect(editor.getByText("Walk-in doubles · 2 eligible byes")).toBeVisible();
  await editor.getByRole("button", { name: "Add another late team" }).click();
  const save = editor.getByRole("button", { name: "Save 2 late teams" });
  await expect(save).toBeDisabled();
  for (let index = 1; index <= 2; index++) {
    const entrant = editor.getByRole("group", { name: `Late team ${index}` });
    await entrant.getByLabel("Player 1", { exact: true }).fill(`Walk-in ${index} A`);
    await entrant.getByLabel("Player 2", { exact: true }).fill(`Walk-in ${index} B`);
    await entrant.getByLabel("Bye slot").selectOption({ index: 1 });
    await expect(entrant.locator(".ko-batch-preview")).toContainText(`vs Walk-in ${index} A - Walk-in ${index} B`);
    await expect(entrant.locator(".ko-batch-preview")).toContainText(/Semifinal \d+ will wait for the winner/);
  }
  await save.click();
  await expect(editor.getByRole("button", { name: "Add late teams" })).toBeVisible();
  const after = (await request("state", undefined, organizer.cookie)).data;
  expect(after.teams).toHaveLength(8);
  expect(after.matches.filter(match => match.bye)).toHaveLength(0);
  expect(after.matches.map(match => match.id)).toEqual(before.matches.map(match => match.id));

  await page.setViewportSize({ width: 850, height: 700 });
  await page.goto(`${origin}/standings?tournament=${tournamentId}`);
  const bracket = page.getByRole("region", { name: /Walk-in doubles knockout bracket/ });
  await expect(bracket.locator(".bracket-connectors path")).toHaveCount(6);
  const filledBye = before.matches.find(match => match.bye);
  const nextRound = after.matches.find(match => match.round === filledBye.round + 1 && match.index === Math.floor(filledBye.index / 2));
  await expect(bracket.locator(`path[data-from-match="${filledBye.id}"][data-to-match="${nextRound.id}"]`)).toBeAttached();
  const scrollLeft = await bracket.evaluate(node => {
    node.scrollLeft = node.scrollWidth;
    return node.scrollLeft;
  });
  expect(scrollLeft).toBeGreaterThan(0);
  expect(await bracket.evaluate(node => {
    const canvas = node.querySelector(".bracket-canvas").getBoundingClientRect();
    const cards = new Map([...node.querySelectorAll("[data-match-id]")].map(card => [card.dataset.matchId, card.getBoundingClientRect()]));
    return [...node.querySelectorAll(".bracket-connectors path")].every(path => {
      const start = path.getPointAtLength(0);
      const end = path.getPointAtLength(path.getTotalLength());
      const from = cards.get(path.dataset.fromMatch);
      const to = cards.get(path.dataset.toMatch);
      return Math.abs(start.x + canvas.left - from.right) < 1 && Math.abs(end.x + canvas.left - to.left) < 1
        && Math.abs(start.y + canvas.top - (from.top + from.height / 2)) < 1
        && Math.abs(end.y + canvas.top - (to.top + to.height / 2)) < 1;
    });
  })).toBe(true);
});
