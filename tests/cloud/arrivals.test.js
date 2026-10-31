import test from "node:test";
import assert from "node:assert/strict";
import { owner, request, redeem, importFixture, invitation, fixture, envelope } from "./helpers.js";

test("only organizers check teams in; arrivals persist in snapshots and backups without changing scoring control", async () => {
  const o = await owner();
  let state = await importFixture(o, fixture(1));
  const umpire = await redeem((await invitation(o, "umpire")).url);
  const co = await redeem((await invitation(o, "organizer")).url);
  const preset = (await request("preset", { name: "Screen" }, o.cookie)).data;
  const display = await redeem((await invitation(o, "display", "Screen", preset.id)).url);
  const match = state.matches.find(m => m.status === "live"), team = state.teams.find(t => t.id === match.a);
  let record = (await request("claim", { matchId: match.id, device: crypto.randomUUID() }, umpire.cookie)).data;
  const action = { action: "teamArrival", revision: state.revision, payload: { tournamentId: team.tournamentId, teamId: team.id, arrived: true } };
  for (const cookie of [umpire.cookie, display.cookie]) assert.equal((await request("action", action, cookie)).status, 403);
  assert.equal((await request("action", action, co.cookie, { Origin: "https://evil.example" })).status, 403);
  const checked = await request("action", action, co.cookie);
  assert.equal(checked.status, 200, JSON.stringify(checked.data));
  state = checked.data;
  const arrivedAt = state.teams.find(t => t.id === team.id).arrivedAt;
  assert.ok(Number.isFinite(Date.parse(arrivedAt)));
  assert.deepEqual(state.matches, (await request("state", undefined, umpire.cookie)).data.matches);
  assert.equal((await request("state", undefined, umpire.cookie)).data.teams.find(t => t.id === team.id).arrivedAt, arrivedAt);
  assert.equal((await request("action", action, o.cookie)).status, 409);
  record = (await request("score", envelope(umpire, record, "point", match.a), umpire.cookie)).data.record;
  assert.deepEqual(record.score.points, [1, 0]);
  const backup = (await request("export", undefined, o.cookie)).data;
  const restored = await owner();
  const imported = await request("import", { destination: restored.eventId, backup }, restored.cookie);
  assert.equal(imported.status, 200);
  assert.equal(imported.data.teams.find(t => t.id === team.id).arrivedAt, arrivedAt);
  const undone = await request("action", { ...action, revision: state.revision, payload: { ...action.payload, arrived: false } }, o.cookie);
  assert.equal(undone.status, 200);
  assert.equal(undone.data.teams.find(t => t.id === team.id).arrivedAt, undefined);
  assert.equal((await request("live", undefined, umpire.cookie)).data.live.find(r => r.matchId === match.id).control, "yours");
});

test("imports reject invalid team arrival timestamps and accept older teams without check-in metadata", async () => {
  const o = await owner(), state = fixture(1);
  state.teams[0].arrivedAt = "not-a-time";
  const invalid = await request("import", { destination: o.eventId, backup: { format: "shuttlehub-v1", state } }, o.cookie);
  assert.equal(invalid.status, 400);
  assert.match(invalid.data.error, /arrival time/);
  delete state.teams[0].arrivedAt;
  assert.ok((await importFixture(o, state)).teams.every(t => t.arrivedAt == null));
});
