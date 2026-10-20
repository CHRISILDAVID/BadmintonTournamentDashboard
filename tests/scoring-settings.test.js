import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, emptyState, validateGames, standings } from "../server/engine.js";
import { playoffPreset, PLAYOFF_STAGE, scoringRules } from "../shared/format.js";

function playoffDraw() {
  const preset = playoffPreset("beginner", 1);
  preset.scoring.playoff = { points: 19, cap: 30, bestOf: 1, goldenPoint: false };
  let s = applyAction(emptyState(), "tournament", { name: "Scoring correction", ...preset });
  const tournamentId = s.tournaments[0].id;
  s = applyAction(s, "teams", { tournamentId, teams: Array.from({ length: 6 }, (_, i) => ({ players: [`Player ${i}`, `Partner ${i}`], seed: i + 1 })) });
  s = applyAction(s, "generate", { tournamentId });
  s = applyAction(s, "randomComplete", { tournamentId });
  return applyAction(s, "knockouts", { tournamentId });
}
const finish = (s, id, games) => applyAction(applyAction(s, "start", { matchId: id, court: 1 }), "finish", { matchId: id, games });

test("correcting playoff points preserves completed 19-point games and lets a live game finish at 21", () => {
  let s = playoffDraw();
  const [first, second] = s.matches.filter(m => m.stage === PLAYOFF_STAGE);
  s = finish(s, first.id, [[19, 1]]);
  s = applyAction(s, "start", { matchId: second.id, court: 1 });
  const original = structuredClone(s), t = s.tournaments[0];
  assert.throws(() => applyAction(s, "finish", { matchId: second.id, games: [[21, 1]] }), /Play to 19/);
  s = applyAction(s, "scoring", { tournamentId: t.id, scoring: { ...t.scoring, playoff: { ...t.scoring.playoff, points: 21 } } });
  assert.equal(s.tournaments[0].scoring.league.points, 15);
  assert.equal(s.tournaments[0].scoring.knockout.points, 21);
  assert.equal(scoringRules(s.tournaments[0], PLAYOFF_STAGE).points, 21);
  assert.deepEqual(s.matches.map(m => m.id), original.matches.map(m => m.id));
  for (const m of s.matches) {
    const { scoring, ...unchanged } = m;
    assert.deepEqual(unchanged, original.matches.find(x => x.id === m.id));
  }
  assert.deepEqual(standings(s, t.id, 0), standings(original, t.id, 0));
  const completed = s.matches.find(m => m.id === first.id);
  assert.equal(scoringRules(s.tournaments[0], completed.stage, completed).points, 19);
  assert.equal(validateGames(completed.games, completed.scoring), 0);
  s = applyAction(s, "finish", { matchId: second.id, games: [[21, 1]] });
  assert.equal(s.matches.find(m => m.id === second.id).status, "completed");
  s = applyAction(s, "correctResult", { matchId: first.id, games: [[19, 2]] });
  assert.deepEqual(s.matches.find(m => m.id === first.id).games, [[19, 2]]);
  assert.deepEqual(JSON.parse(JSON.stringify(s)).matches.find(m => m.id === first.id).scoring, completed.scoring);
});

test("scoring corrections validate every stage atomically and preserve historical rules through repeated changes", () => {
  let s = playoffDraw();
  const t = s.tournaments[0], playoff = s.matches.find(m => m.stage === PLAYOFF_STAGE);
  s = finish(s, playoff.id, [[19, 0]]);
  const before = structuredClone(s);
  for (const bad of [undefined, { ...t.scoring, playoff: { ...t.scoring.playoff, points: 99 } }, { ...t.scoring, knockout: { ...t.scoring.knockout, bestOf: 2 } }]) {
    assert.throws(() => applyAction(s, "scoring", { tournamentId: t.id, scoring: bad }));
    assert.deepEqual(s, before);
  }
  assert.throws(() => applyAction(s, "scoring", { tournamentId: "deleted", scoring: t.scoring }), /not found/);
  for (const points of [21, 25]) s = applyAction(s, "scoring", { tournamentId: t.id, scoring: { ...s.tournaments[0].scoring, playoff: { ...t.scoring.playoff, points } } });
  assert.equal(s.matches.find(m => m.id === playoff.id).scoring.points, 19);
  assert.equal(s.tournaments[0].scoring.playoff.points, 25);
});

test("a downstream match replayed after a winner correction uses the current rules", () => {
  let s = playoffDraw();
  s = applyAction(s, "randomComplete", { tournamentId: s.tournaments[0].id });
  const t = s.tournaments[0];
  s = applyAction(s, "scoring", { tournamentId: t.id, scoring: { ...t.scoring, knockout: { ...t.scoring.knockout, points: 25 } } });
  const playoff = s.matches.find(m => m.stage === PLAYOFF_STAGE);
  const winnerWasA = playoff.winner === playoff.a;
  s = applyAction(s, "correctResult", { matchId: playoff.id, games: [winnerWasA ? [0, 19] : [19, 0]] });
  const reset = s.matches.filter(m => m.stage !== "League" && m.stage !== PLAYOFF_STAGE && m.status === "upcoming");
  assert.ok(reset.length > 0);
  for (const m of reset) {
    assert.equal(m.scoring, undefined);
    assert.equal(scoringRules(s.tournaments[0], m.stage, m).points, 25);
  }
});
