import test from "node:test";
import assert from "node:assert/strict";
import { applyAction } from "../../server/engine.js";
import { origin, request, owner, fixture, importFixture, invitation, redeem } from "./helpers.js";

// Another security test deliberately revokes all maintainer sessions. Obtain a
// fresh session per request so this test does not depend on suite scheduling.
async function history(path = "", body, retry = 0) {
  const auth = await request("maintainer/session", { secret: "local-test-secret" });
  const result = await request(`maintainer/history${path}`, body, auth.cookie);
  if (result.status === 401 && retry < 2) return history(path, body, retry + 1);
  return result;
}
function completedFixture() {
  let state = fixture(1);
  const tournamentId = state.tournaments[0].id;
  for (const m of state.matches) {
    if (m.status !== "live") state = applyAction(state, "start", { matchId: m.id, court: 1 });
    state = applyAction(state, "finish", { matchId: m.id, games: [[5, 0]] });
  }
  state = applyAction(state, "knockouts", { tournamentId });
  for (const m of state.matches.filter(m => m.stage !== "League")) {
    state = applyAction(state, "start", { matchId: m.id, court: 1 });
    state = applyAction(state, "finish", { matchId: m.id, games: [[5, 0]] });
  }
  return state;
}

test("history is maintainer-only, bounded at every level, and retains removed results", async () => {
  const label = `history-${crypto.randomUUID()}`, o = await owner(label), other = await owner();
  let state = await importFixture(o, completedFixture());
  const category = state.tournaments[0], path = `/${o.eventId}`, detail = `${path}/tournaments/${category.id}`;
  for (const route of ["", path, detail]) {
    assert.equal((await request(`maintainer/history${route}`)).status, 401);
    assert.equal((await request(`maintainer/history${route}`, undefined, o.cookie)).status, 401);
  }
  const umpire = await redeem((await invitation(o, "umpire")).url);
  assert.equal((await request(`maintainer/history${path}`, undefined, umpire.cookie)).status, 401);
  const organizer = await redeem((await invitation(o, "organizer")).url);
  assert.equal((await request(`maintainer/history${path}`, undefined, organizer.cookie)).status, 401);
  const single = await history("?limit=1");
  assert.equal(single.status, 200); assert.equal(single.data.items.length, 1); assert.ok(single.data.total >= 2);
  assert.ok(single.data.nextCursor);
  const next = await history(`?limit=1&after=${encodeURIComponent(single.data.nextCursor)}`);
  assert.equal(next.status, 200); assert.equal(next.data.items.length, 1);
  assert.notEqual(single.data.items[0].eventId, next.data.items[0].eventId);
  for (const query of ["?limit=11", "?limit=0", "?limit=-1", "?after=bad%27"]) assert.equal((await history(query)).status, 400);
  assert.equal((await history("", {})).status, 405);
  assert.equal((await history("/not-an-event")).status, 400);
  assert.equal((await history(`/${crypto.randomUUID()}`)).status, 404);
  const root = await history(path);
  assert.equal(root.status, 200); assert.equal(root.data.owner, label); assert.equal(root.data.total, 1);
  const final = state.matches.find(m => m.stage === "Final");
  assert.equal(root.data.items[0].winner.id, final.winner);
  assert.equal(root.data.items[0].runnerUp.id, final.b);
  assert.equal("thirdPlace" in root.data.items[0], false);
  const games = await history(`${detail}?limit=2`);
  assert.equal(games.status, 200); assert.equal(games.data.items.length, 2); assert.equal(games.data.total, 7);
  const games2 = await history(`${detail}?limit=2&after=${games.data.nextCursor}&revision=${games.data.revision}`);
  assert.equal(games2.status, 200); assert.equal(games2.data.items.length, 2);
  assert.ok(games2.data.items.every(m => !games.data.items.some(first => first.id === m.id)));
  assert.deepEqual(games.data.items[0].games, [[5, 0]]);
  const entries = await history(`${detail}?view=entries&limit=2`);
  assert.equal(entries.data.total, 4); assert.equal(entries.data.items.length, 2);
  assert.deepEqual(entries.data.items[0].players, state.teams[0].players);
  const entries2 = await history(`${detail}?view=entries&limit=2&after=${entries.data.nextCursor}`);
  assert.equal(entries2.data.items.length, 2); assert.equal(entries2.data.nextCursor, null);
  assert.ok(entries2.data.items.every(t => !entries.data.items.some(first => first.id === t.id)));
  for (const query of ["?after=no", "?limit=51", "?view=private"]) assert.equal((await history(detail + query)).status, 400);
  assert.equal((await history(`/${other.eventId}/tournaments/${category.id}`)).status, 404);
  for (const data of [root.data, games.data, entries.data]) for (const field of ["sessions", "profiles", "actions", "recovery", "token", "hash", "assignments"]) assert.equal(field in data, false);
  const auth = await request("maintainer/session", { secret: "local-test-secret" });
  const headers = await fetch(`${origin}/api/maintainer/history${path}`, { headers: { Cookie: auth.cookie } });
  assert.equal(headers.headers.get("cache-control"), "no-store");

  async function action(action, payload) {
    const r = await request("action", { action, payload, revision: state.revision }, o.cookie);
    assert.equal(r.status, 200, JSON.stringify(r.data)); state = r.data;
  }
  await action("correctResult", { matchId: final.id, games: [[0, 5]] });
  const corrected = await history(path);
  assert.equal(corrected.data.items[0].winner.id, final.b);
  assert.equal(corrected.data.items[0].runnerUp.id, final.a);
  assert.equal((await history(`${detail}?revision=${games.data.revision}`)).status, 409);
  assert.equal((await history(`${path}?revision=${games.data.revision}`)).status, 409);
  await action("deleteTournament", { tournamentId: category.id });
  const archive = await history(path);
  assert.equal(archive.data.total, 1); assert.equal(archive.data.archived, 1);
  assert.ok(archive.data.items[0].archivedAt); assert.equal(archive.data.items[0].winner.id, final.b);
  assert.equal((await history(detail)).data.total, 7);
  assert.equal((await history(`${detail}?view=entries`)).data.total, 4);
  assert.equal((await request("state", undefined, o.cookie)).data.tournaments.length, 0);
  // Retained categories paginate alongside new categories without duplicates.
  for (let i = 0; i < 3; i++) await action("tournament", { name: `Draft ${i}`, size: 2, groups: 1, qualify: 2, points: 5, cap: 6, bestOf: 1 });
  const a = await history(`${path}?limit=2`), b = await history(`${path}?limit=2&after=${a.data.nextCursor}&revision=${a.data.revision}`);
  assert.equal(a.data.total, 4); assert.equal(a.data.items.length, 2); assert.equal(b.data.items.length, 2); assert.equal(b.data.nextCursor, null);
  assert.equal(new Set([...a.data.items, ...b.data.items].map(t => t.id)).size, 4);
  const empty = await history(`/${other.eventId}`);
  assert.equal(empty.data.total, 0); assert.deepEqual(empty.data.items, []);
  // Accepted legacy backups may have non-UUID category IDs. Drilling down
  // must preserve that existing import contract, including encoded slashes.
  const legacy = fixture(1), oldId = legacy.tournaments[0].id, legacyId = "old club/open doubles";
  legacy.tournaments[0].id = legacyId;
  for (const row of [...legacy.teams, ...legacy.matches]) if (row.tournamentId === oldId) row.tournamentId = legacyId;
  await importFixture(other, legacy);
  const legacyPage = await history(`/${other.eventId}/tournaments/${encodeURIComponent(legacyId)}`);
  assert.equal(legacyPage.status, 200); assert.equal(legacyPage.data.tournament.id, legacyId); assert.equal(legacyPage.data.total, 6);
  assert.equal((await history(`${path}/tournaments/%ZZ`)).status, 400);
});
