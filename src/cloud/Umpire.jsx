import React, { useEffect, useState } from "react";
import { useStore } from "zustand";
import { tournamentStore } from "../stores/index.js";
import { liveStore } from "./connection.js";
import Scorer from "./Scorer.jsx";
import { currentSession, namespace, list } from "./storage.js";
export default function Umpire() {
  const { state } = useStore(tournamentStore), { connected } = useStore(liveStore);
  const [selected, setSelected] = useState(null);
  // Keep the prepared fixture visible through finalization or assignment changes.
  const [prepared, setPrepared] = useState(null);
  const [pending, setPending] = useState([]), [storageError, setStorageError] = useState("");
  useEffect(() => {
    if (!prepared) list(`${namespace(currentSession())}:match:`)
      .then(rows => setPending(rows.filter(r => r.prepared && (r.pending.length || r.conflict))))
      .catch(e => setStorageError(e.message));
  }, [prepared, state]);
  useEffect(() => {
    if (selected && state) {
      const m = state.matches.find(m => m.id === selected);
      if (m && !prepared) setPrepared({ match: m, teams: state.teams, category: state.tournaments.find(t => t.id === m.tournamentId) });
    }
  }, [selected, state]);
  if (prepared) return <Scorer key={prepared.match.id} {...prepared} onClose={() => { setSelected(null); setPrepared(null); }}/>;
  return <main className="umpire-desk"><header><h1>Your matches</h1><span>{connected ? "Connected" : "Offline — prepared matches only"}</span></header><p>Open a match while connected to prepare scoring on this phone.</p>
    {storageError && <p role="alert">{storageError}</p>}
    {pending.length > 0 && <section><h2>Saved work to synchronize or reconcile</h2>{pending.map(r => <button className="umpire-match" key={r.base.matchId} onClick={() => setPrepared(r.prepared)}>
      <strong>Match {r.base.matchId.slice(0, 8)} · {r.pending.length} pending</strong><span>{r.conflict || "Open saved scoring work"}</span>
    </button>)}</section>}
    {state?.matches.map(m => <button className="umpire-match" key={m.id} disabled={m.status !== "live"} onClick={() => setSelected(m.id)}>
      <small>{m.status === "live" ? `Court ${m.court}` : m.status} · {state.tournaments.find(t => t.id === m.tournamentId)?.name}</small>
      <strong>{state.teams.find(t => t.id === m.a)?.name} vs {state.teams.find(t => t.id === m.b)?.name}</strong><span>Open scorer →</span>
    </button>)}
    {!state?.matches.length && <p>No assigned matches yet. Your organizer can assign matches without a new invitation.</p>}
  </main>;
}
