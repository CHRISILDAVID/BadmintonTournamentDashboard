import test from "node:test";
import assert from "node:assert/strict";
import { emptyState, applyAction, standings } from "../server/engine.js";
import {
  upcomingMatches,
  removeLegacyCalls,
  tournamentProgress,
} from "../shared/matches.js";
import { practiceState } from "../server/demo.js";

function setup() {
  let s = emptyState();
  for (const name of ["Singles", "Other singles"]) {
    s = applyAction(s, "tournament", {
      name,
      size: 1,
      groups: 1,
      qualify: 2,
      points: 21,
      cap: 30,
      bestOf: 1,
    });
    const tournamentId = s.tournaments.at(-1).id;
    s = applyAction(s, "teams", {
      tournamentId,
      teams: Array.from({ length: 4 }, (_, i) => ({
        players: [`${name} Player ${i + 1}`],
      })),
    });
    s = applyAction(s, "generate", { tournamentId });
  }
  return s;
}

test("all ready fixtures are visible regardless of old holds, call order or planned times", () => {
  const s = setup();
  s.callOrder = s.matches.map((m) => m.id).reverse();
  s.matches[0].held = true;
  s.matches[0].scheduled = "23:59";
  assert.deepEqual(
    upcomingMatches(s).map((m) => m.id),
    s.matches.map((m) => m.id),
  );
  const expected = structuredClone(s);
  delete expected.callOrder;
  expected.matches.forEach((m) => delete m.held);
  assert.equal(removeLegacyCalls(s), true);
  assert.deepEqual(s, expected);
  assert.equal(removeLegacyCalls(s), false);
});

test("any ready game can start; court and player conflicts remain enforced", () => {
  let s = setup();
  const chosen = s.matches.at(-1);
  chosen.held = true;
  s.callOrder = [s.matches[0].id];
  s = applyAction(s, "start", { matchId: chosen.id, court: 1 });
  assert.equal(s.matches.find((m) => m.id === chosen.id).status, "live");
  assert.equal(s.callOrder, undefined);
  assert.equal(s.matches.find((m) => m.id === chosen.id).held, undefined);
  assert.ok(!upcomingMatches(s).some((m) => m.id === chosen.id));
  assert.throws(
    () => applyAction(s, "start", { matchId: s.matches[0].id, court: 1 }),
    /occupied/,
  );
  const overlap = upcomingMatches(s).find((m) =>
    [m.a, m.b].some((id) => [chosen.a, chosen.b].includes(id)),
  );
  assert.throws(
    () => applyAction(s, "start", { matchId: overlap.id, court: 2 }),
    /already playing/,
  );
});

test("undo start frees the court and immediately returns a game to upcoming without changing standings", () => {
  let s = setup();
  const match = s.matches[0];
  const before = standings(s, match.tournamentId);
  s = applyAction(s, "start", { matchId: match.id, court: 1 });
  s = applyAction(s, "returnMatch", { matchId: match.id });
  const returned = s.matches.find((m) => m.id === match.id);
  assert.equal(returned.court, null);
  assert.equal(returned.startedAt, undefined);
  assert.equal(returned.held, undefined);
  assert.deepEqual(returned.games, []);
  assert.ok(upcomingMatches(s).some((m) => m.id === match.id));
  assert.deepEqual(standings(s, match.tournamentId), before);
  assert.throws(
    () => applyAction(s, "returnMatch", { matchId: match.id }),
    /Only an on-court/,
  );
  s = applyAction(s, "start", { matchId: match.id, court: 1 });
  s = applyAction(s, "finish", { matchId: match.id, games: [[21, 15]] });
  assert.throws(
    () => applyAction(s, "returnMatch", { matchId: match.id }),
    /Only an on-court/,
  );
});

test("retired call and hold operations are rejected without mutations", () => {
  const s = setup(),
    before = structuredClone(s);
  for (const action of [
    "moveCall",
    "holdMatch",
    "releaseMatch",
    "resetCallOrder",
  ])
    assert.throws(
      () => applyAction(s, action, { matchId: s.matches[0].id, position: 1 }),
      /Unknown operation/,
    );
  assert.deepEqual(s, before);
});

test("final becomes ready only after both semifinals finish", () => {
  let s = practiceState(emptyState());
  const t = s.tournaments.find((t) => t.name.includes("Knockout rehearsal"));
  const final = s.matches.find(
    (m) => m.tournamentId === t.id && m.stage === "Final",
  );
  assert.ok(!upcomingMatches(s).some((m) => m.id === final.id));
  assert.throws(
    () => applyAction(s, "start", { matchId: final.id, court: 4 }),
    /Both opponents/,
  );
  for (const m of s.matches.filter(
    (m) => m.tournamentId === t.id && m.stage === "Semifinal",
  )) {
    s = applyAction(s, "start", { matchId: m.id, court: 4 });
    s = applyAction(s, "finish", { matchId: m.id, games: [[21, 15]] });
  }
  assert.ok(upcomingMatches(s).some((m) => m.id === final.id));
});

test("stage actions unlock after the last league result for that category only", () => {
  let s = setup();
  const id = s.tournaments[0].id,
    other = s.tournaments[1].id;
  const matches = s.matches.filter((m) => m.tournamentId === id);
  assert.equal(tournamentProgress(s, id).canCreateKnockouts, false);
  for (const [i, m] of matches.entries()) {
    s = applyAction(s, "start", { matchId: m.id, court: 1 });
    s = applyAction(s, "finish", { matchId: m.id, games: [[21, 15]] });
    assert.equal(
      tournamentProgress(s, id).canCreateKnockouts,
      i === matches.length - 1,
    );
    assert.equal(tournamentProgress(s, other).canCreateKnockouts, false);
  }
  s = applyAction(s, "knockouts", { tournamentId: id });
  assert.equal(tournamentProgress(s, id).canCreateKnockouts, false);
  assert.equal(tournamentProgress(s, id).postseason, true);
  assert.throws(() => applyAction(s, "knockouts", { tournamentId: id }));
});
