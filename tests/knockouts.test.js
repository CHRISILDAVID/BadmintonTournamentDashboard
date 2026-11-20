import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, emptyState } from "../shared/tournament.js";
import { eligibleKnockoutTeams, knockoutDependents, knockoutSlotLockReason } from "../shared/knockouts.js";
import { PLAYOFF_STAGE, playoffPreset, scoringRules } from "../shared/format.js";
import { tournamentProgress } from "../shared/matches.js";
import { tournamentDisplayData } from "../shared/display.js";

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

const knockoutRules = { points: 5, cap: 5, bestOf: 1, goldenPoint: true };
const knockoutConfig = {
  name: "Singles knockout",
  size: 1,
  format: "knockouts",
  scoring: { knockout: knockoutRules },
};

test("batch entrants fill two byes atomically and keep the original draw", () => {
  let state = applyAction(emptyState(), "tournament", knockoutConfig);
  const tournamentId = state.tournaments[0].id;
  state = applyAction(state, "teams", { tournamentId, teams: Array.from({ length: 6 }, (_, i) => ({ players: [`Seed ${i + 1}`] })) });
  state = applyAction(state, "generate", { tournamentId });
  const byes = main(state).filter(match => match.bye);
  const entries = byes.map((match, index) => ({
    matchId: match.id, side: match.a ? "b" : "a", players: [`Late team ${index + 1}`],
  }));
  const batch = entries => applyAction(state, "fillKnockoutByes", { tournamentId, entries });
  const before = structuredClone(state);
  assert.throws(() => batch([entries[0], { ...entries[1], players: entries[0].players }]), /Late team 2.*already entered/);
  assert.deepEqual(state, before);
  const updated = batch(entries);
  assert.equal(updated.teams.length, 8);
  assert.equal(updated.revision, state.revision + 1);
  assert.equal(main(updated).length, 7);
  assert.equal(main(updated).filter(match => match.bye).length, 0);
  assert.deepEqual(main(updated).map(match => match.id), main(state).map(match => match.id));
  const dependents = knockoutDependents(main(state));
  for (const [index, bye] of byes.entries()) {
    const filled = updated.matches.find(match => match.id === bye.id);
    assert.equal(filled.status, "upcoming");
    assert.equal(filled[entries[index].side], updated.teams.find(team => team.name === entries[index].players[0]).id);
    const consumer = updated.matches.find(match => match.id === dependents.get(bye.id)[0].id);
    assert.equal([consumer.a, consumer.b].includes(bye.winner), false);
  }

  const next = dependents.get(byes[1].id)[0];
  const sibling = main(state).find(match => match.round === byes[1].round && match.index === (byes[1].index ^ 1));
  state = finish(state, sibling);
  state = applyAction(state, "start", { matchId: next.id, court: 1 });
  const locked = structuredClone(state);
  assert.throws(() => batch(entries), /Late team 2.*on court or completed/);
  assert.deepEqual(state, locked);
});

test("standalone knockouts draw every registration by seed and allow a reset before play even with byes", () => {
  const legacy = { id: "league", name: "Existing league", size: 1, groups: 1, qualify: 2, points: 21, cap: 30, bestOf: 1 };
  let state = { ...emptyState(), tournaments: [legacy] };
  assert.throws(() => applyAction(state, "tournament", { ...knockoutConfig, format: "unknown" }), /supported tournament format/);
  state = applyAction(state, "tournament", knockoutConfig);
  const tournamentId = state.tournaments[1].id;
  assert.throws(() => applyAction(state, "generate", { tournamentId }), /at least 2 teams/);
  state = applyAction(state, "tournament", { ...knockoutConfig, tournamentId, name: "Club singles" });
  state = applyAction(state, "teams", { tournamentId, teams: [3, 1, 5, 2, 4].map(seed => ({ seed, players: [`Seed ${seed}`] })) });
  state = applyAction(state, "generate", { tournamentId });
  const seeds = new Map(state.teams.map(t => [t.id, t.seed]));
  const firstRound = state.matches.filter(m => m.round === 1);
  assert.deepEqual(firstRound.map(m => [seeds.get(m.a), seeds.get(m.b)]), [[1, undefined], [4, 5], [2, undefined], [3, undefined]]);
  assert.deepEqual(firstRound.filter(m => m.bye).map(m => m.winner), [firstRound[0].a, firstRound[2].a, firstRound[3].a]);
  assert.ok(state.teams.every(t => t.group === null));
  assert.ok(state.matches.every(m => m.group === null && m.stage !== "League"));
  assert.equal(tournamentProgress(state, tournamentId).hasFixtures, true);
  assert.equal(tournamentProgress(state, tournamentId).canCreateKnockouts, false);
  const display = tournamentDisplayData(state, tournamentId);
  assert.equal(display.hasLeague, false);
  assert.equal(display.showLeagueStandings, false);
  assert.deepEqual(display.knockoutRounds.map(r => r.stage), ["Quarterfinal", "Semifinal", "Final"]);
  assert.throws(() => applyAction(state, "generate", { tournamentId }), /Fixtures already exist/);
  assert.throws(() => applyAction(state, "tournament", { ...knockoutConfig, tournamentId }), /Format is locked/);
  state = applyAction(state, "resetFixtures", { tournamentId });
  assert.equal(state.matches.length, 0);
  assert.equal(state.teams.length, 5);
  assert.equal(tournamentProgress(state, tournamentId).hasFixtures, false);
  state = applyAction(state, "tournament", { ...legacy, tournamentId, format: "league" });
  state = applyAction(state, "generate", { tournamentId });
  assert.equal(state.matches.length, 10);
  assert.ok(state.matches.every(m => m.stage === "League"));
  assert.deepEqual(state.tournaments[0], legacy);
});

test("standalone knockouts share the bracket editor, team locks, scoring changes and result corrections", () => {
  let state = applyAction(emptyState(), "tournament", knockoutConfig);
  const tournamentId = state.tournaments[0].id;
  state = applyAction(state, "teams", { tournamentId, teams: ["Uma", "Mira", "Isha"].map(name => ({ players: [name] })) });
  state = applyAction(state, "generate", { tournamentId });
  const [bye, opener, final] = state.matches;
  const team = state.teams.find(t => t.id === opener.a);
  const editTeam = { tournamentId, teams: [{ id: team.id, players: ["Meera"] }] };
  assert.throws(() => applyAction(state, "teams", { ...editTeam, teams: [{ ...editTeam.teams[0], seed: 10 }] }), /Seeds are locked/);
  assert.throws(() => applyAction(state, "deleteTeam", { tournamentId, teamId: team.id }), /entries are locked/);
  state = applyAction(state, "teams", editTeam);
  assert.equal(state.teams.find(t => t.id === team.id).name, "Meera");
  state = fill(state, bye);
  state = swap(state, opener, "a", opener, "b");
  state = applyAction(state, "schedule", { matchId: opener.id, scheduled: "17:30" });
  const edited = state.matches.find(m => m.id === opener.id);
  assert.equal(edited.a, opener.b);
  assert.equal(edited.scheduled, "17:30");
  state = finish(state, edited);
  assert.throws(() => applyAction(state, "resetFixtures", { tournamentId }), /Only unplayed fixtures/);
  assert.equal(state.matches.find(m => m.id === final.id).b, edited.a);
  state = applyAction(state, "scoring", { tournamentId, scoring: { knockout: { ...knockoutRules, points: 7, cap: 7 } } });
  assert.deepEqual(state.matches.find(m => m.id === opener.id).scoring, knockoutRules);
  state = finish(state, state.matches.find(m => m.id === bye.id));
  state = finish(state, state.matches.find(m => m.id === final.id));
  assert.equal(tournamentProgress(state, tournamentId).champion.winner, bye.a);
  assert.throws(() => applyAction(state, "teams", editTeam), /Player names are locked/);
  state = applyAction(state, "correctResult", { matchId: opener.id, games: [[0, 5]] });
  const reopened = state.matches.find(m => m.id === final.id);
  assert.deepEqual([reopened.status, reopened.winner, reopened.b], ["upcoming", null, edited.b]);
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
