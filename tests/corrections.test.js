import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, emptyState, standings } from "../server/engine.js";
import { drawSize, groupLabel, playoffPreset, PLAYOFF_STAGE } from "../shared/format.js";
import { tournamentDisplayData } from "../shared/display.js";

function setup(count = 8, groups = 2, qualify = 2, mode = "direct") {
  let s = applyAction(emptyState(), "tournament", {
    name: "Corrections", size: 1, groups, qualify, points: 21, cap: 30, bestOf: 1,
    ...(mode === "direct" ? {} : playoffPreset(mode, groups)),
  });
  const t = s.tournaments[0];
  s = applyAction(s, "teams", { tournamentId: t.id, teams: Array.from({ length: count }, (_, i) => ({
    players: Array.from({ length: t.size }, (_, j) => `Player ${i + 1} ${j + 1}`), seed: i + 1,
  })) });
  return applyAction(s, "generate", { tournamentId: t.id });
}
function finish(s, m, reverse = false) {
  const points = m.stage !== "League" && m.stage !== PLAYOFF_STAGE ? 21 : s.tournaments[0].points;
  s = applyAction(s, "start", { matchId: m.id, court: 1 });
  return applyAction(s, "finish", { matchId: m.id, games: [reverse ? [0, points] : [points, 0]] });
}
function draw(s) {
  for (const m of s.matches.filter(m => m.stage === "League")) s = finish(s, m);
  return applyAction(s, "knockouts", { tournamentId: s.tournaments[0].id });
}
function complete(s) {
  while (s.matches.some(m => m.status === "upcoming" && m.a && m.b))
    s = finish(s, s.matches.find(m => m.status === "upcoming" && m.a && m.b));
  assert.ok(s.matches.every(m => m.status === "completed"));
  return s;
}

test("player names can change before play, on court and after results, preserving IDs and fixtures until the final", () => {
  let s = setup();
  const team = s.teams[0];
  for (const phase of ["fixtures", "live", "completed"]) {
    if (phase === "live") s = applyAction(s, "start", { matchId: s.matches[0].id, court: 1 });
    if (phase === "completed") s = applyAction(s, "finish", { matchId: s.matches[0].id, games: [[21, 0]] });
    const fixtures = structuredClone(s.matches);
    s = applyAction(s, "teams", { tournamentId: team.tournamentId, teams: [{ id: team.id, players: [`Renamed ${phase}`] }] });
    assert.equal(s.teams[0].name, `Renamed ${phase}`);
    assert.equal(s.teams[0].seed, team.seed);
    assert.equal(s.teams[0].group, team.group);
    assert.deepEqual(s.matches, fixtures);
  }
  for (const m of s.matches.filter(m => m.status !== "completed")) s = finish(s, m);
  s = complete(applyAction(s, "knockouts", { tournamentId: team.tournamentId }));
  assert.throws(() => applyAction(s, "teams", { tournamentId: team.tournamentId, teams: [{ id: team.id, players: ["Too late"] }] }), /tournament ends/);
});

test("name edits retain registration, seed, duplicate and cross-category on-court protections atomically", () => {
  let s = setup();
  const [team, other] = s.teams;
  for (const row of [
    { players: ["New registration"] },
    { id: team.id, players: ["Rename"], seed: 99 },
    { id: team.id, players: other.players },
    { id: team.id, players: [] },
  ]) assert.throws(() => applyAction(s, "teams", { tournamentId: team.tournamentId, teams: [row] }));
  const before = structuredClone(s);
  assert.throws(() => applyAction(s, "teams", { tournamentId: team.tournamentId, teams: [
    { id: team.id, players: ["Valid edit"] }, { id: other.id, players: ["Valid edit"] },
  ] }));
  assert.deepEqual(s, before);
  s = applyAction(s, "tournament", { name: "Other", size: 1, groups: 1, qualify: 2, points: 21, cap: 30, bestOf: 1 });
  const tid = s.tournaments[1].id;
  s = applyAction(s, "teams", { tournamentId: tid, teams: [{ players: ["Other player"] }, { players: ["Opponent"] }] });
  s = applyAction(s, "generate", { tournamentId: tid });
  const live = s.matches.find(m => m.a === team.id || m.b === team.id);
  s = applyAction(s, "start", { matchId: live.id, court: 1 });
  s = applyAction(s, "start", { matchId: s.matches.find(m => m.tournamentId === tid).id, court: 2 });
  assert.throws(() => applyAction(s, "teams", { tournamentId: team.tournamentId, teams: [{ id: team.id, players: ["Other player"] }] }), /on court more than once/);
});

test("same-winner score corrections retain downstream results; winner changes clear only affected descendants", () => {
  let s = complete(draw(setup()));
  const semifinal = s.matches.find(m => m.stage === "Semifinal");
  const final = s.matches.find(m => m.stage === "Final");
  const before = structuredClone(s);
  s = applyAction(s, "correctResult", { matchId: semifinal.id, games: [[21, 19]] });
  assert.deepEqual(s.matches.find(m => m.id === final.id), final);
  assert.equal(s.matches.find(m => m.id === semifinal.id).completedAt, semifinal.completedAt);
  assert.ok(s.matches.find(m => m.id === semifinal.id).correctedAt);
  s = applyAction(s, "correctResult", { matchId: semifinal.id, games: [[0, 21]] });
  const reset = s.matches.find(m => m.id === final.id);
  assert.equal(reset.a, semifinal.b);
  assert.equal(reset.status, "upcoming");
  assert.equal(reset.winner, null);
  assert.equal(reset.court, null);
  assert.deepEqual(reset.games, []);
  assert.equal(tournamentDisplayData(s, s.tournaments[0].id).champion, null);
  assert.deepEqual(s.matches.filter(m => ![semifinal.id, final.id].includes(m.id)), before.matches.filter(m => ![semifinal.id, final.id].includes(m.id)));
  s = applyAction(s, "start", { matchId: final.id, court: 1 });
  s = applyAction(s, "correctResult", { matchId: semifinal.id, games: [[21, 0]] });
  assert.equal(s.matches.find(m => m.id === final.id).court, null);
  s = complete(s);
  const latestFinal = s.matches.find(m => m.id === final.id);
  s = applyAction(s, "correctResult", { matchId: final.id, games: [[0, 21]] });
  assert.equal(tournamentDisplayData(s, s.tournaments[0].id).champion.id, latestFinal.b);
  assert.throws(() => applyAction(s, "correctResult", { matchId: final.id, games: [[21, 20]] }));
});

test("league corrections recalculate rankings and an existing draw using actual league results", () => {
  let s = draw(setup(6, 3, 1));
  const league = s.matches.find(m => m.stage === "League");
  const ids = s.matches.map(m => m.id);
  s = applyAction(s, "correctResult", { matchId: league.id, games: [[0, 21]] });
  assert.deepEqual(s.matches.map(m => m.id), ids);
  const qualifiers = Array.from({ length: 3 }, (_, group) => standings(s, s.tournaments[0].id, group)[0].id);
  assert.equal(qualifiers[league.group], league.b);
  const opening = s.matches.filter(m => m.stage !== "League" && m.round === 1);
  assert.deepEqual(new Set(opening.flatMap(m => [m.a, m.b]).filter(Boolean)), new Set(qualifiers));
  s = complete(s);
  assert.ok(tournamentDisplayData(s, s.tournaments[0].id).champion);
});

test("playoff corrections propagate through existing named slots and reset completed later rounds", () => {
  let s = complete(draw(setup(15, 3, 4, "intermediate")));
  const playoff = s.matches.find(m => m.stage === PLAYOFF_STAGE);
  const feeder = s.matches.find(m => m.aSource?.matchId === playoff.id || m.bSource?.matchId === playoff.id);
  s = applyAction(s, "correctResult", { matchId: playoff.id, games: [[0, 15]] });
  const changed = s.matches.find(m => m.id === feeder.id);
  assert.ok([changed.a, changed.b].includes(playoff.b));
  assert.equal(changed.status, "upcoming");
  assert.equal(s.matches.find(m => m.stage === "Final").winner, null);
  s = complete(s);
  // Rebuilding from corrected league standings keeps persistent playoff references.
  const league = s.matches.find(m => m.stage === "League");
  s = applyAction(s, "correctResult", { matchId: league.id, games: [[0, 15]] });
  for (const m of s.matches)
    for (const side of ["a", "b"])
      if (m[`${side}Source`]) assert.ok(s.matches.some(x => x.id === m[`${side}Source`].matchId));
  complete(JSON.parse(JSON.stringify(s)));
});

for (const [count, groups, qualify, mode] of [
  [18, 3, 3, "direct"], [25, 5, 2, "direct"], [30, 6, 2, "direct"],
  [200, 37, 2, "direct"], [200, 100, 2, "direct"],
  [200, 40, 4, "intermediate"], [30, 5, 4, "beginner"],
]) test(`${count} teams / ${groups} groups (${mode}) balance fixtures and complete a bracket with byes`, () => {
  let s = setup(count, groups, qualify, mode);
  const sizes = Array.from({ length: groups }, (_, g) => s.teams.filter(t => t.group === g).length);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
  assert.equal(s.matches.length, sizes.reduce((n, size) => n + size * (size - 1) / 2, 0));
  assert.equal(new Set(s.matches.map(m => [m.a, m.b].sort().join())).size, s.matches.length);
  s = draw(s);
  const entrants = groups * qualify;
  const main = s.matches.filter(m => m.stage !== "League" && m.stage !== PLAYOFF_STAGE);
  assert.equal(main.filter(m => !m.bye).length, entrants - 1);
  assert.equal(main.filter(m => m.bye).length, drawSize(entrants) - entrants);
  for (const m of main.filter(m => m.round === 1 && !m.bye)) {
    const group = side => m[side] ? s.teams.find(t => t.id === m[side]).group : s.matches.find(x => x.id === m[`${side}Source`].matchId).group;
    assert.notEqual(group("a"), group("b"));
  }
  const bye = main.find(m => m.bye);
  if (bye) assert.throws(() => applyAction(s, "correctResult", { matchId: bye.id, games: [[21, 0]] }), /bye/);
  complete(JSON.parse(JSON.stringify(s)));
});

test("group labels continue after Z and invalid counts are rejected", () => {
  assert.deepEqual([0, 25, 26, 27, 51, 52, 255].map(groupLabel), ["A", "Z", "AA", "AB", "AZ", "BA", "IV"]);
  for (const groups of [0, -1, 1.5, 257, "", "invalid"])
    assert.throws(() => setup(4, groups));
  assert.throws(() => setup(4, 3, 2), /at least 6/);
});
