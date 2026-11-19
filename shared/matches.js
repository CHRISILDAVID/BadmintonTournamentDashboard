import { hasLeagueDraw } from "./groups.js";

export const hasTournamentDraw = (state, tournamentId) =>
  state.matches.some(m => m.tournamentId === tournamentId) || hasLeagueDraw(state, tournamentId);

export const canResetFixtures = (matches) =>
  matches.every(m => m.status === "upcoming" || (m.status === "completed" && m.bye));

// Read games saved before standalone games were renamed from Friendly to Custom.
export const isCustomGame = match => ["custom", "friendly"].includes(match?.kind);
export const matchStageLabel = match => isCustomGame(match) ? "Custom" : match.stage;
export const matchesFilter = (match, filter) => filter === "all" ||
  (["custom", "friendly"].includes(filter) ? isCustomGame(match) : match.tournamentId === filter);
export const matchCategory = (match, tournament) => isCustomGame(match) ? "Custom" : tournament?.name;

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
  const tournament = state.tournaments.find(t => t.id === tournamentId);
  const matches = state.matches.filter((m) => m.tournamentId === tournamentId);
  const league = matches.filter((m) => m.stage === "League");
  const postseason = matches.some((m) => m.stage !== "League");
  const remaining = league.filter((m) => m.status !== "completed").length;
  const champion = matches.find((m) => m.stage === "Final" && m.winner);
  const hasLeague = hasLeagueDraw(state, tournamentId);
  const qualifiers = Array.from({ length: tournament?.groups || 0 }, (_, group) =>
    Math.min(tournament.qualify, state.teams.filter(t => t.tournamentId === tournamentId && t.group === group).length),
  ).reduce((total, count) => total + count, 0);
  return {
    hasFixtures: matches.length > 0 || hasLeague,
    postseason,
    remaining,
    champion,
    canCreateKnockouts: hasLeague && remaining === 0 && !postseason &&
      qualifiers >= 2,
  };
}
