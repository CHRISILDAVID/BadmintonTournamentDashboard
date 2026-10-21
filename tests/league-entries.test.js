import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, emptyState, standings } from "../server/engine.js";
import { playoffPreset, qualificationStatus, scoringRules } from "../shared/format.js";
import { tournamentProgress } from "../shared/matches.js";
import { tournamentDisplayData } from "../shared/display.js";

function setup(mode = "direct") {
  let s = applyAction(emptyState(), "tournament", {
    name: "League entries", size: 1, groups: 2, qualify: 2, points: 5, cap: 6, bestOf: 1,
    ...(mode === "direct" ? {} : playoffPreset(mode)),
  });
  const t = s.tournaments[0], count = mode === "direct" ? 8 : mode === "intermediate" ? 10 : 12;
  s = applyAction(s, "teams", { tournamentId: t.id, teams: entries(count, t.size) });
  return applyAction(s, "generate", { tournamentId: t.id });
}
const entries = (count, size = 1, prefix = "Player") => Array.from({ length: count }, (_, i) => ({
  players: Array.from({ length: size }, (_, j) => `${prefix} ${i} ${j}`),
}));
function finish(s, m) {
  if (m.status === "upcoming") s = applyAction(s, "start", { matchId: m.id, court: 1 });
  return applyAction(s, "finish", { matchId: m.id, games: [[scoringRules(s.tournaments[0], m.stage).points, 0]] });
}
function completeLeague(s) {
  for (const m of s.matches.filter(m => m.stage === "League" && m.status !== "completed")) s = finish(s, m);
  return s;
}
function checkPairs(s) {
  for (const t of s.tournaments) for (let group = 0; group < t.groups; group++) {
    const teams = s.teams.filter(x => x.tournamentId === t.id && x.group === group);
    const fixtures = s.matches.filter(m => m.tournamentId === t.id && m.stage === "League" && m.group === group);
    assert.equal(fixtures.length, teams.length * Math.max(0, teams.length - 1) / 2);
    assert.equal(new Set(fixtures.map(m => [m.a, m.b].sort().join(":"))).size, fixtures.length);
    assert.ok(fixtures.every(m => teams.some(t => t.id === m.a) && teams.some(t => t.id === m.b)));
  }
}

test("late entries preserve played, scheduled and live fixtures and append only missing group pairings", () => {
  let s = setup(), t = s.tournaments[0];
  s = finish(s, s.matches[0]);
  s = applyAction(s, "schedule", { matchId: s.matches[1].id, scheduled: "14:30" });
  s = applyAction(s, "start", { matchId: s.matches[1].id, court: 1 });
  const old = structuredClone(s), beforeStandings = standings(s, t.id, 0);
  s = applyAction(s, "teams", { tournamentId: t.id, group: 0, teams: entries(2, 1, "Late") });
  for (const m of old.matches) assert.deepEqual(s.matches.find(x => x.id === m.id), m);
  for (const row of beforeStandings) assert.deepEqual(standings(s, t.id, 0).find(x => x.id === row.id), row);
  assert.equal(s.matches.length, old.matches.length + 9);
  assert.equal(s.teams.filter(x => x.group === 0).length, 6);
  checkPairs(s);
  assert.deepEqual(old.tournaments[0], t);
});

test("new group has independent fixtures, increases qualification places, and completes an adapted bracket", () => {
  let s = completeLeague(setup()), t = s.tournaments[0];
  const previous = structuredClone(s.matches);
  s = applyAction(s, "teams", { tournamentId: t.id, group: "new", teams: entries(3, 1, "New group") });
  assert.equal(s.tournaments[0].groups, 3);
  assert.deepEqual(s.matches.slice(0, previous.length), previous);
  assert.equal(s.matches.filter(m => m.group === 2).length, 3);
  assert.equal(tournamentProgress(s, t.id).canCreateKnockouts, false);
  checkPairs(s);
  s = completeLeague(s);
  assert.equal(tournamentProgress(s, t.id).canCreateKnockouts, true);
  s = applyAction(s, "knockouts", { tournamentId: t.id });
  assert.ok(s.matches.some(m => m.bye));
  while (s.matches.some(m => m.status !== "completed")) {
    const ready = s.matches.find(m => m.status === "upcoming" && m.a && m.b);
    assert.ok(ready, "adapted bracket must have a playable next match");
    s = finish(s, ready);
  }
  assert.ok(tournamentProgress(s, t.id).champion);
});

test("removal deletes all team history, frees its court, and recomputes standings without changing other fixtures", () => {
  let s = setup(), t = s.tournaments[0], team = s.teams[0];
  const involved = s.matches.filter(m => [m.a, m.b].includes(team.id));
  s = finish(s, involved[0]);
  s = applyAction(s, "start", { matchId: involved[1].id, court: 2 });
  const retained = structuredClone(s.matches.filter(m => ![m.a, m.b].includes(team.id)));
  s = applyAction(s, "deleteTeam", { tournamentId: t.id, teamId: team.id });
  assert.deepEqual(s.matches, retained);
  assert.ok(!s.teams.some(x => x.id === team.id));
  assert.ok(!s.matches.some(m => m.status === "live" && m.court === 2));
  assert.ok(standings(s, t.id, team.group).every(row => row.played === 0 && row.wins === 0 && row.pointDiff === 0));
  assert.equal(tournamentDisplayData(s, t.id).completed, 0);
  checkPairs(s);
});

test("empty and undersized groups do not leave broken knockout slots, and zero-fixture leagues accept replacements", () => {
  let s = setup(), t = s.tournaments[0];
  const survivors = [s.teams[0].id, s.teams.find(x => x.group !== s.teams[0].group).id];
  for (const team of s.teams.filter(x => !survivors.includes(x.id))) s = applyAction(s, "deleteTeam", { tournamentId: t.id, teamId: team.id });
  assert.equal(s.matches.length, 0);
  assert.equal(tournamentDisplayData(s, t.id).hasLeague, true);
  assert.equal(tournamentProgress(s, t.id).canCreateKnockouts, true);
  const drawn = applyAction(s, "knockouts", { tournamentId: t.id });
  assert.equal(drawn.matches.length, 1);
  assert.equal(drawn.matches[0].stage, "Final");
  for (const team of s.teams) s = applyAction(s, "deleteTeam", { tournamentId: t.id, teamId: team.id });
  assert.equal(tournamentProgress(s, t.id).canCreateKnockouts, false);
  s = applyAction(s, "teams", { tournamentId: t.id, group: 1, teams: entries(2, 1, "Replacement") });
  checkPairs(s);
  assert.equal(s.matches.length, 1);
  s = completeLeague(s);
  s = applyAction(s, "knockouts", { tournamentId: t.id });
  assert.equal(s.matches.filter(m => m.stage === "Final").length, 1);
});

test("knockout readiness counts available qualification places after a whole group withdraws", () => {
  let s = setup(), t = s.tournaments[0];
  s = applyAction(s, "resetFixtures", { tournamentId: t.id });
  s = applyAction(s, "tournament", { ...t, tournamentId: t.id, qualify: 1 });
  s = applyAction(s, "generate", { tournamentId: t.id });
  for (const team of s.teams.filter(x => x.group === 1)) s = applyAction(s, "deleteTeam", { tournamentId: t.id, teamId: team.id });
  s = completeLeague(s);
  assert.equal(tournamentProgress(s, t.id).canCreateKnockouts, false);
  assert.throws(() => applyAction(s, "knockouts", { tournamentId: t.id }), /At least two qualifying teams/);
});

for (const mode of ["intermediate", "beginner"]) test(`${mode} preserves qualification rules after late entries, new groups and withdrawals`, () => {
  let s = setup(mode), t = s.tournaments[0];
  s = applyAction(s, "teams", { tournamentId: t.id, group: 0, teams: entries(2, 2, "Late") });
  for (const team of s.teams.filter(x => x.group === 1).slice(2)) s = applyAction(s, "deleteTeam", { tournamentId: t.id, teamId: team.id });
  s = applyAction(s, "teams", { tournamentId: t.id, group: "new", teams: entries(3, 2, "New group") });
  checkPairs(s);
  s = completeLeague(s);
  const last = standings(s, t.id, 0).at(-1);
  assert.equal(qualificationStatus(s, t, last, standings(s, t.id, 0).length - 1), "");
  s = applyAction(s, "knockouts", { tournamentId: t.id });
  assert.ok(s.matches.filter(m => m.stage !== "League").every(m => !m.a || s.teams.some(x => x.id === m.a)));
  while (s.matches.some(m => m.status !== "completed")) {
    const ready = s.matches.find(m => m.status === "upcoming" && m.a && m.b);
    assert.ok(ready);
    s = finish(s, ready);
  }
  assert.ok(tournamentProgress(s, t.id).champion);
});

test("invalid late imports roll back atomically and entry changes lock when the draw is created", () => {
  let s = setup(), t = s.tournaments[0], saved = structuredClone(s);
  for (const payload of [
    { group: "new", teams: entries(1) },
    { group: "new", teams: [{ players: ["Fresh"] }, { players: ["Fresh"] }] },
    { group: 90, teams: entries(1, 1, "Late") },
    { group: 0, teams: [{ players: ["Fresh"], seed: 1 }] },
  ]) {
    assert.throws(() => applyAction(s, "teams", { tournamentId: t.id, ...payload }));
    assert.deepEqual(s, saved);
  }
  s = completeLeague(s);
  s = applyAction(s, "knockouts", { tournamentId: t.id });
  assert.throws(() => applyAction(s, "teams", { tournamentId: t.id, group: 0, teams: entries(1, 1, "Late") }), /locked/);
  assert.throws(() => applyAction(s, "deleteTeam", { tournamentId: t.id, teamId: s.teams[0].id }), /locked/);
});
