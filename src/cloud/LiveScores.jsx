import React, { useEffect, useState } from "react";
import { useStore } from "zustand";
import { liveStore } from "./connection.js";
import { Clock3, Pause, Radio, WifiOff, CircleCheck, CircleDashed } from "lucide-react";
import { matchCategory, matchStageLabel, isCustomGame } from "../../shared/matches.js";
import { groupLabel } from "../../shared/format.js";
import { liveScoreCard } from "../lib/live-score-card.js";
import "./live-score-card.css";

const statusIcons = { live: Radio, warning: Clock3, waiting: CircleDashed, complete: CircleCheck };

export default function LiveScores({ matches, teams, tournament, tournaments }) {
  const { records, connected, preset } = useStore(liveStore);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const shown = matches.filter(m => (!preset?.courts?.length || preset.courts.includes(m.court)) && (!preset?.finals || m.stage === "Final"));
  return <div className="live-score-list">{shown.map(m => {
    const config = tournaments?.get(m.tournamentId) || tournament;
    const view = liveScoreCard(m, records[m.id], config, connected, now);
    const { rules, points, wins, needed, showGamesWon, gameNumber, games, status, pointLabels } = view;
    const sides = [m.a, m.b].map(id => teams.get(id));
    const doubles = sides.some(team => team?.players?.length > 1);
    const context = [matchCategory(m, config), isCustomGame(m) ? (doubles ? "Doubles" : "Singles") : matchStageLabel(m),
      m.group != null ? `Group ${groupLabel(m.group)}` : null].filter(Boolean).join(" · ");
    const StatusIcon = !connected ? WifiOff : records[m.id]?.score?.paused && status.label === "Paused" ? Pause : statusIcons[status.tone];
    return <article className="live-score-card" key={m.id} data-score-state={status.tone} aria-label={`Court ${m.court}: ${sides[0]?.name} vs ${sides[1]?.name}`}>
      <header className="live-score-heading">
        <strong className="live-score-court">Court {m.court}</strong>
        <span className={`live-score-status ${status.tone}`}><StatusIcon size={13} aria-hidden="true"/>{status.label}</span>
        <p className="live-score-context">{context}</p>
      </header>
      <div className="live-score-format"><strong>{rules?.bestOf === 1 ? "Single game" : `Game ${gameNumber}`}</strong>
        {showGamesWon && <span>Best of {rules.bestOf} · Win {needed} games</span>}
      </div>
      <table className={`live-score-board ${showGamesWon ? "multi-game" : "single-game"}`} aria-label={`Court ${m.court} scoreboard`}>
        <thead><tr><th scope="col">{doubles ? "Team" : "Player"}</th><th scope="col">Points</th>{showGamesWon && <th scope="col">Games won</th>}</tr></thead>
        <tbody>{sides.map((team, side) => <tr className="live-score-team" key={side}>
          <th scope="row"><div className="live-score-names">{team?.players?.length ? team.players.map((player, index) => <span key={index}>{player}</span>) : <span>{team?.name || "Awaiting player"}</span>}</div>
            {pointLabels[side] && <span className="live-score-point-label">{pointLabels[side]}</span>}
          </th>
          <td className="live-score-points"><b>{points?.[side] ?? "—"}</b></td>
          {showGamesWon && <td className="live-score-wins"><b>{wins?.[side] ?? "—"}</b></td>}
        </tr>)}</tbody>
      </table>
      <footer className="live-score-footer">
        {games.length > 0 && <div className="live-score-history" aria-label="Completed game scores">{games.map((game, index) => <span key={index}>Game {index + 1}<b>{game.join("–")}</b></span>)}</div>}
        {rules && <p className="live-score-rules">To {rules.points}<span>·</span>{rules.goldenPoint ? "Golden point" : `Win by 2 · Cap ${rules.cap}`}</p>}
        {status.note && <p className="live-score-note">{status.note}</p>}
      </footer>
    </article>;
  })}{!shown.length && <p className="vb-empty">Live scores appear when matches are on court.</p>}</div>;
}
