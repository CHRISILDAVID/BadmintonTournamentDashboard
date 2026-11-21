import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";
import { importFixture, origin, owner, request } from "../cloud/helpers.js";
import { applyAction, emptyState } from "../../shared/tournament.js";

test("organizer confirms the seed count in Excel preview and manages the imported seeds", async ({ browser }) => {
  const event = await owner();
  const initial = applyAction(emptyState(), "tournament", { name: "Beginner", size: 2,
    format: "knockouts", points: 15, cap: 21, bestOf: 1, manualSeeding: true });
  const tournamentId = initial.tournaments[0].id;
  await importFixture(event, initial);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Teams");
  sheet.addRow(["player1", "player2", "Seed"]);
  for (let i = 1; i <= 14; i++) sheet.addRow([`Player ${i}`, `Partner ${i}`, i <= 8 ? i : null]);
  const context = await browser.newContext();
  await context.addCookies([{ name: "sh_session", value: event.cookie.slice("sh_session=".length),
    url: origin, httpOnly: true, secure: true, sameSite: "Strict" }]);
  const page = await context.newPage();
  await page.goto(`${origin}/teams?tournament=${tournamentId}`);
  await page.getByRole("button", { name: "Import teams" }).click();
  await page.getByLabel("Team spreadsheet").setInputFiles({ name: "teams.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()) });
  const count = page.getByLabel("Number of teams to seed");
  await expect(count).toHaveValue("8");
  await count.selectOption("2");
  const seedTwo = page.getByRole("combobox", { name: "Seed 2", exact: true });
  await seedTwo.fill("partner 14");
  await expect(page.getByRole("listbox", { name: "Teams for seed 2" }).getByRole("option")).toHaveText(["Player 14 - Partner 14"]);
  await seedTwo.press("Enter");
  await page.getByRole("dialog").getByRole("button", { name: "Import teams" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Manage seeds" }).click();
  await seedTwo.fill("missing player");
  await seedTwo.press("Enter");
  await expect(page.getByText("No available teams match this search.")).toBeVisible();
  await seedTwo.press("Escape");
  await expect(seedTwo).toHaveValue("Player 14 - Partner 14");
  const seedOne = page.getByRole("combobox", { name: "Seed 1", exact: true });
  await seedOne.fill("partner 3");
  await page.getByRole("option", { name: "Player 3 - Partner 3", exact: true }).click();
  await expect(seedOne).toHaveValue("Player 3 - Partner 3");
  await page.getByRole("button", { name: "Move seed 2 up" }).click();
  await page.getByRole("button", { name: "Remove seed 2" }).click();
  await page.getByRole("button", { name: "Save seeds" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const state = (await request("state", undefined, event.cookie)).data;
  expect(state.tournaments[0].seedOrder).toEqual([state.teams.find(t => t.players[1] === "Partner 14").id]);
  expect(state.teams).toHaveLength(14);
  const draw = await request("action", { action: "generate", payload: { tournamentId }, revision: state.revision }, event.cookie);
  expect(draw.status, JSON.stringify(draw.data)).toBe(200);
  expect(draw.data.matches.filter(m => m.bye).map(m => m.winner)).toContain(state.tournaments[0].seedOrder[0]);
  await context.close();
});
