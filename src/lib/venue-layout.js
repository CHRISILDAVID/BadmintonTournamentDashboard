export const BREAKPOINTS = { desktop: 1200, tablet: 768, phone: 0 };
export const COLUMNS = { desktop: 12, tablet: 6, phone: 1 };
export const ROW_HEIGHT = 24;
export const GAP = 16;
export const selectionKey = ids => JSON.stringify([...ids].sort());
export const breakpointFor = width => width >= 1200 ? "desktop" : width >= 768 ? "tablet" : "phone";

export function defaultLayouts(ids, availableHeight = 720) {
  return Object.fromEntries(Object.entries(COLUMNS).map(([breakpoint, cols]) => {
    const across = breakpoint === "phone" ? 1 : breakpoint === "tablet" ? Math.min(2, ids.length || 1) : ids.length <= 3 ? Math.max(1, ids.length) : 2;
    const w = cols / across;
    const minH = breakpoint === "phone" ? 20 : 18;
    const h = Math.max(minH, Math.min(80, Math.floor((availableHeight + GAP) / (ROW_HEIGHT + GAP))));
    return [breakpoint, ids.map((i, index) => ({ i, x: (index % across) * w, y: Math.floor(index / across) * h, w, h,
      minW: breakpoint === "phone" ? 1 : breakpoint === "tablet" ? 3 : 4, minH }))];
  }));
}
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const integer = (n, fallback, min, max) => Math.max(min, Math.min(max, Number.isInteger(n) ? n : fallback));

// Treat persisted browser data as untrusted; repair stale IDs and overlapping cells.
export function normalizeLayout(input, defaults, cols) {
  const byId = new Map((Array.isArray(input) ? input : []).filter(x => x && typeof x.i === "string").map(x => [x.i, x]));
  const layout = defaults.map(base => {
    const item = byId.get(base.i) || base;
    const w = integer(item.w, base.w, base.minW, cols);
    return { ...base, w, h: integer(item.h, base.h, base.minH, 80),
      x: integer(item.x, base.x, 0, cols - w), y: integer(item.y, base.y, 0, 20000) };
  }).sort((a, b) => a.y - b.y || a.x - b.x);
  const placed = [];
  for (const item of layout) {
    let collisions;
    while ((collisions = placed.filter(other => overlap(item, other))).length)
      item.y = Math.max(...collisions.map(other => other.y + other.h));
    placed.push(item);
  }
  return layout;
}
export function resolveLayouts(saved, defaults) {
  return Object.fromEntries(Object.keys(COLUMNS).map(bp => [bp, normalizeLayout(saved?.[bp], defaults[bp], COLUMNS[bp])]));
}
export function reorderPanel(layout, id, offset, cols) {
  const ordered = [...layout].sort((a, b) => a.y - b.y || a.x - b.x).map(item => ({ ...item }));
  const index = ordered.findIndex(item => item.i === id), target = index + offset;
  if (index < 0 || target < 0 || target >= ordered.length) return layout;
  [ordered[index].x, ordered[target].x] = [ordered[target].x, ordered[index].x];
  [ordered[index].y, ordered[target].y] = [ordered[target].y, ordered[index].y];
  return normalizeLayout(ordered, ordered, cols);
}

export function cleanSelection(selection) {
  const ids = [...new Set(Array.isArray(selection?.ids) ? selection.ids.filter(id => typeof id === "string" && id.length <= 100) : [])].slice(0, 256);
  return { count: integer(selection?.count, 1, 0, 256), ids };
}
