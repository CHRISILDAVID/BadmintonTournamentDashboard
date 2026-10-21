import { DatabaseSync, backup } from "node:sqlite";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const source = path.resolve(process.argv[2] || "data/shuttlehub.sqlite");
const folder = path.resolve(process.argv[3] || `output/backups/${new Date().toISOString().replace(/[:.]/g, "-")}`);
const destination = path.join(folder, "shuttlehub.sqlite");
if (destination.toLowerCase() === source.toLowerCase()) throw new Error("Backup destination must differ from the source.");
// Claim a new directory atomically. Existing directories/backups are never reused.
await mkdir(path.dirname(folder), { recursive: true });
await mkdir(folder);
const db = new DatabaseSync(source, { readOnly: true });
// SQLite's backup API includes committed WAL changes while the source stays intact.
try { await backup(db, destination); } finally { db.close(); }
// Read the completed copy so JSON and SQLite represent the same committed state.
const copy = new DatabaseSync(destination, { readOnly: true });
try {
  const row = copy.prepare("SELECT value FROM kv WHERE key='state'").get();
  if (!row) throw new Error("No local event found.");
  await writeFile(path.join(folder, "event.json"), JSON.stringify({ format: "shuttlehub-v1", exportedAt: new Date().toISOString(), state: JSON.parse(row.value) }, null, 2), { flag: "wx" });
} finally { copy.close(); }
console.log(`Backup and migration JSON saved to ${folder}`);
