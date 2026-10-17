import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { once } from "node:events";
import { DatabaseSync } from "node:sqlite";

test(
  "account-free access, revisions, live events, persistence and legacy migration",
  { timeout: 30000 },
  async () => {
    const baseDir = resolve(tmpdir()),
      dataDir = mkdtempSync(join(baseDir, "shuttlehub-test-"));
    let processRef, base;
    async function start() {
      processRef = spawn(process.execPath, ["server/index.js"], {
        env: { ...process.env, PORT: "0", DATA_DIR: dataDir },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      base = await new Promise((resolve, reject) => {
        let output = "";
        const timer = setTimeout(
          () => reject(new Error("Server startup timed out")),
          8000,
        );
        processRef.stdout.on("data", (chunk) => {
          output += chunk;
          const match = output.match(
            /ShuttleHub is ready: (http:\/\/localhost:\d+)/,
          );
          if (match) {
            clearTimeout(timer);
            resolve(match[1]);
          }
        });
        processRef.on("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });
        processRef.on("exit", (code) => {
          clearTimeout(timer);
          reject(new Error(`Server exited: ${code}`));
        });
      });
    }
    async function stop() {
      if (processRef && processRef.exitCode === null) {
        const closed = once(processRef, "exit");
        processRef.kill();
        await closed;
      }
    }
    const post = (url, body, cookie, extra = {}) =>
      fetch(base + url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { cookie } : {}),
          ...extra,
        },
        body: JSON.stringify(body),
      });
    try {
      await start();
      for (const route of ["/", "/display", "/index.html"]) {
        const page = await fetch(base + route);
        assert.equal(page.status, 200);
        assert.equal(page.headers.get("cache-control"), "no-store");
      }
      assert.equal((await fetch(base + "/api/session")).status, 404);
      assert.equal(
        (await post("/api/login", { password: "unused" })).status,
        404,
      );
      assert.equal((await fetch(base + "/api/network")).status, 200);
      assert.equal(
        (
          await post(
            "/api/action",
            { revision: 0, action: "demo" },
            undefined,
            { origin: "http://untrusted.invalid" },
          )
        ).status,
        403,
      );
      const controller = new AbortController();
      const stream = await fetch(base + "/api/events", {
        signal: controller.signal,
      });
      const reader = stream.body.getReader();
      const first = new TextDecoder().decode((await reader.read()).value);
      assert.match(first, /revision/);
      const response = await post("/api/action", {
        revision: 0,
        action: "demo",
      });
      assert.equal(response.status, 200);
      const s = await response.json();
      assert.equal(s.revision, 1);
      const update = new TextDecoder().decode((await reader.read()).value);
      assert.match(update, /"revision":1/);
      controller.abort();
      assert.equal(
        (
          await post("/api/action", {
            revision: 0,
            action: "event",
            payload: s.event,
          })
        ).status,
        409,
      );
      const exported = await fetch(base + "/api/export").then((r) => r.json());
      assert.equal(exported.format, "shuttlehub-v1");
      assert.equal(exported.password, undefined);
      await stop();
      const legacyDB = new DatabaseSync(join(dataDir, "shuttlehub.sqlite"));
      const oldState = JSON.parse(
        legacyDB.prepare("SELECT value FROM kv WHERE key='state'").get().value,
      );
      oldState.teams[0].name = "Old team nickname";
      oldState.event.date = "2026-10-15";
      oldState.matches[0].live = [14, 10];
      oldState.matches[0].scheduled = "2026-10-15T14:30";
      legacyDB
        .prepare("UPDATE kv SET value=? WHERE key='state'")
        .run(JSON.stringify(oldState));
      legacyDB
        .prepare("INSERT INTO kv(key,value) VALUES('password',?)")
        .run(JSON.stringify({ salt: "old", hash: "unused" }));
      legacyDB.close();
      await start();
      const restored = await fetch(base + "/api/state").then((r) => r.json());
      assert.equal(restored.teams.length, 24);
      assert.equal(restored.teams[0].name,oldState.teams[0].players.join(" - "));
      assert.equal(restored.teams[0].id,oldState.teams[0].id);
      assert.equal(restored.revision, 2);
      assert.equal("date" in restored.event, false);
      assert.equal(restored.matches[0].scheduled, "14:30");
      assert.equal("live" in restored.matches[0], false);
      assert.deepEqual(restored.matches[0].games, oldState.matches[0].games);
      assert.equal((await fetch(base + "/api/session")).status, 404);
      const inspect = new DatabaseSync(join(dataDir, "shuttlehub.sqlite"));
      assert.equal(
        inspect.prepare("SELECT value FROM kv WHERE key='password'").get(),
        undefined,
      );
      inspect.close();
      assert.equal(
        (
          await post("/api/action", {
            revision: 2,
            action: "event",
            payload: { ...restored.event, name: "ShuttleHub Club" },
          })
        ).status,
        200,
      );
      const beforePractice = await fetch(base + "/api/state").then(r=>r.json());
      const practiceResponse = await post("/api/action",{revision:beforePractice.revision,action:"practice"});
      assert.equal(practiceResponse.status,200);
      const practice = await practiceResponse.json();
      assert.equal(practice.tournaments.length,beforePractice.tournaments.length+5);
      const draft = practice.tournaments.find(t=>t.name === "Practice / Unused draft");
      const deletedResponse = await post("/api/action",{revision:practice.revision,action:"deleteTournament",payload:{tournamentId:draft.id}});
      assert.equal(deletedResponse.status,200);
      const deleted = await deletedResponse.json();
      assert.equal(deleted.teams.some(t=>t.tournamentId === draft.id),false);
      assert.equal(deleted.tournaments.some(t=>t.id === draft.id),false);
      const callEvents = new AbortController();
      const callStream = await fetch(base + "/api/events", {signal:callEvents.signal});
      const callReader = callStream.body.getReader();
      await callReader.read();
      const called = deleted.matches.findLast(m=>m.status === "upcoming" && m.a && m.b);
      const moveResponse = await post("/api/action",{revision:deleted.revision,action:"moveCall",payload:{matchId:called.id,position:1}});
      assert.equal(moveResponse.status,200);
      const moved = await moveResponse.json();
      assert.equal(moved.callOrder[0],called.id);
      const callEvent = new TextDecoder().decode((await callReader.read()).value);
      assert.ok(callEvent.includes(`"revision":${moved.revision}`));
      callEvents.abort();
      assert.equal((await post("/api/action",{revision:deleted.revision,action:"holdMatch",payload:{matchId:called.id}})).status,409);
      const holdResponse = await post("/api/action",{revision:moved.revision,action:"holdMatch",payload:{matchId:called.id}});
      assert.equal(holdResponse.status,200);
      const held = await holdResponse.json();
      assert.equal(held.matches.find(m=>m.id===called.id).held,true);
      assert.ok(!held.callOrder.includes(called.id));
      await stop(); await start();
      assert.deepEqual(await fetch(base + "/api/state").then(r=>r.json()),held);
    } finally {
      await stop();
      const resolved = resolve(dataDir);
      if (
        resolved.startsWith(baseDir + sep) &&
        resolved.split(sep).at(-1).startsWith("shuttlehub-test-")
      )
        rmSync(resolved, { recursive: true, force: true });
    }
  },
);
