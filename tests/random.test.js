import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { randomGames } from "../server/random-scores.js";
import { applyAction, emptyState, validateGames } from "../server/engine.js";
import { playoffPreset, scoringRules } from "../shared/format.js";
import { practiceState } from "../server/demo.js";
import { tournamentDisplayData } from "../shared/display.js";

test("random scores respect golden point, deuce, caps and best-of match endings", () => {
  let seed = 42;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (const points of [5, 15, 21, 50])
    for (const bestOf of [1, 3, 5])
      for (const goldenPoint of [true, false]) {
        const rules = { points, bestOf, goldenPoint, cap: goldenPoint ? points : Math.min(60, points + 9) };
        const winners = new Set(), lengths = new Set();
        for (let i = 0; i < 300; i++) {
          const games = randomGames(rules, random);
          winners.add(validateGames(games, rules));
          lengths.add(games.length);
        }
        assert.equal(winners.size, 2);
        assert.equal(lengths.size, Math.ceil(bestOf / 2));
      }
  for (let i = 0; i < 100; i++) {
    const rules = { points: 15, cap: 16, bestOf: 3, goldenPoint: false };
    validateGames(randomGames(rules, random), rules);
  }
});

test("bulk completion preserves results and other categories, frees courts, and leaves stage creation manual", () => {
  const before = practiceState(emptyState());
  const tid = before.matches.find(m => m.stage === "Semifinal").tournamentId;
  let s = applyAction(before, "randomComplete", { tournamentId: tid });
  assert.equal(s.revision, before.revision + 1);
  assert.ok(s.matches.filter(m => m.tournamentId === tid).every(m => m.status === "completed"));
  assert.ok(tournamentDisplayData(s, tid).champion);
  assert.deepEqual(s.matches.filter(m => m.tournamentId !== tid || m.status === "completed" && before.matches.find(x => x.id === m.id)?.status === "completed"),
    before.matches.filter(m => m.tournamentId !== tid || m.status === "completed"));
  s = applyAction(s, "randomComplete");
  assert.equal(s.matches.length, before.matches.length);
  assert.deepEqual(s.teams, before.teams);
  assert.deepEqual(s.tournaments, before.tournaments);
  assert.ok(s.matches.every(m => m.status === "completed"));
  for (const m of s.matches.filter(m => before.matches.find(x => x.id === m.id).status !== "completed")) {
    assert.equal(m.court, null);
    const winner = validateGames(m.games, scoringRules(s.tournaments.find(t => t.id === m.tournamentId), m.stage));
    assert.equal(m.winner, winner === 0 ? m.a : m.b);
  }
  assert.throws(() => applyAction(s, "randomComplete"), /no unfinished/);
  assert.throws(() => applyAction(s, "randomComplete", { tournamentId: "missing" }), /not found/);
});

for (const mode of ["intermediate", "beginner"]) test(`${mode}: pending playoffs, byes and all dependent rounds complete using stage scoring`, () => {
  const count = mode === "intermediate" ? 200 : 30;
  const groups = mode === "intermediate" ? 40 : 5;
  let s = applyAction(emptyState(), "tournament", { name: mode, ...playoffPreset(mode, groups) });
  const tournamentId = s.tournaments[0].id;
  s.tournaments[0].scoring.playoff.bestOf = 3;
  s.tournaments[0].scoring.knockout.bestOf = 5;
  s = applyAction(s, "teams", { tournamentId, teams: Array.from({ length: count }, (_, i) => ({ players: [`Player ${i}`, `Partner ${i}`] })) });
  s = applyAction(s, "generate", { tournamentId });
  s = applyAction(s, "start", { matchId: s.matches[0].id, court: 1 });
  s = applyAction(s, "randomComplete", { tournamentId });
  const league = structuredClone(s.matches);
  s = applyAction(s, "knockouts", { tournamentId });
  assert.ok(s.matches.some(m => m.bye));
  s = applyAction(s, "randomComplete", { tournamentId });
  assert.ok(s.matches.every(m => m.status === "completed"));
  assert.deepEqual(s.matches.filter(m => m.stage === "League"), league);
  for (const m of s.matches.filter(m => !m.bye)) {
    const winner = validateGames(m.games, scoringRules(s.tournaments[0], m.stage));
    assert.equal(m.winner, winner === 0 ? m.a : m.b);
  }
  assert.ok(tournamentDisplayData(s, tournamentId).champion);
});

test("missing feeders fail atomically instead of silently completing only some matches", () => {
  const s = practiceState(emptyState());
  s.matches.find(m => m.stage === "Final").round = 9;
  const before = structuredClone(s);
  assert.throws(() => applyAction(s, "randomComplete"), /missing opponents or feeder/);
  assert.deepEqual(s, before);
});

test("HTTP testing toggle, revision checks, and random results persist across restart", { timeout: 30000 }, async () => {
  const baseDir = resolve(tmpdir()), dataDir = mkdtempSync(join(baseDir, "shuttlehub-random-test-"));
  let child, base;
  async function start(disabled) {
    child = spawn(process.execPath, ["server/index.js"], {
      env: { ...process.env, PORT: "0", DATA_DIR: dataDir, DISABLE_TEST_TOOLS: disabled ? "1" : "0" },
      stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    });
    base = await new Promise((resolve, reject) => {
      let output = "";
      const timer = setTimeout(() => reject(new Error("Server startup timed out")), 8000);
      child.on("error", err => { clearTimeout(timer); reject(err); });
      child.on("exit", code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
      child.stdout.on("data", chunk => {
        output += chunk;
        const match = output.match(/ShuttleHub is ready: (http:\/\/localhost:\d+)/);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
    });
  }
  async function stop() {
    if (child && child.exitCode === null) {
      const closed = once(child, "exit");
      child.kill();
      await closed;
    }
  }
  const post = body => fetch(base + "/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  try {
    await start(false);
    assert.deepEqual(await (await fetch(base + "/api/features")).json(), { testTools: true });
    const loaded = await (await post({ revision: 0, action: "practice" })).json();
    const response = await post({ revision: loaded.revision, action: "randomComplete" });
    assert.equal(response.status, 200);
    const completed = await response.json();
    assert.ok(completed.matches.every(m => m.status === "completed"));
    assert.equal((await post({ revision: loaded.revision, action: "randomComplete" })).status, 409);
    await stop();
    await start(true);
    assert.deepEqual(await (await fetch(base + "/api/features")).json(), { testTools: false });
    assert.deepEqual(await (await fetch(base + "/api/state")).json(), completed);
    assert.equal((await post({ revision: completed.revision, action: "randomComplete" })).status, 403);
    assert.deepEqual(await (await fetch(base + "/api/state")).json(), completed);
  } finally {
    await stop();
    const resolved = resolve(dataDir);
    if (resolved.startsWith(baseDir + sep) && resolved.split(sep).at(-1).startsWith("shuttlehub-random-test-"))
      rmSync(resolved, { recursive: true, force: true });
  }
});
