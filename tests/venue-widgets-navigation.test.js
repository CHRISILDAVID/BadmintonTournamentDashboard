import test from "node:test";
import assert from "node:assert/strict";
import { createVenueStore, VENUE_STORAGE_KEY } from "../src/stores/venue.js";
import { defaultLayouts, selectionKey } from "../src/lib/venue-layout.js";
import { visibleWidgets, widgetLayout, keyboardWidgetLayout, WIDGET_COLUMNS } from "../src/lib/venue-widgets.js";
import { readRoute, routeHref } from "../src/lib/navigation.js";
import { createOrganizerStore } from "../src/stores/organizer.js";

const memory = initial => {
  const values = new Map(Object.entries(initial || {}));
  return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};
const league = { showLeagueStandings: true, hasKnockouts: false, playoffs: [] };
const knockout = { showLeagueStandings: false, hasKnockouts: true, playoffs: [{ status: "completed" }] };

test("automatic widgets follow phases while explicit visibility survives the final", () => {
  assert.deepEqual(visibleWidgets(league), ["standings", "upcoming", "results"]);
  assert.deepEqual(visibleWidgets({ ...knockout, showLeagueStandings: true, playoffs: [{ status: "upcoming" }] }), ["standings", "playoffs", "knockouts"]);
  assert.deepEqual(visibleWidgets(knockout), ["knockouts"]);
  assert.deepEqual(visibleWidgets(knockout, { visibility: { standings: "show", results: "show", playoffs: "show", knockouts: "hide" } }), ["standings", "results", "playoffs"]);
  assert.deepEqual(visibleWidgets(league, { visibility: { standings: "corrupt" } }), visibleWidgets(league));
});

test("v1 panel layouts migrate intact; widget changes save, cancel, reset and reload together", () => {
  const key = selectionKey(["a"]), layouts = defaultLayouts(["a"]);
  const storage = memory({ [VENUE_STORAGE_KEY]: JSON.stringify({ version: 1, state: { selection: { count: 1, ids: ["a"] }, savedLayouts: { [key]: layouts } } }) });
  const store = createVenueStore(storage);
  assert.deepEqual(store.getState().savedLayouts[key], layouts);
  store.getState().begin(key, layouts);
  store.getState().setWidgetVisibility("a", "standings", "show");
  const custom = widgetLayout({}, ["standings"], "desktop", 500);
  custom[0].h = 25;
  store.getState().updateWidgetLayout("a", "desktop", custom);
  assert.equal(store.getState().save(), true);
  const restored = createVenueStore(storage).getState();
  assert.equal(restored.savedLayouts[key].widgets.a.visibility.standings, "show");
  assert.equal(restored.savedLayouts[key].widgets.a.layouts.desktop[0].h, 25);
  assert.equal(restored.editing, false);
  store.getState().begin(key, restored.savedLayouts[key]);
  store.getState().setWidgetVisibility("a", "standings", "hide");
  store.getState().cancel();
  assert.equal(store.getState().savedLayouts[key].widgets.a.visibility.standings, "show");
  store.getState().begin(key, restored.savedLayouts[key]);
  store.getState().reset(layouts);
  assert.equal(store.getState().draft.widgets, undefined);
  store.getState().save();
  assert.equal(createVenueStore(storage).getState().savedLayouts[key].widgets, undefined);
});

test("hidden widgets retain sizes and invalid widget layouts recover without overlap", () => {
  const store = createVenueStore(memory()), key = selectionKey(["a"]);
  store.getState().begin(key, defaultLayouts(["a"]));
  store.getState().updateWidgetLayout("a", "desktop", [{ i: "standings", x: 0, y: 0, w: 12, h: 30 }]);
  store.getState().updateWidgetLayout("a", "desktop", [{ i: "knockouts", x: 0, y: 0, w: 12, h: 20 }]);
  const widgets = store.getState().draft.widgets.a;
  assert.equal(widgets.layouts.desktop.find(item => item.i === "standings").h, 30);
  for (const bp of Object.keys(WIDGET_COLUMNS)) {
    const layout = widgetLayout({ layouts: { [bp]: [{ i: "standings", w: -10, h: "broken", x: 999, y: -1 }, { i: "deleted", w: 200 }] } }, ["standings", "knockouts", "results"], bp, 200);
    for (const a of layout) {
      assert.ok(a.x >= 0 && a.x + a.w <= WIDGET_COLUMNS[bp] && a.h >= 8);
      for (const b of layout) if (a !== b) assert.ok(!(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y));
    }
  }
});

test("keyboard widget resizing is bounded and reordering preserves every widget", () => {
  const layout = widgetLayout({}, ["standings", "upcoming", "results"], "desktop", 600);
  const reordered = keyboardWidgetLayout(layout, "results", "ArrowUp", false, 12);
  assert.deepEqual(new Set(reordered.map(item => item.i)), new Set(layout.map(item => item.i)));
  assert.ok(reordered.find(item => item.i === "results").x < reordered.find(item => item.i === "upcoming").x);
  const resized = keyboardWidgetLayout(layout, "results", "ArrowDown", true, 12);
  assert.equal(resized.find(item => item.i === "results").h, layout.find(item => item.i === "results").h + 1);
  const narrow = keyboardWidgetLayout(layout, "results", "ArrowLeft", true, 12);
  assert.equal(narrow.find(item => item.i === "results").w, 6);
});

test("failed widget saves retain both the committed layout and unsaved visibility", () => {
  const storage = memory(), store = createVenueStore(storage), key = selectionKey(["a"]), layouts = defaultLayouts(["a"]);
  store.getState().begin(key, layouts); store.getState().save();
  store.getState().begin(key, layouts); store.getState().setWidgetVisibility("a", "results", "hide");
  storage.setItem = () => { throw Error("quota"); };
  assert.equal(store.getState().save(), false);
  assert.deepEqual(store.getState().savedLayouts[key], layouts);
  assert.equal(store.getState().draft.widgets.a.visibility.results, "hide");
  assert.equal(store.getState().editing, true);
});

test("routes round-trip encoded tournament/search filters and reject unknown pages or filters", () => {
  const input = { page: "Matches", filter: "a & b", matchQuery: "Raj / Hari", matchStatus: "live", matchStage: "postseason" };
  const url = new URL(routeHref(input), "http://desk.local");
  assert.deepEqual(readRoute(url), { ...input, teamQuery: "" });
  assert.equal(readRoute({ pathname: "/display/", search: "" }).page, "Display");
  assert.equal(readRoute({ pathname: "/missing", search: "?status=bad&stage=bad" }).page, "Not found");
  assert.equal(readRoute({ pathname: "/matches", search: "?status=bad" }).matchStatus, "all");
});

test("organizer navigation restores deep links and browser history without resetting search on data updates", () => {
  const browser = new EventTarget();
  browser.location = new URL("http://desk.local/matches?tournament=a&q=Raj&status=live");
  const entries = [browser.location.href];
  browser.history = {
    pushState: (_, __, href) => { browser.location = new URL(href, browser.location); entries.push(browser.location.href); },
    replaceState: (_, __, href) => { browser.location = new URL(href, browser.location); entries[entries.length - 1] = browser.location.href; },
  };
  const store = createOrganizerStore(browser), disconnect = store.getState().connectNavigation();
  assert.equal(store.getState().matchQuery, "Raj");
  store.getState().setMatchQuery("Hari");
  assert.equal(entries.length, 1);
  store.getState().setPage("Standings", { filter: "b" });
  assert.equal(entries.length, 2);
  store.getState().open({ type: "match" });
  browser.location = new URL(entries[0]); browser.dispatchEvent(new Event("popstate"));
  assert.equal(store.getState().page, "Matches");
  assert.equal(store.getState().matchQuery, "Hari");
  assert.equal(store.getState().matchStatus, "live");
  assert.equal(store.getState().filter, "a");
  assert.equal(store.getState().modal, null);
  disconnect();
  browser.location = new URL("http://desk.local/teams"); browser.dispatchEvent(new Event("popstate"));
  assert.equal(store.getState().page, "Matches");
});
