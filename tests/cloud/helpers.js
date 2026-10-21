import { applyAction, emptyState } from "../../server/engine.js";
export const origin = process.env.CLOUD_TEST_ORIGIN || "http://127.0.0.1:8799";
export async function request(path, body, cookie = "", extra = {}) {
  const response = await fetch(`${origin}/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json", ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  return { status: response.status, data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
export async function owner(label = crypto.randomUUID()) {
  const p = await request("provision", { owner: label }, "", { Authorization: "Bearer local-test-secret" });
  if (p.status !== 201) throw new Error(JSON.stringify(p));
  return { ...await redeem(p.data.setupUrl), setupUrl: p.data.setupUrl };
}
export async function redeem(url) {
  const [eventId, token] = new URLSearchParams(new URL(url).hash.slice(1)).get("invite").split(".");
  const r = await request("redeem", { eventId, token });
  if (r.status !== 200) throw new Error(JSON.stringify(r));
  return { ...r.data, cookie: r.cookie };
}
export function fixture(courts = 2, points = 5) {
  let s = applyAction(emptyState(), "event", { name: "Isolation cup", venue: "Test only", courts: Math.max(2, courts), announcement: "" });
  // Separate categories allow courts to start in parallel without shared players.
  for (let court = 1; court <= courts; court++) {
    s = applyAction(s, "tournament", { name: `Doubles ${court}`, size: 2, groups: 1, qualify: 2, points, cap: points + 1, bestOf: 1 });
    const tournamentId = s.tournaments.at(-1).id;
    s = applyAction(s, "teams", { tournamentId, teams: Array.from({ length: 4 }, (_, i) => ({ players: [`C${court} Player ${i} A`, `C${court} Player ${i} B`], seed: i + 1 })) });
    s = applyAction(s, "generate", { tournamentId });
    const m = s.matches.find(m => m.tournamentId === tournamentId);
    s = applyAction(s, "start", { matchId: m.id, court });
  }
  return s;
}
export async function importFixture(o, state = fixture()) {
  const r = await request("import", { destination: o.eventId, backup: { format: "shuttlehub-v1", state } }, o.cookie);
  if (r.status !== 200) throw new Error(JSON.stringify(r));
  return r.data;
}
export async function invitation(o, role, name = role, preset) {
  const r = await request("invite", { role, name, preset }, o.cookie);
  if (r.status !== 200) throw new Error(JSON.stringify(r));
  return r.data;
}
export const envelope = (o, record, type, teamId) => ({
  id: crypto.randomUUID(), eventId: o.eventId, matchId: record.matchId, device: record.device,
  generation: record.generation, seq: record.seq + 1, revision: record.revision, type,
  ...(teamId ? { teamId } : {}), clientTime: Date.now(),
});
