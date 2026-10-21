import { WebSocket } from "ws";
import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { owner, importFixture, fixture, request, invitation, redeem, envelope, origin } from "../tests/cloud/helpers.js";

const venues = Number(process.env.LOAD_VENUES || 4), courts = Number(process.env.LOAD_COURTS || 4), rounds = Number(process.env.LOAD_ROUNDS || 30);
const controllers = [], sockets = [], waiting = new Map(), latencies = [], http = [], usageBefore = [], owners = [];
async function socket(session, display = false) {
  const ws = new WebSocket(origin.replace(/^http/, "ws") + "/api/socket", { headers: { Cookie: session.cookie, Origin: origin } });
  sockets.push(ws);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Socket snapshot timed out")), 10000);
    ws.on("error", reject);
    ws.on("message", raw => {
      const message = JSON.parse(raw.toString());
      if (message.type === "snapshot") { clearTimeout(timeout); resolve(); }
      if (display && message.type === "score") {
        const key = `${session.eventId}:${message.record.matchId}:${message.record.revision}`;
        const pending = waiting.get(key);
        if (pending) {
          pending.seen++;
          if (pending.seen === 2) { waiting.delete(key); clearTimeout(pending.timer); latencies.push(performance.now() - pending.start); pending.resolve(); }
        }
      }
    });
  });
  return ws;
}
try {
  for (let v = 0; v < venues; v++) {
    const o = await owner(); owners.push(o);
    const state = await importFixture(o, fixture(courts, 50));
    const preset = (await request("preset", { name: "Load screen" }, o.cookie)).data;
    const link = await invitation(o, "display", "Load screen", preset.id);
    await socket(await redeem(link.url), true); await socket(await redeem(link.url), true);
    for (const m of state.matches.filter(m => m.status === "live")) {
      const inv = await invitation(o, "umpire"), u = await redeem(inv.url);
      await request("assign", { matchId: m.id, profile: inv.profile }, o.cookie);
      const r = await request("claim", { matchId: m.id, device: crypto.randomUUID() }, u.cookie);
      if (r.status !== 200) throw new Error(r.data.error);
      await socket(u);
      controllers.push({ u, m, record: r.data });
    }
    usageBefore.push((await request("usage", undefined, o.cookie)).data);
  }
  const started = performance.now();
  for (let n = 0; n < rounds; n++) await Promise.all(controllers.map(async c => {
    const a = envelope(c.u, c.record, "point", n % 2 ? c.m.b : c.m.a);
    const key = `${c.u.eventId}:${c.m.id}:${c.record.revision + 1}`, start = performance.now();
    const delivered = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Display delivery timed out")), 10000);
      waiting.set(key, { start, resolve, timer, seen: 0 });
    });
    const response = await request("score", a, c.u.cookie);
    if (response.status !== 200 || !response.data.accepted) throw new Error(JSON.stringify(response.data));
    http.push(performance.now() - start); c.record = response.data.record;
    await delivered;
  }));
  const elapsedMs = performance.now() - started;
  const after = await Promise.all(owners.map(async o => (await request("usage", undefined, o.cookie)).data));
  const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))];
  const delta = key => after.reduce((sum, u, i) => sum + u.observedSinceWake[key] - usageBefore[i].observedSinceWake[key], 0);
  const result = { measuredAt: new Date().toISOString(), environment: "Wrangler local workerd on maintainer Windows machine; loopback network, not deployed Cloudflare",
    venues, courtsPerVenue: courts, controllers: controllers.length, displays: venues * 2, sockets: sockets.length,
    acceptedActions: http.length, elapsedMs, actionsPerSecond: http.length / (elapsedMs / 1000),
    actionToBothDisplaysMs: { p50: percentile(latencies, .5), p95: percentile(latencies, .95), p99: percentile(latencies, .99), max: Math.max(...latencies) },
    httpAckMs: { p50: percentile(http, .5), p95: percentile(http, .95), max: Math.max(...http) },
    observedSqlRowsRead: delta("sqlRowsRead"), observedSqlRowsWritten: delta("sqlRowsWritten"),
    observedHandlerWallMs: delta("handlerWallMs"), finalDatabaseBytes: after.reduce((n, u) => n + u.databaseBytes, 0),
    limitations: "Burst test only; no sustained daily capacity, provider CPU/duration, internet latency, mobile radio loss or deployment SLA inferred." };
  await mkdir("output", { recursive: true });
  await writeFile("output/cloud-load-results.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  for (const entry of waiting.values()) clearTimeout(entry.timer);
  for (const ws of sockets) ws.close(1000);
}
