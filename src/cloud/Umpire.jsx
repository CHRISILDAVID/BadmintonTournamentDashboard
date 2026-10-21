import React, { useEffect, useState } from "react";
import { useStore } from "zustand";
import { useDesk } from "../hooks/useDesk.jsx";
import { liveStore } from "./connection.js";
import Scorer from "./Scorer.jsx";
import { currentSession, namespace, list } from "./storage.js";
import Matches from "../pages/Matches.jsx";
import Standings from "../pages/Standings.jsx";
import MatchForm from "../forms/MatchForm.jsx";
import ConfirmForm from "../forms/ConfirmForm.jsx";
import { Modal } from "../components/common.jsx";
import PageLink from "../components/PageLink.jsx";
import { Toaster } from "../components/ui/sonner.jsx";

export default function Umpire() {
  const { state, page, modal, error, setModal, setError } = useDesk();
  const { connected } = useStore(liveStore);
  // Retain the fixture and pending work through finalization and controller changes.
  const [prepared, setPrepared] = useState(null);
  const [pending, setPending] = useState([]), [storageError, setStorageError] = useState("");
  useEffect(() => {
    if (!prepared) list(`${namespace(currentSession())}:match:`)
      .then(rows => setPending(rows.filter(r => r.prepared && (r.pending.length || r.conflict))))
      .catch(e => setStorageError(e.message));
  }, [prepared, state]);
  if (prepared) return <Scorer key={prepared.match.id} {...prepared} onClose={() => setPrepared(null)}/>;
  const titles = { match: "Match desk", returnMatch: "Return this match to waiting?", knockouts: "Create the knockout bracket" };
  return <main className="umpire-desk">
    <header><h1>{page === "History" ? "Match history" : page === "Standings" ? "Standings & brackets" : "Event matches"}</h1><span>{connected ? "Connected" : "Offline — prepared matches only"}</span></header>
    <p>Choose a match, assign a free court, and start when both teams are ready.</p>
    <nav className="toolbar" aria-label="Umpire navigation"><PageLink page="Matches">All matches</PageLink><PageLink page="Standings">Standings & brackets</PageLink></nav>
    {storageError && <p role="alert">{storageError}</p>}
    {pending.length > 0 && <section><h2>Saved work to synchronize or reconcile</h2>{pending.map(r => <button className="umpire-match" key={r.base.matchId} onClick={() => setPrepared(r.prepared)}>
      <strong>Match {r.base.matchId.slice(0, 8)} · {r.pending.length} pending</strong><span>{r.conflict || "Open saved scoring work"}</span>
    </button>)}</section>}
    {page === "Standings" ? <Standings/> : <Matches key={page} history={page === "History"} onScore={match => setPrepared({ match, teams: state.teams, category: state.tournaments.find(t => t.id === match.tournamentId) })}/>}
    {modal && titles[modal.type] && <Modal title={titles[modal.type]} close={() => { setModal(null); setError(""); }}>
      {modal.type === "match" ? <MatchForm/> : <ConfirmForm/>}
      {error && <div className="error inline-error" role="alert">{error}</div>}
    </Modal>}
    <Toaster position="bottom-right" closeButton richColors/>
  </main>;
}
