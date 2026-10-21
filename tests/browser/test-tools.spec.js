import { test, expect } from "@playwright/test";
import { owner, importFixture, request, origin } from "../cloud/helpers.js";

test("cloud organizer can confirm random results for just the selected category", async ({ browser }) => {
  test.skip(process.env.CLOUD_TEST_TOOLS !== "true", "Run against a local Worker with ENABLE_TEST_TOOLS:true.");
  const o = await owner(), state = await importFixture(o), t = state.tournaments[0];
  const context = await browser.newContext();
  await context.addCookies([{ name: "sh_session", value: o.cookie.slice("sh_session=".length), url: origin, httpOnly: true, secure: true, sameSite: "Strict" }]);
  const page = await context.newPage();
  await page.goto(`${origin}/matches?tournament=${t.id}`);
  const button = page.getByRole("button", { name: "Testing: complete unfinished matches", exact: true });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.getByRole("dialog")).toContainText(t.name);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await request("state", undefined, o.cookie)).data).toEqual(state);
  await button.click();
  await page.getByRole("button", { name: "Complete with random scores", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(button).toBeDisabled();
  const next = (await request("state", undefined, o.cookie)).data;
  expect(next.matches.filter(m => m.tournamentId === t.id).every(m => m.status === "completed")).toBe(true);
  expect(next.matches.filter(m => m.tournamentId !== t.id)).toEqual(state.matches.filter(m => m.tournamentId !== t.id));
  await context.close();
});
