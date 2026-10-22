import React, { useEffect, useRef, useState } from "react";
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
import { Toaster } from "../components/ui/sonner.jsx";
import DeskNavigation from "../components/DeskNavigation.jsx";
import useScorerReturn from "../hooks/useScorerReturn.js";

export default function Umpire() {
  const { state, page, modal, error, busy, setModal, setError } = useDesk();
  const { connected } = useStore(liveStore);
  // Retain the fixture and pending work through finalization and controller changes.
  const [prepared, setPrepared] = useState(null);
  useScorerReturn(!!prepared);
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [page]);
  const [pending, setPending] = useState([]), [storageError, setStorageError] = useState("");
  useEffect(() => {
    if (!prepared) list(`${namespace(currentSession())}:match:`)
      .then(rows => setPending(rows.filter(r => r.prepared && (r.pending.length || r.conflict))))
      .catch(e => setStorageError(e.message));
  }, [prepared, state]);
  if (prepared) return <Scorer key={prepared.match.id} {...prepared} returnLabel={page === "History" ? "Match history" : page} onClose={() => setPrepared(null)}/>;
  const titles = { match: "Match desk", returnMatch: "Return this match to waiting?" };
  return <main className="umpire-desk">
    <a className="skip-link" href="#umpire-content">Skip to matches and standings</a>
    <div className="umpire-context"><strong>ShuttleHub <span>/ Umpire desk</span></strong><span className={`connection ${connected ? "" : "disconnected"}`}><i className="dot"/>{connected ? "Connected" : "Offline — prepared matches only"}</span></div>
    <div className="umpire-event">{state.event.name}</div>
    <header><h1 ref={heading} tabIndex={-1}>{page === "History" ? "Match history" : page === "Standings" ? "Standings & brackets" : "Event matches"}</h1></header>
    <p>{page === "History" ? "Completed games and final results." : page === "Standings" ? "Group rankings and the route to the final." : "Find your match, check the court, and start when both teams are ready."}</p>
    <DeskNavigation page={page} event={state.event} umpire/>
    <div id="umpire-content" tabIndex={-1}>
    {storageError && <p role="alert">{storageError}</p>}
    {pending.length > 0 && <section><h2>Saved work to synchronize or reconcile</h2>{pending.map(r => <button className="umpire-match" key={r.base.matchId} aria-label={`Open saved scoring work for match ${r.base.matchId.slice(0, 8)}`} onClick={() => setPrepared(r.prepared)}>
      <strong>{r.prepared.teams.find(t => t.id === r.prepared.match.a)?.name} vs {r.prepared.teams.find(t => t.id === r.prepared.match.b)?.name}</strong><span>Court {r.prepared.match.court} · {r.pending.length} pending · Match {r.base.matchId.slice(0, 8)}</span><span>{r.conflict || "Open saved scoring work"}</span>
    </button>)}</section>}
    {page === "Standings" ? <Standings/> : <Matches key={page} history={page === "History"} onScore={match => setPrepared({ match, teams: state.teams, category: state.tournaments.find(t => t.id === match.tournamentId) })}/>}
    </div>
    {modal && titles[modal.type] && <Modal title={titles[modal.type]} busy={busy} close={() => { setModal(null); setError(""); }}>
      {modal.type === "match" ? <MatchForm/> : <ConfirmForm/>}
      {error && <div className="error inline-error" role="alert">{error}</div>}
    </Modal>}
    <Toaster position="bottom-right" closeButton richColors/>
  </main>;
}
