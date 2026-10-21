import test from "node:test";
import assert from "node:assert/strict";
import { newScore, reduceScore, elapsedSeconds } from "../shared/live-scoring.js";
import { validateGames } from "../server/engine.js";
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
