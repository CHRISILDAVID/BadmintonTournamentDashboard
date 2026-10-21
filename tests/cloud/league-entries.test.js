import test from "node:test";
import assert from "node:assert/strict";
import { owner, request, importFixture, invitation, redeem, envelope } from "./helpers.js";

test("league changes refresh umpire state and remove withdrawn team scores while rejecting stale offline work", async () => {
  const o = await owner();
  let state = await importFixture(o);
  const m = state.matches.find(m => m.status === "live");
  const otherMatches = state.matches.filter(x => x.tournamentId !== m.tournamentId);
  const u = await redeem((await invitation(o, "umpire")).url);
  const claim = (await request("claim", { matchId: m.id, device: crypto.randomUUID() }, u.cookie)).data;
  const scored = (await request("score", envelope(u, claim, "point", m.a), u.cookie)).data.record;
  const add = await request("action", { action: "teams", revision: state.revision,
    payload: { tournamentId: m.tournamentId, group: 0, teams: [{ players: ["Late A", "Late B"] }] } }, o.cookie);
  assert.equal(add.status, 200);
  state = add.data;
  assert.equal(state.matches.filter(x => x.tournamentId === m.tournamentId).length, 10);
  assert.equal((await request("live", undefined, u.cookie)).data.live.find(x => x.matchId === m.id).generation, scored.generation);
  const stale = await request("action", { action: "deleteTeam", revision: state.revision - 1,
    payload: { tournamentId: m.tournamentId, teamId: m.a } }, o.cookie);
  assert.equal(stale.status, 409);
  const removed = await request("action", { action: "deleteTeam", revision: state.revision,
    payload: { tournamentId: m.tournamentId, teamId: m.a } }, o.cookie);
  assert.equal(removed.status, 200);
  const current = (await request("state", undefined, u.cookie)).data;
  assert.ok(!current.matches.some(x => x.a === m.a || x.b === m.a));
  assert.ok(!current.teams.some(x => x.id === m.a));
  assert.deepEqual(current.matches.filter(x => x.tournamentId !== m.tournamentId), otherMatches);
  assert.ok(!(await request("live", undefined, u.cookie)).data.live.some(x => x.matchId === m.id));
  const rejected = await request("score", envelope(u, scored, "point", m.a), u.cookie);
  assert.equal(rejected.data.conflict, true);
  assert.equal((await request("claim", { matchId: m.id, device: crypto.randomUUID() }, u.cookie)).status, 409);
  const preset = (await request("preset", { name: "Display" }, o.cookie)).data;
  const d = await redeem((await invitation(o, "display", "Display", preset.id)).url);
  assert.ok(!(await request("live", undefined, d.cookie)).data.live.some(x => x.matchId === m.id));
});
