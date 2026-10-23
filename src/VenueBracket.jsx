import React from "react";
import BracketTeam from "./components/BracketTeam.jsx";
import {
  PLAYOFF_STAGE,
  scoringRules,
  scoringLabel,
  pendingOpponent,
  groupLabel,
} from "../shared/format.js";

function BracketMatch({ match, teams, previousStage, slotProps }) {
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
        return <BracketTeam key={side} team={player} placeholder={placeholder} winner={winner}
          games={match.games} side={side} completed={match.status === "completed"} bye={match.bye}
          slotProps={slotProps?.(match, side === 0 ? "a" : "b", player, placeholder)}/>;
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

export default function VenueBracket({ tournament, rounds, teams, slotProps }) {
  const matches = rounds.flatMap(round => round.matches).filter(m => !m.bye);
  return <div className="venue-knockout-content">
    <p className="venue-widget-note">{matches.filter(m => m.status === "completed").length} / {matches.length} played</p>
    <div className="vb-bracket-tree vb-scroll" data-auto-scroll="" tabIndex={0} role="region" aria-label={`${tournament.name} knockout bracket`}>
      {rounds.map((round, index) => <section key={round.round} className={`vb-bracket-round ${index === 0 ? "vb-first-round" : ""} ${index === rounds.length - 1 ? "vb-last-round" : ""}`} aria-label={`${tournament.name} ${round.stage} round`}>
        <h4>{round.stage}</h4>
        <div className="vb-bracket-row-scroll vb-scroll" data-auto-scroll="" data-scroll-axis="x" tabIndex={0} role="region" aria-label={`${round.stage} matches, scroll horizontally for all teams`}>
          <div className="vb-bracket-matches" style={{ "--round-matches": round.matches.length }}>
            {round.matches.map(match => <div key={match.id} className={`vb-bracket-cell ${match.index % 2 === 0 ? "vb-branch-upper" : "vb-branch-lower"} ${match.winner ? "vb-branch-decided" : ""}`}>
              <BracketMatch match={match} teams={teams} previousStage={rounds[index - 1]?.stage} slotProps={slotProps}/>
            </div>)}
          </div>
        </div>
      </section>)}
    </div>
  </div>;
}
