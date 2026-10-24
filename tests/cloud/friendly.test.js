import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { owner, request, invitation, redeem, envelope, origin } from "./helpers.js";

const setup = { size: 2, sides: [["Alice", "Bob"], ["Chris", "Dana"]], scoring: { bestOf: 1, points: 5, cap: 5, goldenPoint: true } };

test("organizers create friendly games; umpires score them live and displays receive results", async () => {
  const o = await owner(), u = await redeem((await invitation(o, "umpire")).url);
  const co = await redeem((await invitation(o, "organizer")).url);
  const preset = (await request("preset", { name: "All games" }, o.cookie)).data;
  const display = await redeem((await invitation(o, "display", "Screen", preset.id)).url);
  const create = (session, revision = 0) => request("action", { action: "friendly", payload: setup, revision }, session.cookie);
  assert.equal((await create(u)).status, 403);
  assert.equal((await create(display)).status, 403);
  const created = await create(co);
  assert.equal(created.status, 200);
  const m = created.data.matches[0];
  assert.equal(m.tournamentId, null);
  assert.deepEqual(created.data.tournaments, []);
  const start = await request("action", { action: "start", payload: { matchId: m.id, court: 1 }, revision: created.data.revision }, u.cookie);
  assert.equal(start.status, 200);
  let record = (await request("claim", { matchId: m.id, device: crypto.randomUUID() }, u.cookie)).data;
  assert.deepEqual(record.score.rules, setup.scoring);
  assert.equal((await request("action", { action: "finish", payload: { matchId: m.id, games: [[5, 0]] }, revision: start.data.revision }, display.cookie)).status, 403);
  const socket = new WebSocket(origin.replace(/^http/, "ws") + "/api/socket", { headers: { Cookie: display.cookie, Origin: origin } });
  try {
    const snapshot = await new Promise((resolve, reject) => { socket.once("message", raw => resolve(JSON.parse(raw))); socket.once("error", reject); });
    assert.equal(snapshot.state.matches[0].id, m.id);
    const update = new Promise(resolve => socket.once("message", raw => resolve(JSON.parse(raw))));
    const first = await request("score", envelope(u, record, "point", m.a), u.cookie);
    assert.equal(first.data.accepted, true); record = first.data.record;
    const pushed = await update;
    assert.equal(pushed.type, "score"); assert.deepEqual(pushed.record.score.points, [1, 0]);
    for (let i = 1; i < 5; i++) {
      const result = await request("score", envelope(u, record, "point", m.a), u.cookie);
      assert.equal(result.data.accepted, true); record = result.data.record;
    }
    const final = await request("score", envelope(u, record, "confirm"), u.cookie);
    assert.equal(final.data.finalized, true);
    const history = (await request("state", undefined, o.cookie)).data;
    assert.equal(history.matches[0].status, "completed");
    assert.equal(history.matches[0].winner, m.a);
    assert.deepEqual(history.matches[0].games, [[5, 0]]);
    assert.deepEqual(history.tournaments, []);
    const corrected = await request("action", { action: "correctResult", payload: { matchId: m.id, games: [[0, 5]] }, revision: history.revision }, o.cookie);
    assert.equal(corrected.status, 200); assert.equal(corrected.data.matches[0].winner, m.b);
    assert.equal((await request("state", undefined, display.cookie)).data.matches[0].winner, m.b);
  } finally { socket.close(); }
});

test("friendly backups restore without categories and reject invalid standalone references", async () => {
  const o = await owner();
  const created = await request("action", { action: "friendly", payload: setup, revision: 0 }, o.cookie);
  const backup = (await request("export", undefined, o.cookie)).data;
  for (const corrupt of [
    s => { s.matches[0].scoring.bestOf = 2; },
    s => { s.matches[0].tournamentId = "missing"; },
    s => { s.teams[0].friendlyMatchId = "other"; },
    s => { s.matches[0].b = s.matches[0].a; },
    s => { s.matches[0].kind = "tournament"; },
  ]) {
    const destination = await owner(), invalid = structuredClone(backup);
    corrupt(invalid.state);
    const response = await request("import", { destination: destination.eventId, backup: invalid }, destination.cookie);
    assert.equal(response.status, 400);
    assert.equal((await request("state", undefined, destination.cookie)).data.matches.length, 0);
  }
  const destination = await owner();
  const imported = await request("import", { destination: destination.eventId, backup }, destination.cookie);
  assert.equal(imported.status, 200);
  assert.deepEqual(imported.data.matches, created.data.matches);
  assert.deepEqual(imported.data.teams, created.data.teams);
  assert.deepEqual(imported.data.tournaments, []);
});
