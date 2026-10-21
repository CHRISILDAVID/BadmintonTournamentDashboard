import { createTournamentStore } from "./tournament.js";
import { organizerStore } from "./organizer.js";
import { cloudEnabled, scopedFetch } from "../cloud/storage.js";
import { cloudEventSource } from "../cloud/connection.js";
export { organizerStore };
export const tournamentStore = createTournamentStore({
  ...(cloudEnabled() ? { eventSource: cloudEventSource, fetcher: scopedFetch } : {}),
  onError: error => organizerStore.getState().setError(error),
  onNotice: notice => organizerStore.getState().setNotice(notice),
  onConflict: revision => organizerStore.getState().setModal(current => current ? { ...current, conflictRevision: revision } : current),
});
if (globalThis.__shuttleOfflineState) tournamentStore.getState().accept(globalThis.__shuttleOfflineState);
if (cloudEnabled()) window.addEventListener("shuttle-snapshot", event => {
  // Assignments can change without a tournament mutation/revision increment.
  if (!tournamentStore.getState().state || event.detail.revision >= tournamentStore.getState().state.revision)
    tournamentStore.setState({ state: event.detail });
});
