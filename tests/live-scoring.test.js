import test from "node:test";
import assert from "node:assert/strict";
import { newScore, reduceScore, elapsedSeconds } from "../shared/live-scoring.js";
import { validateGames } from "../shared/tournament.js";
const match = { id: "match", a: "team-a", b: "team-b" };
test("point reducer honors every engine scoring format, game transitions and undo across games", () => {
  for (const goldenPoint of [false, true]) for (const bestOf of [1, 3, 5]) {
    const rules = { points: 15, cap: goldenPoint ? 15 : 21, bestOf, goldenPoint };
    let s = newScore(match, rules, 0);
    for (let g = 0; g < Math.ceil(bestOf / 2); g++) {
      for (let n = 0; n < 14; n++) {
        s = reduceScore(s, { type: "point", teamId: "team-a" });
        s = reduceScore(s, { type: "point", teamId: "team-b" });
      }
      const before = structuredClone(s);
      s = reduceScore(s, { type: "point", teamId: "team-a" });
      if (!goldenPoint) s = reduceScore(s, { type: "point", teamId: "team-a" });
      const won = structuredClone(s);
      s = reduceScore(s, { type: "undo" });
      if (!goldenPoint) s = reduceScore(s, { type: "undo" });
      assert.deepEqual(s, before);
      s = won;
    }
    assert.equal(s.complete, true);
    assert.equal(validateGames(s.games, rules), 0);
    s = reduceScore(s, { type: "confirm" });
    assert.throws(() => reduceScore(s, { type: "point", teamId: "team-a" }));
  }
});
test("pause timing and wrong team checks do not mutate previous state", () => {
  const s = newScore(match, { points: 21, cap: 30, bestOf: 1 }, 1000);
  assert.throws(() => reduceScore(s, { type: "point", teamId: "player-name" }));
  const paused = reduceScore(s, { type: "pause" }, 6000);
  assert.equal(elapsedSeconds(paused, 20000), 5);
  assert.throws(() => reduceScore(paused, { type: "point", teamId: match.a }));
  const resumed = reduceScore(paused, { type: "resume" }, 11000);
  assert.equal(elapsedSeconds(resumed, 13000), 7);
  assert.deepEqual(s.points, [0, 0]);
});

test("a completed game correction preserves current points and later undo", () => {
  let s = newScore(match, { points: 5, cap: 6, bestOf: 3 });
  for (const teamId of [match.a, match.a, match.a, match.a, match.a, match.b, match.b])
    s = reduceScore(s, { type: "point", teamId });
  const correction = { type: "correctGame", gameIndex: 0 };
  assert.throws(() => reduceScore(s, { ...correction, score: [4, 4] }), /Invalid game/);
  assert.throws(() => reduceScore(s, { ...correction, score: [2, 5] }), /Confirm the change/);
  s = reduceScore(s, { ...correction, score: [5, 2] });
  assert.deepEqual(s.points, [0, 2]);
  assert.deepEqual(s.wins, [1, 0]);
  s = reduceScore(s, { ...correction, score: [2, 5], confirmWinnerChange: true });
  assert.deepEqual(s.wins, [0, 1]);
  s = reduceScore(s, { type: "undo" });
  assert.deepEqual(s.games, [[2, 5]]);
  assert.deepEqual(s.points, [0, 1]);
  s = reduceScore(s, { type: "undo" });
  assert.deepEqual(s.points, [0, 0]);
  assert.throws(() => reduceScore(s, { type: "undo" }), /No point to undo/);
});

test("winner corrections recalculate completion without discarding a game underway", () => {
  const rules = { points: 5, cap: 6, bestOf: 3 };
  let s = newScore(match, rules);
  for (const teamId of [...Array(5).fill(match.a), ...Array(5).fill(match.b)])
    s = reduceScore(s, { type: "point", teamId });
  const correction = { type: "correctGame", gameIndex: 0, score: [0, 5], confirmWinnerChange: true };
  const thirdGame = reduceScore(s, { type: "point", teamId: match.a });
  assert.throws(() => reduceScore(thirdGame, correction), /Undo its points/);
  const complete = reduceScore(s, correction);
  assert.equal(complete.complete, true);
  assert.deepEqual(complete.wins, [0, 2]);
  s = reduceScore(complete, { ...correction, score: [5, 0] });
  assert.equal(s.complete, false);
  assert.deepEqual(s.points, [0, 0]);
  assert.deepEqual(s.wins, [1, 1]);
});
