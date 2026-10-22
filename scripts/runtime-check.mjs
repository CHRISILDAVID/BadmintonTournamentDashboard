import { unstable_dev } from "wrangler";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { fixture } from "../tests/cloud/helpers.js";
import { applyAction } from "../server/engine.js";
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
  const maintainer = await call("maintainer/session", { secret: "runtime-check-secret" }); assert.equal(maintainer.status, 200);
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
  // A separate completed event verifies retained podiums and drill-down data
  // across a real runtime restart without disturbing the live-score scenario.
  const archiveSetup = await call("provision", { owner: "archive-owner" }, "", true);
  const [archiveEvent, archiveToken] = new URLSearchParams(new URL(archiveSetup.data.setupUrl).hash.slice(1)).get("invite").split(".");
  const archiveOwner = await call("redeem", { eventId: archiveEvent, token: archiveToken });
  let completed = fixture(1);
  for (const match of completed.matches) {
    if (match.status !== "live") completed = applyAction(completed, "start", { matchId: match.id, court: 1 });
    completed = applyAction(completed, "finish", { matchId: match.id, games: [[5, 0]] });
  }
  const categoryId = completed.tournaments[0].id;
  completed = applyAction(completed, "knockouts", { tournamentId: categoryId });
  const final = completed.matches.find(m => m.stage === "Final");
  completed = applyAction(completed, "start", { matchId: final.id, court: 1 });
  completed = applyAction(completed, "finish", { matchId: final.id, games: [[5, 0]] });
  const archiveImport = await call("import", { destination: archiveEvent, backup: { format: "shuttlehub-v1", state: completed } }, archiveOwner.cookie);
  assert.equal(archiveImport.status, 200);
  assert.equal((await call("action", { action: "deleteTournament", payload: { tournamentId: categoryId }, revision: archiveImport.data.revision }, archiveOwner.cookie)).status, 200);
  const historyPath = `maintainer/history/${archiveEvent}`;
  const historyBefore = await call(historyPath, undefined, maintainer.cookie);
  assert.equal(historyBefore.status, 200); assert.equal(historyBefore.data.archived, 1);
  await worker.stop();
  worker = await unstable_dev("cloud/worker.js", options);
  assert.equal((await call("maintainer/session", undefined, maintainer.cookie)).status, 200);
  const historyAfter = await call(historyPath, undefined, maintainer.cookie);
  assert.deepEqual(historyAfter.data.items, historyBefore.data.items);
  assert.equal(historyAfter.data.items[0].winner.id, final.a);
  assert.equal(historyAfter.data.items[0].runnerUp.id, final.b);
  const archivedMatches = await call(`${historyPath}/tournaments/${categoryId}?limit=2`, undefined, maintainer.cookie);
  assert.equal(archivedMatches.status, 200); assert.equal(archivedMatches.data.total, 7); assert.equal(archivedMatches.data.items.length, 2);
  assert.equal((await call(`${historyPath}/tournaments/${categoryId}?view=entries&limit=2`, undefined, maintainer.cookie)).data.total, 4);
  const after = await call("live", undefined, owner.cookie);
  assert.equal(after.status, 200); assert.deepEqual(after.data.live[0].score.points, [1, 0]);
  const retry = await call("score", action, owner.cookie);
  assert.equal(retry.data.duplicate, true);
  assert.equal((await call("provision", { owner: "restart-owner" }, "", true)).status, 409);
  await worker.stop();
  worker = await unstable_dev("cloud/worker.js", { ...options, vars: { ...options.vars, PROVISIONING_SECRET: "rotated-runtime-secret" } });
  assert.equal((await call("maintainer/session", undefined, maintainer.cookie)).status, 401);
  assert.equal((await call(historyPath, undefined, maintainer.cookie)).status, 401);
  assert.equal((await call("me", undefined, owner.cookie)).status, 200);
  console.log("PASS: invitation expiry, durable score/session/dedup persistence, owner uniqueness, archived podium/match/entry persistence, maintainer session persistence and revocation on secret rotation.");
} finally { await worker?.stop(); }
