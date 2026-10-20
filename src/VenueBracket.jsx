import React, { useLayoutEffect, useRef } from "react";
import { Check } from "lucide-react";
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
  const canvas = useRef(null), viewport = useRef(null), space = useRef(null);
  useLayoutEffect(() => {
    const element = canvas.current, frame = viewport.current;
    const cards = [...element.querySelectorAll(".vb-ko-card")];
    const measure = () => {
      const width = rounds.length * 310 + (rounds.length - 1) * 26;
      element.style.width = `${width}px`;
      const row = Math.max(118, ...cards.map(card => card.offsetHeight + 20));
      element.style.setProperty("--vb-bracket-row", `${row}px`);
      // Keep names readable. Large draws scroll instead of shrinking to tiny text.
      const scale = Math.max(0.85, Math.min(1.25, frame.clientWidth / width, frame.clientHeight / element.offsetHeight));
      element.style.transform = `scale(${scale})`;
      space.current.style.width = `${Math.ceil(width * scale)}px`;
      space.current.style.height = `${Math.ceil(element.offsetHeight * scale)}px`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame); cards.forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [rounds, teams]);
  const matches = rounds.flatMap(round => round.matches).filter(m => !m.bye);
  return <div className="venue-knockout-content">
    <p className="venue-widget-note">{matches.filter(m => m.status === "completed").length} / {matches.length} played · Scroll to explore the draw</p>
    <div className="vb-bracket-viewport vb-scroll" ref={viewport} tabIndex={0} data-auto-scroll="" data-scroll-axis="both" aria-label={`${tournament.name} knockout bracket, scroll for all rounds`}>
      <div ref={space} className="venue-bracket-space"><div ref={canvas} className="vb-bracket-canvas" style={{ "--bracket-rounds": rounds.length, "--bracket-slots": rounds[0].matches.length }}>
        {rounds.map((round, column) => <section key={round.round} className={`vb-bracket-round ${column === 0 ? "vb-first-round" : ""} ${column === rounds.length - 1 ? "vb-last-round" : ""}`} aria-label={`${tournament.name} ${round.stage} round`}>
          <h4>{round.stage}</h4><div className="vb-bracket-matches">{round.matches.map(match => <div key={match.id} className={`vb-bracket-cell ${match.index % 2 === 0 ? "vb-branch-upper" : "vb-branch-lower"} ${match.winner ? "vb-branch-decided" : ""}`} style={{ gridRow: `${match.index * 2 ** column + 1} / span ${2 ** column}` }}>
            <BracketMatch match={match} teams={teams} previousStage={rounds[column - 1]?.stage}/>
          </div>)}</div>
        </section>)}
      </div></div>
    </div>
  </div>;
}
