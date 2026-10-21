import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

test("local migration backup includes WAL state and refuses source or existing backup destinations", async () => {
  const folder = await mkdtemp(path.join(tmpdir(), "shuttlehub-backup-test-"));
  const source = path.join(folder, "shuttlehub.sqlite");
  const destination = path.join(folder, "backup");
  const db = new DatabaseSync(source);
  const state = { tournaments: [{ id: "retained-id", name: "Mixed" }], matches: [], settings: { courts: 3 } };
  try {
    db.exec("PRAGMA journal_mode=WAL; CREATE TABLE kv(key TEXT PRIMARY KEY,value TEXT)");
    db.prepare("INSERT INTO kv VALUES (?,?)").run("state", JSON.stringify(state));
    const run = promisify(execFile);
    const script = fileURLToPath(new URL("../scripts/backup-local.mjs", import.meta.url));
    await run(process.execPath, [script, source, destination]);
    const json = JSON.parse(await readFile(path.join(destination, "event.json"), "utf8"));
    assert.deepEqual(json.state, state);
    const copy = new DatabaseSync(path.join(destination, "shuttlehub.sqlite"), { readOnly: true });
    try { assert.deepEqual(JSON.parse(copy.prepare("SELECT value FROM kv").get().value), state); }
    finally { copy.close(); }
    const previous = await readFile(path.join(destination, "shuttlehub.sqlite"));
    await assert.rejects(run(process.execPath, [script, source, destination]), /EEXIST/);
    await assert.rejects(run(process.execPath, [script, source, folder]), /must differ/);
    assert.deepEqual(await readFile(path.join(destination, "shuttlehub.sqlite")), previous);
    assert.deepEqual(JSON.parse(db.prepare("SELECT value FROM kv").get().value), state);
  } finally { db.close(); }
});
