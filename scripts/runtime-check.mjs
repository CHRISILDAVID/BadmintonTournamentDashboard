import { unstable_dev } from "wrangler";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { fixture } from "../tests/cloud/helpers.js";
const directory = await mkdtemp(path.join(os.tmpdir(), "shuttlehub-runtime-"));
const options = { config: "wrangler.jsonc", local: true, port: 8801, persist: true, persistTo: directory, logLevel: "error", vars: {
  PROVISIONING_SECRET: "runtime-check-secret", INVITATION_TTL_SECONDS: "1",
}, experimental: { disableExperimentalWarning: true } };
let worker;
const call = async (route, body, cookie = "", auth = false) => {
  const response = await worker.fetch(`http://127.0.0.1:8801/api/${route}`, { method: body === undefined ? "GET" : "POST",
    headers: { Origin: "http://127.0.0.1:8801", Cookie: cookie, "Content-Type": "application/json", ...(auth ? { Authorization: "Bearer runtime-check-secret" } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, data: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
};
try {
  worker = await unstable_dev("cloud/worker.js", options);
  const setup = await call("provision", { owner: "restart-owner" }, "", true);
  const [eventId, token] = new URLSearchParams(new URL(setup.data.setupUrl).hash.slice(1)).get("invite").split(".");
  const owner = await call("redeem", { eventId, token }); assert.equal(owner.status, 200);
  const imported = await call("import", { destination: eventId, backup: { format: "shuttlehub-v1", state: fixture(1) } }, owner.cookie);
  assert.equal(imported.status, 200);
  const m = imported.data.matches.find(m => m.status === "live");
  const claim = await call("claim", { matchId: m.id, device: crypto.randomUUID() }, owner.cookie);
  const action = { id: crypto.randomUUID(), eventId, matchId: m.id, device: claim.data.device, generation: claim.data.generation, seq: 1, revision: 0, type: "point", teamId: m.a };
  const accepted = await call("score", action, owner.cookie); assert.equal(accepted.data.accepted, true);
  const invite = await call("invite", { role: "umpire", name: "Expired" }, owner.cookie);
  await new Promise(resolve => setTimeout(resolve, 1200));
  const [e, t] = new URLSearchParams(new URL(invite.data.url).hash.slice(1)).get("invite").split(".");
  assert.equal((await call("redeem", { eventId: e, token: t })).status, 403);
  await worker.stop();
  worker = await unstable_dev("cloud/worker.js", options);
  const after = await call("live", undefined, owner.cookie);
  assert.equal(after.status, 200); assert.deepEqual(after.data.live[0].score.points, [1, 0]);
  const retry = await call("score", action, owner.cookie);
  assert.equal(retry.data.duplicate, true);
  assert.equal((await call("provision", { owner: "restart-owner" }, "", true)).status, 409);
  console.log("PASS: real invitation expiry, durable score/session/dedup persistence across workerd restart, persistent owner uniqueness.");
} finally { await worker?.stop(); }
