import test from "node:test";
import assert from "node:assert/strict";
import { origin, request, owner, redeem, importFixture, invitation, envelope } from "./helpers.js";
import { WebSocket } from "ws";

const unlock = () => request("maintainer/session", { secret: "local-test-secret" });

test("maintainer access requires a separate secure session and same-origin browser mutations", async () => {
  for (const path of ["maintainer/session", "maintainer/owners"]) assert.equal((await request(path)).status, 401);
  assert.equal((await request("maintainer/session", { secret: "wrong" })).status, 403);
  assert.equal((await request("maintainer/session", { secret: "local-test-secret" }, "", { Origin: "https://evil.example" })).status, 403);
  const response = await fetch(`${origin}/api/maintainer/session`, {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ secret: "local-test-secret" }),
  });
  assert.equal(response.status, 200);
  const cookieHeader = response.headers.get("set-cookie"), cookie = cookieHeader.split(";")[0];
  for (const flag of ["Secure", "HttpOnly", "SameSite=Strict", "Path=/api/", "Max-Age=604800"]) assert.ok(cookieHeader.includes(flag));
  assert.ok(!JSON.stringify(await response.json()).includes("local-test-secret"));
  assert.equal((await request("maintainer/session", undefined, cookie)).status, 200);
  assert.equal((await request("state", undefined, cookie)).status, 401);
  for (const path of ["provision", "maintainer-recovery", "maintainer/logout", "maintainer/logout-all"])
    assert.equal((await request(path, { owner: "forged-owner" }, cookie, { Origin: "https://evil.example" })).status, 403);
  assert.equal((await request("maintainer/owners", undefined, cookie.replace(/[a-f0-9]$/, "z"))).status, 401);
  const organizer = await owner();
  assert.equal((await request("maintainer/owners", undefined, organizer.cookie)).status, 401);
  assert.equal((await request("provision", { owner: "forged-owner" }, organizer.cookie)).status, 401);
  assert.equal((await request("maintainer-recovery", { owner: "forged-owner" }, organizer.cookie)).status, 401);
  assert.equal((await request("maintainer/logout", {}, cookie)).status, 200);
});

test("maintainer form provisioning enforces one event; restoration retains data and rotates authority", async () => {
  const maintainer = await unlock(), identity = `maintainer-${crypto.randomUUID()}`;
  assert.equal(maintainer.status, 200);
  const attempts = await Promise.all(Array.from({ length: 3 }, () => request("provision", { owner: identity }, maintainer.cookie)));
  assert.equal(attempts.filter(r => r.status === 201).length, 1);
  assert.equal(attempts.filter(r => r.status === 409).length, 2);
  const setup = attempts.find(r => r.status === 201).data, organizer = await redeem(setup.setupUrl);
  const state = await importFixture(organizer);
  let directory = await request("maintainer/owners", undefined, maintainer.cookie);
  assert.equal(directory.status, 200);
  let listed = directory.data.owners.some(o => o.owner === identity && o.event === organizer.eventId);
  while (!listed && directory.data.nextCursor) {
    directory = await request(`maintainer/owners?after=${encodeURIComponent(directory.data.nextCursor)}`, undefined, maintainer.cookie);
    assert.equal(directory.status, 200);
    listed = directory.data.owners.some(o => o.owner === identity && o.event === organizer.eventId);
  }
  assert.ok(listed);
  assert.equal((await request("maintainer/owners?after=bad%27", undefined, maintainer.cookie)).status, 400);
  const recovery = await request("maintainer-recovery", { owner: identity }, maintainer.cookie);
  assert.equal(recovery.status, 201); assert.equal(recovery.data.eventId, organizer.eventId);
  await assert.rejects(redeem(organizer.recovery));
  const restored = await redeem(recovery.data.setupUrl);
  assert.equal(restored.eventId, organizer.eventId);
  assert.equal((await request("me", undefined, organizer.cookie)).status, 401);
  assert.equal((await request("state", undefined, restored.cookie)).data.matches[0].id, state.matches[0].id);
  await assert.rejects(redeem(recovery.data.setupUrl));
  await request("maintainer/logout", {}, maintainer.cookie);
});

test("maintainer logout and lock-all revoke remembered sessions without revoking organizer access", async () => {
  const a = await unlock(), b = await unlock(), organizer = await owner();
  assert.notEqual(a.cookie, b.cookie);
  assert.equal((await request("maintainer/logout", {}, a.cookie)).status, 200);
  assert.equal((await request("maintainer/session", undefined, a.cookie)).status, 401);
  assert.equal((await request("maintainer/session", undefined, b.cookie)).status, 200);
  const c = await unlock();
  assert.equal((await request("maintainer/logout-all", {}, b.cookie)).status, 200);
  for (const cookie of [a.cookie, b.cookie, c.cookie])
    assert.equal((await request("maintainer/session", undefined, cookie)).status, 401);
  assert.equal((await request("me", undefined, organizer.cookie)).status, 200);
});

test("maintainer removal revokes organizer sessions and links immediately, retains data and allows restoration", async () => {
  const maintainer = await unlock(), identity = `remove-${crypto.randomUUID()}`;
  const o = await owner(identity), other = await owner(), state = await importFixture(o);
  const co = await redeem((await invitation(o, "organizer")).url);
  const pendingCo = await invitation(o, "organizer");
  const umpire = await redeem((await invitation(o, "umpire")).url);
  const m = state.matches.find(m => m.status === "live");
  const record = (await request("claim", { matchId: m.id, device: crypto.randomUUID() }, co.cookie)).data;
  assert.equal((await request("score", envelope(co, record, "point", m.a), co.cookie)).data.accepted, true);
  for (const cookie of ["", o.cookie, co.cookie])
    assert.equal((await request("maintainer/revoke", { owner: identity }, cookie)).status, 401);
  assert.equal((await request("maintainer/revoke", { owner: identity }, maintainer.cookie, { Origin: "https://evil.example" })).status, 403);
  assert.equal((await request("maintainer/revoke", undefined, maintainer.cookie)).status, 405);
  assert.equal((await request("maintainer/revoke", { owner: "missing-owner" }, maintainer.cookie)).status, 404);
  const pendingRecovery = await request("maintainer-recovery", { owner: identity }, maintainer.cookie);
  const socket = new WebSocket(origin.replace(/^http/, "ws") + "/api/socket", { headers: { Cookie: o.cookie, Origin: origin } });
  try {
    await new Promise((resolve, reject) => { socket.once("message", resolve); socket.once("error", reject); });
    const closed = new Promise(resolve => socket.once("close", resolve));
    assert.equal((await request("maintainer/revoke", { owner: identity }, maintainer.cookie)).status, 200);
    assert.equal(await closed, 4001);
    for (const cookie of [o.cookie, co.cookie]) {
      assert.equal((await request("state", undefined, cookie)).status, 401);
      assert.equal((await request("score", envelope(co, record, "point", m.a), cookie)).status, 401);
    }
    for (const url of [o.recovery, pendingCo.url, pendingRecovery.data.setupUrl]) await assert.rejects(redeem(url));
    assert.equal((await request("state", undefined, other.cookie)).status, 200);
    assert.equal((await request("state", undefined, umpire.cookie)).status, 200);
    assert.deepEqual((await request("state", undefined, umpire.cookie)).data, state);
    // The revoked organizer's control is released, retaining accepted points.
    const replacement = await request("claim", { matchId: m.id, device: crypto.randomUUID() }, umpire.cookie);
    assert.equal(replacement.status, 200);
    assert.deepEqual(replacement.data.score.points, [1, 0]);
    assert.equal((await request("provision", { owner: identity }, maintainer.cookie)).status, 409);
    const restoration = await request("maintainer-recovery", { owner: identity }, maintainer.cookie);
    const restored = await redeem(restoration.data.setupUrl);
    assert.equal(restored.eventId, o.eventId);
    assert.deepEqual((await request("state", undefined, restored.cookie)).data, state);
    assert.equal((await request("state", undefined, co.cookie)).status, 401);
  } finally { socket.close(); await request("maintainer/logout", {}, maintainer.cookie); }
});
