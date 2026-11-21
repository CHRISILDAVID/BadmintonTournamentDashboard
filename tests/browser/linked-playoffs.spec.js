import { expect, test } from "@playwright/test";
import { importFixture, invitation, origin, owner, redeem, request } from "../cloud/helpers.js";
import { applyAction, emptyState } from "../../shared/tournament.js";

test("organizer links two categories and their finalists advance through the event bracket", async ({ browser }) => {
  const event = await owner();
  let initial = emptyState();
  const sources = ["Pure Beginner", "Beginner"].map(name => {
    initial = applyAction(initial, "tournament", { name, size: 2, format: "knockouts", points: 5, cap: 6, bestOf: 1 });
    const tournamentId = initial.tournaments.at(-1).id;
    initial = applyAction(initial, "teams", { tournamentId, teams: [
      { players: [`${name} Alice`, `${name} Bob`] },
      { players: [`${name} Charlie`, `${name} Dana`] },
    ] });
    initial = applyAction(initial, "generate", { tournamentId });
    return tournamentId;
  });
  await importFixture(event, initial);
  const context = await browser.newContext();
  await context.addCookies([{ name: "sh_session", value: event.cookie.slice("sh_session=".length),
    url: origin, httpOnly: true, secure: true, sameSite: "Strict" }]);
  const page = await context.newPage();
  await page.goto(`${origin}/tournaments`);
  await page.getByRole("button", { name: "New tournament" }).click();
  await page.getByLabel("Tournament name").fill("Overall Title");
  await page.getByLabel("Players per team").fill("2");
  await page.getByRole("button", { name: "Next: format & scoring" }).click();
  await page.getByLabel("Tournament format").selectOption("linked");
  await page.getByLabel("Linked bracket").selectOption("semifinals");
  await page.getByLabel("Source category 1").selectOption(sources[0]);
  await page.getByLabel("Source category 2").selectOption(sources[1]);
  await page.getByLabel("Linked playoffs best of").selectOption("1");
  await page.getByLabel("Linked playoffs points").fill("5");
  await page.getByRole("button", { name: "Create tournament", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  let current = (await request("state", undefined, event.cookie)).data;
  const linkedId = current.tournaments.find(t => t.name === "Overall Title").id;
  await page.goto(`${origin}/matches`);
  await expect(page.getByRole("cell", { name: "Category Final", exact: true })).toHaveCount(2);
  await page.goto(`${origin}/standings?tournament=${linkedId}`);
  await expect(page.getByRole("heading", { name: "Grand Semifinals" })).toBeVisible();
  await expect(page.getByText("Pure Beginner #1", { exact: true })).toBeVisible();

  async function finish(match) {
    for (const [action, payload] of [["start", { court: 1 }], ["finish", { games: [[5, 0]] }]]) {
      const result = await request("action", { action, payload: { matchId: match.id, ...payload }, revision: current.revision }, event.cookie);
      expect(result.status, JSON.stringify(result.data)).toBe(200);
      current = result.data;
    }
  }
  for (const id of sources) await finish(current.matches.find(m => m.tournamentId === id));
  await page.reload();
  await expect(page.getByText("Pure Beginner Alice - Pure Beginner Bob", { exact: true })).toBeVisible();
  await expect(page.getByText("Beginner Charlie - Beginner Dana", { exact: true })).toBeVisible();

  for (const match of current.matches.filter(m => m.tournamentId === linkedId && m.stage === "Semifinal")) await finish(match);
  await finish(current.matches.find(m => m.tournamentId === linkedId && m.stage === "Final"));
  await page.goto(`${origin}/tournaments`);
  await expect(page.getByText("Pure Beginner Alice - Pure Beginner Bob · Overall champion", { exact: true })).toBeVisible();

  const preset = await request("preset", { categories: [linkedId] }, event.cookie);
  const invite = await invitation(event, "display", "Grand Final screen", preset.data.id);
  const display = await redeem(invite.url);
  const screen = await request("state", undefined, display.cookie);
  expect(screen.data.tournaments.map(t => t.id)).toEqual([linkedId]);
  expect(screen.data.teams).toHaveLength(4);
  expect(screen.data.matches.find(m => m.stage === "Final").stageLabel).toBe("Grand Final");
  const displayContext = await browser.newContext();
  await displayContext.addCookies([{ name: "sh_session", value: display.cookie.slice("sh_session=".length),
    url: origin, httpOnly: true, secure: true, sameSite: "Strict" }]);
  const venue = await displayContext.newPage();
  await venue.goto(`${origin}/display`);
  await expect(venue.getByText("Pure Beginner Alice - Pure Beginner Bob · Overall champion", { exact: true })).toBeVisible();
  await displayContext.close();

  const restored = await owner();
  const backup = await importFixture(restored, current);
  expect(backup.matches.filter(m => m.tournamentId === linkedId)).toHaveLength(3);
  await context.close();
});
