import express from "express";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { emptyState, applyAction } from "./engine.js";
import { demoState, practiceState } from "./demo.js";
import { removeLegacyCalls } from "../shared/matches.js";
import { playerLabel } from "../shared/players.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Temporary testing feature. Disable both its UI and API before a real event.
const testToolsEnabled = process.env.DISABLE_TEST_TOOLS !== "1";
const dataDir = process.env.DATA_DIR || path.join(root, "data");
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, "shuttlehub.sqlite"));
db.exec(
  "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
);
const get = (key) => {
  const row = db.prepare("SELECT value FROM kv WHERE key = ?").get(key);
  return row ? JSON.parse(row.value) : null;
};
const set = (key, value) =>
  db
    .prepare(
      "INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
    .run(key, JSON.stringify(value));
let state = get("state") || emptyState();
const retiredCalls = removeLegacyCalls(state);
// Upgrade existing local data without touching teams, fixtures, or results.
if (
  retiredCalls ||
  "date" in state.event ||
  state.matches.some((m) => m.scheduled?.includes("T") || "live" in m) ||
  state.teams.some((team) => team.name !== playerLabel(team.players))
) {
  delete state.event.date;
  state.teams.forEach((team) => { team.name = playerLabel(team.players); });
  state.matches.forEach((m) => {
    delete m.live;
    if (m.scheduled?.includes("T"))
      m.scheduled = m.scheduled.split("T")[1].slice(0, 5);
  });
  state.revision++;
  set("state", state);
}
db.prepare("DELETE FROM kv WHERE key = ?").run("password");
const clients = new Set();
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  if (req.path.startsWith("/api")) res.setHeader("Cache-Control", "no-store");
  if (
    req.method !== "GET" &&
    req.headers.origin &&
    req.headers.origin !== `${req.protocol}://${req.headers.host}`
  )
    return res.status(403).json({
      error: "Open the organizer page on this host before making changes.",
    });
  next();
});
const broadcast = () =>
  clients.forEach((res) =>
    res.write(`data: ${JSON.stringify({ revision: state.revision })}\n\n`),
  );
app.get("/api/state", (req, res) => res.json(state));
app.get("/api/features", (req, res) => res.json({ testTools: testToolsEnabled }));
app.get("/api/network", (req, res) => {
  const port = server.address().port;
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter(
      (n) =>
        n.family === "IPv4" && !n.internal && !n.address.startsWith("169.254."),
    )
    .map((n) => `http://${n.address}:${port}`);
  res.json({ addresses });
});
app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ revision: state.revision })}\n\n`);
  clients.add(res);
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15000);
  req.on("close", () => {
    clients.delete(res);
    clearInterval(heartbeat);
  });
});
app.post("/api/action", (req, res) => {
  try {
    if (req.body.action === "randomComplete" && !testToolsEnabled)
      return res.status(403).json({ error: "Random match completion is disabled." });
    if (req.body.revision !== state.revision)
      return res.status(409).json({
        error:
          "Another organizer made a change. The latest data has been loaded; please try again.",
      });
    let next;
    if (req.body.action === "demo") {
      if (state.tournaments.length)
        throw new Error("Sample data can only be loaded into an empty event.");
      next = demoState();
      next.revision = state.revision + 1;
    } else if (req.body.action === "practice") {
      next = practiceState(state);
      next.revision = state.revision + 1;
    } else if (req.body.action === "clearDemo") {
      if (!state.demo)
        throw new Error("Only sample events can be cleared here.");
      next = emptyState();
      next.revision = state.revision + 1;
    } else next = applyAction(state, req.body.action, req.body.payload);
    set("state", next);
    state = next;
    broadcast();
    res.json(state);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});
app.get("/api/export", (req, res) => {
  res
    .attachment(
      `shuttlehub-backup-${new Date().toISOString().slice(0, 10)}.json`,
    )
    .json({
      format: "shuttlehub-v1",
      exportedAt: new Date().toISOString(),
      state,
    });
});
app.use("/api", (req, res) =>
  res.status(404).json({ error: "Unknown API endpoint." }),
);
if (process.argv.includes("--dev")) {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(root, "dist"), {
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-store");
    },
  }));
  app.use(["/assets", "/vendor"], (_req, res) => res.status(404).type("text").send("Asset not found."));
  app.get("/{*path}", (req, res) =>
    res.set("Cache-Control", "no-store").sendFile(path.join(root, "dist/index.html")),
  );
}
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ error: "The server could not process that request." });
});
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, "0.0.0.0", () => {
  const activePort = server.address().port;
  console.log(`ShuttleHub is ready: http://localhost:${activePort}`);
  Object.values(networkInterfaces())
    .flat()
    .filter(
      (n) =>
        n.family === "IPv4" && !n.internal && !n.address.startsWith("169.254."),
    )
    .forEach((n) =>
      console.log(
        `Same Wi-Fi: http://${n.address}:${activePort} · Venue screen: http://${n.address}:${activePort}/display`,
      ),
    );
});
