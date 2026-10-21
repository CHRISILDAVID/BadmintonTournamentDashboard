import React, { useEffect, useState } from "react";
import { useStore } from "zustand";
import { liveStore } from "./connection.js";
export default function LiveScores({ matches, teams, category }) {
  const { records, connected, preset } = useStore(liveStore);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const shown = matches.filter(m => (!preset?.courts?.length || preset.courts.includes(m.court)) && (!preset?.finals || m.stage === "Final"));
  return <div className="live-score-list">{shown.map(m => {
    const r = records[m.id], s = r?.score;
    const delayed = !r?.contactAt || now - r.contactAt > 45000;
    return <article className="live-score-card" key={m.id}>
      <header><strong>Court {m.court}</strong><span>{category} · {m.id.slice(0, 8)}</span><small className={!connected || delayed || r?.invalidated ? "score-delayed" : ""}>
        {!connected ? "Display disconnected · Last confirmed score" : r?.invalidated ? "Awaiting organizer reconciliation" : delayed ? "Umpire updates delayed" : s?.paused ? "Paused" : "Playing"}
      </small></header>
      {[m.a, m.b].map((id, side) => <div className="live-score-team" key={id}><span>{teams.get(id)?.name}</span><b>{s ? s.complete ? s.games.at(-1)?.[side] : s.points[side] : "–"}</b><small>{s?.wins[side] || 0} games</small></div>)}
      <footer>Game {s ? Math.min(s.games.length + 1, s.rules.bestOf) : 1} · Previous: {s?.games.map(g => g.join("–")).join(" / ") || "—"}</footer>
    </article>;
  })}{!shown.length && <p className="vb-empty">Live scores appear when matches are on court.</p>}</div>;
}
