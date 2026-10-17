import test from "node:test";
import assert from "node:assert/strict";
import { emptyState, applyAction } from "../server/engine.js";
import { playoffPreset } from "../shared/format.js";
import { groupEditLockReason } from "../shared/groups.js";

function setup(mode = "intermediate", count = 10) {
  let s = applyAction(emptyState(), "tournament", {
    ...playoffPreset(mode),
    name: mode,
    ...(mode === "direct" ? { groups: 2, qualify: 2 } : {}),
  });
  const tournamentId = s.tournaments[0].id;
  s = applyAction(s, "teams", {
    tournamentId,
    teams: Array.from({ length: count }, (_, i) => ({
      players: [`Player ${i}`, `Partner ${i}`],
      seed: i + 1,
    })),
  });
  return { s: applyAction(s, "generate", { tournamentId }), tournamentId };
}
function payload(s, tournamentId) {
  return {
    tournamentId,
    teamAId: s.teams.find(
      (t) => t.tournamentId === tournamentId && t.group === 0,
    ).id,
    teamBId: s.teams.find(
      (t) => t.tournamentId === tournamentId && t.group === 1,
    ).id,
  };
}
function assertRoundRobin(s, tournamentId) {
  for (let group = 0; group < 2; group++) {
    const teams = s.teams.filter(
      (t) => t.tournamentId === tournamentId && t.group === group,
    );
    const matches = s.matches.filter(
      (m) => m.tournamentId === tournamentId && m.group === group,
    );
    const pairs = new Set(matches.map((m) => [m.a, m.b].sort().join("/")));
    assert.equal(matches.length, (teams.length * (teams.length - 1)) / 2);
    assert.equal(pairs.size, matches.length);
    for (const a of teams)
      for (const b of teams) {
        if (a.id !== b.id) assert.ok(pairs.has([a.id, b.id].sort().join("/")));
      }
  }
}
for (const [mode, count] of [
  ["intermediate", 10],
  ["beginner", 12],
  ["direct", 9],
]) {
  test(`${mode}: repeated swaps preserve group sizes and every round-robin pairing`, () => {
    let { s, tournamentId } = setup(mode, count);
    const sizes = [0, 1].map(
      (g) => s.teams.filter((t) => t.group === g).length,
    );
    for (let i = 0; i < 4; i++) {
      const p = payload(s, tournamentId);
      const before = structuredClone(s);
      s = applyAction(s, "swapGroups", p);
      assert.equal(s.teams.find((t) => t.id === p.teamAId).group, 1);
      assert.equal(s.teams.find((t) => t.id === p.teamBId).group, 0);
      assert.deepEqual(
        [0, 1].map((g) => s.teams.filter((t) => t.group === g).length),
        sizes,
      );
      assertRoundRobin(s, tournamentId);
      assert.equal(s.revision, before.revision + 1);
    }
  });
}
test("swaps preserve fixture IDs, scheduling, holds, manual call order and other categories", () => {
  let { s, tournamentId } = setup();
  s = applyAction(s, "tournament", {
    ...playoffPreset("beginner"),
    name: "Other category",
  });
  const otherId = s.tournaments.at(-1).id;
  s = applyAction(s, "teams", {
    tournamentId: otherId,
    teams: Array.from({ length: 12 }, (_, i) => ({
      players: [`Other ${i}`, `Other partner ${i}`],
    })),
  });
  s = applyAction(s, "generate", { tournamentId: otherId });
  const otherMatch = s.matches.find((m) => m.tournamentId === otherId);
  s = applyAction(s, "start", { matchId: otherMatch.id, court: 1 });
  s = applyAction(s, "finish", { matchId: otherMatch.id, games: [[15, 14]] });
  const own = s.matches.filter((m) => m.tournamentId === tournamentId);
  s = applyAction(s, "holdMatch", { matchId: own[0].id });
  s = applyAction(s, "moveCall", { matchId: own.at(-1).id, position: 1 });
  s.matches.find((m) => m.id === own[1].id).scheduled = "14:30";
  const before = structuredClone(s);
  const after = applyAction(s, "swapGroups", payload(s, tournamentId));
  const metadata = (state) => state.matches.map(({ a, b, ...rest }) => rest);
  assert.deepEqual(metadata(after), metadata(before));
  assert.deepEqual(after.callOrder, before.callOrder);
  assert.deepEqual(
    after.matches.filter((m) => m.tournamentId === otherId),
    before.matches.filter((m) => m.tournamentId === otherId),
  );
  assert.deepEqual(s, before, "action does not mutate its input");
  assertRoundRobin(after, tournamentId);
});
test("on-court participants cannot swap, unrelated teams can, and return-to-waiting unlocks them", () => {
  let { s, tournamentId } = setup();
  const m = s.matches[0];
  s = applyAction(s, "start", { matchId: m.id, court: 1 });
  const active = structuredClone(s.matches.find((x) => x.id === m.id));
  const other = s.teams.find((t) => t.group !== m.group);
  const p = { tournamentId, teamAId: m.a, teamBId: other.id };
  assert.throws(() => applyAction(s, "swapGroups", p), /on court/);
  const idle = s.teams.find(
    (t) => t.group === m.group && t.id !== m.a && t.id !== m.b,
  );
  s = applyAction(s, "swapGroups", { ...p, teamAId: idle.id });
  assert.deepEqual(
    s.matches.find((x) => x.id === m.id),
    active,
  );
  s = applyAction(s, "returnMatch", { matchId: m.id });
  s = applyAction(s, "swapGroups", { ...p, teamBId: idle.id });
  assertRoundRobin(s, tournamentId);
});
test("the first completed match locks both the shared UI rule and server action", () => {
  let { s, tournamentId } = setup();
  const m = s.matches[0];
  s = applyAction(s, "start", { matchId: m.id, court: 1 });
  assert.equal(groupEditLockReason(s, tournamentId), "");
  s = applyAction(s, "finish", { matchId: m.id, games: [[15, 14]] });
  assert.match(groupEditLockReason(s, tournamentId), /first completed match/);
  assert.throws(
    () => applyAction(s, "swapGroups", payload(s, tournamentId)),
    /first completed match/,
  );
});
test("invalid swaps, missing fixtures and knockout draws are rejected atomically", () => {
  const { s, tournamentId } = setup();
  const p = payload(s, tournamentId);
  const before = structuredClone(s);
  for (const invalid of [
    { ...p, teamBId: p.teamAId },
    { ...p, teamAId: "missing" },
    { ...p, tournamentId: "missing" },
    {
      ...p,
      teamBId: s.teams.find((t) => t.group === 0 && t.id !== p.teamAId).id,
    },
  ])
    assert.throws(() => applyAction(s, "swapGroups", invalid));
  assert.throws(
    () => applyAction({ ...s, matches: [] }, "swapGroups", p),
    /Create fixtures/,
  );
  assert.throws(
    () =>
      applyAction(
        {
          ...s,
          matches: s.matches.map((m) => ({ ...m, stage: "Quarterfinal" })),
        },
        "swapGroups",
        p,
      ),
    /knockout draw/,
  );
  assert.deepEqual(s, before);
});
