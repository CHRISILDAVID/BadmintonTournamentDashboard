import test from "node:test";
import assert from "node:assert/strict";
import { scoreText, stepScore, finalScores } from "../src/scores.js";
import { validateGames } from "../server/engine.js";

test("score entry stays blank after clearing and does not bake in leading zeros", () => {
  assert.equal(scoreText(""), "");
  assert.equal(scoreText("0"), "0");
  assert.equal(scoreText("021"), "21");
  assert.equal(scoreText("000"), "0");
  for (const value of ["-1","21.5","1e2","twenty"]) assert.equal(scoreText(value), null);
});

test("visible score controls increment and decrement within the scoring cap", () => {
  assert.equal(stepScore("",1,30),"1");
  assert.equal(stepScore("",-1,30),"0");
  assert.equal(stepScore("0",-1,30),"0");
  assert.equal(stepScore("21",1,30),"22");
  assert.equal(stepScore("21",-1,30),"20");
  assert.equal(stepScore("30",1,30),"30");
});

test("missing scores cannot silently become zero; explicit zero remains a valid result", () => {
  assert.throws(()=>finalScores([["21",""]]),/Enter both scores/);
  assert.throws(()=>finalScores([["","21"]]),/Enter both scores/);
  assert.throws(()=>finalScores([["21","10"],["",""]]),/Enter both scores/);
  const text=[["0","21"]];
  const parsed=finalScores(text);
  assert.deepEqual(parsed,[[0,21]]);
  assert.deepEqual(text,[["0","21"]]);
  assert.equal(validateGames(parsed,{bestOf:1,points:21,cap:30}),1);
});
