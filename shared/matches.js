// Fixture order is for browsing only; any ready game can start.
export const canStart = (match) =>
  match.status === "upcoming" && !!match.a && !!match.b;

export const upcomingMatches = (state) =>
  state ? state.matches.filter(canStart) : [];

// Retire old queue metadata without touching fixtures, scores or court assignments.
export function removeLegacyCalls(state) {
  const changed =
    Object.hasOwn(state, "callOrder") ||
    state.matches.some((m) => Object.hasOwn(m, "held"));
  delete state.callOrder;
  state.matches.forEach((m) => {
    delete m.held;
  });
  return changed;
}

export function tournamentProgress(state, tournamentId) {
  const matches = state.matches.filter((m) => m.tournamentId === tournamentId);
  const league = matches.filter((m) => m.stage === "League");
  const postseason = matches.some((m) => m.stage !== "League");
  const remaining = league.filter((m) => m.status !== "completed").length;
  const champion = matches.find((m) => m.stage === "Final" && m.winner);
  return {
    hasFixtures: !!matches.length,
    postseason,
    remaining,
    champion,
    canCreateKnockouts: league.length > 0 && remaining === 0 && !postseason,
  };
}
