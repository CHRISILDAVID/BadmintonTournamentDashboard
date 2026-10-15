import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { once } from "node:events";

test(
  "server authentication, revisions, live events and SQLite persistence",
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
      assert.equal(
        (await fetch(base + "/api/session").then((r) => r.json())).needsSetup,
        true,
      );
      assert.equal(
        (await post("/api/action", { revision: 0, action: "demo" })).status,
        401,
      );
      assert.equal(
        (await post("/api/login", { password: "short" })).status,
        400,
      );
      const login = await post("/api/login", {
        password: "Temporary-test-password",
      });
      assert.equal(login.status, 200);
      const cookie = login.headers.get("set-cookie").split(";")[0];
      assert.equal(
        (
          await post("/api/action", { revision: 0, action: "demo" }, cookie, {
            origin: "http://untrusted.invalid",
          })
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
      const response = await post(
        "/api/action",
        { revision: 0, action: "demo" },
        cookie,
      );
      assert.equal(response.status, 200);
      const s = await response.json();
      assert.equal(s.revision, 1);
      const update = new TextDecoder().decode((await reader.read()).value);
      assert.match(update, /"revision":1/);
      controller.abort();
      assert.equal(
        (
          await post(
            "/api/action",
            { revision: 0, action: "event", payload: s.event },
            cookie,
          )
        ).status,
        409,
      );
      assert.equal((await fetch(base + "/api/export")).status, 401);
      const exported = await fetch(base + "/api/export", {
        headers: { cookie },
      }).then((r) => r.json());
      assert.equal(exported.format, "shuttlehub-v1");
      assert.equal(exported.password, undefined);
      await stop();
      await start();
      const restored = await fetch(base + "/api/state").then((r) => r.json());
      assert.equal(restored.teams.length, 24);
      assert.equal(restored.revision, 1);
      assert.equal(
        (await fetch(base + "/api/session").then((r) => r.json())).needsSetup,
        false,
      );
      assert.equal(
        (
          await fetch(base + "/api/session", { headers: { cookie } }).then(
            (r) => r.json(),
          )
        ).authenticated,
        false,
      );
      assert.equal(
        (await post("/api/login", { password: "Temporary-test-password" }))
          .status,
        200,
      );
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
