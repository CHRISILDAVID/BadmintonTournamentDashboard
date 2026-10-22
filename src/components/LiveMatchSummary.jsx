import React, { useEffect, useState } from "react";
import { useStore } from "zustand";
import { liveStore } from "../cloud/connection.js";

// Display only the server's existing point record; on-court status alone is
// never evidence that a score is current or that this device controls scoring.
export default function LiveMatchSummary({ matchId }) {
  const record = useStore(liveStore, s => s.records[matchId]);
  const connected = useStore(liveStore, s => s.connected);
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  const score = record?.score;
  if (!score) return <p className="live-match-summary">No point score received yet</p>;
  const delayed = !record.contactAt || now - record.contactAt > 45000;
  const points = score.complete ? score.games.at(-1) : score.points;
  return <div className="live-match-summary">
    <strong>Last confirmed points: {points?.join("–")} <span>· Game {Math.min(score.games.length + 1, score.rules.bestOf)}</span></strong>
    <small>{!connected ? "Connection unavailable · Score may be out of date" : record.invalidated ? "Awaiting organizer reconciliation" : delayed ? "Umpire updates delayed" : score.paused ? "Paused" : "Receiving umpire updates"}</small>
  </div>;
}
