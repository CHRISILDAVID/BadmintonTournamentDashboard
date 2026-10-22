import React, { useEffect, useMemo } from "react";
import { useStore } from "zustand";
import { organizerStore, tournamentStore } from "../stores/index.js";
import { upcomingMatches } from "../../shared/matches.js";
import { NativeSelect } from "../components/ui/native-select.jsx";
import { currentSession } from "../cloud/storage.js";

// Page-level adapter; small components can subscribe directly to either store.
export function useDesk() {
  const data = useStore(tournamentStore);
  const ui = useStore(organizerStore);
  const { state } = data;
  const { setFilter } = ui;
  const umpire = currentSession()?.role === "umpire";
  const filter = umpire && !state?.tournaments.some(t => t.id === ui.filter)
    ? state?.tournaments[0]?.id || "all" : ui.filter;
  useEffect(() => {
    if (umpire && filter !== ui.filter) setFilter(filter, true);
  }, [umpire, filter, ui.filter, setFilter]);
  const display = ui.page === "Display";
  const derived = useMemo(() => {
    const selected = state?.matches.filter(m => filter === "all" || m.tournamentId === filter) || [];
    const readyMatches = upcomingMatches(state);
    const teams = new Map(state?.teams.map(t => [t.id, t]));
    const tournaments = new Map(state?.tournaments.map(t => [t.id, t]));
    return {
      selected, readyMatches,
      live: selected.filter(m => m.status === "live").sort((a, b) => a.court - b.court),
      upcoming: readyMatches.filter(m => filter === "all" || m.tournamentId === filter),
      completed: selected.filter(m => m.status === "completed").sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || "")),
      team: id => teams.get(id), tournament: id => tournaments.get(id),
    };
  }, [state, filter]);
  const categorySelect = <NativeSelect aria-label="Filter by tournament" className="category-select" value={filter} onChange={e => setFilter(e.target.value)}>
    {!umpire && <option value="all">All tournaments</option>}
    {state?.tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
  </NativeSelect>;
  const admin = !display && (!currentSession() || ["owner", "organizer"].includes(currentSession().role));
  return { ...data, ...ui, ...derived, filter, display, admin, umpire,
    canManageMatches: !display && (admin || currentSession()?.role === "umpire"), categorySelect };
}
