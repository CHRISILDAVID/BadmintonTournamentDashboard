import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, emptyState } from "../shared/tournament.js";
import { matchArrivals, sortByArrival, arrivalLabel } from "../shared/arrivals.js";

const at = time => `2026-10-31T${time}:00.000Z`;
function fixture() {
  return {
    teams: ["a", "b", "c", "d"].map((id, i) => ({ id, players: [id], arrivedAt: at(["08:00", "10:00", "09:00", "09:30"][i]) })),
    matches: [
      { id: "ac", a: "a", b: "c", status: "upcoming" },
      { id: "cd", a: "c", b: "d", status: "upcoming" },
      { id: "ab", a: "a", b: "b", status: "upcoming" },
    ],
  };
}

test("organizer arrival action timestamps a team once, ignores supplied times, and can undo a mistake", () => {
  let s = applyAction(emptyState(), "tournament", { name: "Doubles", size: 2, groups: 1, qualify: 2, points: 21, cap: 30, bestOf: 1 });
  const tournamentId = s.tournaments[0].id;
  s = applyAction(s, "teams", { tournamentId, teams: [{ players: ["Alice", "Bob"] }] });
  const original = structuredClone(s), teamId = s.teams[0].id, start = Date.now();
  const payload = { tournamentId, teamId, arrived: true, arrivedAt: at("01:00") };
  s = applyAction(s, "teamArrival", payload);
  assert.ok(Date.parse(s.teams[0].arrivedAt) >= start);
  assert.ok(Date.parse(s.teams[0].arrivedAt) <= Date.now());
  assert.equal(original.teams[0].arrivedAt, undefined);
  assert.equal(applyAction(s, "teamArrival", payload).teams[0].arrivedAt, s.teams[0].arrivedAt);
  s = applyAction(s, "teamArrival", { ...payload, arrived: false });
  assert.equal(s.teams[0].arrivedAt, undefined);
  assert.deepEqual(s.teams[0].players, ["Alice", "Bob"]);
  assert.throws(() => applyAction(s, "teamArrival", { ...payload, tournamentId: "other" }), /Team not found/);
  assert.throws(() => applyAction(s, "teamArrival", { ...payload, arrived: "yes" }), /whether this team/);
});

test("ready matches prioritize the longest-waiting team and ties use both-teams readiness without mutating fixture order", () => {
  const state = fixture(), before = structuredClone(state), arrivals = matchArrivals(state);
  assert.deepEqual(sortByArrival(state.matches, arrivals).map(m => m.id), ["ac", "ab", "cd"]);
  assert.equal(arrivalLabel(arrivals.get("ab"), Date.parse(at("10:00"))), "Ready · Waiting 120 min");
  assert.deepEqual(state, before);
  delete state.teams[0].arrivedAt;
  const next = matchArrivals(state);
  assert.deepEqual(sortByArrival(state.matches, next).map(m => m.id), ["cd", "ac", "ab"]);
  assert.equal(arrivalLabel(next.get("ab")), "1 team not checked in");
  delete state.teams[1].arrivedAt;
  assert.equal(matchArrivals(state).get("ab").label, "Teams not checked in");
});

test("completing a match resets both teams' wait, while byes and score corrections do not change arrival priority", () => {
  const state = fixture();
  state.matches.push({ id: "played", a: "a", b: "b", status: "completed", completedAt: at("10:30") });
  const arrivals = matchArrivals(state);
  assert.deepEqual(sortByArrival(state.matches.filter(m => m.status === "upcoming"), arrivals).map(m => m.id), ["cd", "ac", "ab"]);
  assert.equal(arrivals.get("ab").waitingSince, Date.parse(at("10:30")));
  state.matches.at(-1).correctedAt = at("11:30");
  assert.equal(matchArrivals(state).get("ab").waitingSince, Date.parse(at("10:30")));
  state.matches.at(-1).bye = true;
  assert.equal(matchArrivals(state).get("ab").waitingSince, Date.parse(at("08:00")));
  assert.equal(state.teams[0].arrivedAt, at("08:00"));
});

test("players on other courts/categories make a match unavailable until their game finishes or its start is undone", () => {
  const state = fixture();
  state.teams.push({ id: "other", players: ["A"] });
  state.matches.push({ id: "live", a: "other", b: "d", status: "live", tournamentId: "another" });
  const arrivals = matchArrivals(state);
  assert.equal(arrivals.get("ab").ready, false);
  assert.equal(arrivals.get("ab").label, "Players already on court");
  state.matches.pop();
  assert.equal(matchArrivals(state).get("ab").ready, true);
});

test("older unchecked teams, pending opponents and custom games keep stable fixture order; knockout matches retain team arrivals", () => {
  const state = fixture();
  state.matches[0].stage = "Final";
  assert.equal(matchArrivals(state).get("ac").ready, true);
  delete state.teams[0].arrivedAt;
  delete state.teams[1].arrivedAt;
  delete state.teams[2].arrivedAt;
  delete state.teams[3].arrivedAt;
  state.matches.push({ id: "pending", a: "a", b: null, status: "upcoming" }, { id: "custom", kind: "custom", a: "a", b: "b", status: "upcoming" });
  const arrivals = matchArrivals(state);
  assert.equal(arrivals.get("pending").label, "Awaiting opponents");
  assert.equal(arrivals.has("custom"), false);
  assert.deepEqual(sortByArrival(state.matches, arrivals), state.matches);
});
