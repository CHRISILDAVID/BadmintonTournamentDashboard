import { DurableObject } from "cloudflare:workers";
import { token, digest, json, check, cookie, readJson } from "./security.js";
export { TournamentEvent } from "./event.js";

// A single coordinator plus a UNIQUE primary key enforces one event per identity
// even when provisioning requests arrive simultaneously.
export class OwnerDirectory extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS owners (owner TEXT PRIMARY KEY, event TEXT UNIQUE NOT NULL)");
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
      if (["/api/provision", "/api/maintainer-recovery"].includes(url.pathname)) {
        check(request.method === "POST", "POST required.", 405);
        check(env.PROVISIONING_SECRET && request.headers.get("Authorization") === `Bearer ${env.PROVISIONING_SECRET}`, "Provisioning denied.", 403);
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
