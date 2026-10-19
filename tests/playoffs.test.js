import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyState,
  applyAction,
  validateGames,
  standings,
} from "../server/engine.js";
import {
  PLAYOFF_STAGE,
  playoffPreset,
  qualificationFormat,
  qualificationStatus,
  scoringRules,
} from "../shared/format.js";
import { tournamentDisplayData } from "../shared/display.js";
import { upcomingMatches } from "../shared/matches.js";

function setup(mode, count, groups = 2) {
  let s = applyAction(emptyState(), "tournament", {
    name: mode,
    ...playoffPreset(mode, groups),
  });
  const tournamentId = s.tournaments[0].id;
  const n =
    count ?? qualificationFormat(s.tournaments[0]).teamsPerGroup * groups;
  s = applyAction(s, "teams", {
    tournamentId,
    teams: Array.from({ length: n }, (_, i) => ({
      players: [`Player ${i + 1}`, `Partner ${i + 1}`],
      seed: i + 1,
    })),
  });
  return { s, tournamentId };
}
function finish(s, m, games = [[15, 14]]) {
  s = applyAction(s, "start", { matchId: m.id, court: 1 });
  return applyAction(s, "finish", { matchId: m.id, games });
}
function leagueFinished(mode, groups = 2) {
  let { s, tournamentId } = setup(mode, undefined, groups);
  s = applyAction(s, "generate", { tournamentId });
  for (const m of s.matches) s = finish(s, m);
  return { s, tournamentId };
}

test("golden point accepts every first-to-15 finish; deuce and best-of retain their own rules", () => {
  const golden = playoffPreset("intermediate").scoring.league;
  for (let loser = 0; loser < 15; loser++) {
    assert.equal(validateGames([[15, loser]], golden), 0);
    assert.equal(validateGames([[loser, 15]], golden), 1);
  }
  for (const game of [
    [14, 13],
    [14, 14],
    [15, 15],
    [16, 14],
    [16, 15],
    [21, 10],
    [-1, 15],
    [15, 1.5],
  ])
    assert.throws(() => validateGames([game], golden));
  const deuce = playoffPreset("beginner").scoring.knockout;
  for (const game of [
    [21, 0],
    [21, 19],
    [22, 20],
    [29, 27],
    [30, 28],
    [30, 29],
  ])
    assert.equal(validateGames([game], deuce), 0);
  for (const game of [
    [15, 14],
    [21, 20],
    [22, 19],
    [30, 27],
    [31, 29],
  ])
    assert.throws(() => validateGames([game], deuce));
  assert.equal(
    validateGames(
      [
        [15, 14],
        [12, 15],
        [15, 0],
      ],
      { ...golden, bestOf: 3 },
    ),
    0,
  );
  assert.throws(
    () => validateGames([[15, 14]], { ...golden, bestOf: 3 }),
    /must win 2/,
  );
  assert.throws(
    () =>
      validateGames(
        [
          [15, 14],
          [15, 10],
          [0, 15],
        ],
        { ...golden, bestOf: 3 },
      ),
    /already won/,
  );
});

for (const mode of ["intermediate", "beginner"]) {
  test(`${mode}: correct group playoffs, upset winners, cross-group QFs, champion and unchanged league tables`, () => {
    let { s, tournamentId } = leagueFinished(mode);
    const t = s.tournaments[0],
      format = qualificationFormat(t);
    const ranks = [0, 1].map((g) => standings(s, tournamentId, g));
    assert.equal(s.matches.length, mode === "intermediate" ? 20 : 30);
    s = applyAction(s, "knockouts", { tournamentId });
    assert.equal(s.matches.length, mode === "intermediate" ? 29 : 41);
    const playoffs = s.matches.filter((m) => m.stage === PLAYOFF_STAGE);
    assert.equal(playoffs.length, format.pairs.length * 2);
    const view = tournamentDisplayData(s, tournamentId);
    assert.deepEqual(
      view.knockoutRounds.map((r) => r.stage),
      ["Quarterfinal", "Semifinal", "Final"],
    );
    assert.equal(view.playoffs.length, playoffs.length);
    assert.equal(view.showLeagueStandings, true);
    assert.equal(
      view.groups
        .flatMap((g) => g.rows)
        .filter((r) => r.qualificationStatus === "direct").length,
      format.direct * 2,
    );
    assert.equal(
      view.groups
        .flatMap((g) => g.rows)
        .filter((r) => r.qualificationStatus === "playoff").length,
      playoffs.length * 2,
    );
    assert.equal(
      upcomingMatches(s).filter((m) => m.stage === "Quarterfinal").length,
      mode === "intermediate" ? 2 : 0,
    );
    const slots = ranks.map((rows) => rows.slice(0, 4).map((r) => r.id));
    for (const m of playoffs.reverse()) {
      const [high, low] = m.playoffRanks;
      assert.equal(m.a, ranks[m.group][high - 1].id);
      assert.equal(m.b, ranks[m.group][low - 1].id);
      assert.ok(
        format.pairs.some(
          (pair) => pair.join() === [high, low, m.qualifyingSlot].join(),
        ),
      );
      s = finish(s, m, [[14, 15]]); // Lower league rank wins every playoff.
      assert.equal(
        tournamentDisplayData(s, tournamentId).showLeagueStandings,
        s.matches.some(
          (match) =>
            match.stage === PLAYOFF_STAGE && match.status !== "completed",
        ),
      );
      slots[m.group][m.qualifyingSlot - 1] = m.b;
      assert.equal(
        qualificationStatus(s, t, ranks[m.group][low - 1], low - 1),
        "qualified",
      );
      assert.equal(
        qualificationStatus(s, t, ranks[m.group][high - 1], high - 1),
        "eliminated",
      );
    }
    assert.deepEqual(
      s.matches
        .filter((m) => m.stage === "Quarterfinal")
        .map((m) => [m.a, m.b]),
      [
        [slots[0][0], slots[1][3]],
        [slots[1][1], slots[0][2]],
        [slots[1][0], slots[0][3]],
        [slots[0][1], slots[1][2]],
      ],
    );
    assert.deepEqual(
      [0, 1].map((g) => standings(s, tournamentId, g)),
      ranks,
    );
    assert.equal(upcomingMatches(s).length, 4);
    s = JSON.parse(JSON.stringify(s)); // Saved feeder references survive persistence.
    for (const m of s.matches.filter(
      (m) => m.stage !== "League" && m.stage !== PLAYOFF_STAGE,
    ))
      s = finish(s, m, [[30, 29]]);
    assert.ok(tournamentDisplayData(s, tournamentId).champion);
    assert.ok(s.matches.every((m) => m.status === "completed"));
    assert.deepEqual(
      [0, 1].map((g) => standings(s, tournamentId, g)),
      ranks,
    );
    assert.equal(
      tournamentDisplayData(s, tournamentId)
        .groups.flatMap((g) => g.rows)
        .filter((r) => ["direct", "qualified"].includes(r.qualificationStatus))
        .length,
      8,
    );
    assert.throws(() => applyAction(s, "knockouts", { tournamentId }));
  });
}

test("playoff formats validate exact entrants and configuration before locking fixtures", () => {
  for (const [mode, counts] of [
    ["intermediate", [8, 9, 11, 12]],
    ["beginner", [8, 10, 11, 13]],
  ]) {
    for (const count of counts) {
      const { s, tournamentId } = setup(mode, count);
      assert.throws(
        () => applyAction(s, "generate", { tournamentId }),
        /exactly/,
      );
      assert.equal(s.matches.length, 0);
    }
  }
  const config = { name: "Invalid", ...playoffPreset("intermediate") };
  for (const bad of [
    { groups: 0 },
    { qualify: 2 },
    { size: 1 },
    { qualification: "unknown" },
  ])
    assert.throws(() =>
      applyAction(emptyState(), "tournament", { ...config, ...bad }),
    );
  for (const scoring of [
    undefined,
    {},
    { ...config.scoring, playoff: undefined },
    { ...config.scoring, league: { ...config.scoring.league, cap: 16 } },
  ])
    assert.throws(() =>
      applyAction(emptyState(), "tournament", { ...config, scoring }),
    );
  let { s, tournamentId } = setup("beginner");
  s = applyAction(s, "generate", { tournamentId });
  assert.throws(
    () => applyAction(s, "knockouts", { tournamentId }),
    /Complete every league/,
  );
  assert.throws(
    () => applyAction(s, "tournament", { ...config, tournamentId }),
    /locked/,
  );
});

test("pending playoff slots cannot start; wrong-stage scores cannot advance a winner", () => {
  let { s, tournamentId } = leagueFinished("beginner");
  s = applyAction(s, "knockouts", { tournamentId });
  const pending = s.matches.find((m) => m.stage === "Quarterfinal");
  assert.throws(
    () => applyAction(s, "start", { matchId: pending.id, court: 1 }),
    /Both opponents/,
  );
  const m = s.matches.find((m) => m.stage === PLAYOFF_STAGE);
  s = applyAction(s, "start", { matchId: m.id, court: 1 });
  const before = structuredClone(s);
  assert.throws(
    () => applyAction(s, "finish", { matchId: m.id, games: [[21, 19]] }),
    /0 to 15/,
  );
  assert.deepEqual(s, before);
  s = applyAction(s, "returnMatch", { matchId: m.id });
  assert.equal(s.matches.find((x) => x.id === m.id).winner, null);
  assert.equal(s.matches.find((x) => x.id === pending.id).b, null);
});

test("stage best-of rules are independent and legacy tournaments retain original scoring", () => {
  const config = { name: "Per-stage games", ...playoffPreset("intermediate") };
  config.scoring.playoff.bestOf = 3;
  config.scoring.knockout.bestOf = 5;
  const s = applyAction(emptyState(), "tournament", config);
  assert.equal(scoringRules(s.tournaments[0]).bestOf, 1);
  assert.equal(scoringRules(s.tournaments[0], PLAYOFF_STAGE).bestOf, 3);
  assert.equal(scoringRules(s.tournaments[0], "Quarterfinal").bestOf, 5);
  const legacy = { points: 21, cap: 30, bestOf: 3 };
  for (const stage of ["League", PLAYOFF_STAGE, "Semifinal"])
    assert.deepEqual(scoringRules(legacy, stage), {
      ...legacy,
      goldenPoint: false,
    });
});

for (const mode of ["intermediate", "beginner"]) {
  for (const groups of [1, 2, 4, 8]) {
    test(`${mode}: ${groups} groups preserve ranks and advance a complete ${groups * 4}-team draw`, () => {
      const config = playoffPreset(mode, groups);
      const format = qualificationFormat(config);
      const entrants = groups * format.teamsPerGroup;
      for (const count of [entrants - 1, entrants + 1]) {
        const { s, tournamentId } = setup(mode, count, groups);
        assert.throws(
          () => applyAction(s, "generate", { tournamentId }),
          /exactly/,
        );
      }
      let { s, tournamentId } = leagueFinished(mode, groups);
      const ranks = Array.from({ length: groups }, (_, g) =>
        standings(s, tournamentId, g),
      );
      for (let g = 0; g < groups; g++) {
        assert.equal(ranks[g].length, format.teamsPerGroup);
        const fixtures = s.matches.filter((m) => m.group === g);
        assert.equal(
          fixtures.length,
          (format.teamsPerGroup * (format.teamsPerGroup - 1)) / 2,
        );
        assert.equal(
          new Set(fixtures.map((m) => [m.a, m.b].sort().join())).size,
          fixtures.length,
        );
      }
      s = applyAction(s, "knockouts", { tournamentId });
      const playoffs = s.matches.filter((m) => m.stage === PLAYOFF_STAGE);
      assert.equal(playoffs.length, groups * format.pairs.length);
      const expectedStages = {
        1: ["Semifinal", "Final"],
        2: ["Quarterfinal", "Semifinal", "Final"],
        4: ["Round of 16", "Quarterfinal", "Semifinal", "Final"],
        8: ["Round of 32", "Round of 16", "Quarterfinal", "Semifinal", "Final"],
      }[groups];
      assert.deepEqual(
        tournamentDisplayData(s, tournamentId).knockoutRounds.map(
          (r) => r.stage,
        ),
        expectedStages,
      );
      const slots = ranks.map((rows) => rows.slice(0, 4).map((r) => r.id));
      for (const m of playoffs.toReversed()) {
        assert.equal(m.a, ranks[m.group][m.playoffRanks[0] - 1].id);
        assert.equal(m.b, ranks[m.group][m.playoffRanks[1] - 1].id);
        s = finish(s, m, [[14, 15]]);
        slots[m.group][m.qualifyingSlot - 1] = m.b;
      }
      assert.equal(
        tournamentDisplayData(s, tournamentId).showLeagueStandings,
        false,
      );
      const main = s.matches.filter(
        (m) => m.stage !== "League" && m.stage !== PLAYOFF_STAGE,
      );
      assert.equal(main.length, groups * 4 - 1);
      const opening = main.filter((m) => m.round === 1);
      assert.deepEqual(
        new Set(opening.flatMap((m) => [m.a, m.b])),
        new Set(slots.flat()),
      );
      if (groups === 1) {
        assert.deepEqual(
          opening.map((m) => [m.a, m.b]),
          [
            [slots[0][0], slots[0][3]],
            [slots[0][1], slots[0][2]],
          ],
        );
      } else {
        for (const m of opening) {
          const aGroup = slots.findIndex((ids) => ids.includes(m.a));
          const bGroup = slots.findIndex((ids) => ids.includes(m.b));
          assert.notEqual(aGroup, bGroup);
          assert.equal(
            slots[aGroup].indexOf(m.a) + slots[bGroup].indexOf(m.b),
            3,
          );
        }
      }
      s = JSON.parse(JSON.stringify(s));
      for (const m of main) s = finish(s, m, [[30, 29]]);
      assert.ok(s.matches.every((m) => m.status === "completed"));
      assert.ok(tournamentDisplayData(s, tournamentId).champion);
      assert.deepEqual(
        Array.from({ length: groups }, (_, g) => standings(s, tournamentId, g)),
        ranks,
      );
    });
  }
}
