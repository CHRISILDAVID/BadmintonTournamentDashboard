import express from "express";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { emptyState, applyAction } from "./engine.js";
import { demoState } from "./demo.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
const sessions = new Map(),
  clients = new Set(),
  attempts = new Map();
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
    return res
      .status(403)
      .json({
        error: "Open the organizer page on this host before making changes.",
      });
  const sid = req.headers.cookie
    ?.split("; ")
    .find((c) => c.startsWith("sh_session="))
    ?.slice(11);
  const session = sessions.get(sid);
  req.auth = !!session && session > Date.now();
  req.sid = sid;
  next();
});
const local = (req) =>
  ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress);
const auth = (req, res, next) =>
  req.auth
    ? next()
    : res.status(401).json({ error: "Sign in to manage the tournament." });
const broadcast = () =>
  clients.forEach((res) =>
    res.write(`data: ${JSON.stringify({ revision: state.revision })}\n\n`),
  );
app.get("/api/session", (req, res) =>
  res.json({
    authenticated: req.auth,
    needsSetup: !get("password"),
    canSetup: local(req),
  }),
);
app.post("/api/login", (req, res) => {
  const key = req.socket.remoteAddress,
    record = attempts.get(key) || { count: 0, until: Date.now() + 900000 };
  if (record.until < Date.now()) {
    record.count = 0;
    record.until = Date.now() + 900000;
  }
  if (record.count >= 15)
    return res
      .status(429)
      .json({ error: "Too many attempts. Try again in 15 minutes." });
  const password = String(req.body.password || "");
  if (password.length > 200)
    return res.status(400).json({ error: "Password is too long." });
  let stored = get("password");
  if (!stored) {
    if (!local(req))
      return res
        .status(403)
        .json({
          error:
            "Create the organizer password on the host laptop at localhost first.",
        });
    if (password.length < 8)
      return res
        .status(400)
        .json({ error: "Choose a password with at least 8 characters." });
    const salt = randomBytes(16).toString("hex");
    stored = { salt, hash: scryptSync(password, salt, 64).toString("hex") };
    set("password", stored);
  }
  if (
    !timingSafeEqual(
      Buffer.from(stored.hash, "hex"),
      scryptSync(password, stored.salt, 64),
    )
  ) {
    record.count++;
    attempts.set(key, record);
    return res.status(401).json({ error: "Incorrect organizer password." });
  }
  attempts.delete(key);
  const sid = randomBytes(32).toString("hex");
  sessions.set(sid, Date.now() + 24 * 60 * 60 * 1000);
  res.cookie("sh_session", sid, {
    httpOnly: true,
    sameSite: "strict",
    maxAge: 86400000,
    path: "/",
  });
  res.json({ ok: true });
});
app.post("/api/logout", (req, res) => {
  sessions.delete(req.sid);
  res.clearCookie("sh_session");
  res.json({ ok: true });
});
app.get("/api/state", (req, res) => res.json(state));
app.get("/api/network", auth, (req, res) => {
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
app.post("/api/action", auth, (req, res) => {
  try {
    if (req.body.revision !== state.revision)
      return res
        .status(409)
        .json({
          error:
            "Another organizer made a change. The latest data has been loaded; please try again.",
        });
    let next;
    if (req.body.action === "demo") {
      if (state.tournaments.length)
        throw new Error("Sample data can only be loaded into an empty event.");
      next = demoState();
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
app.get("/api/export", auth, (req, res) => {
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
if (process.argv.includes("--dev")) {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*path}", (req, res) =>
    res.sendFile(path.join(root, "dist/index.html")),
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
