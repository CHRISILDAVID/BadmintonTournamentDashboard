import React, { useEffect, useState } from "react";
import { useStore } from "zustand";
import { Timer } from "lucide-react";
import { liveStore } from "./connection.js";
import { matchCategory, matchStageLabel, isCustomGame } from "../../shared/matches.js";
import { groupLabel } from "../../shared/format.js";
import { elapsedSeconds } from "../../shared/live-scoring.js";
import { liveScoreCard } from "../lib/live-score-card.js";
import "./live-score-card.css";

function matchElapsed(match, score, now) {
  const started = Date.parse(match.startedAt);
  const elapsed = score ? elapsedSeconds(score, now) : Math.max(0, Math.floor((now - started) / 1000));
  if (!Number.isFinite(elapsed)) return null;
  return [Math.floor(elapsed / 60), elapsed % 60].map(value => String(value).padStart(2, "0")).join(":");
}

export default function LiveScores({ matches, teams, tournament, tournaments }) {
  const { records, connected } = useStore(liveStore);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return <div className="live-score-list">{matches.map(match => {
    const config = tournaments?.get(match.tournamentId) || tournament;
    const record = records[match.id];
    const { points, games, status, pointLabels } = liveScoreCard(match, record, config, connected, now);
    const current = !record?.score?.complete;
    const scores = current ? [...games, points] : games;
    const sides = [match.a, match.b].map(id => teams.get(id));
    const doubles = sides.some(team => team?.players?.length > 1);
    const elapsed = matchElapsed(match, record?.score, now);
    const context = [matchCategory(match, config), isCustomGame(match) ? (doubles ? "Doubles" : "Singles") : matchStageLabel(match),
      match.group != null ? `Group ${groupLabel(match.group)}` : null, `Court ${match.court}`].filter(Boolean).join(" · ");

    return <article className="live-score-card" key={match.id} data-score-state={status.tone}
      aria-label={`Court ${match.court}: ${sides[0]?.name} vs ${sides[1]?.name}`}>
      <header className="live-score-heading">
        <strong className="live-score-match">{Number.isInteger(match.index) ? `Match ${match.index + 1}` : `Court ${match.court}`}</strong>
        <span className={`live-score-status ${status.tone}`} title={status.note || undefined}>{status.label}</span>
      </header>
      <table className="live-score-board" aria-label={`Court ${match.court} scoreboard`}>
        <thead className="sr-only"><tr><th scope="col">{doubles ? "Team" : "Player"}</th>
          {scores.map((_, index) => <th key={index} scope="col">Game {index + 1}{current && index === scores.length - 1 ? " (current)" : ""}</th>)}
        </tr></thead>
        <tbody>{sides.map((team, side) => <tr key={side}>
          <th scope="row"><div className="live-score-names">{team?.players?.length
            ? team.players.map((player, index) => <span key={index}>{player}</span>)
            : <span>{team?.name || "Awaiting player"}</span>}</div>
            {pointLabels[side] && <span className="live-score-point-label">{pointLabels[side]}</span>}
          </th>
          {scores.map((game, index) => {
            const live = current && index === scores.length - 1;
            return <td key={index} className={`live-score-game${live ? " is-current" : ""}${!live && game?.[side] > game?.[1 - side] ? " is-won" : ""}`}>
              {game?.[side] ?? "—"}
            </td>;
          })}
        </tr>)}</tbody>
      </table>
      <footer className="live-score-footer">
        <span>{context}</span>
        {elapsed && <span className="live-score-elapsed" aria-label={`Elapsed ${elapsed}`}><Timer size={13} aria-hidden="true"/>{elapsed}</span>}
      </footer>
    </article>;
  })}{!matches.length && <p className="vb-empty">Live scores appear when matches are on court.</p>}</div>;
}
