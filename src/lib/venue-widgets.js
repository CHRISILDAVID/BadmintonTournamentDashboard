import { normalizeLayout, reorderPanel } from "./venue-layout.js";

export const WIDGETS = {
  live: "Live scores",
  standings: "League standings", upcoming: "Up next", results: "Latest results",
  playoffs: "Playoffs", knockouts: "Knockouts",
};
export const WIDGET_BREAKPOINTS = { desktop: 900, tablet: 560, phone: 0 };
export const WIDGET_COLUMNS = { desktop: 12, tablet: 6, phone: 1 };
export const WIDGET_ROW = 16;
export const WIDGET_GAP = 12;
export const widgetBreakpoint = width => width >= 900 ? "desktop" : width >= 560 ? "tablet" : "phone";
export function cleanLiveScoreLayout(value) {
  return { position: value?.position === "top" ? "top" : "tournament", flow: value?.flow === "wrap" ? "wrap" : "horizontal" };
}
export function visibleWidgets(data, preferences = {}) {
  const automatic = {
    live: !!data.onCourt?.length,
    standings: data.showLeagueStandings,
    upcoming: !data.hasKnockouts,
    results: !data.hasKnockouts,
    playoffs: data.playoffs.some(match => match.status !== "completed"),
    knockouts: data.hasKnockouts,
  };
  return Object.keys(WIDGETS).filter(id => preferences.visibility?.[id] === "show" ||
    (preferences.visibility?.[id] !== "hide" && automatic[id]));
}
export function cleanWidgetPreferences(value) {
  const visibility = Object.fromEntries(Object.keys(WIDGETS).map(id => [
    id, ["show", "hide"].includes(value?.visibility?.[id]) ? value.visibility[id] : "auto",
  ]));
  const layouts = value?.layouts && typeof value.layouts === "object" && !Array.isArray(value.layouts) ? value.layouts : {};
  return { visibility, layouts };
}
export function widgetDefaults(ids, breakpoint, height = 600) {
  const cols = WIDGET_COLUMNS[breakpoint], stacked = breakpoint === "phone";
  const rows = stacked ? ids.length : ids.length <= 1 ? 1 : 1 + Math.ceil((ids.length - 1) / 2);
  const h = Math.max(8, Math.min(80, Math.floor((height + WIDGET_GAP) / (rows || 1) / (WIDGET_ROW + WIDGET_GAP))));
  return ids.map((i, index) => ({
    i, x: stacked || index === 0 ? 0 : ((index - 1) % 2) * cols / 2,
    y: stacked ? index * h : index === 0 ? 0 : (1 + Math.floor((index - 1) / 2)) * h,
    w: stacked || index === 0 || (index === ids.length - 1 && ids.length % 2 === 0) ? cols : cols / 2, h,
    minW: stacked ? 1 : cols / 2, minH: 8,
  }));
}
export function widgetLayout(preferences, ids, breakpoint, height) {
  return normalizeLayout(preferences?.layouts?.[breakpoint], widgetDefaults(ids, breakpoint, height), WIDGET_COLUMNS[breakpoint]);
}
// Keep hidden widgets' positions so adding one back restores its previous size.
export function rememberWidgetLayout(previous, visible) {
  const ids = new Set(visible.map(item => item.i));
  return [...(Array.isArray(previous) ? previous : []).filter(item => item && WIDGETS[item.i] && !ids.has(item.i)), ...visible];
}
export function keyboardWidgetLayout(layout, id, key, resize, cols) {
  const item = layout.find(item => item.i === id);
  if (!item) return layout;
  if (!resize && (key === "ArrowUp" || key === "ArrowDown"))
    return reorderPanel(layout, id, key === "ArrowUp" ? -1 : 1, cols);
  const dimension = resize ? (key === "ArrowLeft" || key === "ArrowRight" ? "w" : "h") : "x";
  const delta = key === "ArrowLeft" || key === "ArrowUp" ? -1 : 1;
  return normalizeLayout(layout.map(item => item.i === id ? { ...item, [dimension]: item[dimension] + delta } : item), layout, cols);
}
