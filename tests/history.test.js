import test from "node:test";
import assert from "node:assert/strict";
import { categoryHistory, historyLimit, historyCursor } from "../cloud/history.js";

const state = { event: { name: "Club finals" } }, category = { id: "category", name: "Mixed doubles", size: 2, groups: 1 };
const teams = [{ id: "a", name: "Anil - Ravi", players: ["Anil", "Ravi"] }, { id: "b", name: "Dev - Hari", players: ["Dev", "Hari"] }];
const final = { id: "final", stage: "Final", a: "a", b: "b", status: "completed", winner: "b", completedAt: "2026-10-01T10:00:00Z" };
test("history uses the completed final for first and second, including corrected and reopened results", () => {
  const original = structuredClone({ state, category, teams, final });
  const result = categoryHistory(state, category, teams, [final]);
  assert.equal(result.status, "completed");
  assert.deepEqual(result.winner, teams[1]); assert.deepEqual(result.runnerUp, teams[0]);
  assert.equal(result.completedAt, final.completedAt); assert.equal(result.completedMatches, 1);
  assert.equal("thirdPlace" in result, false);
  const corrected = categoryHistory(state, category, teams, [{ ...final, winner: "a" }]);
  assert.equal(corrected.winner.id, "a"); assert.equal(corrected.runnerUp.id, "b");
  const reopened = categoryHistory(state, category, teams, [{ ...final, status: "upcoming", winner: null, completedAt: null }]);
  assert.equal(reopened.winner, null); assert.equal(reopened.runnerUp, null);
  assert.notEqual(reopened.status, "completed");
  assert.deepEqual({ state, category, teams, final }, original);
});
test("history does not infer a podium from league standings or a semifinal, or invent a runner for a bye", () => {
  for (const stage of ["League", "Semifinal"]) {
    const result = categoryHistory(state, category, teams, [{ ...final, stage }]);
    assert.equal(result.winner, null); assert.equal(result.runnerUp, null);
  }
  const bye = categoryHistory(state, category, teams, [{ ...final, a: null, bye: true }], "2026-10-02T00:00:00Z");
  assert.equal(bye.winner.id, "b"); assert.equal(bye.runnerUp, null); assert.ok(bye.archivedAt);
  assert.equal(categoryHistory(state, category, [], []).status, "registration");
});
test("history pagination accepts bounded sizes and numeric positions only", () => {
  assert.equal(historyLimit(null), 10); assert.equal(historyLimit("20"), 20); assert.equal(historyCursor(""), 0);
  assert.equal(historyCursor("20"), 20);
  for (const value of ["-1", "1.5", "a", "1e3", "9007199254740992"]) {
    assert.throws(() => historyLimit(value)); assert.throws(() => historyCursor(value));
  }
  for (const value of [0, 51]) assert.throws(() => historyLimit(value));
});
