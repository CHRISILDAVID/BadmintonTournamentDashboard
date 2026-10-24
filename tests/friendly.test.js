import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, emptyState, standings } from "../server/engine.js";
import { scoringRules } from "../shared/format.js";
import { matchesFilter } from "../shared/matches.js";
import { liveDisplayMatches, tournamentDisplayData } from "../shared/display.js";

const rules = { bestOf: 3, points: 15, cap: 15, goldenPoint: true };
const friendly = (s = emptyState(), sides = [["Alice"], ["Bob"]]) =>
  applyAction(s, "friendly", { size: sides[0].length, sides, scoring: rules });

test("standalone friendly games start, record and correct results without a tournament", () => {
  let s = friendly();
  const m = s.matches[0];
  assert.equal(m.tournamentId, null);
  assert.equal(m.stage, "Friendly");
  assert.deepEqual(s.tournaments, []);
  assert.deepEqual(scoringRules(undefined, m.stage, m), rules);
  assert.equal(s.teams[0].friendlyMatchId, m.id);
  assert.equal(matchesFilter(m, "friendly"), true);
  assert.equal(matchesFilter(m, "all"), true);
  assert.equal(matchesFilter(m, "category"), false);
  s = applyAction(s, "schedule", { matchId: m.id, scheduled: "18:30" });
  s = applyAction(s, "start", { matchId: m.id, court: 1 });
  assert.deepEqual(liveDisplayMatches(s).map(m => m.id), [m.id]);
  assert.deepEqual(liveDisplayMatches(s, { categories: ["category"] }), []);
  assert.deepEqual(liveDisplayMatches(s, { courts: [2] }), []);
  assert.deepEqual(liveDisplayMatches(s, { finals: true }), []);
  s = applyAction(s, "finish", { matchId: m.id, games: [[15, 14], [15, 0]] });
  assert.equal(s.matches[0].winner, m.a);
  assert.ok(s.matches[0].completedAt);
  s = applyAction(s, "correctResult", { matchId: m.id, games: [[0, 15], [14, 15]] });
  assert.equal(s.matches[0].winner, m.b);
  assert.equal(s.matches[0].status, "completed");
  assert.deepEqual(s.tournaments, []);
  assert.equal(s.matches.length, 1);
});

test("friendly games preserve tournament draws and standings, and share court/player conflict checks", () => {
  let s = applyAction(emptyState(), "tournament", { name: "Singles", size: 1, groups: 1, qualify: 2, points: 21, cap: 30, bestOf: 1 });
  const t = s.tournaments[0];
  s = applyAction(s, "teams", { tournamentId: t.id, teams: [{ players: ["Alice"], seed: 1 }, { players: ["Chris"], seed: 2 }] });
  s = applyAction(s, "generate", { tournamentId: t.id });
  const original = structuredClone(s);
  s = friendly(s);
  const m = s.matches.at(-1);
  assert.deepEqual(standings(s, t.id), standings(original, t.id));
  assert.deepEqual(tournamentDisplayData(s, t.id), tournamentDisplayData(original, t.id));
  s = applyAction(s, "start", { matchId: original.matches[0].id, court: 1 });
  assert.throws(() => applyAction(s, "start", { matchId: m.id, court: 1 }), /occupied/);
  assert.throws(() => applyAction(s, "start", { matchId: m.id, court: 2 }), /already playing/);
  s = applyAction(s, "finish", { matchId: original.matches[0].id, games: [[21, 0]] });
  s = applyAction(s, "deleteTournament", { tournamentId: t.id });
  assert.deepEqual(s.matches.map(m => m.id), [m.id]);
  assert.equal(s.teams.length, 2);
  s = applyAction(s, "start", { matchId: m.id, court: 1 });
  s = applyAction(s, "returnMatch", { matchId: m.id });
  assert.equal(s.matches[0].court, null);
  assert.equal(s.matches[0].status, "upcoming");
});

test("friendly setup rejects duplicate players, incomplete sides and invalid rules atomically", () => {
  const s = emptyState(), before = structuredClone(s);
  for (const payload of [
    { size: 1, sides: [[" Alice "], ["alice"]], scoring: rules },
    { size: 2, sides: [["Alice"], ["Bob"]], scoring: rules },
    { size: 1, sides: [[""], ["Bob"]], scoring: rules },
    { size: 1, sides: [["A".repeat(81)], ["Bob"]], scoring: rules },
    { size: 3, sides: [["A", "B", "C"], ["D", "E", "F"]], scoring: rules },
    { size: 1, sides: [["Alice"], ["Bob"]], scoring: { ...rules, bestOf: 2 } },
    { size: 1, sides: [["Alice"], ["Bob"]], scoring: { ...rules, cap: 30 } },
  ]) assert.throws(() => applyAction(s, "friendly", payload));
  assert.deepEqual(s, before);
  assert.equal(friendly(s, [["Alice", "Bob"], ["Chris", "Dana"]]).teams.length, 2);
});
