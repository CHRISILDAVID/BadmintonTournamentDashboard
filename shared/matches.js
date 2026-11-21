import { hasLeagueDraw } from "./groups.js";
import { isLinkedPlayoffs } from "./format.js";
import { qualifiesFromLeague } from "./linked-playoffs.js";

export const hasTournamentDraw = (state, tournamentId) =>
  state.matches.some(m => m.tournamentId === tournamentId) || hasLeagueDraw(state, tournamentId);

export const canResetFixtures = (matches) =>
  matches.every(m => m.status === "upcoming" || (m.status === "completed" && m.bye));

// Read games saved before standalone games were renamed from Friendly to Custom.
export const isCustomGame = match => ["custom", "friendly"].includes(match?.kind);
export function matchStageLabel(match, tournaments = []) {
  if (isCustomGame(match)) return "Custom";
  if (match.stage !== "Final" && match.stage !== "Semifinal") return match.stage;
  for (const t of tournaments) {
    if (!isLinkedPlayoffs(t)) continue;
    if (t.id === match.tournamentId)
      return match.stage === "Final" ? "Grand Final" : `Grand Semifinal ${match.index + 1}`;
    if (match.stage === "Final" && t.linkedPlayoffs.sources.some(source => source.tournamentId === match.tournamentId))
      return "Category Final";
  }
  return match.stageLabel ?? match.stage;
}
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
    canCreateKnockouts: hasLeague && remaining === 0 && !postseason && !qualifiesFromLeague(state, tournamentId) &&
      qualifiers >= 2,
  };
}
