export function groupEditLockReason(state, tournamentId) {
  const tournament = state.tournaments.find((t) => t.id === tournamentId);
  if (!tournament) return "Tournament not found.";
  if (tournament.groups < 2) return "This tournament has only one group.";
  const matches = state.matches.filter((m) => m.tournamentId === tournamentId);
  if (!matches.length) return "Create fixtures before editing groups.";
  if (matches.some((m) => m.status === "completed"))
    return "Groups are locked after the first completed match.";
  if (matches.some((m) => m.stage !== "League"))
    return "Groups cannot change after creating the knockout draw.";
  return "";
}
