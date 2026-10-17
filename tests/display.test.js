import test from "node:test";
import assert from "node:assert/strict";
import { emptyState, applyAction } from "../server/engine.js";
import {
  displayTournamentOptions,
  resolveDisplaySelection,
  tournamentDisplayData,
  resultScore,
} from "../shared/display.js";

function setup() {
  let s = applyAction(emptyState(), "tournament", {
    name: "Doubles",
    size: 2,
    groups: 2,
    qualify: 2,
    bestOf: 1,
    points: 21,
    cap: 30,
  });
  const tournamentId = s.tournaments[0].id;
  s = applyAction(s, "teams", {
    tournamentId,
    teams: Array.from({ length: 10 }, (_, i) => ({
      players: [`Player ${i + 1} A`, `Player ${i + 1} B`],
      seed: i + 1,
    })),
  });
  s = applyAction(s, "generate", { tournamentId });
  return { s, tournamentId };
}

test("screen selections honor N, keep distinct IDs, and recover from deleted tournaments", () => {
  const options = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(
    resolveDisplaySelection(options, { count: 2, ids: ["c", "a"] }),
    { count: 2, ids: ["c", "a"] },
  );
  assert.deepEqual(
    resolveDisplaySelection(options, { count: 3, ids: ["c", "c", "deleted"] }),
    { count: 3, ids: ["c", "a", "b"] },
  );
  assert.deepEqual(
    resolveDisplaySelection(options, { count: 100, ids: ["b"] }),
    { count: 3, ids: ["b", "a", "c"] },
  );
  assert.deepEqual(resolveDisplaySelection([], { count: 3, ids: ["a"] }), {
    count: 0,
    ids: [],
  });
  assert.deepEqual(
    resolveDisplaySelection(options, { count: 1, ids: ["c", "a"] }),
    { count: 1, ids: ["c"] },
  );
  assert.deepEqual(
    resolveDisplaySelection(options, { count: -2, ids: "bad" }),
    { count: 1, ids: ["a"] },
  );
});

test("results retain every completed match in its own group, newest first", () => {
  let { s, tournamentId } = setup();
  const groupA = s.matches.filter((m) => m.group === 0).slice(0, 5);
  const groupB = s.matches.filter((m) => m.group === 1).slice(0, 4);
  for (const [i, m] of [...groupA, ...groupB].entries()) {
    s = applyAction(s, "start", { matchId: m.id, court: 1 });
    s = applyAction(s, "finish", { matchId: m.id, games: [[21, 15]] });
    s.matches.find((x) => x.id === m.id).completedAt =
      `2026-01-01T00:00:${String(i).padStart(2, "0")}Z`;
  }
  const view = tournamentDisplayData(s, tournamentId);
  assert.equal(view.resultGroups.length, 2);
  assert.deepEqual(
    view.resultGroups[0].results.map((m) => m.id),
    groupA.map((m) => m.id).reverse(),
  );
  assert.deepEqual(
    view.resultGroups[1].results.map((m) => m.id),
    groupB.map((m) => m.id).reverse(),
  );
  assert.equal(
    view.groups[0].rows.reduce((n, r) => n + r.wins, 0),
    5,
  );
  assert.equal(
    view.groups[1].rows.reduce((n, r) => n + r.wins, 0),
    4,
  );
  assert.equal(view.completed, 9);
  assert.equal(view.showLeagueStandings, true);
});

test("empty groups and registration categories stay understandable without fake results", () => {
  let { s, tournamentId } = setup();
  const view = tournamentDisplayData(s, tournamentId);
  assert.equal(view.groups.length, 2);
  assert.ok(view.resultGroups.every((g) => g.results.length === 0));
  s = applyAction(s, "resetFixtures", { tournamentId });
  const draft = tournamentDisplayData(s, tournamentId);
  assert.equal(draft.hasLeague, false);
  assert.equal(draft.showLeagueStandings, true);
  assert.equal(draft.groups[0].rows.length, 10);
  assert.equal(draft.groups[0].label, "Entries \u00b7 draw pending");
  assert.deepEqual(draft.resultGroups, []);
  assert.equal(tournamentDisplayData(s, "missing"), null);
});

test("knockout results and champion are separate from league groups and rankings", () => {
  let { s, tournamentId } = setup();
  for (const m of s.matches) {
    s = applyAction(s, "start", { matchId: m.id, court: 1 });
    s = applyAction(s, "finish", { matchId: m.id, games: [[21, 15]] });
  }
  const leagueRows = tournamentDisplayData(s, tournamentId).groups.map(
    (g) => g.rows,
  );
  assert.equal(tournamentDisplayData(s, tournamentId).hasKnockouts, false);
  s = applyAction(s, "knockouts", { tournamentId });
  const draw = tournamentDisplayData(s, tournamentId);
  assert.equal(draw.hasKnockouts, true);
  assert.equal(draw.showLeagueStandings, false);
  assert.deepEqual(
    draw.knockoutRounds.map((r) => r.stage),
    ["Semifinal", "Final"],
  );
  assert.equal(draw.knockoutRounds[1].matches[0].a, null);
  assert.equal(draw.knockoutRounds[1].matches[0].b, null);
  for (const m of s.matches.filter((m) => m.stage !== "League")) {
    s = applyAction(s, "start", { matchId: m.id, court: 1 });
    s = applyAction(s, "finish", { matchId: m.id, games: [[10, 21]] });
  }
  const view = tournamentDisplayData(s, tournamentId);
  assert.equal(view.hasKnockouts, true);
  assert.equal(
    view.knockoutRounds[1].matches[0].a,
    view.knockoutRounds[0].matches[0].winner,
  );
  assert.equal(
    view.knockoutRounds[1].matches[0].b,
    view.knockoutRounds[0].matches[1].winner,
  );
  assert.equal(view.knockoutResults.length, 3);
  assert.equal(view.resultGroups.length, 2);
  assert.ok(
    view.resultGroups.every((g) =>
      g.results.every((m) => m.stage === "League"),
    ),
  );
  assert.deepEqual(
    view.groups.map((g) => g.rows),
    leagueRows,
  );
  assert.equal(
    view.champion.id,
    s.matches.find((m) => m.stage === "Final").winner,
  );
});

test("display rounds retain draw order and pending opponents for every supported knockout size", () => {
  for (const entrants of [2, 4, 8, 16]) {
    const groups = entrants / 2;
    let s = applyAction(emptyState(), "tournament", {
      name: `Draw ${entrants}`,
      size: 1,
      groups,
      qualify: 2,
      bestOf: 1,
      points: 21,
      cap: 30,
    });
    const tournamentId = s.tournaments[0].id;
    s = applyAction(s, "teams", {
      tournamentId,
      teams: Array.from({ length: entrants * 2 }, (_, i) => ({
        players: [`Player ${i}`],
      })),
    });
    s = applyAction(s, "generate", { tournamentId });
    for (const m of s.matches) {
      s = applyAction(s, "start", { matchId: m.id, court: 1 });
      s = applyAction(s, "finish", { matchId: m.id, games: [[21, 15]] });
    }
    s = applyAction(s, "knockouts", { tournamentId });
    // Storage order must not decide the visual column or match order.
    s.matches.reverse();
    const view = tournamentDisplayData(s, tournamentId);
    assert.equal(view.knockoutRounds.length, Math.log2(entrants));
    assert.equal(view.knockoutRounds.at(-1).stage, "Final");
    for (const [i, round] of view.knockoutRounds.entries()) {
      assert.equal(round.matches.length, entrants / 2 ** (i + 1));
      assert.deepEqual(
        round.matches.map((m) => m.index),
        Array.from({ length: round.matches.length }, (_, index) => index),
      );
      assert.ok(
        round.matches.every((m) => (i === 0 ? m.a && m.b : !m.a && !m.b)),
      );
    }
  }
});

test("result scores follow the displayed winner's side, including best-of-three", () => {
  assert.equal(
    resultScore({ a: "a", b: "b", winner: "b", games: [[14, 21]] }),
    "21\u201314",
  );
  assert.equal(
    resultScore({
      a: "a",
      b: "b",
      winner: "a",
      games: [
        [21, 14],
        [18, 21],
        [21, 16],
      ],
    }),
    "21\u201314 / 18\u201321 / 21\u201316",
  );
});

test("ongoing categories are offered first while selected finished categories remain available", () => {
  const s = {
    tournaments: [{ id: "finished" }, { id: "draft" }, { id: "ongoing" }],
    matches: [
      { tournamentId: "finished", status: "completed" },
      { tournamentId: "ongoing", status: "upcoming" },
    ],
  };
  const options = displayTournamentOptions(s);
  assert.deepEqual(
    options.map((t) => t.id),
    ["ongoing", "draft", "finished"],
  );
  assert.deepEqual(
    resolveDisplaySelection(options, { count: 1, ids: ["finished"] }).ids,
    ["finished"],
  );
});
