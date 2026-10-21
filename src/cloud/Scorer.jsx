import React, { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { currentSession, namespace, read, write, api } from "./storage.js";
import { liveStore, subscribeCloud, contact } from "./connection.js";
import { reduceScore, elapsedSeconds } from "../../shared/live-scoring.js";

export default function Scorer({ match, teams, category, onClose }) {
  const session = currentSession(), key = `${namespace(session)}:match:${match.id}`;
  const [record, setRecord] = useState(null), [error, setError] = useState(""), [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false), [, tick] = useState(0);
  const [offlineReady, setOfflineReady] = useState(false);
  const { connected } = useStore(liveStore);
  const ref = useRef(null), syncing = useRef(false), editing = useRef(false), alive = useRef(true);
  const commit = async value => { await write(key, value); ref.current = value; if (alive.current) setRecord(value); };
  const flush = async () => {
    if (!alive.current || currentSession()?.sessionId !== session.sessionId || syncing.current || editing.current || !ref.current?.pending.length || !navigator.onLine || ref.current.conflict) return;
    syncing.current = true;
    try {
      while (alive.current && currentSession()?.sessionId === session.sessionId && ref.current.pending.length && !editing.current) {
        const action = ref.current.pending[0];
        const response = await api("score", action);
        if (!alive.current) return;
        // New taps may have been persisted while the request was in flight.
        // Serialize the acknowledgement with tap persistence.
        while (editing.current) await new Promise(resolve => setTimeout(resolve, 10));
        if (!alive.current) return;
        editing.current = true;
        try {
          if (!response.accepted) {
            await commit({ ...ref.current, conflict: response.error }); setError(response.error); break;
          }
          const pending = ref.current.pending.filter(a => a.id !== action.id);
          if (response.obsolete) {
            const conflict = "This action was previously accepted, but control or the match has since changed. Ask the organizer to reconcile the remaining work.";
            await commit({ ...ref.current, pending, conflict }); setError(conflict); break;
          }
          let optimistic = response.record.score;
          for (const a of pending) optimistic = reduceScore(optimistic, a, a.clientTime);
          await commit({ ...ref.current, base: response.record, pending, optimistic });
        } finally { editing.current = false; }
      }
      if (alive.current && !ref.current?.conflict) setError("");
    } catch (e) {
      if (alive.current && [401, 403, 409].includes(e.status)) {
        while (editing.current) await new Promise(resolve => setTimeout(resolve, 10));
        editing.current = true;
        try { await commit({ ...ref.current, conflict: e.message }); } catch {} finally { editing.current = false; }
      }
      if (alive.current) setError(e.message);
    } finally { syncing.current = false; }
  };
  useEffect(() => {
    alive.current = true;
    let release;
    navigator.serviceWorker?.ready.then(() => { if (alive.current) setOfflineReady(true); });
    if (!navigator.locks) { setError("This browser cannot safely lock a scoring tab. Use a current Chrome, Safari, Edge or Firefox browser."); return; }
    navigator.locks.request(key, { ifAvailable: true }, async lock => {
      if (!lock) { setError("This match is already open in another tab. Close that scorer first."); return; }
      if (!alive.current) return;
      setLocked(true);
      try {
        const stored = await read(key);
        if (stored) { ref.current = stored; setRecord(stored); await flush(); }
      } catch (e) { setError(e.message); }
      await new Promise(resolve => { release = resolve; if (!alive.current) resolve(); });
    });
    const update = setInterval(() => tick(n => n + 1), 1000);
    const heartbeat = setInterval(() => { if (ref.current && !ref.current.conflict) contact(ref.current.base, ref.current.device); flush(); }, 15000);
    const unsubscribe = subscribeCloud(message => {
      if (message.type === "connected") flush();
      if (message.type === "snapshot" && ref.current && !ref.current.pending.length) {
        const remote = message.live.find(r => r.matchId === match.id);
        if (remote && remote.generation !== ref.current.base.generation) setError("Controller or match changed. Reopen after organizer reconciliation.");
      }
    });
    const online = () => flush();
    window.addEventListener("online", online);
    const visibility = () => { if (document.visibilityState === "visible") flush(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { alive.current = false; release?.(); clearInterval(update); clearInterval(heartbeat); unsubscribe(); window.removeEventListener("online", online); document.removeEventListener("visibilitychange", visibility); };
  }, [key]);
  const claim = async () => {
    setBusy(true); setError("");
    try {
      const device = record?.device || crypto.randomUUID();
      const base = await api("claim", { matchId: match.id, device });
      await commit({ device, base, pending: [], optimistic: base.score, conflict: null, prepared: { match, teams, category } });
      contact(base, device);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const archiveAndClaim = async () => {
    if (!confirm("Has the organizer reviewed this pending work? It will be retained as a local archive, and this screen will use the current server score.")) return;
    setBusy(true);
    try {
      const previous = ref.current;
      await write(`${namespace(session)}:archive:${crypto.randomUUID()}`, previous);
      const device = crypto.randomUUID();
      const base = await api("claim", { matchId: match.id, device });
      await commit({ device, base, pending: [], optimistic: base.score, conflict: null, prepared: { match, teams, category } });
      setError(""); contact(base, device);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const tap = async (type, teamId) => {
    if (!ref.current || editing.current || ref.current.conflict) return;
    editing.current = true; setBusy(true);
    try {
      const r = ref.current;
      const action = { id: crypto.randomUUID(), eventId: session.eventId, matchId: match.id,
        generation: r.base.generation, device: r.device, seq: r.base.seq + r.pending.length + 1,
        revision: r.base.revision + r.pending.length, type, ...(teamId ? { teamId } : {}), clientTime: Date.now() };
      const optimistic = reduceScore(r.optimistic, action, action.clientTime);
      await commit({ ...r, pending: [...r.pending, action], optimistic });
      setError("");
    } catch (e) { setError(e.message); }
    finally { editing.current = false; setBusy(false); flush(); }
  };
  const s = record?.optimistic, pending = record?.pending.length || 0, elapsed = s ? elapsedSeconds(s) : 0;
  return <section className="scorer" aria-label="Point by point scorer">
    <header><button onClick={onClose}>← Matches</button><span>Court {match.court} · {category.name}</span><small>Match {match.id.slice(0, 8)}</small></header>
    <div className={`score-status ${!connected || pending ? "pending" : ""}`} role="status">
      {!connected ? "OFFLINE / CONNECTION UNAVAILABLE" : "Connected"} · {pending} pending
      {s?.confirmed ? pending ? " · Result pending sync" : " · Result confirmed" : s?.paused ? " · Paused" : " · Playing"}
    </div>
    <small>{offlineReady ? "Offline shell prepared on this browser" : "Preparing offline shell — keep internet connected"}</small>
    {error && <p role="alert" className="score-error">{error}</p>}
    {!s ? <div className="score-start"><h2>Ready to score</h2><p>Claim this match while connected. Keep this tab for the whole match.</p><button disabled={!locked || busy || !connected} onClick={claim}>Claim scoring control</button></div> : <>
      <div className="score-meta">Game {Math.min(s.games.length + 1, s.rules.bestOf)} · First to {s.rules.points} · {s.rules.goldenPoint ? "Golden point" : `Win by two, cap ${s.rules.cap}`}<b>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</b></div>
      <div className="score-teams">{s.teams.map((id, side) => <div className="score-team" key={id}>
        <h2>{teams.find(t => t.id === id)?.name || "Team"}</h2><strong>{s.complete ? s.games.at(-1)?.[side] : s.points[side]}</strong>
        <span>{s.wins[side]} games won</span><button aria-label={`Point for ${teams.find(t => t.id === id)?.name}`} disabled={busy || !locked || !!record.conflict || s.paused || s.complete || s.confirmed} onClick={() => tap("point", id)}>+ Point</button>
      </div>)}</div>
      <div className="score-controls"><button disabled={busy || !!record.conflict || !s.undo.length || s.confirmed} onClick={() => tap("undo")}>Undo point</button><button disabled={busy || !!record.conflict || s.complete || s.confirmed} onClick={() => tap(s.paused ? "resume" : "pause")}>{s.paused ? "Resume" : "Pause"}</button><button disabled={!pending || busy} onClick={flush}>Sync now</button></div>
      <p className="score-games">Previous games: {s.games.map(g => g.join("–")).join(" / ") || "None yet"}</p>
      {s.complete && !s.confirmed && <button className="confirm-result" disabled={busy || !!record.conflict} onClick={() => tap("confirm")}>Confirm final result</button>}
      {record.conflict && <><p>Pending work is preserved. Ask the organizer to review it before restarting.</p><button onClick={() => {
        const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `pending-${match.id}.json`; a.click(); URL.revokeObjectURL(a.href);
      }}>Export unresolved work</button><button disabled={busy} onClick={pending ? archiveAndClaim : claim}>{pending ? "Archive reviewed work & claim current score" : "Claim transferred control"}</button></>}
    </>}
  </section>;
}
