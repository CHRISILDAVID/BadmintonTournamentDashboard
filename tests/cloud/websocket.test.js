import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { owner, importFixture, request, invitation, redeem, envelope, origin } from "./helpers.js";
function connect(session, originHeader = origin, eventId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(origin.replace(/^http/, "ws") + `/api/socket${eventId ? `?eventId=${eventId}` : ""}`, { headers: { Cookie: session.cookie, Origin: originHeader } });
    ws.on("error", reject);
    ws.once("message", data => resolve({ ws, snapshot: JSON.parse(data.toString()) }));
  });
}
test("WebSocket origin/event checks, all event matches, live revocation and denied mutations", async () => {
  const o = await owner(), b = await owner(), state = await importFixture(o);
  await assert.rejects(connect(o, "https://evil.example"));
  await assert.rejects(connect(o, origin, b.eventId));
  const inv = await invitation(o, "umpire"), u = await redeem(inv.url);
  const { ws, snapshot } = await connect(u);
  try {
    assert.deepEqual(snapshot.state.matches, state.matches);
    assert.deepEqual(snapshot.state.teams, state.teams);
    assert.deepEqual(snapshot.state.tournaments, state.tournaments);
    const denied = new Promise(resolve => ws.once("message", raw => resolve(JSON.parse(raw.toString()))));
    ws.send(JSON.stringify({ type: "action", action: "event" }));
    assert.equal((await denied).type, "error");
    const scoreUpdate = new Promise(resolve => ws.once("message", raw => resolve(JSON.parse(raw.toString()))));
    const match = state.matches.find(m => m.status === "live");
    assert.equal((await request("claim", { matchId: match.id, device: crypto.randomUUID() }, u.cookie)).status, 200);
    const update = await scoreUpdate;
    assert.equal(update.type, "score");
    assert.equal(update.record.matchId, match.id);
    const closed = new Promise(resolve => ws.once("close", code => resolve(code)));
    await request("revoke", { profile: inv.profile }, o.cookie);
    assert.equal(await closed, 4001);
  } finally { ws.close(); }
});

test("stale first offline point after transfer is retained, without modifying replacement score", async () => {
  const o = await owner(), state = await importFixture(o), m = state.matches.find(m => m.status === "live");
  const inv = await invitation(o, "umpire"), u = await redeem(inv.url);
  const old = (await request("claim", { matchId: m.id, device: crypto.randomUUID() }, u.cookie)).data;
  await request("transfer", { matchId: m.id }, o.cookie);
  const replacement = (await request("claim", { matchId: m.id, device: crypto.randomUUID() }, o.cookie)).data;
  await request("score", envelope(o, replacement, "point", m.b), o.cookie);
  const denied = await request("score", envelope(u, old, "point", m.a), u.cookie);
  assert.equal(denied.data.conflict, true);
  assert.equal((await request("access", undefined, o.cookie)).data.rejected.length, 1);
  assert.deepEqual((await request("live", undefined, o.cookie)).data.live.find(r => r.matchId === m.id).score.points, [0, 1]);
});

test("duplicate old action cannot reveal a new controller's record after reassignment", async () => {
  const o = await owner(), state = await importFixture(o), m = state.matches.find(m => m.status === "live");
  const inv = await invitation(o, "umpire"), u = await redeem(inv.url);
  await request("assign", { matchId: m.id, profile: inv.profile }, o.cookie);
  const claim = (await request("claim", { matchId: m.id, device: crypto.randomUUID() }, u.cookie)).data;
  const action = envelope(u, claim, "point", m.a);
  assert.equal((await request("score", action, u.cookie)).data.accepted, true);
  const other = await invitation(o, "umpire");
  await request("assign", { matchId: m.id, profile: other.profile }, o.cookie);
  const retry = (await request("score", action, u.cookie)).data;
  assert.equal(retry.duplicate, true); assert.equal(retry.obsolete, true); assert.equal(retry.record, undefined);
});
