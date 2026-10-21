import { DurableObject } from "cloudflare:workers";
import { token, digest, json, check, cookie, readJson, secretMatches } from "./security.js";
export { TournamentEvent } from "./event.js";
const MAINTAINER_AGE = 7 * 24 * 60 * 60;
const maintenanceCookie = (secret, age = MAINTAINER_AGE) =>
  `sh_maintainer=${secret}; Path=/api/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;
const maintenanceToken = request => request.headers.get("Cookie")?.split(";").map(s => s.trim())
  .find(s => s.startsWith("sh_maintainer="))?.slice(14) || "";
const sameOrigin = (request, url) => check(request.headers.get("Origin") === url.origin, "Open this website before making changes.", 403);
async function maintenanceSession(request, env) {
  const secret = maintenanceToken(request);
  check(env.PROVISIONING_SECRET && /^[a-f0-9]{64}$/.test(secret), "Unlock the maintainer page to continue.", 401);
  const hash = await digest(secret);
  const session = await env.DIRECTORY.getByName("owners").maintenanceSession(hash, await digest(env.PROVISIONING_SECRET));
  check(session, "Maintainer access expired or was revoked. Unlock the page again.", 401);
  return { hash, ...session };
}

// A single coordinator plus a UNIQUE primary key enforces one event per identity
// even when provisioning requests arrive simultaneously.
export class OwnerDirectory extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS owners (owner TEXT PRIMARY KEY, event TEXT UNIQUE NOT NULL)");
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS maintainer_sessions (hash TEXT PRIMARY KEY, expires INTEGER NOT NULL, credential TEXT NOT NULL)");
  }
  createMaintenanceSession(hash, credential) {
    const expires = Date.now() + MAINTAINER_AGE * 1000;
    this.ctx.storage.sql.exec("DELETE FROM maintainer_sessions WHERE expires<=? OR credential<>?", Date.now(), credential);
    this.ctx.storage.sql.exec("INSERT INTO maintainer_sessions(hash,expires,credential) VALUES(?,?,?)", hash, expires, credential);
    return { expires };
  }
  maintenanceSession(hash, credential) {
    return this.ctx.storage.sql.exec("SELECT expires FROM maintainer_sessions WHERE hash=? AND credential=? AND expires>?", hash, credential, Date.now()).toArray()[0] || null;
  }
  endMaintenanceSession(hash, all = false) {
    if (all) this.ctx.storage.sql.exec("DELETE FROM maintainer_sessions");
    else this.ctx.storage.sql.exec("DELETE FROM maintainer_sessions WHERE hash=?", hash);
  }
  listOwners(after = "") {
    check(typeof after === "string" && (!after || /^[a-zA-Z0-9_-]{3,100}$/.test(after)), "Invalid directory cursor.");
    const rows = this.ctx.storage.sql.exec("SELECT owner,event FROM owners WHERE owner>? ORDER BY owner LIMIT 101", after).toArray();
    return { owners: rows.slice(0, 100), nextCursor: rows.length > 100 ? rows[99].owner : null };
  }
  async provision(owner) {
    check(typeof owner === "string" && /^[a-zA-Z0-9_-]{3,100}$/.test(owner), "Use a stable owner identifier (3–100 letters, digits, _ or -).");
    const sql = this.ctx.storage.sql;
    let row = sql.exec("SELECT event FROM owners WHERE owner=?", owner).toArray()[0];
    if (!row) {
      row = { event: crypto.randomUUID() };
      sql.exec("INSERT INTO owners(owner,event) VALUES(?,?)", owner, row.event);
    }
    const secret = token();
    const created = await this.env.EVENTS.getByName(row.event).initialize(row.event, await digest(secret));
    check(created, `This organizer already owns event ${row.event}. Use their recovery link.`, 409);
    return { eventId: row.event, token: secret };
  }
  async recover(owner) {
    check(typeof owner === "string", "Owner identifier required.");
    const row = this.ctx.storage.sql.exec("SELECT event FROM owners WHERE owner=?", owner).toArray()[0];
    check(row, "Organizer identity not found.", 404);
    const secret = token();
    await this.env.EVENTS.getByName(row.event).maintainerRecovery(await digest(secret));
    return { eventId: row.event, token: secret };
  }
}
export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (!url.pathname.startsWith("/api/")) {
        const response = await env.ASSETS.fetch(request);
        const headers = new Headers(response.headers);
        headers.set("Referrer-Policy", "no-referrer");
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("X-Frame-Options", "DENY");
        return new Response(response.body, { status: response.status, headers });
      }
      if (url.pathname.startsWith("/api/maintainer/")) {
        const directory = env.DIRECTORY.getByName("owners");
        if (url.pathname === "/api/maintainer/session" && request.method === "POST") {
          sameOrigin(request, url);
          const body = await readJson(request, 4096);
          check(env.PROVISIONING_SECRET && typeof body.secret === "string" &&
            await secretMatches(body.secret, env.PROVISIONING_SECRET), "Maintainer secret was not accepted.", 403);
          const secret = token(), hash = await digest(secret);
          const session = await directory.createMaintenanceSession(hash, await digest(env.PROVISIONING_SECRET));
          return json(session, 200, { "Set-Cookie": maintenanceCookie(secret) });
        }
        const session = await maintenanceSession(request, env);
        if (url.pathname === "/api/maintainer/session") {
          check(request.method === "GET", "GET or POST required.", 405);
          return json({ expires: session.expires });
        }
        if (url.pathname === "/api/maintainer/owners") {
          check(request.method === "GET", "GET required.", 405);
          return json(await directory.listOwners(url.searchParams.get("after") || ""));
        }
        if (["/api/maintainer/logout", "/api/maintainer/logout-all"].includes(url.pathname)) {
          check(request.method === "POST", "POST required.", 405); sameOrigin(request, url);
          await directory.endMaintenanceSession(session.hash, url.pathname.endsWith("logout-all"));
          return json({ ok: true }, 200, { "Set-Cookie": maintenanceCookie("", 0) });
        }
        check(false, "Maintainer operation not found.", 404);
      }
      if (["/api/provision", "/api/maintainer-recovery"].includes(url.pathname)) {
        check(request.method === "POST", "POST required.", 405);
        const authorization = request.headers.get("Authorization");
        if (authorization) check(env.PROVISIONING_SECRET && await secretMatches(authorization, `Bearer ${env.PROVISIONING_SECRET}`), "Provisioning denied.", 403);
        else { sameOrigin(request, url); await maintenanceSession(request, env); }
        const body = await readJson(request);
        const directory = env.DIRECTORY.getByName("owners");
        const result = url.pathname === "/api/provision" ? await directory.provision(body.owner) : await directory.recover(body.owner);
        return json({ eventId: result.eventId, setupUrl: `${url.origin}/#invite=${result.eventId}.${result.token}` }, 201);
      }
      if (request.method !== "GET" || request.headers.get("Upgrade")?.toLowerCase() === "websocket")
        check(request.headers.get("Origin") === url.origin, "Open this website before making changes.", 403);
      if (url.pathname === "/api/redeem") {
        check(request.method === "POST", "POST required.", 405);
        const body = await readJson(request);
        check(typeof body.eventId === "string" && /^[a-f0-9-]{36}$/.test(body.eventId), "Invalid invitation.");
        check(typeof body.token === "string" && /^[a-f0-9]{64}$/.test(body.token), "Invalid invitation.");
        return env.EVENTS.getByName(body.eventId).fetch(new Request(request.url, { method: "POST", headers: request.headers, body: JSON.stringify(body) }));
      }
      const auth = cookie(request);
      check(auth.eventId && /^[a-f0-9-]{36}$/.test(auth.eventId) && /^[a-f0-9]{64}$/.test(auth.secret || ""), "Open your invitation or recovery link to access this event.", 401);
      check(!url.searchParams.has("eventId") || url.searchParams.get("eventId") === auth.eventId, "Event access denied.", 403);
      check(!request.headers.has("X-Shuttle-Event") || request.headers.get("X-Shuttle-Event") === auth.eventId, "Browser access changed. Reload before continuing.", 401);
      return env.EVENTS.getByName(auth.eventId).fetch(request);
    } catch (error) {
      return json({ error: error.status ? error.message : "Cloud service unavailable. Pending scores remain on this device." }, error.status || 503);
    }
  },
};
