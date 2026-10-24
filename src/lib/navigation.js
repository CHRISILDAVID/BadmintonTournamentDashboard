export const PAGE_PATHS = {
  Overview: "/", Tournaments: "/tournaments", "Teams & players": "/teams",
  Matches: "/matches", History: "/matches/history", Standings: "/standings",
  Settings: "/settings", Display: "/display",
};
export function readRoute(location = { pathname: "/", search: "" }) {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const page = Object.keys(PAGE_PATHS).find(page => PAGE_PATHS[page] === path) || "Not found";
  const params = new URLSearchParams(location.search);
  return {
    page, filter: params.get("tournament") === "friendly" ? "custom" : params.get("tournament") || "all",
    teamQuery: page === "Teams & players" ? params.get("q") || "" : "",
    matchQuery: ["Matches", "History"].includes(page) ? params.get("q") || "" : "",
    matchStatus: ["live", "upcoming", "completed"].includes(params.get("status")) ? params.get("status") : "all",
    matchStage: ["League", "postseason"].includes(params.get("stage")) ? params.get("stage") : "all",
  };
}
export function routeHref(state) {
  const params = new URLSearchParams();
  if (state.filter && state.filter !== "all" && state.page !== "Display") params.set("tournament", state.filter);
  const query = state.page === "Teams & players" ? state.teamQuery : ["Matches", "History"].includes(state.page) ? state.matchQuery : "";
  if (query) params.set("q", query);
  if (state.page === "Matches") {
    if (state.matchStatus && state.matchStatus !== "all") params.set("status", state.matchStatus);
    if (state.matchStage && state.matchStage !== "all") params.set("stage", state.matchStage);
  }
  return (PAGE_PATHS[state.page] || "/") + (params.size ? `?${params}` : "");
}
