import { createStore } from "zustand/vanilla";
import { persist } from "zustand/middleware";
import { cleanSelection } from "../lib/venue-layout.js";
import { cleanWidgetPreferences, rememberWidgetLayout, WIDGETS } from "../lib/venue-widgets.js";

export const VENUE_STORAGE_KEY = "shuttlehub.venue.layout.v1";
export const LEGACY_SELECTION_KEY = "shuttlehub.venue.selection.v1";
function browserStorage() { try { return globalThis.localStorage; } catch { return undefined; } }
export function createVenueStore(storage = browserStorage()) {
  let failure = "", lastSaved = "";
  const adapter = {
    getItem(name) {
      try {
        const raw = storage?.getItem(name);
        if (raw) return JSON.parse(raw);
        const legacy = storage?.getItem(LEGACY_SELECTION_KEY);
        return legacy ? { state: { selection: cleanSelection(JSON.parse(legacy)), savedLayouts: {} }, version: 1 } : null;
      } catch { return null; }
    },
    setItem(name, value) {
      const serialized = JSON.stringify(value);
      if (lastSaved === serialized) return;
      try {
        if (!storage) throw new Error("Storage unavailable");
        storage.setItem(name, serialized); lastSaved = serialized; failure = "";
      } catch { failure = "This browser could not save the layout. Allow local storage or free browser storage, then try again."; }
    },
    removeItem(name) { try { storage?.removeItem(name); } catch {} },
  };
  return createStore(persist((set, get) => ({
    selection: { count: 1, ids: [] }, savedLayouts: {},
    editing: false, editingKey: null, draft: null, storageError: "",
    setSelection(selection) {
      const next = cleanSelection(selection);
      if (JSON.stringify(next) !== JSON.stringify(get().selection)) set({ selection: next });
    },
    begin(key, layouts) { set({ editing: true, editingKey: key, draft: structuredClone(layouts), storageError: "" }); },
    updateDraft(breakpoint, layout) {
      if (get().editing && JSON.stringify(get().draft[breakpoint]) !== JSON.stringify(layout))
        set({ draft: { ...get().draft, [breakpoint]: structuredClone(layout) } });
    },
    setWidgetVisibility(tournamentId, id, mode) {
      if (!get().editing || !WIDGETS[id] || !["auto", "show", "hide"].includes(mode)) return;
      const widgets = get().draft.widgets || {};
      const previous = cleanWidgetPreferences(widgets[tournamentId]);
      set({ draft: { ...get().draft, widgets: { ...widgets, [tournamentId]: {
        ...previous, visibility: { ...previous.visibility, [id]: mode },
      } } } });
    },
    updateWidgetLayout(tournamentId, breakpoint, layout) {
      if (!get().editing) return;
      const widgets = get().draft.widgets || {};
      const previous = cleanWidgetPreferences(widgets[tournamentId]);
      const next = rememberWidgetLayout(previous.layouts[breakpoint], layout);
      if (JSON.stringify(next) === JSON.stringify(previous.layouts[breakpoint])) return;
      set({ draft: { ...get().draft, widgets: { ...widgets, [tournamentId]: {
        ...previous, layouts: { ...previous.layouts, [breakpoint]: next },
      } } } });
    },
    reset(layouts) { if (get().editing) set({ draft: structuredClone(layouts), storageError: "" }); },
    cancel() { set({ editing: false, editingKey: null, draft: null, storageError: "" }); },
    save() {
      if (!get().editing) return false;
      const previous = get().savedLayouts;
      const entries = Object.entries(previous).filter(([key]) => key !== get().editingKey).slice(-29);
      const next = Object.fromEntries([...entries, [get().editingKey, structuredClone(get().draft)]]);
      failure = "";
      set({ savedLayouts: next });
      if (failure) { const message = failure; set({ savedLayouts: previous, storageError: message }); return false; }
      get().cancel(); return true;
    },
  }), {
    name: VENUE_STORAGE_KEY, version: 2, storage: adapter,
    partialize: ({ selection, savedLayouts }) => ({ selection, savedLayouts }),
    migrate: (persisted, version) => ({ selection: cleanSelection(persisted?.selection), savedLayouts: version === 1 ? persisted?.savedLayouts || {} : {} }),
    merge: (persisted, current) => ({ ...current, selection: cleanSelection(persisted?.selection),
      savedLayouts: persisted?.savedLayouts && typeof persisted.savedLayouts === "object" && !Array.isArray(persisted.savedLayouts) ? persisted.savedLayouts : {} }),
  }));
}
export const venueStore = createVenueStore();
