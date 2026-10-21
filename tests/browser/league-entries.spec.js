import { test, expect } from "@playwright/test";
import { owner, importFixture, fixture, origin, request } from "../cloud/helpers.js";
import { applyAction } from "../../server/engine.js";

test("organizer adds late teams and a new group, then removes a team and its results during league", async ({ browser }) => {
  const o = await owner();
  let initial = fixture(1);
  const played = initial.matches.find(m => m.status === "live");
  initial = applyAction(initial, "finish", { matchId: played.id, games: [[5, 0]] });
  const state = await importFixture(o, initial), t = state.tournaments[0];
  const context = await browser.newContext();
  await context.addCookies([{ name: "sh_session", value: o.cookie.slice("sh_session=".length), url: origin, httpOnly: true, secure: true, sameSite: "Strict" }]);
  const page = await context.newPage();
  await page.goto(`${origin}/teams?tournament=${t.id}`);
  await page.getByRole("button", { name: "Add team", exact: true }).click();
  await page.getByLabel("Add teams to group", { exact: true }).selectOption("0");
  await page.getByLabel("Player 1", { exact: true }).fill("Late Alice");
  await page.getByLabel("Player 2", { exact: true }).fill("Late Bob");
  await page.getByRole("button", { name: "Save team", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "Late Alice - Late Bob", exact: true })).toBeVisible();
  let current = (await request("state", undefined, o.cookie)).data;
  expect(current.matches).toHaveLength(10);
  expect(current.matches.find(m => m.id === played.id)).toEqual(state.matches.find(m => m.id === played.id));

  await page.getByRole("button", { name: "New group", exact: true }).click();
  await expect(page.getByLabel("Add teams to group", { exact: true })).toHaveValue("new");
  await page.getByLabel("Team spreadsheet").setInputFiles({ name: "late-group.csv", mimeType: "text/csv",
    buffer: Buffer.from("player1,player2\nNew A,New B\nNew C,New D\nNew E,New F\n") });
  await expect(page.getByText("3 teams ready to review")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Import teams", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "Group B", exact: true })).toHaveCount(3);
  current = (await request("state", undefined, o.cookie)).data;
  expect(current.tournaments[0].groups).toBe(2);
  expect(current.matches.filter(m => m.group === 1)).toHaveLength(3);

  const withdrawn = state.teams.find(x => x.id === played.a);
  await page.getByRole("button", { name: `Edit ${withdrawn.name}`, exact: true }).click();
  await page.getByRole("button", { name: "Remove team", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Standings and qualification will be recalculated");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("cell", { name: withdrawn.name, exact: true })).toHaveCount(0);
  current = (await request("state", undefined, o.cookie)).data;
  expect(current.matches.some(m => m.a === played.a || m.b === played.a)).toBe(false);
  expect(current.matches).toHaveLength(9);
  await page.goto(`${origin}/matches/history?tournament=${t.id}`);
  await expect(page.getByText("No results yet", { exact: true })).toBeVisible();
  await context.close();
});
