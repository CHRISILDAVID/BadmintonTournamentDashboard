import test from "node:test";
import assert from "node:assert/strict";
import { owner, request, redeem, importFixture, invitation, envelope, fixture } from "./helpers.js";
import { applyAction } from "../../shared/tournament.js";

const releaseBody = (record, returnToUpcoming = false) => ({ matchId: record.matchId,
  generation: record.generation, revision: record.revision, returnToUpcoming });

test("controlling umpire releases scoring without losing accepted points; old actions and releases cannot affect the replacement", async () => {
  const o = await owner(), state = await importFixture(o, fixture(1));
  const m = state.matches.find(m => m.status === "live");
  const first = await redeem((await invitation(o, "umpire")).url);
  const second = await redeem((await invitation(o, "umpire")).url);
  let record = (await request("claim", { matchId: m.id, device: crypto.randomUUID() }, first.cookie)).data;
  const stale = releaseBody(record);
  record = (await request("score", envelope(first, record, "point", m.a), first.cookie)).data.record;
  const pending = envelope(first, record, "point", m.a);
  assert.equal((await request("release", releaseBody(record), second.cookie)).status, 403);
  assert.equal((await request("release", stale, first.cookie)).status, 409);
  assert.equal((await request("release", releaseBody(record), first.cookie, { Origin: "https://evil.example" })).status, 403);
  assert.equal((await request("release", releaseBody(record), first.cookie)).status, 200);
  const live = (await request("live", undefined, second.cookie)).data.live.find(r => r.matchId === m.id);
  assert.equal(live.control, "available");
  assert.deepEqual(live.score.points, [1, 0]);
  const next = await request("claim", { matchId: m.id, device: crypto.randomUUID() }, second.cookie);
  assert.equal(next.status, 200);
  assert.deepEqual(next.data.score.points, [1, 0]);
  assert.ok(next.data.generation > record.generation);
  assert.equal((await request("release", releaseBody(record), first.cookie)).status, 403);
  assert.equal((await request("score", pending, first.cookie)).data.accepted, false);
  assert.equal((await request("score", envelope(second, next.data, "point", m.b), second.cookie)).data.accepted, true);
  assert.equal((await request("state", undefined, o.cookie)).data.matches.find(x => x.id === m.id).court, m.court);
});

test("an umpire can undo a reserved start before claiming, and another umpire can restart on another court", async () => {
  const o = await owner(), initial = fixture(1), m = initial.matches.find(m => m.status === "live");
  let state = await importFixture(o, applyAction(initial, "returnMatch", { matchId: m.id }));
  const first = await redeem((await invitation(o, "umpire")).url);
  const second = await redeem((await invitation(o, "umpire")).url);
  state = (await request("action", { action: "start", payload: { matchId: m.id, court: 1 }, revision: state.revision }, first.cookie)).data;
  const reserved = (await request("live", undefined, first.cookie)).data.live.find(r => r.matchId === m.id);
  assert.equal(reserved.control, "yours");
  assert.equal((await request("release", releaseBody(reserved, true), second.cookie)).status, 403);
  assert.equal((await request("release", releaseBody(reserved, true), first.cookie)).status, 200);
  state = (await request("state", undefined, o.cookie)).data;
  assert.equal(state.matches.find(x => x.id === m.id).status, "upcoming");
  assert.equal(state.matches.find(x => x.id === m.id).court, null);
  const restarted = await request("action", { action: "start", payload: { matchId: m.id, court: 2 }, revision: state.revision }, second.cookie);
  assert.equal(restarted.status, 200);
  assert.equal(restarted.data.matches.find(x => x.id === m.id).court, 2);
  const claimed = await request("claim", { matchId: m.id, device: crypto.randomUUID() }, second.cookie);
  assert.equal(claimed.status, 200);
  assert.deepEqual(claimed.data.score.points, [0, 0]);
  assert.equal((await request("release", releaseBody(reserved, true), first.cookie)).status, 403);
});

test("undoing a scored start resets scoring on restart and cannot release completed results or read-only displays", async () => {
  const o = await owner(), state = await importFixture(o, fixture(1)), m = state.matches.find(m => m.status === "live");
  const u = await redeem((await invitation(o, "umpire")).url);
  let record = (await request("claim", { matchId: m.id, device: crypto.randomUUID() }, u.cookie)).data;
  record = (await request("score", envelope(u, record, "point", m.a), u.cookie)).data.record;
  assert.equal((await request("release", releaseBody(record, true), u.cookie)).status, 200);
  const next = (await request("state", undefined, o.cookie)).data;
  assert.equal((await request("action", { action: "start", payload: { matchId: m.id, court: 2 }, revision: next.revision }, u.cookie)).status, 200);
  record = (await request("claim", { matchId: m.id, device: crypto.randomUUID() }, u.cookie)).data;
  assert.deepEqual(record.score.points, [0, 0]);
  const preset = (await request("preset", { name: "Display", courts: [], categories: [], widgets: ["live"] }, o.cookie)).data;
  const display = await redeem((await invitation(o, "display", "Display", preset.id)).url);
  assert.equal((await request("release", releaseBody(record), display.cookie)).status, 403);
  for (let i = 0; i < 5; i++) record = (await request("score", envelope(u, record, "point", m.a), u.cookie)).data.record;
  record = (await request("score", envelope(u, record, "confirm"), u.cookie)).data.record;
  assert.equal((await request("release", releaseBody(record), u.cookie)).status, 409);
});
