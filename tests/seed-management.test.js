import assert from "node:assert/strict";
import test from "node:test";
import { applyAction, emptyState } from "../shared/tournament.js";

test("imported seeds can be reordered and removed before a 14-team knockout", () => {
  let state = emptyState();
  const act = (action, payload) => state = applyAction(state, action, payload);
  act("tournament", { name: "Beginner", size: 1, format: "knockouts", points: 15, cap: 21, bestOf: 1, manualSeeding: true });
  const tournamentId = state.tournaments[0].id;
  const teamRows = Array.from({ length: 14 }, (_, index) => ({ players: [`Player ${index + 1}`] }));
  act("teams", { tournamentId, teams: teamRows.slice(0, 8), seededRows: [7, 0] });
  act("teams", { tournamentId, teams: teamRows.slice(8), seededRows: [5] });
  const ids = state.teams.map(t => t.id);
  assert.deepEqual(state.tournaments[0].seedOrder, [ids[7], ids[0], ids[13]]);
  assert.throws(() => act("seeds", { tournamentId, teamIds: [ids[7], ids[7]] }), /different team/);
  act("seeds", { tournamentId, teamIds: [ids[13], ids[7], ids[5], ids[4]] });
  assert.deepEqual(state.tournaments[0].seedOrder, [ids[13], ids[7], ids[5], ids[4]]);
  act("generate", { tournamentId });
  assert.deepEqual(state.matches.filter(m => m.bye).map(m => m.winner), [ids[13], ids[7]]);
  assert.equal(new Set(state.matches.filter(m => m.round === 1).flatMap(m => [m.a, m.b]).filter(Boolean)).size, 14);
  assert.throws(() => act("seeds", { tournamentId, teamIds: [] }), /locked/);
  act("resetFixtures", { tournamentId });
  act("deleteTeam", { tournamentId, teamId: ids[7] });
  assert.deepEqual(state.tournaments[0].seedOrder, [ids[13], ids[5], ids[4]]);
});
