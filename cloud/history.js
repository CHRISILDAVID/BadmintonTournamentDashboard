import { check } from "./security.js";
import { pendingOpponent, scoringRules } from "../shared/format.js";

export function historyLimit(value, fallback = 10, maximum = 50) {
  if (value === null || value === undefined || value === "") return fallback;
  check(/^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) >= 1 && Number(value) <= maximum,
    `Page size must be between 1 and ${maximum}.`);
  return Number(value);
}
export function historyCursor(value = "") {
  check(typeof value === "string" && (!value || /^\d+$/.test(value)) && Number.isSafeInteger(Number(value)) && Number(value) >= 0, "Invalid history cursor.");
  return Number(value);
}

// Result labels are facts from the completed final. No third-place ranking is
// inferred, and reopened/corrected finals immediately replace these placings.
export function categoryHistory(state, category, teams, matches, archivedAt = null) {
  const final = matches.find(m => m.stage === "Final" && m.status === "completed" && m.winner);
  const label = id => {
    const team = teams.find(t => t.id === id);
    return team ? { id: team.id, name: team.name, players: team.players } : null;
  };
  const runner = final && (final.winner === final.a ? final.b : final.winner === final.b ? final.a : null);
  return {
    id: category.id, name: category.name, size: category.size, groups: category.groups,
    status: final ? "completed" : !matches.length ? "registration" : matches.every(m => m.status === "upcoming") ? "ready" : "ongoing",
    teams: teams.length, matches: matches.length, completedMatches: matches.filter(m => m.status === "completed").length,
    winner: final ? label(final.winner) : null, runnerUp: runner ? label(runner) : null,
    completedAt: final?.completedAt || null, archivedAt, eventName: state.event.name,
  };
}

// Per-event read projection. Responses query bounded SQL pages; large fixtures
// never travel to the maintainer just to render ten category summaries.
export class EventHistory {
  constructor(event) {
    this.event = event;
    this.sql = event.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS history_categories (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, archived INTEGER NOT NULL, summary TEXT NOT NULL, config TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS history_entries (category TEXT NOT NULL, id TEXT NOT NULL, position INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(category,id));
      CREATE INDEX IF NOT EXISTS history_entry_page ON history_entries(category,position);
      CREATE TABLE IF NOT EXISTS history_matches (category TEXT NOT NULL, id TEXT NOT NULL, position INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(category,id));
      CREATE INDEX IF NOT EXISTS history_match_page ON history_matches(category,position);
    `);
  }
  syncRows(table, category, records) {
    const previous = new Map(this.sql.exec(`SELECT id,position,data FROM ${table} WHERE category=?`, category).toArray().map(r => [r.id, r]));
    records.forEach((record, position) => {
      const data = JSON.stringify(record), old = previous.get(record.id);
      if (!old || old.position !== position || old.data !== data)
        this.sql.exec(`INSERT INTO ${table}(category,id,position,data) VALUES(?,?,?,?) ON CONFLICT(category,id) DO UPDATE SET position=excluded.position,data=excluded.data`, category, record.id, position, data);
      previous.delete(record.id);
    });
    for (const id of previous.keys()) this.sql.exec(`DELETE FROM ${table} WHERE category=? AND id=?`, category, id);
  }
  capture(state, category, archivedAt = null) {
    const teams = state.teams.filter(t => t.tournamentId === category.id).sort((a, b) => a.seed - b.seed || a.id.localeCompare(b.id));
    const matches = state.matches.filter(m => m.tournamentId === category.id);
    const summary = JSON.stringify(categoryHistory(state, category, teams, matches, archivedAt));
    const config = JSON.stringify(category);
    const old = this.sql.exec("SELECT summary,config,archived FROM history_categories WHERE id=?", category.id).toArray()[0];
    if (!old || old.summary !== summary || old.config !== config || old.archived !== Number(!!archivedAt))
      this.sql.exec("INSERT INTO history_categories(id,archived,summary,config) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET archived=excluded.archived,summary=excluded.summary,config=excluded.config", category.id, Number(!!archivedAt), summary, config);
    this.syncRows("history_entries", category.id, teams.map(t => ({ id: t.id, name: t.name, players: t.players, seed: t.seed, group: t.group })));
    const names = new Map(teams.map(t => [t.id, t.name]));
    this.syncRows("history_matches", category.id, matches.map(m => ({
      id: m.id, a: names.get(m.a) || pendingOpponent(m, "a"), b: names.get(m.b) || pendingOpponent(m, "b"),
      stage: m.stage, group: m.group, round: m.round, status: m.status, court: m.court, scheduled: m.scheduled || null,
      games: m.games, winner: names.get(m.winner) || null, bye: !!m.bye, completedAt: m.completedAt || null,
    })));
  }
  beforeStateChange(previous, next) {
    if (!previous?.tournaments.length) return;
    const retained = new Set(next.tournaments.map(t => t.id));
    // Deletion remains an organizer operation; retain its last recorded data
    // for maintainer history in the same transaction as the existing delete.
    for (const category of previous.tournaments)
      if (!retained.has(category.id)) this.capture(previous, category, new Date().toISOString());
  }
  sync() {
    const state = this.event.get("state");
    check(state, "Event not found.", 404);
    if (this.event.get("historyRevision") !== state.revision) this.event.ctx.storage.transactionSync(() => {
      for (const category of state.tournaments) this.capture(state, category);
      this.event.put("historyRevision", state.revision);
    });
    return state;
  }
  summary(state = this.sync()) {
    const counts = this.sql.exec("SELECT COUNT(*) AS tournaments,COALESCE(SUM(archived),0) AS archived,COALESCE(SUM(CASE WHEN json_extract(summary,'$.status')='completed' THEN 1 ELSE 0 END),0) AS completed FROM history_categories").one();
    return { event: { name: state.event.name, venue: state.event.venue, courts: state.event.courts }, ...counts };
  }
  page({ after = "", limit = 10, revision } = {}) {
    const state = this.sync();
    this.checkRevision(state, revision);
    const size = historyLimit(limit), cursor = historyCursor(after);
    const rows = this.sql.exec("SELECT seq,summary FROM history_categories WHERE seq>? ORDER BY seq LIMIT ?", cursor, size + 1).toArray();
    return { ...this.summary(state), revision: state.revision, items: rows.slice(0, size).map(r => JSON.parse(r.summary)),
      total: this.sql.exec("SELECT COUNT(*) AS n FROM history_categories").one().n,
      nextCursor: rows.length > size ? String(rows[size - 1].seq) : null, limit: size };
  }
  category(id, { view = "matches", after = "", limit = 20, revision } = {}) {
    const state = this.sync();
    this.checkRevision(state, revision);
    check(["matches", "entries"].includes(view), "Choose matches or entries.");
    const row = this.sql.exec("SELECT summary,config FROM history_categories WHERE id=?", id).toArray()[0];
    check(row, "Sub-tournament not found.", 404);
    const size = historyLimit(limit, 20), cursor = historyCursor(after), table = view === "matches" ? "history_matches" : "history_entries";
    // Position is zero-based internally; the external cursor is the next
    // position to read, so an empty cursor includes the first record.
    const rows = this.sql.exec(`SELECT position,data FROM ${table} WHERE category=? AND position>=? ORDER BY position LIMIT ?`, id, cursor, size + 1).toArray();
    const config = JSON.parse(row.config);
    return { event: { name: state.event.name, venue: state.event.venue }, revision: state.revision, tournament: JSON.parse(row.summary),
      rules: { league: scoringRules(config), knockout: scoringRules(config, "Final") }, view,
      items: rows.slice(0, size).map(r => JSON.parse(r.data)), total: this.sql.exec(`SELECT COUNT(*) AS n FROM ${table} WHERE category=?`, id).one().n,
      nextCursor: rows.length > size ? String(rows[size - 1].position + 1) : null, limit: size };
  }
  checkRevision(state, revision) {
    check(revision === undefined || revision === null || String(state.revision) === String(revision), "Event history changed. Refresh this view to continue.", 409);
  }
}
