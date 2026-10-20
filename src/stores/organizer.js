import { createStore } from "zustand/vanilla";
import { readRoute, routeHref } from "../lib/navigation.js";

const update = (value, previous) => typeof value === "function" ? value(previous) : value;
export function createOrganizerStore(browser = globalThis.window) {
  return createStore((set, get) => {
    const navigate = (patch, replace = false) => {
      const next = { ...get(), ...patch };
      const href = routeHref(next);
      if (browser && href !== browser.location.pathname + browser.location.search)
        browser.history[replace ? "replaceState" : "pushState"](null, "", href);
      set(patch);
    };
    return {
  ...readRoute(browser?.location), modal: null, error: "", notice: "",
  connectNavigation() {
    const sync = () => set({ ...readRoute(browser.location), modal: null, error: "" });
    browser?.addEventListener("popstate", sync);
    return () => browser?.removeEventListener("popstate", sync);
  },
  setTeamQuery: teamQuery => navigate({ teamQuery }, true),
  setMatchQuery: matchQuery => navigate({ matchQuery }, true),
  setMatchStatus: matchStatus => navigate({ matchStatus }),
  setMatchStage: matchStage => navigate({ matchStage }),
  setPage: (page, patch = {}) => navigate({ page, ...patch, modal: null, error: "" }),
  setFilter: (filter, replace = false) => navigate({ filter }, replace),
  setModal: value => set(s => ({ modal: update(value, s.modal) })),
  setError: error => set({ error }),
  setNotice: notice => set({ notice }),
  open: modal => set({ modal, error: "" }),
  };
  });
}
export const organizerStore = createOrganizerStore();
