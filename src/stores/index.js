import { createTournamentStore } from "./tournament.js";
import { organizerStore } from "./organizer.js";
export { organizerStore };
export const tournamentStore = createTournamentStore({
  onError: error => organizerStore.getState().setError(error),
  onNotice: notice => organizerStore.getState().setNotice(notice),
  onConflict: revision => organizerStore.getState().setModal(current => current ? { ...current, conflictRevision: revision } : current),
});
