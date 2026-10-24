import { standings } from "./standings.js";
import { hasLeagueDraw } from "./groups.js";
import { PLAYOFF_STAGE, qualificationStatus, groupLabel } from "./format.js";
import { isFriendly } from "./matches.js";

export function displayTournamentOptions(state) {
  const priority = (t) => {
    const matches = state.matches.filter((m) => m.tournamentId === t.id);
    if (matches.some((m) => m.status !== "completed")) return 0;
    return matches.length ? 2 : 1;
  };
  return [...state.tournaments].sort((a, b) => priority(a) - priority(b));
}

// Keep selections distinct and valid when organizers add/delete categories.
export function resolveDisplaySelection(tournaments, selection = {}) {
  const requested = Number(selection.count);
  const count = Math.min(
    tournaments.length,
    Math.max(1, Number.isInteger(requested) ? requested : 1),
  );
  const valid = new Set(tournaments.map((t) => t.id));
  const ids = [
    ...new Set(
      (Array.isArray(selection.ids) ? selection.ids : []).filter((id) =>
        valid.has(id),
      ),
    ),
  ];
  for (const t of tournaments) if (!ids.includes(t.id)) ids.push(t.id);
  return { count, ids: ids.slice(0, count) };
}

export function tournamentDisplayData(state, tournamentId) {
  const tournament = state.tournaments.find((t) => t.id === tournamentId);
  if (!tournament) return null;
  const matches = state.matches.filter((m) => m.tournamentId === tournamentId);
  const hasLeague = hasLeagueDraw(state, tournamentId);
  const completed = matches
    .filter((m) => m.status === "completed" && !m.bye)
    .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
  const groups = hasLeague
    ? Array.from({ length: tournament.groups }, (_, group) => ({
        key: `group-${group}`,
        label: `Group ${groupLabel(group)}`,
        rows: standings(state, tournamentId, group).map((row, rank) => ({
          ...row,
          qualificationStatus: qualificationStatus(
            state,
            tournament,
            row,
            rank,
          ),
        })),
        results: completed.filter(
          (m) => m.stage === "League" && m.group === group,
        ),
      }))
    : [
        {
          key: "entries",
          label: "Entries · draw pending",
          rows: standings(state, tournamentId),
          results: [],
        },
      ];
  const knockoutResults = completed.filter((m) => m.stage !== "League");
  const playoffs = matches
    .filter((m) => m.stage === PLAYOFF_STAGE)
    .sort((a, b) => a.group - b.group || a.qualifyingSlot - b.qualifyingSlot);
  const knockouts = matches.filter(
    (m) => m.stage !== "League" && m.stage !== PLAYOFF_STAGE,
  );
  const knockoutRounds = [...new Set(knockouts.map((m) => m.round))]
    .sort((a, b) => a - b)
    .map((round) => {
      const fixtures = knockouts
        .filter((m) => m.round === round)
        .sort((a, b) => a.index - b.index);
      return { round, stage: fixtures[0].stage, matches: fixtures };
    });
  const final = matches.find((m) => m.stage === "Final" && m.winner);
  return {
    tournament,
    groups,
    resultGroups: hasLeague
      ? groups.map(({ key, label, results }) => ({ key, label, results }))
      : [],
    knockoutResults,
    playoffs,
    knockoutRounds,
    hasKnockouts: knockoutRounds.length > 0,
    showLeagueStandings:
      knockoutRounds.length === 0 ||
      playoffs.some((m) => m.status !== "completed"),
    hasLeague,
    completed: completed.length,
    total: matches.filter(m => !m.bye).length,
    champion: final ? state.teams.find((t) => t.id === final.winner) : null,
    onCourt: matches
      .filter((m) => m.status === "live")
      .sort((a, b) => a.court - b.court),
  };
}

export function resultScore(match) {
  if (match.bye) return "Bye";
  // Always put the displayed winner first, even if it was opponent B.
  return match.games
    .map(([a, b]) => (match.winner === match.b ? [b, a] : [a, b]).join("–"))
    .join(" / ");
}

// The shared score strip follows screen permissions, independently of the
// tournament panels selected in this browser's layout.
export function liveDisplayMatches(state, preset) {
  const tournaments = new Set(state.tournaments.filter(t => !preset?.categories?.length || preset.categories.includes(t.id)).map(t => t.id));
  return state.matches.filter(m => m.status === "live" && (tournaments.has(m.tournamentId) || (isFriendly(m) && !preset?.categories?.length)) &&
    (!preset?.courts?.length || preset.courts.includes(m.court)) && (!preset?.finals || m.stage === "Final"))
    .sort((a, b) => a.court - b.court);
}
