export function hasLeagueDraw(state, tournamentId) {
  return !!state.tournaments.find(t => t.id === tournamentId)?.leagueGenerated ||
    state.matches.some(m => m.tournamentId === tournamentId) ||
    state.teams.some(t => t.tournamentId === tournamentId && t.group != null);
}

export function leagueEntryLockReason(state, tournamentId) {
  if (!state.tournaments.some(t => t.id === tournamentId)) return "Tournament not found.";
  return state.matches.some(m => m.tournamentId === tournamentId && m.stage !== "League")
    ? "Team entries are locked after the playoff or knockout draw is created." : "";
}

export function groupEditLockReason(state, tournamentId) {
  const tournament = state.tournaments.find((t) => t.id === tournamentId);
  if (!tournament) return "Tournament not found.";
  if (tournament.groups < 2) return "This tournament has only one group.";
  const matches = state.matches.filter((m) => m.tournamentId === tournamentId);
  if (!hasLeagueDraw(state, tournamentId)) return "Create fixtures before editing groups.";
  if (matches.some((m) => m.status === "completed"))
    return "Groups are locked after the first completed match.";
  if (matches.some((m) => m.stage !== "League"))
    return "Groups cannot change after creating the knockout draw.";
  return "";
}
