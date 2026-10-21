import test from "node:test";
import assert from "node:assert/strict";
import { owner, request, redeem, importFixture, invitation, envelope } from "./helpers.js";

test("persistent owner uniqueness, single-use invitations, event isolation and role restrictions", async () => {
  const identity = crypto.randomUUID();
  const attempts = await Promise.all(Array.from({ length: 5 }, () => request("provision", { owner: identity }, "", { Authorization: "Bearer local-test-secret" })));
  assert.equal(attempts.filter(r => r.status === 201).length, 1);
  assert.equal(attempts.filter(r => r.status === 409).length, 4);
  const setup = attempts.find(r => r.status === 201).data.setupUrl;
  const a = await redeem(setup), b = await owner();
  await assert.rejects(redeem(setup));
  const sa = await importFixture(a), sb = await importFixture(b);
  assert.equal((await request("state")).status, 401);
  assert.equal((await request("state?eventId=" + b.eventId, undefined, a.cookie)).status, 403);
  assert.equal((await request("state", undefined, a.cookie.replace(a.eventId, b.eventId))).status, 401);
  assert.equal((await request("action", { action: "event", revision: 1, payload: sa.event }, b.cookie, { "X-Shuttle-Event": a.eventId })).status, 401);
  assert.equal((await request("state", undefined, a.cookie, { "X-Shuttle-Session": b.sessionId })).status, 401);
  assert.equal((await request("state", undefined, a.cookie)).data.matches[0].id, sa.matches[0].id);
  assert.equal((await request("export", undefined, a.cookie)).data.eventId, a.eventId);
  const invite = await invitation(a, "umpire"), u = await redeem(invite.url);
  assert.deepEqual((await request("state", undefined, u.cookie)).data.matches, []);
  for (const path of ["export", "access", "usage"]) assert.equal((await request(path, undefined, u.cookie)).status, 403);
  assert.equal((await request("action", { action: "event", payload: sb.event, revision: 1 }, u.cookie)).status, 403);
  assert.equal((await request("claim", { matchId: sa.matches[0].id, device: crypto.randomUUID() }, u.cookie)).status, 403);
  assert.equal((await request("invite", { role: "owner" }, a.cookie)).status, 400);
  assert.equal((await request("action", { action: "demo" }, a.cookie)).status, 403);
  assert.equal((await request("action", {}, a.cookie, { Origin: "https://evil.example" })).status, 403);
  assert.equal((await request("import", { destination: b.eventId, backup: {} }, a.cookie)).status, 400);
  assert.equal((await request("import", { destination: a.eventId, backup: {} }, a.cookie)).status, 409);
  const state = (await request("state", undefined, b.cookie)).data;
  assert.equal(state.matches[0].id, sb.matches[0].id);
});

test("per-match sequencing, duplicate retry, finalization once, transfers and rule changes", async () => {
  const o = await owner(), state = await importFixture(o);
  const matches = state.matches.filter(m => m.status === "live");
  const inv = await invitation(o, "umpire"), u = await redeem(inv.url);
  for (const m of matches) await request("assign", { matchId: m.id, profile: inv.profile }, o.cookie);
  const records = await Promise.all(matches.map(async m => {
    const r = await request("claim", { matchId: m.id, device: crypto.randomUUID() }, u.cookie);
    assert.equal(r.status, 200); return r.data;
  }));
  const firstActions = records.map((r, i) => envelope(u, r, "point", matches[i].a));
  const results = await Promise.all(firstActions.map(a => request("score", a, u.cookie)));
  for (const r of results) { assert.equal(r.status, 200); assert.equal(r.data.record.revision, 1); }
  const retry = await request("score", firstActions[0], u.cookie);
  assert.equal(retry.data.duplicate, true); assert.equal(retry.data.record.score.points[0], 1);
  let record = retry.data.record;
  const unordered = { ...envelope(u, record, "point", matches[0].a), seq: 999 };
  assert.equal((await request("score", unordered, u.cookie)).status, 409);
  for (let i = 0; i < 4; i++) {
    const r = await request("score", envelope(u, record, "point", matches[0].a), u.cookie);
    assert.equal(r.status, 200); record = r.data.record;
  }
  assert.equal(record.score.complete, true);
  const confirm = envelope(u, record, "confirm");
  const finished = await request("score", confirm, u.cookie);
  assert.equal(finished.data.finalized, true);
  const finalRevision = (await request("state", undefined, o.cookie)).data.revision;
  assert.equal((await request("score", confirm, u.cookie)).data.duplicate, true);
  assert.equal((await request("state", undefined, o.cookie)).data.revision, finalRevision);
  record = results[1].data.record;
  const stale = envelope(u, record, "point", matches[1].a);
  await request("transfer", { matchId: matches[1].id }, o.cookie);
  const next = await request("claim", { matchId: matches[1].id, device: crypto.randomUUID() }, o.cookie);
  assert.equal(next.status, 200); assert.equal(next.data.score.points[0], 1);
  const rejected = await request("score", stale, u.cookie);
  assert.equal(rejected.data.conflict, true);
  assert.equal((await request("access", undefined, o.cookie)).data.rejected.length, 1);
  let current = (await request("state", undefined, o.cookie)).data;
  const t = current.tournaments.find(t => t.id === matches[1].tournamentId);
  const rules = { points: 7, cap: 8, bestOf: 1, goldenPoint: false };
  const changed = await request("action", { action: "scoring", revision: current.revision, payload: { tournamentId: t.id, scoring: { league: rules, knockout: rules } } }, o.cookie);
  assert.equal(changed.status, 200);
  assert.equal((await request("score", envelope(o, next.data, "point", matches[1].a), o.cookie)).data.conflict, true);
  assert.equal((await request("claim", { matchId: matches[1].id, device: crypto.randomUUID() }, o.cookie)).status, 409);
  await request("transfer", { matchId: matches[1].id, reset: true }, o.cookie);
  assert.equal((await request("claim", { matchId: matches[1].id, device: crypto.randomUUID() }, o.cookie)).data.score.rules.points, 7);
});

test("recovery revokes previous access and rotates its single-use secret; display grants are revocable", async () => {
  const o = await owner(), other = await owner();
  const [eventId, secret] = new URLSearchParams(new URL(o.recovery).hash.slice(1)).get("invite").split(".");
  assert.equal((await request("redeem", { eventId: other.eventId, token: secret })).status, 403);
  const restored = await redeem(o.recovery);
  assert.equal((await request("me", undefined, o.cookie)).status, 401);
  await assert.rejects(redeem(o.recovery));
  assert.ok(restored.recovery);
  const preset = await request("preset", { name: "Courts 1–3", courts: [1, 2, 3] }, restored.cookie);
  const invite = await invitation(restored, "display", "Screen", preset.data.id);
  const d1 = await redeem(invite.url), d2 = await redeem(invite.url);
  assert.equal((await request("live", undefined, d1.cookie)).data.preset.name, "Courts 1–3");
  assert.equal((await request("action", {}, d2.cookie)).status, 403);
  await request("revoke", { profile: invite.profile }, restored.cookie);
  assert.equal((await request("state", undefined, d1.cookie)).status, 401);
  await assert.rejects(redeem(invite.url));
});
