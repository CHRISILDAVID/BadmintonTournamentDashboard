import test from "node:test";
import assert from "node:assert/strict";
import { liveScoreCard } from "../src/lib/live-score-card.js";
import { newScore, reduceScore } from "../shared/live-scoring.js";

const now = 100000;
const match = { id: "match", a: "a", b: "b", stage: "Custom", kind: "custom" };
const rules = { points: 5, cap: 7, bestOf: 3, goldenPoint: false };
const record = (overrides = {}) => ({ score: newScore(match, rules), contactAt: now, control: "other", ...overrides });
const view = (r, connected = true, m = match) => liveScoreCard(m, r, undefined, connected, now);

test("single-game cards omit games won, while best-of-three and five show the victory target", () => {
  for (const [bestOf, needed, showGamesWon] of [[1, 1, false], [3, 2, true], [5, 3, true]]) {
    const card = view(record({ score: newScore(match, { ...rules, bestOf }) }));
    assert.equal(card.showGamesWon, showGamesWon);
    assert.equal(card.needed, needed);
    assert.deepEqual(card.points, [0, 0]);
    assert.deepEqual(card.wins, [0, 0]);
  }
});

test("no scoring record means awaiting score with unknown points and wins, rather than a delay or invented zeros", () => {
  const card = view(undefined, true, { ...match, scoring: rules });
  assert.equal(card.status.label, "Awaiting score");
  assert.equal(card.points, null); assert.equal(card.wins, null);
  assert.equal(card.rules.bestOf, 3);
  const t = { points: 21, cap: 30, bestOf: 1 };
  assert.equal(liveScoreCard({ ...match, stage: "League" }, undefined, t, true, now).rules.points, 21);
});

test("early best-of-three finishes display the last played game and final points", () => {
  let score = newScore(match, rules);
  for (let i = 0; i < 5; i++) score = reduceScore(score, { type: "point", teamId: "a" });
  assert.equal(view(record({ score })).gameNumber, 2);
  assert.deepEqual(view(record({ score })).points, [0, 0]);
  assert.deepEqual(view(record({ score })).games, [[5, 0]]);
  for (let i = 0; i < 5; i++) score = reduceScore(score, { type: "point", teamId: "a" });
  const card = view(record({ score }));
  assert.equal(card.gameNumber, 2);
  assert.deepEqual(card.points, [5, 0]);
  assert.deepEqual(card.wins, [2, 0]);
  assert.equal(card.status.label, "Result pending");
});

test("offline, review, paused and delayed states retain the saved score without claiming it is live", () => {
  const r = record(); r.score.points = [3, 2];
  assert.equal(view(r).status.label, "Live");
  assert.equal(view(r, false).status.label, "Display offline");
  assert.equal(view({ ...r, invalidated: "Changed rules" }).status.label, "Score under review");
  assert.equal(view({ ...r, score: { ...r.score, paused: true } }).status.label, "Paused");
  assert.equal(view({ ...r, contactAt: now - 45001 }).status.label, "Updates delayed");
  assert.equal(view({ ...r, control: "available" }).status.label, "Awaiting umpire");
  assert.deepEqual(view(r, false).points, [3, 2]);
});

test("game and match point labels follow golden point, deuce and capped scoring", () => {
  const r = record();
  r.score.points = [4, 2];
  assert.deepEqual(view(r).pointLabels, ["Game point", ""]);
  r.score.wins = [1, 0];
  assert.deepEqual(view(r).pointLabels, ["Match point", ""]);
  r.score.points = [4, 4];
  assert.deepEqual(view(r).pointLabels, ["", ""]);
  r.score.rules.goldenPoint = true; r.score.rules.cap = 5;
  assert.deepEqual(view(r).pointLabels, ["Match point", "Game point"]);
  r.score.rules.goldenPoint = false; r.score.rules.cap = 7; r.score.points = [6, 6];
  assert.deepEqual(view(r).pointLabels, ["Match point", "Game point"]);
  r.score.paused = true;
  assert.deepEqual(view(r).pointLabels, ["", ""]);
});
