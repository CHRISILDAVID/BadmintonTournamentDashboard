import test from "node:test";
import assert from "node:assert/strict";
import { createTournamentStore } from "../src/stores/tournament.js";
import { createVenueStore, VENUE_STORAGE_KEY, LEGACY_SELECTION_KEY } from "../src/stores/venue.js";
import { defaultLayouts, resolveLayouts, selectionKey, reorderPanel } from "../src/lib/venue-layout.js";
import { resolveDisplaySelection } from "../shared/display.js";

const response = (revision, extra = {}) => ({ ok: true, json: async () => ({ revision, ...extra }) });
const tick = () => new Promise(resolve => setImmediate(resolve));
const memory = (initial = {}) => {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};

test("snapshots and action responses cannot roll back a newer revision", async () => {
  const store = createTournamentStore({ fetcher: async () => response(5) });
  store.getState().accept({ revision: 6, name: "newest" });
  store.getState().accept({ revision: 6, name: "duplicate" });
  await store.getState().act("event");
  assert.equal(store.getState().state.name, "newest");
  assert.equal(store.getState().busy, false);
});

test("one event subscription is shared and closes only after the final consumer", async () => {
  const sources = [];
  const store = createTournamentStore({ fetcher: async () => response(1), eventSource: () => {
    const source = { readyState: 1, closed: 0, close() { this.closed++; } }; sources.push(source); return source;
  } });
  const a = store.getState().connect(), b = store.getState().connect();
  await tick();
  assert.equal(sources.length, 1);
  assert.equal(store.getState().connected, true);
  a(); a(); assert.equal(sources[0].closed, 0);
  b(); assert.equal(sources[0].closed, 1);
  assert.equal(sources[0].onmessage, null);
  assert.equal(sources[0].onopen, null);
  assert.equal(store.getState().connected, false);
});

test("reconnecting ignores requests from the closed connection", async () => {
  const pending = [];
  const store = createTournamentStore({ fetcher: () => new Promise(resolve => pending.push(resolve)), eventSource: () => ({ readyState: 1, close() {} }) });
  const stop = store.getState().connect(); stop();
  const stopNew = store.getState().connect();
  assert.equal(pending.length, 2);
  pending[1](response(2)); await tick();
  pending[0](response(99)); await tick();
  assert.equal(store.getState().state.revision, 2);
  assert.equal(store.getState().connected, true);
  stopNew();
});

test("an outstanding snapshot cannot mark a failed event connection as connected", async () => {
  let resolve, source;
  const store = createTournamentStore({ fetcher: () => new Promise(r => { resolve = r; }), eventSource: () => (source = { readyState: 1, close() {} }) });
  const stop = store.getState().connect();
  source.readyState = 0; source.onerror(); resolve(response(1)); await tick();
  assert.equal(store.getState().connected, false);
  source.readyState = 1; source.onopen(); resolve(response(2)); await tick();
  assert.equal(store.getState().connected, true);
  stop();
});

test("browser offline/online events update status immediately and their listeners are removed", async () => {
  const networkTarget = new EventTarget();
  let online = true, requests = 0;
  const store = createTournamentStore({ networkTarget, isOnline: () => online,
    fetcher: async () => { requests++; return response(requests); },
    eventSource: () => ({ readyState: 1, close() {} }),
  });
  const stop = store.getState().connect(); await tick();
  online = false; networkTarget.dispatchEvent(new Event("offline"));
  assert.equal(store.getState().connected, false);
  online = true; networkTarget.dispatchEvent(new Event("online")); await tick();
  assert.equal(store.getState().connected, true);
  stop(); const lastRequests = requests;
  networkTarget.dispatchEvent(new Event("online")); await tick();
  assert.equal(requests, lastRequests);
  assert.equal(store.getState().connected, false);
});

test("conflicts retain the supplied form revision and refresh before notifying", async () => {
  let submitted, conflict, error;
  const store = createTournamentStore({
    fetcher: async (url, options) => {
      if (url === "/api/state") return response(8);
      submitted = JSON.parse(options.body);
      return { ok: false, status: 409, json: async () => ({ error: "Another organizer changed this event" }) };
    }, onConflict: revision => { conflict = revision; }, onError: message => { error = message; },
  });
  store.getState().accept({ revision: 7 });
  assert.equal(await store.getState().act("teams", {}, "Saved", 4), false);
  assert.equal(submitted.revision, 4); assert.equal(conflict, 8);
  assert.match(error, /Another organizer/); assert.equal(store.getState().busy, false);
});

test("legacy selections migrate without persisting editing state or tournament data", () => {
  const storage = memory({ [LEGACY_SELECTION_KEY]: JSON.stringify({ count: 2, ids: ["a", "b", "a"] }) });
  const store = createVenueStore(storage), layouts = defaultLayouts(["a", "b"]), key = selectionKey(["a", "b"]);
  assert.deepEqual(store.getState().selection, { count: 2, ids: ["a", "b"] });
  store.getState().begin(key, layouts);
  store.getState().updateDraft("desktop", layouts.desktop.map(x => ({ ...x, h: 25 })));
  assert.equal(store.getState().save(), true);
  const stored = JSON.parse(storage.getItem(VENUE_STORAGE_KEY));
  assert.deepEqual(Object.keys(stored.state).sort(), ["savedLayouts", "selection"]);
  const restored = createVenueStore(storage).getState();
  assert.equal(restored.editing, false); assert.equal(restored.savedLayouts[key].desktop[0].h, 25);
  assert.deepEqual(restored.savedLayouts[key].phone, layouts.phone);
});

test("an empty/deleted event settles to zero panels and recovers when a tournament appears", () => {
  const store = createVenueStore(memory());
  store.getState().setSelection(resolveDisplaySelection([], store.getState().selection));
  assert.deepEqual(store.getState().selection, { count: 0, ids: [] });
  const previous = store.getState();
  store.getState().setSelection(resolveDisplaySelection([], previous.selection));
  assert.equal(store.getState(), previous);
  store.getState().setSelection(resolveDisplaySelection([{ id: "new" }], previous.selection));
  assert.deepEqual(store.getState().selection, { count: 1, ids: ["new"] });
});

test("cancel and reset keep the committed layouts unchanged until save", () => {
  const store = createVenueStore(memory()), layouts = defaultLayouts(["a"]), key = selectionKey(["a"]);
  store.getState().begin(key, layouts); store.getState().save();
  store.getState().begin(key, layouts);
  store.getState().updateDraft("desktop", [{ ...layouts.desktop[0], h: 30 }]);
  store.getState().cancel();
  assert.deepEqual(store.getState().savedLayouts[key], layouts);
  store.getState().begin(key, { ...layouts, desktop: [{ ...layouts.desktop[0], h: 30 }] });
  store.getState().reset(layouts);
  assert.deepEqual(store.getState().draft, layouts);
});

test("selection sets restore independently regardless of selection order", () => {
  const store = createVenueStore(memory());
  for (const ids of [["a", "b"], ["b", "c"]]) { store.getState().begin(selectionKey(ids), defaultLayouts(ids)); store.getState().save(); }
  assert.equal(selectionKey(["b", "a"]), selectionKey(["a", "b"]));
  assert.equal(Object.keys(store.getState().savedLayouts).length, 2);
});

test("corrupt, unavailable, and older storage safely recover", () => {
  for (const storage of [memory({ [VENUE_STORAGE_KEY]: "broken JSON" }), { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } }, memory({ [VENUE_STORAGE_KEY]: JSON.stringify({ version: 0, state: { selection: { count: 2, ids: ["a", "b"] }, savedLayouts: { bad: true } } }) })]) {
    const store = createVenueStore(storage);
    assert.deepEqual(store.getState().savedLayouts, {});
    assert.equal(store.getState().editing, false);
  }
});

test("failed saves show a message and preserve the saved layout and editable draft", () => {
  const storage = memory(), store = createVenueStore(storage), key = selectionKey(["a"]), layouts = defaultLayouts(["a"]);
  store.getState().begin(key, layouts); assert.equal(store.getState().save(), true);
  store.getState().begin(key, layouts);
  store.getState().updateDraft("desktop", [{ ...layouts.desktop[0], h: 30 }]);
  storage.setItem = () => { throw Error("quota"); };
  assert.equal(store.getState().save(), false);
  assert.deepEqual(store.getState().savedLayouts[key], layouts);
  assert.equal(store.getState().editing, true);
  assert.match(store.getState().storageError, /could not save/);
  assert.equal(store.getState().draft.desktop[0].h, 30);
});

test("layout recovery drops deleted IDs, adds new panels, and repairs invalid sizes and overlaps", () => {
  const defaults = defaultLayouts(["a", "b", "new"]);
  const result = resolveLayouts({ desktop: [{ i: "a", x: -10, y: 0, w: 100, h: -1 }, { i: "b", x: 0, y: 0, w: 6, h: 10 }, { i: "new", x: null, y: 0, w: 12, h: 10 }, { i: "deleted", x: 0, y: 0, w: 12, h: 10 }] }, defaults);
  assert.deepEqual(new Set(result.desktop.map(x => x.i)), new Set(["a", "b", "new"]));
  for (const [bp, layout] of Object.entries(result)) for (const a of layout) {
    assert.ok(a.w >= a.minW && a.h >= a.minH && a.x >= 0);
    assert.ok(a.x + a.w <= (bp === "desktop" ? 12 : bp === "tablet" ? 6 : 1));
    for (const b of layout) if (a !== b) assert.ok(!(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y));
  }
});

test("default layouts support one to three desktop columns, two for larger selections, and stacked phones", () => {
  for (const count of [1, 2, 3, 4, 8, 200]) {
    const layouts = defaultLayouts(Array.from({ length: count }, (_, i) => String(i)));
    assert.equal(layouts.desktop[0].w, 12 / (count <= 3 ? count : 2));
    assert.ok(layouts.phone.every(x => x.x === 0 && x.w === 1));
  }
  const layout = defaultLayouts(["a", "b"]).desktop;
  assert.equal(reorderPanel(layout, "a", 1, 12)[0].i, "b");
});
