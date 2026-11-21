import { isKnockoutOnly, isLinkedPlayoffs } from "./format.js";
import { hasLeagueDraw } from "./groups.js";
import { standings } from "./standings.js";

export function linkedSourceSupportsLeague(state, tournament) {
  return !isKnockoutOnly(tournament) && tournament.groups === 1 &&
    !state.matches.some(m => m.tournamentId === tournament.id && m.stage !== "League");
}

export function qualifiesFromLeague(state, tournamentId) {
  return linkedLeaguePlaces(state, tournamentId) > 0;
}

export function linkedLeaguePlaces(state, tournamentId) {
  return state.tournaments.reduce((places, t) =>
    isLinkedPlayoffs(t) && t.linkedPlayoffs.sources.some(source => source.tournamentId === tournamentId && source.method === "league")
      ? Math.max(places, t.linkedPlayoffs.mode === "semifinals" ? 2 : 1) : places, 0);
}

export function linkedSourceTeams(state, source) {
  const fixtures = state.matches.filter(m => m.tournamentId === source.tournamentId);
  if (source.method === "league") {
    if (!hasLeagueDraw(state, source.tournamentId) || !fixtures.length ||
      fixtures.some(m => m.stage === "League" && m.status !== "completed")) return [];
    return standings(state, source.tournamentId, 0).map(team => team.id);
  }
  const final = fixtures.find(m => m.stage === "Final" && m.status === "completed" && m.winner);
  return final ? [final.winner, final.winner === final.a ? final.b : final.a] : [];
}

export function linkedEntryConflict(state, tournamentId) {
  const slots = state.matches.filter(m => m.tournamentId === tournamentId && m.round === 1);
  const teams = new Map(state.teams.map(team => [team.id, team]));
  const players = new Set();
  for (const id of slots.flatMap(m => [m.a, m.b]).filter(Boolean)) {
    for (const player of teams.get(id).players) {
      const name = player.trim().toLowerCase();
      if (players.has(name)) return `${player} qualified in both categories. Resolve the duplicate qualification before starting linked playoffs.`;
      players.add(name);
    }
  }
  return "";
}
