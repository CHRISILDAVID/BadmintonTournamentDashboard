// Pure reducer shared by the phone and the authoritative event coordinator.
// Points are attributed to team IDs, never player labels.
export function newScore(match, rules, now = Date.now()) {
  return { matchId: match.id, teams: [match.a, match.b], rules: structuredClone(rules),
    points: [0, 0], games: [], wins: [0, 0], undo: [], paused: false,
    startedAt: now, pausedAt: null, pausedMs: 0, complete: false, confirmed: false };
}
export function reduceScore(previous, action, now = Date.now()) {
  const s = structuredClone(previous);
  const fail = message => { throw new Error(message); };
  if (s.confirmed) fail("Result already confirmed.");
  if (action.type === "point") {
    if (s.paused || s.complete) fail("Resume play or undo before awarding another point.");
    const side = s.teams.indexOf(action.teamId);
    if (side < 0) fail("Unknown team.");
    s.undo.push({ points: [...s.points], games: structuredClone(s.games), wins: [...s.wins], complete: s.complete });
    s.points[side]++;
    const [a, b] = s.points, hi = Math.max(a, b), lo = Math.min(a, b), r = s.rules;
    const won = r.goldenPoint ? hi >= r.points : hi >= r.points && (hi - lo >= 2 || hi >= r.cap);
    if (won) {
      s.games.push([...s.points]); s.wins[side]++; s.points = [0, 0];
      s.complete = s.wins[side] >= Math.ceil(r.bestOf / 2);
    }
  } else if (action.type === "undo") {
    const prior = s.undo.pop();
    if (!prior) fail("No point to undo.");
    Object.assign(s, prior);
  } else if (action.type === "pause") {
    if (s.paused || s.complete) fail("Match cannot be paused.");
    s.paused = true; s.pausedAt = now;
  } else if (action.type === "resume") {
    if (!s.paused) fail("Match is already playing.");
    s.pausedMs += Math.max(0, now - s.pausedAt); s.paused = false; s.pausedAt = null;
  } else if (action.type === "confirm") {
    if (!s.complete) fail("Finish the required games before confirming.");
    s.confirmed = true; s.endedAt = now;
  } else fail("Unknown scoring action.");
  return s;
}
export function elapsedSeconds(s, now = Date.now()) {
  return Math.max(0, Math.floor(((s.endedAt || (s.paused ? s.pausedAt : now)) - s.startedAt - s.pausedMs) / 1000));
}
export function publicScore(record) {
  if (!record) return null;
  const { undo, ...score } = record.score;
  return { matchId: record.matchId, generation: record.generation, revision: record.revision,
    contactAt: record.contactAt, invalidated: record.invalidated || null, score };
}
