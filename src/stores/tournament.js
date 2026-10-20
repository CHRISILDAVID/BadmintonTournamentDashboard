import { createStore } from "zustand/vanilla";

// Inject transport and notifications so lifecycle and revision rules can be tested.
export function createTournamentStore({ fetcher = (...args) => fetch(...args),
  eventSource = url => new EventSource(url), onError = () => {},
  onNotice = () => {}, onConflict = () => {}, networkTarget = globalThis.window,
  isOnline = () => globalThis.navigator?.onLine !== false } = {}) {
  let source = null, consumers = 0, generation = 0;
  let cleanupNetwork = () => {};
  let refreshing = null;
  const store = createStore((set, get) => ({
    state: null, connected: false, busy: false,
    accept(next) {
      if (!get().state || next.revision > get().state.revision) set({ state: next });
    },
    async refresh() {
      if (refreshing?.token === generation) { refreshing.again = true; return refreshing.promise; }
      const token = generation;
      const request = { token, again: false, promise: null };
      refreshing = request;
      request.promise = (async () => {
        do {
          request.again = false;
          const response = await fetcher("/api/state");
          if (!response.ok) throw new Error("Unable to load tournament data.");
          const next = await response.json();
          if (token !== generation) return;
          get().accept(next);
        } while (request.again);
      })();
      try { await request.promise; }
      finally { if (refreshing === request) refreshing = null; }
    },
    connect() {
      consumers++;
      if (!source) {
        const connection = eventSource("/api/events");
        source = connection;
        const token = generation;
        const refresh = () => get().refresh().then(() => {
          if (token === generation && source === connection && connection.readyState === 1 && isOnline()) set({ connected: true });
        }).catch(error => {
          if (token === generation) { set({ connected: false }); onError(error.message); }
        });
        source.onmessage = refresh;
        source.onopen = refresh;
        source.onerror = () => set({ connected: false });
        const offline = () => set({ connected: false });
        networkTarget?.addEventListener("offline", offline);
        networkTarget?.addEventListener("online", refresh);
        cleanupNetwork = () => {
          networkTarget?.removeEventListener("offline", offline);
          networkTarget?.removeEventListener("online", refresh);
        };
        refresh();
      }
      let disposed = false;
      return () => {
        if (disposed) return;
        disposed = true;
        if (--consumers === 0) {
          cleanupNetwork();
          source.onmessage = null;
          source.onopen = null;
          source.onerror = null;
          source.close(); source = null; generation++;
          set({ connected: false });
        }
      };
    },
    async act(action, payload = {}, message = "Changes saved", expectedRevision) {
      if (get().busy) return false;
      set({ busy: true }); onError("");
      try {
        const response = await fetcher("/api/action", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, payload, revision: expectedRevision ?? get().state?.revision }),
        });
        const data = await response.json();
        if (!response.ok) {
          if (response.status === 409) { await get().refresh(); onConflict(get().state.revision); }
          throw new Error(data.error || "Unable to save this change.");
        }
        get().accept(data); onNotice(message); return true;
      } catch (error) { onError(error.message); return false; }
      finally { set({ busy: false }); }
    },
  }));
  return store;
}
