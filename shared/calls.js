export const canCall = (match) =>
  match.status === "upcoming" && !match.held && !!match.a && !!match.b;

// A manual order takes precedence over planned times. Newly eligible fixtures
// join the end; untouched events continue to use their scheduled order.
export function callQueue(state) {
  if (!state) return [];
  const rank = new Map((state.callOrder || []).map((id, i) => [id, i]));
  return state.matches.filter(canCall).sort((a, b) => {
    const priority =
      (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER);
    return priority || (a.scheduled || "z").localeCompare(b.scheduled || "z");
  });
}
