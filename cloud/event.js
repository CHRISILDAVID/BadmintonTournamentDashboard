import { DurableObject } from "cloudflare:workers";
import { emptyState, applyAction, validateGames } from "../server/engine.js";
import { scoringRules } from "../shared/format.js";
import { newScore, reduceScore, publicScore } from "../shared/live-scoring.js";
import { token, digest, json, check, cookie, sessionCookie, manager, readJson } from "./security.js";

const DAY = 86400000;
const encode = JSON.stringify;
export class TournamentEvent extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.metrics = { httpRequests: 0, webSocketMessages: 0, sqlRowsRead: 0, sqlRowsWritten: 0, handlerWallMs: 0 };
    // Cursor counters include SQLite index work. These observations reset on
    // hibernation/redeploy and are deliberately not presented as billing metrics.
    const raw = this.sql, metrics = this.metrics;
    this.sql = {
      get databaseSize() { return raw.databaseSize; },
      exec(...args) {
        const cursor = raw.exec(...args), rows = cursor.toArray();
        metrics.sqlRowsRead += cursor.rowsRead; metrics.sqlRowsWritten += cursor.rowsWritten;
        return { toArray: () => rows, one: () => { if (rows.length !== 1) throw new Error("Expected one row."); return rows[0]; },
          [Symbol.iterator]: () => rows[Symbol.iterator]() };
      },
    };
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS documents (key TEXT NOT NULL, part INTEGER NOT NULL, value TEXT NOT NULL, PRIMARY KEY(key,part));
      CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, role TEXT NOT NULL, name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, hash TEXT UNIQUE NOT NULL, profile TEXT NOT NULL, role TEXT NOT NULL, expires INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0, preset TEXT);
      CREATE TABLE IF NOT EXISTS invitations (hash TEXT PRIMARY KEY, role TEXT NOT NULL, profile TEXT NOT NULL, expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0, preset TEXT);
      CREATE TABLE IF NOT EXISTS assignments (match TEXT PRIMARY KEY, profile TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS assignment_profile ON assignments(profile);
      CREATE TABLE IF NOT EXISTS scores (match TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS controllers (match TEXT NOT NULL, generation INTEGER NOT NULL, session TEXT NOT NULL, PRIMARY KEY(match,generation));
      CREATE TABLE IF NOT EXISTS actions (id TEXT PRIMARY KEY, match TEXT NOT NULL, generation INTEGER NOT NULL, seq INTEGER NOT NULL, session TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS action_match ON actions(match,generation,seq);
      CREATE TABLE IF NOT EXISTS rejected (id TEXT PRIMARY KEY, match TEXT NOT NULL, session TEXT NOT NULL, payload TEXT NOT NULL, reason TEXT NOT NULL, resolved TEXT);
      CREATE TABLE IF NOT EXISTS presets (id TEXT PRIMARY KEY, data TEXT NOT NULL);
    `);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }
  get(key) {
    const row = this.sql.exec("SELECT value FROM meta WHERE key=?", key).toArray()[0];
    if (!row) return null;
    if (row.value.startsWith("@chunks:"))
      return JSON.parse(this.sql.exec("SELECT value FROM documents WHERE key=? ORDER BY part", key).toArray().map(r => r.value).join(""));
    return JSON.parse(row.value);
  }
  put(key, value) {
    const serialized = encode(value), chunkSize = 200000;
    this.sql.exec("DELETE FROM documents WHERE key=?", key);
    if (serialized.length > chunkSize) {
      let part = 0;
      for (let i = 0; i < serialized.length;) {
        let end = Math.min(i + chunkSize, serialized.length);
        const last = serialized.charCodeAt(end - 1);
        if (end < serialized.length && last >= 0xd800 && last <= 0xdbff) end--;
        this.sql.exec("INSERT INTO documents VALUES(?,?,?)", key, part++, serialized.slice(i, end));
        i = end;
      }
      this.sql.exec("INSERT INTO meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", key, `@chunks:${part}`);
    } else this.sql.exec("INSERT INTO meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", key, serialized);
  }
  initialize(eventId, setupHash) {
    return this.ctx.storage.transactionSync(() => {
      if (this.get("eventId")) return false;
      this.put("eventId", eventId); this.put("state", emptyState());
      const profile = crypto.randomUUID();
      this.sql.exec("INSERT INTO profiles VALUES(?,?,?)", profile, "owner", "Primary organizer");
      this.sql.exec("INSERT INTO invitations(hash,role,profile,expires) VALUES(?,?,?,?)", setupHash, "owner", profile, Date.now() + DAY);
      return true;
    });
  }
  maintainerRecovery(hash) {
    this.ctx.storage.transactionSync(() => {
      const owner = this.sql.exec("SELECT id FROM profiles WHERE role='owner'").one();
      this.sql.exec("UPDATE invitations SET used=1 WHERE profile=? AND role IN ('owner','recovery')", owner.id);
      this.sql.exec("INSERT INTO invitations(hash,role,profile,expires) VALUES(?,?,?,?)", hash, "recovery", owner.id, Date.now() + DAY);
    });
  }
  session(hash) {
    const s = this.sql.exec("SELECT * FROM sessions WHERE hash=? AND revoked=0 AND expires>?", hash, Date.now()).toArray()[0];
    check(s, "Session expired or revoked. Open a valid invitation or recovery link.", 401);
    return s;
  }
  sessionById(id) { return this.sql.exec("SELECT * FROM sessions WHERE id=? AND revoked=0 AND expires>?", id, Date.now()).toArray()[0]; }
  score(id) {
    const r = this.sql.exec("SELECT data FROM scores WHERE match=?", id).toArray()[0];
    return r ? JSON.parse(r.data) : null;
  }
  saveScore(record) { this.sql.exec("INSERT INTO scores VALUES(?,?) ON CONFLICT(match) DO UPDATE SET data=excluded.data", record.matchId, encode(record)); }
  canScore(s) {
    return ["owner", "organizer", "umpire"].includes(s.role);
  }
  testToolsEnabled(s) {
    return [true, "true"].includes(this.env.ENABLE_TEST_TOOLS) && ["owner", "organizer"].includes(s.role);
  }
  canSee(s, matchId, record) {
    if (s.role !== "display") return this.canScore(s);
    const preset = this.preset(s.preset), context = (record || this.score(matchId))?.context;
    if (!preset || !context) return true;
    return (!preset.courts.length || preset.courts.includes(context.court)) &&
      (!preset.categories.length || preset.categories.includes(context.category)) &&
      (!preset.finals || context.stage === "Final");
  }
  me(s) { return { eventId: this.get("eventId"), sessionId: s.id, profile: s.profile, role: s.role, expires: s.expires, preset: s.preset, cloud: true }; }
  snapshot(s) {
    const state = this.get("state");
    if (s.role === "display") {
      const preset = this.preset(s.preset);
      if (!preset?.categories.length) return state;
      const ids = new Set(preset.categories);
      return { ...state, tournaments: state.tournaments.filter(t => ids.has(t.id)),
        teams: state.teams.filter(t => ids.has(t.tournamentId)), matches: state.matches.filter(m => ids.has(m.tournamentId)) };
    }
    if (s.role !== "umpire") return state;
    return { revision: state.revision, event: state.event, matches: state.matches,
      teams: state.teams, tournaments: state.tournaments };
  }
  live(s) {
    const matchIds = new Set(this.get("state").matches.map(m => m.id));
    const contacts = new Map();
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      const key = `${a.matchId}:${a.session}:${a.generation}`;
      if (a.matchId && this.sessionById(a.session)) contacts.set(key, Math.max(contacts.get(key) || 0, a.contactAt || 0));
    }
    return this.sql.exec("SELECT data FROM scores").toArray().map(r => JSON.parse(r.data))
      .filter(r => matchIds.has(r.matchId) && this.canSee(s, r.matchId, r)).map(r => publicScore({ ...r, contactAt: Math.max(r.contactAt || 0, contacts.get(`${r.matchId}:${r.controller}:${r.generation}`) || 0) }));
  }
  broadcast(type, payload, matchId) {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        const a = ws.deserializeAttachment(), s = this.sessionById(a.session);
        if (!s) { ws.close(4001, "Access revoked or expired"); continue; }
        if (!matchId || this.canSee(s, matchId)) ws.send(encode({ type, ...payload }));
      } catch { try { ws.close(1011, "Reconnect"); } catch {} }
    }
  }
  closeRevoked() {
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (!this.sessionById(a.session)) ws.close(4001, "Access revoked");
    }
  }
  async fetch(request) {
    const started = performance.now(); this.metrics.httpRequests++;
    try { return await this.handleRequest(request); }
    finally { this.metrics.handlerWallMs += performance.now() - started; }
  }
  async handleRequest(request) {
    try {
      const url = new URL(request.url), path = url.pathname, method = request.method;
      const hash = path === "/api/redeem" ? null : await digest(cookie(request).secret || "");
      if (hash) this.session(hash);
      // Size limit is application-specific and applies before JSON parsing.
      let body = {};
      if (method === "POST") {
        body = await readJson(request, path === "/api/import" || path === "/api/action" ? 8 * 1024 * 1024 : path === "/api/preset" ? 256 * 1024 : 16384);
      }
      if (path === "/api/redeem") {
        const invitationHash = await digest(body.token), secret = token(), sessionHash = await digest(secret);
        const recovery = token(), recoveryHash = await digest(recovery);
        const result = this.ctx.storage.transactionSync(() => {
          const invite = this.sql.exec("SELECT * FROM invitations WHERE hash=? AND used=0 AND expires>?", invitationHash, Date.now()).toArray()[0];
          check(invite, "Invitation is invalid, expired, or already used.", 403);
          if (invite.role !== "display") this.sql.exec("UPDATE invitations SET used=1 WHERE hash=?", invitationHash);
          const role = invite.role === "recovery" ? "owner" : invite.role;
          if (invite.role === "recovery") {
            this.sql.exec("UPDATE sessions SET revoked=1 WHERE profile=?", invite.profile);
            this.invalidateProfile(invite.profile, "Owner recovered access");
          }
          const id = crypto.randomUUID(), expires = Math.min(Date.now() + 30 * DAY, invite.role === "display" ? invite.expires : Infinity);
          this.sql.exec("INSERT INTO sessions(id,hash,profile,role,expires,preset) VALUES(?,?,?,?,?,?)", id, sessionHash, invite.profile, role, expires, invite.preset);
          if (role === "owner") {
            this.sql.exec("UPDATE invitations SET used=1 WHERE role='recovery' AND profile=?", invite.profile);
            this.sql.exec("INSERT INTO invitations(hash,role,profile,expires) VALUES(?,?,?,?)", recoveryHash, "recovery", invite.profile, Date.now() + 365 * DAY);
          }
          return { ...this.me({ id, role, profile: invite.profile, expires, preset: invite.preset }),
            recovery: role === "owner" ? `${url.origin}/#invite=${body.eventId}.${recovery}` : undefined };
        });
        this.closeRevoked(); this.broadcast("refresh", {});
        return json(result, 200, { "Set-Cookie": sessionCookie(body.eventId, secret) });
      }
      const s = this.session(hash);
      check(!request.headers.has("X-Shuttle-Session") || request.headers.get("X-Shuttle-Session") === s.id, "Browser access changed. Reload before continuing.", 401);
      check(!url.searchParams.has("sessionId") || url.searchParams.get("sessionId") === s.id, "Browser access changed. Reload before continuing.", 401);
      if (path === "/api/socket") {
        check(method === "GET" && request.headers.get("Upgrade")?.toLowerCase() === "websocket", "WebSocket required.", 426);
        const pair = new WebSocketPair();
        this.ctx.acceptWebSocket(pair[1]); pair[1].serializeAttachment({ session: s.id });
        pair[1].send(encode({ type: "snapshot", state: this.snapshot(s), live: this.live(s), preset: this.preset(s.preset) }));
        return new Response(null, { status: 101, webSocket: pair[0] });
      }
      if (method === "GET") {
        if (path === "/api/me") return json(this.me(s));
        if (path === "/api/state") return json(this.snapshot(s));
        if (path === "/api/live") return json({ live: this.live(s), preset: this.preset(s.preset) });
        if (path === "/api/features") return json({ cloud: true, testTools: this.testToolsEnabled(s) });
        manager(s);
        if (path === "/api/access") return json({
          profiles: this.sql.exec("SELECT * FROM profiles").toArray(),
          sessions: this.sql.exec("SELECT id,profile,role,expires,revoked,preset FROM sessions").toArray(),
          assignments: this.sql.exec("SELECT * FROM assignments").toArray(),
          presets: this.sql.exec("SELECT data FROM presets").toArray().map(r => JSON.parse(r.data)),
          invitations: this.sql.exec("SELECT rowid AS id,role,profile,expires,used FROM invitations").toArray(),
          rejected: this.sql.exec("SELECT * FROM rejected WHERE resolved IS NULL LIMIT 200").toArray(),
        });
        if (path === "/api/export") return this.exportBackup();
        if (path === "/api/usage") return json({ acceptedActions: this.sql.exec("SELECT COUNT(*) AS n FROM actions").one().n,
          rejectedActions: this.sql.exec("SELECT COUNT(*) AS n FROM rejected").one().n,
          connectedSockets: this.ctx.getWebSockets().length, databaseBytes: this.ctx.storage.sql.databaseSize,
          observedSinceWake: { ...this.metrics },
          note: "Event-local counts. Since-wake counters reset on hibernation/redeploy; handler wall time is not billable compute duration. SQL cursor counts include index work. Check Cloudflare for shared account billing quotas." });
      }
      check(method === "POST", "Unknown endpoint.", 404);
      // Prepare random material before entering the synchronous transaction.
      const secret = token(), secretHash = await digest(secret);
      let change = null;
      const result = this.ctx.storage.transactionSync(() => {
        const current = this.session(hash); // Revalidate after awaits.
        if (path === "/api/claim") {
          check(this.canScore(current), "Scoring access required.", 403);
          check(typeof body.device === "string" && body.device.length >= 16 && body.device.length <= 100, "Invalid controller.");
          const state = this.get("state"), match = state.matches.find(m => m.id === body.matchId);
          check(match?.status === "live", "Start this match on a court before claiming scoring control.", 409);
          let r = this.score(match.id);
          check(!r?.invalidated, "Organizer must reconcile/reset this score before control can be claimed.", 409);
          if (!r) r = { matchId: match.id, generation: 1, revision: 0, seq: 0, score: newScore(match, scoringRules(state.tournaments.find(t => t.id === match.tournamentId), match.stage, match)) };
          check(!r.controller || (r.controller === current.id && r.device === body.device), "Another device controls this match. Ask an organizer to transfer control.", 409);
          r.controller = current.id; r.device = body.device; r.contactAt = Date.now();
          r.context = { court: match.court, category: match.tournamentId, stage: match.stage };
          this.sql.exec("INSERT OR IGNORE INTO controllers VALUES(?,?,?)", r.matchId, r.generation, current.id);
          this.saveScore(r); change = { type: "score", payload: { record: publicScore(r) }, matchId: r.matchId };
          return r;
        }
        if (path === "/api/score") {
          const out = this.acceptScore(current, body);
          if (out.accepted) change = out.finalized ? { type: "refresh", payload: {} } :
            { type: "score", payload: { record: publicScore(out.record) }, matchId: body.matchId };
          return out;
        }
        if (path === "/api/logout") {
          this.sql.exec("UPDATE sessions SET revoked=1 WHERE id=?", current.id);
          return { ok: true };
        }
        if (path === "/api/action") {
          if (current.role === "umpire") {
            check(["schedule", "start", "returnMatch", "finish", "correctResult", "knockouts"].includes(body.action), "This action requires organizer access.", 403);
          } else manager(current);
          check(!["demo", "practice", "clearDemo"].includes(body.action), "Sample event tools are disabled in cloud events.", 403);
          if (body.action === "randomComplete") check(this.testToolsEnabled(current), "Enable cloud testing tools to generate random results.", 403);
          const before = this.get("state");
          check(body.revision === before.revision, "The event changed. Reload and retry.", 409);
          const next = applyAction(before, body.action, body.payload);
          this.invalidateChanged(before, next);
          this.put("state", next); change = { type: "refresh", payload: {} }; return next;
        }
        manager(current);
        if (path === "/api/invite") {
          check(["organizer", "umpire", "display"].includes(body.role), "Invalid invitation role.");
          if (body.role === "display") check(this.preset(body.preset), "Select a screen preset.");
          const profile = crypto.randomUUID(), name = String(body.name || body.role).slice(0, 100);
          this.sql.exec("INSERT INTO profiles VALUES(?,?,?)", profile, body.role, name);
          const invitationSeconds = Math.min(900, Math.max(1, Number(this.env.INVITATION_TTL_SECONDS) || 900));
          const expires = Date.now() + (body.role === "display" ? 30 * DAY : invitationSeconds * 1000);
          this.sql.exec("INSERT INTO invitations(hash,role,profile,expires,preset) VALUES(?,?,?,?,?)", secretHash, body.role, profile, expires, body.preset || null);
          return { profile, expires, url: `${url.origin}/${body.role === "display" ? "display" : ""}#invite=${this.get("eventId")}.${secret}` };
        }
        if (path === "/api/assign") {
          check(this.get("state").matches.some(m => m.id === body.matchId), "Match not found.");
          check(this.sql.exec("SELECT id FROM profiles WHERE id=? AND role='umpire'", body.profile).toArray()[0], "Choose an umpire.");
          const previous = this.sql.exec("SELECT profile FROM assignments WHERE match=?", body.matchId).toArray()[0];
          this.sql.exec("INSERT INTO assignments VALUES(?,?) ON CONFLICT(match) DO UPDATE SET profile=excluded.profile", body.matchId, body.profile);
          if (previous?.profile !== body.profile) this.transfer(body.matchId);
          change = { type: "refresh", payload: {} }; return { ok: true };
        }
        if (path === "/api/transfer") {
          this.transfer(body.matchId, body.reset === true);
          change = { type: "refresh", payload: {} }; return { ok: true };
        }
        if (path === "/api/revoke") {
          if (body.sessionId) {
            const victim = this.sql.exec("SELECT * FROM sessions WHERE id=?", body.sessionId).toArray()[0];
            check(victim && (current.role === "owner" || victim.role !== "owner"), "Cannot revoke this session.", 403);
            this.sql.exec("UPDATE sessions SET revoked=1 WHERE id=?", victim.id);
          } else {
            const profile = this.sql.exec("SELECT * FROM profiles WHERE id=?", body.profile).toArray()[0];
            check(profile && (current.role === "owner" || profile.role !== "owner"), "Cannot revoke this profile.", 403);
            this.sql.exec("UPDATE sessions SET revoked=1 WHERE profile=?", profile.id);
            this.sql.exec("UPDATE invitations SET used=1 WHERE profile=?", profile.id);
          }
          change = { type: "refresh", payload: {} }; return { ok: true };
        }
        if (path === "/api/recovery") {
          check(current.role === "owner", "Only the primary organizer can rotate recovery.", 403);
          this.sql.exec("UPDATE invitations SET used=1 WHERE profile=? AND role='recovery'", current.profile);
          this.sql.exec("INSERT INTO invitations(hash,role,profile,expires) VALUES(?,?,?,?)", secretHash, "recovery", current.profile, Date.now() + 365 * DAY);
          return { url: `${url.origin}/#invite=${this.get("eventId")}.${secret}` };
        }
        if (path === "/api/preset") {
          const p = { id: body.id || crypto.randomUUID(), name: String(body.name || "Main screen").slice(0, 100),
            courts: Array.isArray(body.courts) ? body.courts.filter(n => Number.isInteger(n) && n >= 1 && n <= 32) : [],
            categories: Array.isArray(body.categories) ? body.categories.filter(n => typeof n === "string").slice(0, 100) : [],
            finals: !!body.finals, layout: body.layout || null, updatedAt: Date.now() };
          check(typeof p.id === "string" && p.id.length <= 100, "Invalid preset.");
          this.sql.exec("INSERT INTO presets VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data", p.id, encode(p));
          change = { type: "refresh", payload: {} }; return p;
        }
        if (path === "/api/reconcile") {
          check(typeof body.note === "string" && body.note.trim().length >= 3, "Record the reconciliation decision.");
          this.sql.exec("UPDATE rejected SET resolved=? WHERE id=?", String(body.note).slice(0, 500), body.id);
          return { ok: true };
        }
        if (path === "/api/import") {
          check(current.role === "owner", "Only the primary organizer can migrate an event.", 403);
          check(body.destination === this.get("eventId"), "Confirm the exact destination event.");
          const before = this.get("state");
          check(!before.tournaments.length && !before.teams.length && !before.matches.length, "Destination must be empty. Existing events are never overwritten.", 409);
          const backup = body.backup;
          check(["shuttlehub-v1", "shuttlehub-cloud-v1"].includes(backup?.format), "Unsupported backup.");
          const next = this.validateImport(backup.state);
          this.put("preMigrationBackup", before);
          next.revision = before.revision + 1; this.put("state", next);
          // Preserve historical cloud scoring as evidence; controllers are never restored.
          if (backup.format === "shuttlehub-cloud-v1") this.put("importedScoringArchive", { scoring: backup.scoring, actions: backup.actions, rejected: backup.rejected });
          change = { type: "refresh", payload: {} }; return next;
        }
        check(false, "Unknown endpoint.", 404);
      });
      if (path === "/api/revoke" || path === "/api/logout") this.closeRevoked();
      if (change) this.broadcast(change.type, change.payload, change.matchId);
      return json(result, 200, path === "/api/logout" ? { "Set-Cookie": sessionCookie("", "", 0) } : {});
    } catch (error) {
      if (!error.status && /SQLITE|quota|storage|overloaded|exceeded/i.test(error.message || ""))
        return json({ error: "Cloud storage is unavailable. Pending scores remain on this device; retry when service recovers." }, 503);
      return json({ error: error.status ? error.message : error.message || "Event unavailable. Retry safely." }, error.status || 400);
    }
  }
  preset(id) { const row = id && this.sql.exec("SELECT data FROM presets WHERE id=?", id).toArray()[0]; return row ? JSON.parse(row.data) : null; }
  exportBackup() {
    // Capture the tournament and audit high-water marks synchronously. Accepted
    // actions are immutable; bounded batches exclude actions accepted later.
    const base = { format: "shuttlehub-cloud-v1", eventId: this.get("eventId"), exportedAt: new Date().toISOString(), state: this.get("state"),
      importedScoringArchive: this.get("importedScoringArchive"), preMigrationBackup: this.get("preMigrationBackup"),
      scoring: this.sql.exec("SELECT data FROM scores").toArray().map(r => JSON.parse(r.data)),
      presets: this.sql.exec("SELECT data FROM presets").toArray().map(r => JSON.parse(r.data)) };
    const tables = ["actions", "rejected"].map(table => ({ table, last: this.sql.exec(`SELECT COALESCE(MAX(rowid),0) AS n FROM ${table}`).one().n }));
    const sql = this.sql;
    function* chunks() {
      yield encode(base).slice(0, -1);
      for (const { table, last } of tables) {
        yield `,"${table}":[`;
        let after = 0, first = true;
        while (after < last) {
          const rows = sql.exec(`SELECT rowid AS exportRow,* FROM ${table} WHERE rowid>? AND rowid<=? ORDER BY rowid LIMIT 256`, after, last).toArray();
          if (!rows.length) break;
          for (const { exportRow, ...row } of rows) { yield `${first ? "" : ","}${encode(row)}`; first = false; after = exportRow; }
        }
        yield "]";
      }
      yield "}";
    }
    const iterator = chunks(), encoder = new TextEncoder();
    return new Response(new ReadableStream({
      pull(controller) { const next = iterator.next(); if (next.done) controller.close(); else controller.enqueue(encoder.encode(next.value)); },
      cancel() { iterator.return(); },
    }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Content-Disposition": 'attachment; filename="shuttlehub-backup.json"' } });
  }
  transfer(matchId, reset = false) {
    const r = this.score(matchId);
    if (!r) return;
    r.generation++; r.seq = 0; r.controller = null; r.device = null; r.contactAt = 0;
    if (reset) {
      const state = this.get("state"), m = state.matches.find(m => m.id === matchId);
      check(m?.status === "live", "Only on-court matches can restart scoring.");
      r.score = newScore(m, scoringRules(state.tournaments.find(t => t.id === m.tournamentId), m.stage, m));
      r.invalidated = null; r.revision++;
    }
    this.saveScore(r);
  }
  invalidateProfile(profile, reason) {
    for (const { data } of this.sql.exec("SELECT data FROM scores")) {
      const r = JSON.parse(data);
      const s = r.controller && this.sql.exec("SELECT profile FROM sessions WHERE id=?", r.controller).toArray()[0];
      if (s?.profile === profile) { this.transfer(r.matchId); }
    }
  }
  invalidateChanged(before, next) {
    const signature = (state, id) => {
      const m = state.matches.find(m => m.id === id);
      return m ? encode([m.a, m.b, m.status, m.games, scoringRules(state.tournaments.find(t => t.id === m.tournamentId), m.stage, m)]) : null;
    };
    for (const { data } of this.sql.exec("SELECT data FROM scores")) {
      const r = JSON.parse(data);
      if (signature(before, r.matchId) !== signature(next, r.matchId)) {
        r.generation++; r.seq = 0; r.controller = null; r.device = null; r.revision++;
        r.invalidated = "Match status, opponents, result or scoring rules changed. Review history and explicitly restart scoring.";
        this.saveScore(r);
      }
    }
  }
  acceptScore(s, a) {
    check(s.role !== "display", "Read-only access.", 403);
    check(encode(a).length <= 2048, "Scoring action too large.", 413);
    check(typeof a.id === "string" && a.id.length <= 100 && a.id.length >= 16 &&
      typeof a.matchId === "string" && a.eventId === this.get("eventId") &&
      Number.isSafeInteger(a.seq) && Number.isSafeInteger(a.generation) && Number.isSafeInteger(a.revision), "Invalid scoring envelope.");
    const previous = this.sql.exec("SELECT * FROM actions WHERE id=?", a.id).toArray()[0];
    if (previous) {
      check(previous.session === s.id && previous.payload === encode(a), "Action ID was already used.", 409);
      const record = this.score(a.matchId);
      // A retry acknowledges its own historical action, never discloses the
      // replacement controller's record after control changed.
      const obsolete = !this.canScore(s) || !record || record.generation !== a.generation || record.controller !== s.id || !!record.invalidated;
      return { accepted: true, duplicate: true, ...(obsolete ? { obsolete: true } : { record }) };
    }
    const r = this.score(a.matchId);
    const allowed = this.canScore(s);
    const reason = !allowed ? "Scoring access required" : !r || r.generation !== a.generation || r.controller !== s.id || r.device !== a.device
      ? "Controller replaced" : r.invalidated;
    if (reason) {
      // Only retain evidence from a session that actually wrote/claimed this match.
      const known = r?.controller === s.id || this.sql.exec("SELECT session FROM controllers WHERE match=? AND generation=? AND session=?", a.matchId, a.generation, s.id).toArray()[0];
      if (known) this.sql.exec("INSERT OR IGNORE INTO rejected(id,match,session,payload,reason) VALUES(?,?,?,?,?)", a.id, a.matchId, s.id, encode(a), reason);
      return { accepted: false, conflict: true, error: `${reason}. Pending work retained for organizer reconciliation.` };
    }
    check(a.seq === r.seq + 1 && a.revision === r.revision, "Scoring sequence differs. Reconcile before continuing.", 409);
    // Every management mutation invalidates changed match/rule generations.
    // Ordinary points therefore use the compact authoritative scoring record,
    // without reading/parsing a potentially multi-megabyte tournament snapshot.
    const occurredAt = Math.max(r.score.startedAt, r.lastActionAt || 0, Math.min(Date.now(), Number.isFinite(a.clientTime) ? a.clientTime : Date.now()));
    const next = reduceScore(r.score, a, occurredAt);
    r.lastActionAt = occurredAt;
    r.score = next; r.seq = a.seq; r.revision++; r.contactAt = Date.now();
    if (a.type === "confirm") {
      const state = this.get("state"), match = state.matches.find(m => m.id === a.matchId);
      check(match?.status === "live", "This match is no longer on court.", 409);
      check(encode(r.score.rules) === encode(scoringRules(state.tournaments.find(t => t.id === match.tournamentId), match.stage, match)), "Scoring rules changed.", 409);
      validateGames(next.games, next.rules);
      const updated = applyAction(state, "finish", { matchId: match.id, games: next.games });
      this.invalidateChanged(state, updated);
      this.put("state", updated);
    }
    this.sql.exec("INSERT INTO actions VALUES(?,?,?,?,?,?)", a.id, a.matchId, a.generation, a.seq, s.id, encode(a));
    this.saveScore(r);
    return { accepted: true, record: r, finalized: a.type === "confirm" };
  }
  webSocketMessage(ws, raw) {
    this.metrics.webSocketMessages++;
    try {
      check(typeof raw === "string" && raw.length <= 2048, "Invalid message.");
      const s = this.sessionById(ws.deserializeAttachment().session);
      if (!s) { ws.close(4001, "Access revoked or expired"); return; }
      const message = JSON.parse(raw);
      if (message.type === "contact") {
        const r = this.score(message.matchId);
        check(r && r.controller === s.id && r.device === message.device && r.generation === message.generation && this.canScore(s), "Controller replaced.", 403);
        // Freshness is connection state: no periodic SQL write or server timer.
        const a = ws.deserializeAttachment();
        ws.serializeAttachment({ ...a, matchId: r.matchId, generation: r.generation, contactAt: Date.now() });
        this.broadcast("contact", { matchId: r.matchId, contactAt: Date.now() }, r.matchId);
      } else if (message.type === "snapshot") ws.send(encode({ type: "snapshot", state: this.snapshot(s), live: this.live(s), preset: this.preset(s.preset) }));
      else check(false, "Unsupported WebSocket operation.");
    } catch { ws.send(encode({ type: "error", error: "Live operation denied. Refresh access." })); }
  }
  webSocketClose(ws, code, reason) { try { ws.close(code === 1005 ? 1000 : code, reason); } catch {} }
  webSocketError(ws) { try { ws.close(1011, "Reconnect"); } catch {} }
  validateImport(input) {
    check(input && typeof input.event?.name === "string" && Number.isInteger(input.event.courts) && input.event.courts >= 1 && input.event.courts <= 32, "Invalid event settings.");
    const s = structuredClone(input);
    for (const key of ["tournaments", "teams", "matches"]) {
      check(Array.isArray(s[key]), `Invalid ${key}.`);
      const ids = new Set();
      for (const row of s[key]) { check(typeof row.id === "string" && !ids.has(row.id), `Duplicate or invalid ${key} ID.`); ids.add(row.id); }
    }
    const teams = new Set(s.teams.map(t => t.id)), categories = new Set(s.tournaments.map(t => t.id));
    for (const t of s.tournaments) applyAction(emptyState(), "tournament", t);
    for (const t of s.teams) check(categories.has(t.tournamentId) && Array.isArray(t.players) && t.players.every(p => typeof p === "string"), "Invalid team.");
    const courts = new Set(), players = new Set();
    for (const m of s.matches) {
      check(categories.has(m.tournamentId) && (!m.a || teams.has(m.a)) && (!m.b || teams.has(m.b)) &&
        [m.a, m.b].filter(Boolean).every(id => s.teams.find(t => t.id === id)?.tournamentId === m.tournamentId), "Invalid match references.");
      check(["upcoming", "live", "completed"].includes(m.status), "Invalid match status.");
      if (m.status === "completed" && !m.bye) {
        const winner = validateGames(m.games, scoringRules(s.tournaments.find(t => t.id === m.tournamentId), m.stage, m));
        check(m.winner === [m.a, m.b][winner], "Result winner differs from scores.");
      }
      if (m.status === "live") {
        check(m.a && m.b && Number.isInteger(m.court) && m.court >= 1 && m.court <= s.event.courts && !courts.has(m.court), "Invalid or occupied court.");
        courts.add(m.court);
        for (const id of [m.a, m.b]) for (const p of s.teams.find(t => t.id === id).players) {
          check(!players.has(p.toLowerCase()), "Player is on two courts."); players.add(p.toLowerCase());
        }
      }
    }
    return s;
  }
}
