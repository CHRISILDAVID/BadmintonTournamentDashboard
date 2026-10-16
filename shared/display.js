import { standings } from "./standings.js";

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
  const hasLeague = matches.some((m) => m.stage === "League");
  const completed = matches
    .filter((m) => m.status === "completed")
    .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
  const groups = hasLeague
    ? Array.from({ length: tournament.groups }, (_, group) => ({
        key: `group-${group}`,
        label: `Group ${String.fromCharCode(65 + group)}`,
        rows: standings(state, tournamentId, group),
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
  const final = matches.find((m) => m.stage === "Final" && m.winner);
  return {
    tournament,
    groups,
    resultGroups: hasLeague
      ? groups.map(({ key, label, results }) => ({ key, label, results }))
      : [],
    knockoutResults,
    hasLeague,
    completed: completed.length,
    total: matches.length,
    champion: final ? state.teams.find((t) => t.id === final.winner) : null,
    onCourt: matches
      .filter((m) => m.status === "live")
      .sort((a, b) => a.court - b.court),
  };
}

export function resultScore(match) {
  // Always put the displayed winner first, even if it was opponent B.
  return match.games
    .map(([a, b]) => (match.winner === match.b ? [b, a] : [a, b]).join("–"))
    .join(" / ");
}
