import test from "node:test";
import assert from "node:assert/strict";
import { owner, request, importFixture, fixture, invitation, redeem, envelope } from "./helpers.js";
import { applyAction, validateGames } from "../../server/engine.js";
import { scoringRules } from "../../shared/format.js";

const enabled = process.env.CLOUD_TEST_TOOLS === "true";

test(`cloud random results are ${enabled ? "enabled for organizers" : "disabled by default"} and unavailable to umpires/displays`, async () => {
  const o = await owner();
  let initial = fixture();
  const played = initial.matches.find(m => m.status === "live");
  initial = applyAction(initial, "finish", { matchId: played.id, games: [[5, 0]] });
  const state = await importFixture(o, initial), tid = played.tournamentId;
  assert.equal((await request("features", undefined, o.cookie)).data.testTools, enabled);
  const organizer = await redeem((await invitation(o, "organizer")).url);
  assert.equal((await request("features", undefined, organizer.cookie)).data.testTools, enabled);
  const u = await redeem((await invitation(o, "umpire")).url);
  const preset = (await request("preset", { name: "Test screen" }, o.cookie)).data;
  const display = await redeem((await invitation(o, "display", "Test screen", preset.id)).url);
  for (const s of [u, display]) {
    assert.equal((await request("features", undefined, s.cookie)).data.testTools, false);
    assert.equal((await request("action", { action: "randomComplete", revision: state.revision, payload: { tournamentId: tid } }, s.cookie)).status, 403);
  }
  const live = state.matches.find(m => m.status === "live");
  const claim = (await request("claim", { matchId: live.id, device: crypto.randomUUID() }, u.cookie)).data;
  const random = await request("action", { action: "randomComplete", revision: state.revision, payload: { tournamentId: tid } }, organizer.cookie);
  if (!enabled) {
    assert.equal(random.status, 403);
    assert.deepEqual((await request("state", undefined, o.cookie)).data, state);
    return;
  }
  assert.equal(random.status, 200);
  assert.deepEqual(random.data.matches.find(m => m.id === played.id), state.matches.find(m => m.id === played.id));
  assert.deepEqual(random.data.matches.filter(m => m.tournamentId !== tid), state.matches.filter(m => m.tournamentId !== tid));
  for (const m of random.data.matches.filter(m => m.tournamentId === tid)) {
    assert.equal(m.status, "completed");
    if (m.id !== played.id) assert.equal(m.court, null);
    assert.equal(m.winner, [m.a, m.b][validateGames(m.games, scoringRules(state.tournaments.find(t => t.id === tid), m.stage, m))]);
  }
  assert.equal((await request("action", { action: "randomComplete", revision: state.revision, payload: {} }, o.cookie)).status, 409);
  const all = await request("action", { action: "randomComplete", revision: random.data.revision, payload: {} }, o.cookie);
  assert.equal(all.status, 200);
  assert.ok(all.data.matches.every(m => m.status === "completed"));
  assert.equal((await request("score", envelope(u, claim, "point", live.a), u.cookie)).data.conflict, true);
  for (const action of ["demo", "practice", "clearDemo"]) {
    assert.equal((await request("action", { action, revision: all.data.revision, payload: {} }, o.cookie)).status, 403);
  }
});
