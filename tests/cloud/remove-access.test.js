import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { owner, request, invitation, redeem, importFixture, envelope, origin } from "./helpers.js";

const connect = session => new Promise((resolve, reject) => {
  const socket = new WebSocket(origin.replace(/^http/, "ws") + "/api/socket", { headers: { Cookie: session.cookie, Origin: origin } });
  socket.once("message", () => resolve(socket)); socket.once("error", reject);
});

test("removing staff or display access hides entries, invalidates links and sessions, and retains event history", async () => {
  const o = await owner(), state = await importFixture(o);
  const preset = (await request("preset", { name: "Screen" }, o.cookie)).data;
  const keep = await invitation(o, "umpire", "Keep this umpire");
  const keptSession = await redeem(keep.url);
  for (const role of ["organizer", "umpire", "display"]) {
    const invite = await invitation(o, role, `Remove ${role}`, role === "display" ? preset.id : undefined);
    const session = await redeem(invite.url);
    const displaySession = role === "display" ? await redeem(invite.url) : null;
    const m = state.matches.find(m => m.status === "live");
    let record;
    if (role !== "display") {
      await request("assign", { matchId: m.id, profile: invite.profile }, o.cookie);
      record = (await request("claim", { matchId: m.id, device: crypto.randomUUID() }, session.cookie)).data;
      const point = await request("score", envelope(session, record, "point", m.a), session.cookie);
      assert.equal(point.data.accepted, true); record = point.data.record;
    }
    const socket = await connect(session);
    try {
      const closed = new Promise(resolve => socket.once("close", resolve));
      assert.equal((await request("remove-access", { profile: invite.profile }, o.cookie)).status, 200);
      assert.equal(await closed, 4001);
      const access = (await request("access", undefined, o.cookie)).data;
      assert.ok(!access.profiles.some(p => p.id === invite.profile));
      assert.ok(!access.sessions.some(s => s.profile === invite.profile));
      assert.ok(!access.assignments.some(a => a.profile === invite.profile));
      assert.ok(access.profiles.some(p => p.id === keep.profile));
      assert.equal((await request("state", undefined, session.cookie)).status, 401);
      if (displaySession) assert.equal((await request("state", undefined, displaySession.cookie)).status, 401);
      await assert.rejects(redeem(invite.url));
      assert.equal((await request("assign", { matchId: m.id, profile: invite.profile }, o.cookie)).status, 400);
      if (record) {
        assert.equal((await request("score", envelope(session, record, "point", m.a), session.cookie)).status, 401);
        const replacement = await request("claim", { matchId: m.id, device: crypto.randomUUID() }, keptSession.cookie);
        assert.equal(replacement.status, 200);
        assert.deepEqual(replacement.data.score.points, record.score.points);
        await request("transfer", { matchId: m.id }, o.cookie);
      }
      assert.deepEqual((await request("state", undefined, o.cookie)).data, state);
      assert.equal((await request("remove-access", { profile: invite.profile }, o.cookie)).status, 200);
      const newInvite = await invitation(o, role, `Remove ${role}`, role === "display" ? preset.id : undefined);
      assert.notEqual(newInvite.profile, invite.profile);
      assert.equal((await request("me", undefined, (await redeem(newInvite.url)).cookie)).status, 200);
    } finally { socket.close(); }
  }
  const archive = (await request("export", undefined, o.cookie)).data;
  assert.equal(archive.actions.length, 2);
  assert.deepEqual(archive.state, state);
});

test("staff removal enforces permissions and event isolation, protects the owner and self, and handles unused invites", async () => {
  const o = await owner(), other = await owner();
  const coInvite = await invitation(o, "organizer"), co = await redeem(coInvite.url);
  const umpire = await redeem((await invitation(o, "umpire")).url);
  const preset = (await request("preset", { name: "Screen" }, o.cookie)).data;
  const display = await redeem((await invitation(o, "display", "Screen", preset.id)).url);
  const pending = await invitation(o, "umpire", "Unused invitation");
  for (const session of [umpire, display]) assert.equal((await request("remove-access", { profile: pending.profile }, session.cookie)).status, 403);
  assert.equal((await request("remove-access", { profile: pending.profile })).status, 401);
  assert.equal((await request("remove-access", { profile: pending.profile }, o.cookie, { Origin: "https://evil.example" })).status, 403);
  assert.equal((await request("remove-access", { profile: other.profile }, o.cookie)).status, 404);
  assert.equal((await request("remove-access", { profile: o.profile }, o.cookie)).status, 403);
  assert.equal((await request("remove-access", { profile: o.profile }, co.cookie)).status, 403);
  assert.equal((await request("remove-access", { profile: co.profile }, co.cookie)).status, 403);
  assert.equal((await request("remove-access", {}, o.cookie)).status, 400);
  assert.equal((await request("remove-access", { profile: pending.profile }, co.cookie)).status, 200);
  await assert.rejects(redeem(pending.url));
  assert.ok(!(await request("access", undefined, o.cookie)).data.profiles.some(p => p.id === pending.profile));
  assert.equal((await request("state", undefined, other.cookie)).status, 200);
});

test("both profile and individual-session revocation release scoring control without clearing accepted points", async () => {
  const o = await owner(), state = await importFixture(o), m = state.matches.find(m => m.status === "live");
  for (const target of ["profile", "sessionId"]) {
    const session = await redeem((await invitation(o, "umpire")).url);
    let record = (await request("claim", { matchId: m.id, device: crypto.randomUUID() }, session.cookie)).data;
    record = (await request("score", envelope(session, record, "point", m.a), session.cookie)).data.record;
    assert.equal((await request("revoke", { [target]: session[target] }, o.cookie)).status, 200);
    const claimed = await request("claim", { matchId: m.id, device: crypto.randomUUID() }, o.cookie);
    assert.equal(claimed.status, 200);
    assert.deepEqual(claimed.data.score.points, record.score.points);
    await request("transfer", { matchId: m.id }, o.cookie);
  }
});
