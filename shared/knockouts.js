import { PLAYOFF_STAGE } from "./format.js";

export const isKnockout = match => match.stage !== "League" && match.stage !== PLAYOFF_STAGE;

// Explicit sources travel with a team when its place in the bracket changes.
export function knockoutSource(matches, match, side) {
  if (match[`${side}Source`]) return match[`${side}Source`];
  if (match.round === 1) return { teamId: match[side], seedMatchId: match.id, seedSide: side };
  const feeder = matches.find(m => m.tournamentId === match.tournamentId && isKnockout(m) &&
    m.round === match.round - 1 && m.index === match.index * 2 + (side === "b" ? 1 : 0));
  return { matchId: feeder?.id, label: `Winner of ${feeder?.stage} ${(feeder?.index ?? 0) + 1}` };
}

export function knockoutSlotLockReason(state, match, side) {
  if (!match || !isKnockout(match) || !["a", "b"].includes(side)) return "Choose a knockout place.";
  if (match.status === "live") return "Return this match to waiting before editing its teams.";
  if (!match.bye) {
    if (match.status === "completed") return "Completed games are locked.";
    return match[side] ? "" : "Awaiting a winner from an earlier game.";
  }
  if (match[side] || match[`${side}Source`]) return "This team has advanced by bye. Select it in its next unplayed game.";
  const fixtures = state.matches.filter(m => m.tournamentId === match.tournamentId && isKnockout(m));
  const positions = new Map(fixtures.map(m => [`${m.round}:${m.index}`, m.id]));
  const dependents = new Map();
  for (const fixture of fixtures) {
    for (const [i, s] of ["a", "b"].entries()) {
      const source = fixture[`${s}Source`];
      const feederId = source ? source.matchId : fixture.round > 1
        ? positions.get(`${fixture.round - 1}:${fixture.index * 2 + i}`) : null;
      if (!feederId) continue;
      if (!dependents.has(feederId)) dependents.set(feederId, []);
      dependents.get(feederId).push(fixture);
    }
  }
  const affected = new Set([match.id]), queue = [match.id];
  for (let index = 0; index < queue.length; index++) {
    for (const fixture of dependents.get(queue[index]) || []) {
      if (affected.has(fixture.id)) continue;
      if (fixture.status === "live" || (fixture.status === "completed" && !fixture.bye))
        return "This bye feeds a game that is on court or completed.";
      affected.add(fixture.id);
      queue.push(fixture.id);
    }
  }
  return "";
}

export function eligibleKnockoutTeams(state, tournamentId) {
  const entered = new Set(state.matches.filter(m => m.tournamentId === tournamentId).flatMap(m =>
    [m.a, m.b, m.aSource?.teamId, m.bSource?.teamId]).filter(Boolean));
  return state.teams.filter(t => t.tournamentId === tournamentId && t.group == null && !entered.has(t.id));
}
