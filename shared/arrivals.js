import { canStart, isCustomGame } from "./matches.js";

const timestamp = value => typeof value === "string" && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;

// Arrival belongs to a tournament team. Availability also respects players
// appearing in other teams/categories, just like the court conflict checks.
export function matchArrivals(state) {
  const teams = new Map(state.teams.map(t => [t.id, t]));
  const availableSince = new Map(state.teams.map(t => [t.id, timestamp(t.arrivedAt)]));
  const playing = new Set();
  for (const m of state.matches) {
    if (m.status === "live") for (const id of [m.a, m.b])
      for (const player of teams.get(id)?.players || []) playing.add(player.toLowerCase());
    if (m.status === "completed" && !m.bye) {
      const finished = timestamp(m.completedAt);
      for (const id of [m.a, m.b]) {
        const arrived = availableSince.get(id);
        if (arrived != null && finished != null) availableSince.set(id, Math.max(arrived, finished));
      }
    }
  }
  return new Map(state.matches.filter(m => m.status === "upcoming" && !isCustomGame(m)).map(m => {
    if (!canStart(m)) return [m.id, { ready: false, label: "Awaiting opponents" }];
    const sides = [teams.get(m.a), teams.get(m.b)];
    const missing = sides.filter(t => availableSince.get(t?.id) == null).length;
    if (missing) return [m.id, { ready: false, label: missing === 2 ? "Teams not checked in" : "1 team not checked in" }];
    if (sides.some(t => t.players.some(p => playing.has(p.toLowerCase()))))
      return [m.id, { ready: false, label: "Players already on court" }];
    const times = sides.map(t => availableSince.get(t.id));
    return [m.id, { ready: true, waitingSince: Math.min(...times), readySince: Math.max(...times) }];
  }));
}

export function sortByArrival(matches, arrivals) {
  return [...matches].sort((a, b) => {
    const first = arrivals.get(a.id), second = arrivals.get(b.id);
    return Number(!!second?.ready) - Number(!!first?.ready) ||
      (first?.ready && second?.ready ? first.waitingSince - second.waitingSince || first.readySince - second.readySince : 0);
  });
}

export function arrivalLabel(arrival, now = Date.now()) {
  if (!arrival?.ready) return arrival?.label || "";
  const minutes = Math.max(0, Math.floor((now - arrival.waitingSince) / 60000));
  return minutes ? `Ready · Waiting ${minutes} min` : "Ready · Waiting less than 1 min";
}
