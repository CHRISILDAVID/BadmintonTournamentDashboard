import { isKnockoutOnly, isLinkedPlayoffs } from "./format.js";

export function hasLeagueDraw(state, tournamentId) {
  const tournament = state.tournaments.find(t => t.id === tournamentId);
  if (isKnockoutOnly(tournament)) return false;
  return !!tournament?.leagueGenerated ||
    state.matches.some(m => m.tournamentId === tournamentId) ||
    state.teams.some(t => t.tournamentId === tournamentId && t.group != null);
}

export function teamEntryLockReason(state, tournamentId) {
  const tournament = state.tournaments.find(t => t.id === tournamentId);
  if (!tournament) return "Tournament not found.";
  if (isLinkedPlayoffs(tournament)) return "Teams qualify from the linked categories.";
  return state.matches.some(m => m.tournamentId === tournamentId && m.stage !== "League")
    ? "Team entries are locked after the playoff or knockout draw is created." : "";
}

export function groupEditLockReason(state, tournamentId) {
  const tournament = state.tournaments.find((t) => t.id === tournamentId);
  if (!tournament) return "Tournament not found.";
  if (isKnockoutOnly(tournament)) return "This tournament uses a knockout bracket.";
  if (tournament.groups < 2) return "This tournament has only one group.";
  const matches = state.matches.filter((m) => m.tournamentId === tournamentId);
  if (!hasLeagueDraw(state, tournamentId)) return "Create fixtures before editing groups.";
  if (matches.some((m) => m.status === "completed"))
    return "Groups are locked after the first completed match.";
  if (matches.some((m) => m.stage !== "League"))
    return "Groups cannot change after creating the knockout draw.";
  return "";
}
