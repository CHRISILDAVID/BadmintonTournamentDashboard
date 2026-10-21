import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, emptyState } from "../../server/engine.js";
import { owner, request, importFixture } from "./helpers.js";

test("200-team single-group draw persists beyond SQLite's individual row limit with IDs/results intact", async () => {
  let state = applyAction(emptyState(), "tournament", { name: "Large draw 🏸", size: 1, groups: 1, qualify: 2, points: 21, cap: 30, bestOf: 3 });
  const tournamentId = state.tournaments[0].id;
  state = applyAction(state, "teams", { tournamentId, teams: Array.from({ length: 200 }, (_, i) => ({ players: [`Player ${i} 🏸`], seed: i + 1 })) });
  state = applyAction(state, "generate", { tournamentId });
  assert.equal(state.matches.length, 19900);
  assert.ok(Buffer.byteLength(JSON.stringify(state)) > 2 * 1024 * 1024);
  const o = await owner();
  const imported = await importFixture(o, state);
  assert.equal(imported.matches.length, 19900);
  const saved = await request("state", undefined, o.cookie);
  assert.deepEqual(saved.data.matches, state.matches);
  assert.deepEqual(saved.data.teams, state.teams);
  const exported = await request("export", undefined, o.cookie);
  assert.equal(exported.data.state.tournaments[0].name, "Large draw 🏸");
  assert.equal(exported.data.state.matches.at(-1).id, state.matches.at(-1).id);
});
