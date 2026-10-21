import test from "node:test";
import assert from "node:assert/strict";
import { owner, request, redeem, importFixture, invitation, envelope, fixture } from "./helpers.js";
import { applyAction } from "../../server/engine.js";

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
  const umpireState = (await request("state", undefined, u.cookie)).data;
  assert.deepEqual(umpireState.matches, sa.matches);
  assert.deepEqual(umpireState.teams, sa.teams);
  assert.deepEqual(umpireState.tournaments, sa.tournaments);
  assert.equal((await request("state?eventId=" + b.eventId, undefined, u.cookie)).status, 403);
  for (const path of ["export", "access", "usage"]) assert.equal((await request(path, undefined, u.cookie)).status, 403);
  assert.equal((await request("action", { action: "event", payload: sb.event, revision: 1 }, u.cookie)).status, 403);
  assert.equal((await request("claim", { matchId: sa.matches[0].id, device: crypto.randomUUID() }, u.cookie)).status, 200);
  assert.equal((await request("claim", { matchId: sb.matches[0].id, device: crypto.randomUUID() }, u.cookie)).status, 409);
  assert.equal((await request("invite", { role: "owner" }, a.cookie)).status, 400);
  assert.equal((await request("action", { action: "demo" }, a.cookie)).status, 403);
  assert.equal((await request("action", {}, a.cookie, { Origin: "https://evil.example" })).status, 403);
  assert.equal((await request("import", { destination: b.eventId, backup: {} }, a.cookie)).status, 400);
  assert.equal((await request("import", { destination: a.eventId, backup: {} }, a.cookie)).status, 409);
  const state = (await request("state", undefined, b.cookie)).data;
  assert.equal(state.matches[0].id, sb.matches[0].id);
});

test("umpires see every event match and score without assignment while control remains exclusive", async () => {
  const o = await owner(), initial = fixture();
  const finished = initial.matches.find(m => m.status === "live");
  const state = await importFixture(o, applyAction(initial, "finish", { matchId: finished.id, games: [[5, 0]] }));
  const firstInvite = await invitation(o, "umpire"), secondInvite = await invitation(o, "umpire");
  const first = await redeem(firstInvite.url), second = await redeem(secondInvite.url);
  assert.deepEqual((await request("state", undefined, first.cookie)).data.matches, state.matches);
  assert.deepEqual(new Set(state.matches.map(m => m.status)), new Set(["live", "upcoming", "completed"]));
  const live = state.matches.find(m => m.status === "live");
  // Existing assignments must not hide matches or restrict other umpires.
  await request("assign", { matchId: live.id, profile: firstInvite.profile }, o.cookie);
  assert.deepEqual((await request("state", undefined, second.cookie)).data.matches, state.matches);
  const claim = await request("claim", { matchId: live.id, device: crypto.randomUUID() }, second.cookie);
  assert.equal(claim.status, 200);
  assert.equal((await request("claim", { matchId: live.id, device: crypto.randomUUID() }, first.cookie)).status, 409);
  const point = await request("score", envelope(second, claim.data, "point", live.a), second.cookie);
  assert.equal(point.data.accepted, true);
  assert.deepEqual((await request("live", undefined, first.cookie)).data.live.find(r => r.matchId === live.id).score.points, [1, 0]);
  const foreignPoint = await request("score", envelope(first, point.data.record, "point", live.a), first.cookie);
  assert.equal(foreignPoint.data.conflict, true);
  for (const match of state.matches.filter(m => m.status !== "live")) {
    assert.equal((await request("claim", { matchId: match.id, device: crypto.randomUUID() }, second.cookie)).status, 409);
  }
});

test("umpire match desk supports the full match lifecycle but denies unrelated organizer operations", async () => {
  const o = await owner(), initial = fixture(1), m = initial.matches.find(m => m.status === "live");
  let state = await importFixture(o, applyAction(initial, "returnMatch", { matchId: m.id }));
  const inv = await invitation(o, "umpire"), u = await redeem(inv.url);
  const act = async (action, payload) => {
    const result = await request("action", { action, payload, revision: state.revision }, u.cookie);
    assert.equal(result.status, 200, JSON.stringify(result.data));
    state = result.data;
    return state.matches.find(x => x.id === m.id);
  };
  assert.equal((await act("schedule", { matchId: m.id, scheduled: "14:30" })).scheduled, "14:30");
  const staleRevision = state.revision;
  assert.equal((await act("start", { matchId: m.id, court: 1 })).status, "live");
  const other = state.matches.find(x => x.status === "upcoming");
  assert.equal((await request("action", { action: "start", revision: staleRevision, payload: { matchId: other.id, court: 2 } }, u.cookie)).status, 409);
  const occupied = await request("action", { action: "start", revision: state.revision, payload: { matchId: other.id, court: 1 } }, u.cookie);
  assert.equal(occupied.status, 400);
  assert.match(occupied.data.error, /occupied/);
  const playerConflict = await request("action", { action: "start", revision: state.revision, payload: { matchId: state.matches.find(x => x.status === "upcoming" && [x.a, x.b].some(id => [m.a, m.b].includes(id))).id, court: 2 } }, u.cookie);
  assert.equal(playerConflict.status, 400);
  assert.match(playerConflict.data.error, /already playing/);
  assert.equal((await act("returnMatch", { matchId: m.id })).status, "upcoming");
  await act("start", { matchId: m.id, court: 2 });
  const claimed = (await request("claim", { matchId: m.id, device: crypto.randomUUID() }, u.cookie)).data;
  assert.equal((await act("finish", { matchId: m.id, games: [[5, 0]] })).winner, m.a);
  assert.equal((await request("score", envelope(u, claimed, "point", m.a), u.cookie)).data.conflict, true);
  assert.equal((await act("correctResult", { matchId: m.id, games: [[0, 5]] })).winner, m.b);
  for (const match of state.matches.filter(x => x.status === "upcoming")) {
    await act("start", { matchId: match.id, court: 1 });
    await act("finish", { matchId: match.id, games: [[5, 0]] });
  }
  await act("knockouts", { tournamentId: m.tournamentId });
  assert.ok(state.matches.some(x => x.stage === "Final"));
  for (const action of ["event", "tournament", "teams", "deleteTournament", "scoring", "generate", "randomComplete"]) {
    assert.equal((await request("action", { action, payload: {}, revision: state.revision }, u.cookie)).status, 403);
  }
  for (const path of ["invite", "revoke", "transfer", "preset", "import"]) {
    assert.equal((await request(path, {}, u.cookie)).status, 403);
  }
  const foreignOwner = await owner(), foreignState = await importFixture(foreignOwner);
  assert.equal((await request("action", { action: "start", payload: { matchId: foreignState.matches[0].id, court: 1 }, revision: state.revision }, u.cookie)).status, 400);
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
