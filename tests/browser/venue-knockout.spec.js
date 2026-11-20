import { expect, test } from "@playwright/test";
import { applyAction, emptyState } from "../../shared/tournament.js";
import { envelope, fixture, importFixture, invitation, owner, request } from "../cloud/helpers.js";

for (const [teamCount, firstRoundScreens] of [[16, 2], [32, 4], [40, 8], [64, 8]]) {
  test(`knockout venue display pages a ${teamCount}-team draw`, async ({ page }) => {
    let state = applyAction(emptyState(), "tournament", { name: "Doubles knockout", size: 2, format: "knockouts", points: 5, cap: 6, bestOf: 3 });
    const tournamentId = state.tournaments[0].id;
    state = applyAction(state, "teams", { tournamentId, teams: Array.from({ length: teamCount }, (_, i) => ({
      players: [`Player ${i + 1} A`, `Player ${i + 1} B`],
    })) });
    state = applyAction(state, "generate", { tournamentId });
    if (teamCount === 40) {
      const liveMatch = state.matches.find(match => match.round === 1 && match.index < 4 && !match.bye);
      state = applyAction(state, "start", { matchId: liveMatch.id, court: 1 });
      await page.setViewportSize({ width: 1000, height: 600 });
    }
    const organizer = await owner();
    await importFixture(organizer, state);
    const layout = teamCount === 40 ? {
      selection: { count: 1, ids: [tournamentId] },
      savedLayouts: { [JSON.stringify([tournamentId])]: { liveScores: { position: "top", flow: "horizontal" } } },
    } : null;
    if (teamCount === 40) {
      const match = state.matches.find(match => match.status === "live");
      let score = (await request("claim", { matchId: match.id, device: crypto.randomUUID() }, organizer.cookie)).data;
      for (const team of [...Array(5).fill(match.a), match.b]) {
        score = (await request("score", envelope(organizer, score, "point", team), organizer.cookie)).data.record;
      }
    }
    const preset = (await request("preset", { name: "Knockout screen", layout }, organizer.cookie)).data;
    const invite = await invitation(organizer, "display", "Knockout screen", preset.id);

    await page.clock.install();
    await page.goto(invite.url);
    const badge = page.locator(".vb-screen-badge");
    await expect(badge).toHaveText(`Screen 1 of ${firstRoundScreens} · 7s Timer`);
    const bracket = page.getByRole("region", { name: "Doubles knockout knockout bracket" });
    const viewport = bracket.getByRole("region", { name: "Knockout match cards" });
    const rows = viewport.getByRole("region", { name: /^(Round of \d+|Quarterfinal|Semifinal|Final)$/ });
    for (const [index, count] of [5, 3, 2].entries()) {
      await expect(rows.nth(index).getByRole("article")).toHaveCount(count);
    }
    await expect(viewport).toHaveCSS("overflow-y", teamCount === 40 ? "hidden" : "auto");
    await expect(viewport).toHaveCSS("scrollbar-width", "none");
    await expect.poll(() => viewport.evaluate(node => {
      const flow = node.querySelector(".vb-card-flow");
      const secondRow = flow.querySelectorAll(".vb-paged-round-cards")[1];
      const top = secondRow.getBoundingClientRect().top - flow.getBoundingClientRect().top;
      return [...flow.querySelectorAll(".vb-paged-connectors path")].filter(path =>
        path.getPointAtLength(0).y < top && Math.abs(path.getPointAtLength(path.getTotalLength()).y - top) < 1
      ).length;
    })).toBeGreaterThanOrEqual(3);
    const final = viewport.getByRole("article", { name: "Final 1", exact: true });
    await expect(final).toBeAttached();
    await expect(page.getByText(/played · Knockout Matches/)).toBeVisible();
    if (teamCount === 40) {
      await expect(bracket.getByText("Court 1 · On court")).toBeVisible();
      const scores = page.getByRole("region", { name: "Live scores across all matches" });
      const scoreCard = scores.locator(".live-score-card");
      await expect(scoreCard).toHaveCSS("background-color", "rgb(9, 40, 58)");
      await expect(scoreCard.locator(".live-score-game:not(.is-current)")).toHaveText(["5", "0"]);
      await expect(scoreCard.locator(".live-score-game.is-current")).toHaveText(["0", "1"]);
      await expect(viewport.locator("article.live")).toHaveCSS("background-color", "rgb(252, 247, 233)");
      await expect(viewport.locator("article.completed").first()).toHaveCSS("background-color", "rgb(242, 248, 243)");
      await expect(viewport.locator("article.upcoming").first()).toHaveCSS("background-color", "rgb(245, 248, 252)");
      await page.getByRole("button", { name: "Pause automatic scrolling" }).click();
      await page.getByRole("button", { name: "Resume automatic scrolling" }).click();
      await page.clock.fastForward(4300);
      await expect(badge).toHaveText("Screen 1 of 8 · 7s Timer");
      const box = await bracket.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + 30);
      await page.mouse.wheel(0, 450);
      await expect(scores).not.toBeInViewport();
      await expect(viewport).toHaveCSS("overflow-y", "auto");
      const cardsBox = await viewport.boundingBox();
      await page.mouse.move(cardsBox.x + cardsBox.width / 2, cardsBox.y + 30);
      await page.mouse.wheel(0, 1500);
      await expect.poll(() => viewport.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
      await expect(final).toBeInViewport();
      await page.clock.fastForward(3000);
      await expect(badge).toHaveText("Screen 1 of 8 · 7s Timer");
      await page.clock.fastForward(4100);
    } else {
      await page.clock.fastForward(7000);
    }

    await expect(badge).toHaveText(`Screen 2 of ${firstRoundScreens} · 7s Timer`);
    expect(await viewport.evaluate(node => node.scrollTop)).toBe(0);
    await page.getByRole("button", { name: "Pause automatic scrolling" }).click();
    if (teamCount === 40) {
      const box = await bracket.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + 30);
      await page.mouse.wheel(0, -650);
      await expect(page.getByRole("region", { name: "Live scores across all matches" })).toBeInViewport();
    }
    await page.clock.fastForward(14000);
    await expect(badge).toHaveText(`Screen 2 of ${firstRoundScreens} · Paused`);
    const nextScreen = page.getByRole("button", { name: "Next Screen" });
    await nextScreen.click();
    await expect(badge).toHaveText(`Screen ${firstRoundScreens === 2 ? 1 : 3} of ${firstRoundScreens} · Paused`);
    await expect(final).toBeAttached();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(badge).toHaveText(`Screen ${firstRoundScreens} of ${firstRoundScreens} · Paused`);
    await page.keyboard.press("ArrowRight");
    await expect(badge).toHaveText(`Screen 1 of ${firstRoundScreens} · Paused`);
    await expect(rows.first().getByRole("article").first()).toHaveAccessibleName(/^Round of \d+ 1$/);

    const next = page.getByRole("button", { name: "Next Round" });
    const undo = page.getByRole("button", { name: "Undo" });
    await expect(undo).toBeDisabled();
    const roundCount = new Set(state.matches.map(match => match.round)).size;
    for (let level = 1; level < roundCount; level++) {
      await next.click();
      const screens = Math.ceil(firstRoundScreens / 2 ** level);
      await expect(badge).toHaveText(screens === 1 ? "Static Screen" : `Screen 1 of ${screens} · Paused`);
      await expect(final).toBeAttached();
      if (level === roundCount - 3) {
        const quarters = viewport.getByRole("region", { name: "Quarterfinal", exact: true });
        const semis = viewport.getByRole("region", { name: "Semifinal", exact: true });
        await expect(quarters.getByRole("article")).toHaveCount(4);
        await expect(semis.getByRole("article")).toHaveCount(2);
        await expect(viewport.getByRole("region", { name: "Final", exact: true }).getByRole("article")).toHaveCount(1);
        expect(await viewport.evaluate(node => {
          const [quarters, semis, final] = [...node.querySelectorAll(".vb-paged-round-cards")].map(row =>
            [...row.children].map(card => card.getBoundingClientRect()));
          const center = card => card.left + card.width / 2;
          const below = (card, a, b) => card.top > Math.max(a.bottom, b.bottom)
            && Math.abs(center(card) - (center(a) + center(b)) / 2) < 2;
          return below(semis[0], quarters[0], quarters[1]) && below(semis[1], quarters[2], quarters[3])
            && below(final[0], semis[0], semis[1]);
        })).toBe(true);
      }
    }
    await expect(next).toBeDisabled();
    await expect(nextScreen).toBeDisabled();
    await expect(final).toBeVisible();
    await page.getByRole("button", { name: "Resume automatic scrolling" }).click();
    await page.clock.fastForward(14000);
    await expect(badge).toHaveText("Static Screen");
    await undo.click();
    await expect(rows).toHaveCount(2);
    await expect(rows.first().getByRole("article")).toHaveCount(2);
    await expect(rows.last().getByRole("article")).toHaveCount(1);
    await expect(next).toBeEnabled();
  });
}

test("venue live scores show three columns and automatically scroll when a fourth match is added", async ({ page }) => {
  const organizer = await owner();
  const state = await importFixture(organizer, fixture(6));
  const ids = [state.tournaments[0].id];
  const layout = {
    selection: { count: 1, ids },
    savedLayouts: { [JSON.stringify(ids)]: { liveScores: { position: "top", flow: "horizontal" } } },
  };
  const preset = (await request("preset", { name: "Live courts", courts: [1, 2, 3], layout }, organizer.cookie)).data;
  const invite = await invitation(organizer, "display", "Live courts", preset.id);
  await page.clock.install();
  await page.goto(invite.url);
  const strip = page.getByRole("region", { name: "Live scores across all matches" });
  const scroll = strip.locator(".venue-shared-live-scroll");
  const cards = strip.locator(".live-score-card");
  await expect(cards).toHaveCount(3);
  expect(await scroll.evaluate(node => {
    const edge = node.getBoundingClientRect().right;
    return [...node.querySelectorAll(".live-score-card")].filter(card => card.getBoundingClientRect().right <= edge).length;
  })).toBe(3);
  await page.clock.runFor(3000);
  expect(await scroll.evaluate(node => node.scrollLeft)).toBe(0);
  await expect(strip.getByRole("button", { name: "Next live matches" })).toBeDisabled();
  await request("preset", { ...preset, courts: [1, 2, 3, 4] }, organizer.cookie);
  await expect(cards).toHaveCount(4);
  await expect(scroll).toHaveCSS("scrollbar-width", "none");
  await expect(strip.getByRole("button", { name: "Next live matches" })).toBeEnabled();
  await page.clock.runFor(4000);
  await expect.poll(() => scroll.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
});
