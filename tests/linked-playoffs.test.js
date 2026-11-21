import assert from "node:assert/strict";
import test from "node:test";
import { applyAction, emptyState, validateLinkedFixtures } from "../shared/tournament.js";
import { matchStageLabel, tournamentProgress } from "../shared/matches.js";
import { tournamentDisplayData } from "../shared/display.js";

const scoring = { points: 5, bestOf: 1, cap: 5, goldenPoint: true };

function setup(method, mode) {
  let state = emptyState();
  const act = (type, payload) => state = applyAction(state, type, payload);
  const sources = ["Pure Beginner", "Beginner"].map(name => {
    act("tournament", {
      name, size: 1, groups: 1, qualify: 2,
      format: method === "league" ? "league" : "knockouts",
      scoring: { league: scoring, knockout: scoring },
    });
    const tournamentId = state.tournaments.at(-1).id;
    act("teams", { tournamentId, teams: ["Alice", "Bob"].map(player => ({ players: [`${name} ${player}`] })) });
    act("generate", { tournamentId });
    return { tournamentId, method };
  });
  act("tournament", { name: "Overall Title", size: 1, format: "linked",
    scoring: { knockout: scoring }, linkedPlayoffs: { mode, sources } });
  const tournamentId = state.tournaments.at(-1).id;
  return { act, get state() { return state; }, tournamentId, sources,
    sourceMatch: i => state.matches.find(m => m.tournamentId === sources[i].tournamentId),
    linked: () => state.matches.filter(m => m.tournamentId === tournamentId),
    finish: m => { act("start", { matchId: m.id, court: 1 }); act("finish", { matchId: m.id, games: [[5, 0]] }); },
  };
}

test("league leaders qualify for a single Grand Final without creating category knockouts", () => {
  const event = setup("league", "final");
  const [pending] = event.linked();
  assert.equal(pending.aSource.label, "Pure Beginner #1");
  assert.equal(pending.bSource.label, "Beginner #1");
  assert.equal(pending.a, null);
  assert.throws(() => event.act("start", { matchId: pending.id, court: 1 }), /Both opponents/);
  event.finish(event.sourceMatch(0));
  assert.equal(event.linked()[0].a, event.sourceMatch(0).winner);
  assert.equal(event.linked()[0].b, null);
  assert.equal(tournamentProgress(event.state, event.sources[0].tournamentId).canCreateKnockouts, false);
  assert.throws(() => event.act("knockouts", event.sources[0]), /league standings/);
  event.finish(event.sourceMatch(1));
  event.finish(event.linked()[0]);
  assert.equal(tournamentDisplayData(event.state, event.tournamentId).knockoutRounds[0].stage, "Grand Final");
  assert.equal(tournamentProgress(event.state, event.tournamentId).champion.winner, event.sourceMatch(0).winner);
  validateLinkedFixtures(event.state);
});

test("category finalists cross over, update before play, and advance through the linked semifinals", () => {
  const event = setup("bracket", "semifinals");
  assert.equal(matchStageLabel(event.sourceMatch(0), event.state.tournaments), "Category Final");
  event.finish(event.sourceMatch(0));
  event.finish(event.sourceMatch(1));
  const pure = event.sourceMatch(0), beginner = event.sourceMatch(1);
  assert.deepEqual(event.linked().map(({ a, b }) => [a, b]), [[pure.a, beginner.b], [beginner.a, pure.b], [null, null]]);
  event.act("correctResult", { matchId: pure.id, games: [[0, 5]] });
  const [first, second] = event.linked();
  assert.deepEqual([first.a, first.b], [pure.b, beginner.b]);
  assert.deepEqual([second.a, second.b], [beginner.a, pure.a]);
  event.finish(first);
  assert.throws(() => event.act("correctResult", { matchId: pure.id, games: [[5, 0]] }), /play has already started/);
  assert.equal(event.sourceMatch(0).winner, pure.b);
  event.finish(second);
  const final = event.linked().at(-1);
  assert.deepEqual([final.a, final.b], [first.a, second.a]);
  event.finish(final);
  validateLinkedFixtures(event.state);
  const invalid = structuredClone(event.state);
  invalid.matches.find(m => m.id === first.id).aSource.rank = 2;
  assert.throws(() => validateLinkedFixtures(invalid), /Invalid linked playoff fixture/);
});

test("deleting an unplayed linked bracket restores the source categories' ordinary workflow", () => {
  const event = setup("league", "semifinals");
  event.finish(event.sourceMatch(0));
  assert.throws(() => event.act("deleteTournament", event.sources[0]), /source category/);
  const sourceFixture = event.sourceMatch(0);
  event.act("deleteTournament", { tournamentId: event.tournamentId });
  assert.deepEqual(event.sourceMatch(0), sourceFixture);
  assert.equal(event.linked().length, 0);
  assert.equal(tournamentProgress(event.state, event.sources[0].tournamentId).canCreateKnockouts, true);
});
