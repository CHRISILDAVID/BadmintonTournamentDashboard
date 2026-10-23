import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, emptyState } from "../server/engine.js";
import { eligibleKnockoutTeams, knockoutSlotLockReason } from "../shared/knockouts.js";
import { PLAYOFF_STAGE, playoffPreset, scoringRules } from "../shared/format.js";

function finish(state, match) {
  const t = state.tournaments.find(t => t.id === match.tournamentId);
  const rules = scoringRules(t, match.stage);
  state = applyAction(state, "start", { matchId: match.id, court: 1 });
  return applyAction(state, "finish", { matchId: match.id,
    games: Array.from({ length: Math.ceil(rules.bestOf / 2) }, () => [rules.points, 0]) });
}

function setup(groups = 4, qualify = 2, mode = "direct") {
  let state = applyAction(emptyState(), "tournament", {
    name: "Knockout editing", size: 1, groups, qualify, points: 21, cap: 30, bestOf: 1,
    ...(mode === "direct" ? {} : playoffPreset(mode, groups)),
  });
  const t = state.tournaments[0];
  const count = groups * (mode === "direct" ? Math.max(3, qualify + 1) : 5);
  state = applyAction(state, "teams", { tournamentId: t.id, teams: Array.from({ length: count }, (_, i) => ({
    players: Array.from({ length: t.size }, (_, j) => `Player ${i + 1} ${j + 1}`),
  })) });
  state = applyAction(state, "generate", { tournamentId: t.id });
  for (const match of state.matches) state = finish(state, match);
  return applyAction(state, "knockouts", { tournamentId: t.id });
}

const main = state => state.matches.filter(m => m.stage !== "League" && m.stage !== PLAYOFF_STAGE);
const swap = (state, a, side, b, otherSide) => applyAction(state, "swapKnockouts", {
  tournamentId: a.tournamentId, matchId: a.id, side, otherMatchId: b.id, otherSide,
});
const fill = (state, bye, extra = {}) => applyAction(state, "fillKnockoutBye", {
  tournamentId: bye.tournamentId, matchId: bye.id, side: bye.a || bye.aSource ? "b" : "a", players: ["Late entrant"], ...extra,
});

test("opening swaps preserve completed league results, fixture IDs and schedules and advance the new opponents", () => {
  let state = setup();
  let [a, b] = main(state);
  state = applyAction(state, "schedule", { matchId: a.id, scheduled: "18:30" });
  const before = structuredClone(state);
  state = swap(state, a, "a", b, "b");
  assert.equal(state.matches.find(m => m.id === a.id).a, b.b);
  assert.equal(state.matches.find(m => m.id === b.id).b, a.a);
  assert.equal(state.matches.find(m => m.id === a.id).scheduled, "18:30");
  assert.deepEqual(state.matches.map(m => m.id), before.matches.map(m => m.id));
  assert.deepEqual(state.matches.filter(m => m.stage === "League"), before.matches.filter(m => m.stage === "League"));
  const changed = state.matches.find(m => m.id === a.id);
  state = finish(state, changed);
  assert.equal(main(state).find(m => m.round === 2 && m.index === 0).a, changed.a);
});

test("same-game swaps change sides without changing the entrant set", () => {
  let state = setup();
  const match = main(state)[0];
  state = swap(state, match, "a", match, "b");
  assert.deepEqual([state.matches.find(m => m.id === match.id).a, state.matches.find(m => m.id === match.id).b], [match.b, match.a]);
});

test("later-round and cross-round swaps retain winner sources across saves and result corrections", () => {
  let state = setup();
  const openers = main(state).filter(m => m.round === 1);
  state = finish(state, openers[0]);
  state = finish(state, openers[2]);
  const semis = main(state).filter(m => m.round === 2);
  const played = state.matches.filter(m => m.status === "completed");
  state = swap(state, semis[0], "a", semis[1], "a");
  assert.deepEqual(state.matches.filter(m => m.status === "completed"), played);
  assert.equal(state.matches.find(m => m.id === semis[0].id).a, semis[1].a);
  state = JSON.parse(JSON.stringify(state));
  state = applyAction(state, "correctResult", { matchId: openers[2].id, games: [[0, 21]] });
  assert.equal(state.matches.find(m => m.id === semis[0].id).a, openers[2].b);
  const semi = state.matches.find(m => m.id === semis[0].id);
  state = swap(state, semi, "a", openers[1], "a");
  state = finish(state, state.matches.find(m => m.id === openers[1].id));
  assert.equal(state.matches.find(m => m.id === semi.id).a, openers[1].a);
  while (main(state).some(m => m.status === "upcoming" && m.a && m.b))
    state = finish(state, main(state).find(m => m.status === "upcoming" && m.a && m.b));
  assert.ok(main(state).every(m => m.status === "completed"));
});

test("a new entrant replaces a bye, retracts automatic advancement and advances after winning", () => {
  let state = setup(3, 1);
  const bye = main(state).find(m => m.bye);
  const league = state.matches.filter(m => m.stage === "League");
  const final = main(state).find(m => m.stage === "Final");
  state = fill(state, bye);
  const changed = state.matches.find(m => m.id === bye.id);
  assert.equal(changed.bye, undefined);
  assert.equal(changed.status, "upcoming");
  assert.equal(changed.winner, null);
  assert.deepEqual(changed.games, []);
  assert.equal(state.teams.at(-1).group, null);
  assert.deepEqual(state.matches.filter(m => m.stage === "League"), league);
  assert.equal(state.matches.find(m => m.id === final.id)[bye.index % 2 ? "b" : "a"], null);
  state = swap(state, changed, "a", changed, "b");
  state = finish(state, state.matches.find(m => m.id === bye.id));
  assert.equal(state.matches.find(m => m.id === final.id)[bye.index % 2 ? "b" : "a"], state.teams.at(-1).id);
});

test("byes with a pending playoff source accept an entrant without losing the playoff connection", () => {
  let state = setup(3, 4, "intermediate");
  const bye = main(state).find(m => m.bye);
  // Imported brackets may give a qualification playoff winner a bye.
  const feeder = main(state).find(m => m.aSource || m.bSource);
  const feederSide = feeder.aSource ? "a" : "b";
  const sourceSide = bye.a ? "a" : "b";
  const source = feeder[`${feederSide}Source`];
  feeder[feederSide] = bye[sourceSide];
  delete feeder[`${feederSide}Source`];
  bye[`${sourceSide}Source`] = source;
  bye[sourceSide] = null;
  bye.status = "upcoming";
  bye.winner = null;
  const sourceId = source.matchId;
  state = fill(state, bye, { players: ["Late player A", "Late player B"] });
  assert.equal(state.matches.find(m => m.id === bye.id).status, "upcoming");
  state = finish(state, state.matches.find(m => m.id === sourceId));
  assert.equal(state.matches.find(m => m.id === bye.id)[sourceSide], state.matches.find(m => m.id === sourceId).winner);
  assert.equal(state.matches.find(m => m.id === bye.id).winner, null);
});

test("cross-round connections reconcile in dependency order after a completed feeder changes", () => {
  let state = setup();
  const openers = main(state).filter(m => m.round === 1);
  state = finish(state, openers[2]);
  state = finish(state, openers[3]);
  const semi = main(state).find(m => m.round === 2 && m.index === 1);
  state = finish(state, semi);
  const final = main(state).find(m => m.stage === "Final");
  state = swap(state, final, "b", openers[0], "a");
  state = applyAction(state, "correctResult", { matchId: openers[2].id, games: [[0, 21]] });
  assert.equal(state.matches.find(m => m.id === semi.id).status, "upcoming");
  assert.equal(state.matches.find(m => m.id === openers[0].id).a, null);
  state = finish(state, state.matches.find(m => m.id === semi.id));
  assert.equal(state.matches.find(m => m.id === openers[0].id).a, openers[2].b);
});

test("swapped playoff sources follow playoff winners and corrections", () => {
  let state = setup(2, 4, "intermediate");
  const playoff = state.matches.find(m => m.stage === PLAYOFF_STAGE);
  state = finish(state, playoff);
  const feeder = main(state).find(m => m.aSource?.matchId === playoff.id || m.bSource?.matchId === playoff.id);
  const side = feeder.aSource?.matchId === playoff.id ? "a" : "b";
  const other = main(state).find(m => m.round === 1 && m.id !== feeder.id && m.a);
  state = swap(state, feeder, side, other, "a");
  state = applyAction(state, "correctResult", { matchId: playoff.id, games: [[0, 15]] });
  assert.equal(state.matches.find(m => m.id === other.id).a, playoff.b);
});

test("invalid, foreign, completed, on-court and unresolved places are rejected atomically", () => {
  let state = setup();
  const [a, b] = main(state);
  const before = structuredClone(state);
  for (const [match, side, other, otherSide] of [
    [a, "a", a, "a"], [a, "c", b, "a"], [a, "a", { ...b, id: "missing" }, "a"],
    [a, "a", main(state).find(m => m.round === 2), "a"], [a, "a", state.matches[0], "a"],
  ]) assert.throws(() => swap(state, match, side, other, otherSide));
  assert.deepEqual(state, before);
  state = applyAction(state, "start", { matchId: a.id, court: 1 });
  assert.throws(() => swap(state, a, "a", b, "a"), /waiting/);
  state = applyAction(state, "returnMatch", { matchId: a.id });
  state = swap(state, a, "a", b, "a");
  state = finish(state, state.matches.find(m => m.id === a.id));
  assert.throws(() => swap(state, a, "a", b, "a"), /Completed/);
});

test("league-eliminated entrants and duplicate players cannot fill byes or re-register", () => {
  const state = setup(3, 1);
  const bye = main(state).find(m => m.bye);
  const qualified = new Set(main(state).flatMap(m => [m.a, m.b]));
  const eliminated = state.teams.find(t => !qualified.has(t.id));
  const before = structuredClone(state);
  assert.ok(!eligibleKnockoutTeams(state, bye.tournamentId).some(t => t.id === eliminated.id));
  assert.throws(() => fill(state, bye, { teamId: eliminated.id }), /new team/);
  assert.throws(() => fill(state, bye, { players: eliminated.players }), /eliminated/);
  assert.throws(() => fill(state, bye, { players: ["One", "Two"] }), /exactly/);
  assert.throws(() => fill(state, main(state).find(m => !m.bye && m.round === 1)), /bye/);
  assert.deepEqual(state, before);
});

test("eligible unused registrations can fill byes only once", () => {
  let state = setup(3, 1);
  const bye = main(state).find(m => m.bye);
  const team = { id: "unused", tournamentId: bye.tournamentId, group: null, seed: 99, name: "Unused", players: ["Unused"] };
  state.teams.push(team);
  assert.deepEqual(eligibleKnockoutTeams(state, bye.tournamentId), [team]);
  state = fill(state, bye, { teamId: team.id });
  assert.equal(eligibleKnockoutTeams(state, bye.tournamentId).length, 0);
  assert.equal(state.teams.filter(t => t.id === team.id).length, 1);
  assert.throws(() => fill(state, bye, { teamId: team.id }));
});

test("a bye cannot be reopened once its downstream game is live or completed", () => {
  let state = setup(3, 1);
  const bye = main(state).find(m => m.bye);
  const side = bye.a ? "b" : "a";
  const opener = main(state).find(m => m.round === 1 && !m.bye);
  state = finish(state, opener);
  const final = main(state).find(m => m.stage === "Final");
  state = applyAction(state, "start", { matchId: final.id, court: 1 });
  assert.match(knockoutSlotLockReason(state, state.matches.find(m => m.id === bye.id), side), /on court or completed/);
  assert.throws(() => fill(state, bye), /on court or completed/);
  state = applyAction(state, "finish", { matchId: final.id, games: [[21, 0]] });
  assert.throws(() => fill(state, bye), /on court or completed/);
});

test("league corrections preserve added entrants and swapped qualification places", () => {
  let state = setup(3, 1);
  const bye = main(state).find(m => m.bye);
  const opener = main(state).find(m => !m.bye && m.round === 1);
  state = fill(state, bye);
  const entrant = state.teams.at(-1);
  const changed = state.matches.find(m => m.id === bye.id);
  const addedSide = changed.a === entrant.id ? "a" : "b";
  state = swap(state, changed, addedSide, opener, "a");
  const formerQualifier = state.teams.find(t => t.id === opener.a);
  const league = state.matches.find(m => m.stage === "League" && m.group === formerQualifier.group && m.winner === formerQualifier.id);
  state = applyAction(state, "correctResult", { matchId: league.id, games: [[0, 21]] });
  assert.equal(state.matches.find(m => m.id === opener.id).a, entrant.id);
  assert.ok(!state.matches.find(m => m.id === bye.id).bye);
  assert.equal(main(state).filter(m => m.round === 1).flatMap(m => [m.a, m.b]).filter(id => id === entrant.id).length, 1);
  while (main(state).some(m => m.status === "upcoming" && m.a && m.b))
    state = finish(state, main(state).find(m => m.status === "upcoming" && m.a && m.b));
  assert.ok(main(state).every(m => m.status === "completed"));
});

test("correcting league ranks updates a qualification place after it moves to a later round", () => {
  let state = setup(3, 1);
  const opener = main(state).find(m => m.round === 1 && !m.bye);
  const final = main(state).find(m => m.stage === "Final");
  const side = final.a ? "a" : "b";
  state = swap(state, opener, "a", final, side);
  const originalTeam = state.teams.find(t => t.id === opener.a);
  for (const league of state.matches.filter(m => m.stage === "League" && [m.a, m.b].includes(originalTeam.id)))
    state = applyAction(state, "correctResult", { matchId: league.id, games: [league.a === originalTeam.id ? [0, 21] : [21, 0]] });
  const expected = state.teams.find(t => t.id === state.matches.find(m => m.id === final.id)[side]);
  assert.equal(expected.group, originalTeam.group);
  assert.notEqual(expected.id, originalTeam.id);
});

test("editing leaves other categories and unrelated on-court games unchanged", () => {
  let state = setup();
  const other = setup(3, 1);
  state.tournaments.push(...other.tournaments);
  state.teams.push(...other.teams);
  state.matches.push(...other.matches);
  const fixtures = main(state).filter(m => m.tournamentId === state.tournaments[0].id && m.round === 1);
  state = applyAction(state, "start", { matchId: fixtures[2].id, court: 1 });
  const before = structuredClone(state);
  state = swap(state, fixtures[0], "a", fixtures[1], "a");
  assert.deepEqual(state.matches.find(m => m.id === fixtures[2].id), before.matches.find(m => m.id === fixtures[2].id));
  assert.deepEqual(state.matches.filter(m => m.tournamentId === other.tournaments[0].id), other.matches);
  assert.throws(() => swap(state, fixtures[0], "a", main(other).find(m => !m.bye && m.round === 1), "a"), /Choose a knockout place/);
});
