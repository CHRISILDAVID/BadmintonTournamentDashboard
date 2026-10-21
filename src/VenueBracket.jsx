import React, { useId, useRef } from "react";
import { Check, Minus, Plus, Scan } from "lucide-react";
import { Button } from "./components/ui/button.jsx";
import useBracketBoard from "./useBracketBoard.js";
import {
  PLAYOFF_STAGE,
  scoringRules,
  scoringLabel,
  pendingOpponent,
  groupLabel,
} from "../shared/format.js";

function BracketMatch({ match, teams, previousStage }) {
  const ready = !!match.a && !!match.b;
  const status =
    match.status === "completed"
      ? (match.bye ? "Advances by bye" : "Final score")
      : match.status === "live"
        ? `Court ${match.court} · On court`
        : ready
          ? "Ready"
          : "Awaiting opponents";
  return (
    <article
      className={`vb-ko-card ${match.status} ${match.stage === "Final" ? "vb-ko-final" : ""}`}
      aria-label={`${match.stage} ${match.index + 1}`}
    >
      <div className="vb-ko-meta">
        <span>
          {match.stage === PLAYOFF_STAGE
            ? `${match.playoffRanks.join(" vs ")} → ${groupLabel(match.group)}${match.qualifyingSlot}`
            : `Match ${match.index + 1}`}
        </span>
        <span className={`vb-ko-status ${match.status}`}>{status}</span>
      </div>
      {[match.a, match.b].map((id, side) => {
        const player = teams.get(id);
        const winner = !!id && match.winner === id;
        const placeholder = match.bye && !id && !match[`${side === 0 ? "a" : "b"}Source`] ? "Bye" : match[`${side === 0 ? "a" : "b"}Source`]
          ? pendingOpponent(match, side === 0 ? "a" : "b")
          : previousStage
            ? `Winner of ${previousStage} ${match.index * 2 + side + 1}`
            : "Awaiting qualifier";
        return (
          <div
            className={`vb-ko-opponent ${winner ? "vb-ko-winner" : ""} ${!player ? "vb-ko-pending" : ""}`}
            key={side}
          >
            <strong>{player?.name || placeholder}</strong>
            {match.status === "completed" && player && (
              <span
                className="vb-ko-scores"
                aria-label={`${player.name} ${match.bye ? "advances by bye" : "game scores"}`}
              >
                {match.games.map((game, i) => (
                  <b
                    key={i}
                    className={game[side] > game[1 - side] ? "won" : ""}
                  >
                    {game[side]}
                  </b>
                ))}
                {winner && <Check size={14} aria-label="Winner" />}
              </span>
            )}
          </div>
        );
      })}
    </article>
  );
}

export function VenuePlayoffs({ tournament, playoffs, teams }) {
  return <div className="venue-widget-scroll vb-scroll" data-auto-scroll="" tabIndex={0} aria-label={`${tournament.name} qualification playoffs`}>
    <p className="venue-widget-note">{playoffs.filter(m => m.status === "completed").length} / {playoffs.length} played · {scoringLabel(scoringRules(tournament, PLAYOFF_STAGE))}</p>
    <div className="vb-playoff-grid">{[...new Set(playoffs.map(m => m.group))].map(group => <section key={group}>
      <h4>Group {groupLabel(group)}</h4>
      {playoffs.filter(m => m.group === group).map(m => <BracketMatch key={m.id} match={m} teams={teams}/>)}
    </section>)}</div>
    {!playoffs.length && <p className="vb-empty">No qualification playoffs have been created for this tournament.</p>}
  </div>;
}

export default function VenueBracket({ tournament, rounds, teams }) {
  const canvas = useRef(null), space = useRef(null);
  const helpId = useId();
  const drawKey = `${tournament.id}:${rounds.map(round => `${round.round}:${round.matches.map(match => match.id).join(",")}`).join("|")}`;
  const { scale, dragging, fit, zoomIn, zoomOut, actualSize, boardProps } = useBracketBoard({ canvas, space, drawKey, rounds, teams });
  const matches = rounds.flatMap(round => round.matches).filter(m => !m.bye);
  return <div className="venue-knockout-content">
    <div className="vb-bracket-toolbar">
      <p className="venue-widget-note">{matches.filter(m => m.status === "completed").length} / {matches.length} played</p>
      <div className="vb-bracket-controls" role="group" aria-label="Bracket zoom controls">
        <Button variant="ghost" size="icon-sm" aria-label="Zoom out bracket" title="Zoom out (-)" onClick={zoomOut}><Minus size={16}/></Button>
        <output className="vb-bracket-zoom" aria-label="Bracket zoom">{Math.round(scale * 1000) / 10}%</output>
        <Button variant="ghost" size="icon-sm" aria-label="Zoom in bracket" title="Zoom in (+)" onClick={zoomIn}><Plus size={16}/></Button>
        <Button variant="ghost" size="sm" aria-label="Show bracket at 100%" title="Actual size" onClick={actualSize}>100%</Button>
        <Button variant="outline" size="sm" aria-label="Fit bracket to screen" title="Fit entire bracket (0 or Home)" onClick={fit}><Scan size={16}/> Fit</Button>
      </div>
    </div>
    <p id={helpId} className="vb-bracket-help">Drag to pan · Scroll or pinch to zoom · Arrow keys to move</p>
    <div className="vb-bracket-viewport" aria-label={`${tournament.name} knockout bracket`}>
      <div ref={space} className={`venue-bracket-space ${dragging ? "is-panning" : ""}`} tabIndex={0} role="region" aria-label={`${tournament.name} interactive knockout board`} aria-describedby={helpId} {...boardProps}><div ref={canvas} className="vb-bracket-canvas" style={{ "--bracket-rounds": rounds.length, "--bracket-slots": rounds[0].matches.length }}>
        {rounds.map((round, column) => <section key={round.round} className={`vb-bracket-round ${column === 0 ? "vb-first-round" : ""} ${column === rounds.length - 1 ? "vb-last-round" : ""}`} aria-label={`${tournament.name} ${round.stage} round`}>
          <h4>{round.stage}</h4><div className="vb-bracket-matches">{round.matches.map(match => <div key={match.id} className={`vb-bracket-cell ${match.index % 2 === 0 ? "vb-branch-upper" : "vb-branch-lower"} ${match.winner ? "vb-branch-decided" : ""}`} style={{ gridRow: `${match.index * 2 ** column + 1} / span ${2 ** column}` }}>
            <BracketMatch match={match} teams={teams} previousStage={rounds[column - 1]?.stage}/>
          </div>)}</div>
        </section>)}
      </div></div>
    </div>
  </div>;
}
