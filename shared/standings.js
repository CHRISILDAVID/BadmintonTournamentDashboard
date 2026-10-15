export function standings(state, tournamentId, group) {
  const rows = state.teams
    .filter(
      (t) =>
        t.tournamentId === tournamentId &&
        (group === undefined || t.group === group),
    )
    .map((t) => ({
      ...t,
      played: 0,
      wins: 0,
      losses: 0,
      gameDiff: 0,
      pointDiff: 0,
    }));
  for (const m of state.matches.filter(
    (m) =>
      m.tournamentId === tournamentId &&
      m.stage === "League" &&
      m.status === "completed",
  )) {
    for (const [i, tid] of [m.a, m.b].entries()) {
      const r = rows.find((t) => t.id === tid);
      if (!r) continue;
      r.played++;
      r.wins += m.winner === tid ? 1 : 0;
      r.losses += m.winner !== tid ? 1 : 0;
      for (const s of m.games) {
        r.gameDiff += s[i] > s[1 - i] ? 1 : -1;
        r.pointDiff += s[i] - s[1 - i];
      }
    }
  }
  return rows.sort(
    (a, b) =>
      b.wins - a.wins ||
      b.gameDiff - a.gameDiff ||
      b.pointDiff - a.pointDiff ||
      a.seed - b.seed ||
      a.name.localeCompare(b.name),
  );
}
