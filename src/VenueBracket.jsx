import React, { useLayoutEffect, useRef } from "react";
import { Check } from "lucide-react";

function BracketMatch({ match, teams, previousStage }) {
  const ready = !!match.a && !!match.b;
  const status =
    match.status === "completed"
      ? "Final score"
      : match.status === "live"
        ? `Court ${match.court} · On court`
        : match.held
          ? "On hold"
          : ready
            ? "Ready"
            : "Awaiting opponents";
  return (
    <article
      className={`vb-ko-card ${match.status} ${match.stage === "Final" ? "vb-ko-final" : ""}`}
      aria-label={`${match.stage} ${match.index + 1}`}
    >
      <div className="vb-ko-meta">
        <span>Match {match.index + 1}</span>
        <span className={`vb-ko-status ${match.status}`}>{status}</span>
      </div>
      {[match.a, match.b].map((id, side) => {
        const player = teams.get(id);
        const winner = !!id && match.winner === id;
        const placeholder = previousStage
          ? `Winner of ${previousStage} ${match.index * 2 + side + 1}`
          : "Awaiting qualifier";
        return (
          <div
            className={`vb-ko-opponent ${winner ? "vb-ko-winner" : ""} ${!player ? "vb-ko-pending" : ""}`}
            key={side}
          >
            <strong>{player?.name || placeholder}</strong>
            {match.status === "completed" && (
              <span
                className="vb-ko-scores"
                aria-label={`${player?.name} game scores`}
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

export default function VenueBracket({ tournament, rounds, teams }) {
  const canvas = useRef(null);
  // Keep round centers aligned even when long player names make cards taller.
  useLayoutEffect(() => {
    const element = canvas.current;
    const cards = [...element.querySelectorAll(".vb-ko-card")];
    const measure = () => {
      const height = Math.max(
        150,
        ...cards.map(
          (card) => Math.ceil(card.getBoundingClientRect().height) + 24,
        ),
      );
      element.style.setProperty("--vb-bracket-row", `${height}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [rounds, teams]);
  const completed = rounds
    .flatMap((round) => round.matches)
    .filter((m) => m.status === "completed").length;
  const total = rounds.reduce((sum, round) => sum + round.matches.length, 0);
  return (
    <section
      className="vb-bracket-section"
      aria-label={`${tournament.name} knockout bracket`}
    >
      <div className="vb-section-heading">
        <h3>Knockout bracket</h3>
        <span>
          {completed} / {total} played
        </span>
      </div>
      <div
        className="vb-bracket-viewport vb-scroll"
        tabIndex={0}
        aria-label={`${tournament.name} bracket, automatically scrolling`}
        data-auto-scroll=""
        data-scroll-axis="both"
      >
        <div
          ref={canvas}
          className="vb-bracket-canvas"
          style={{
            "--bracket-rounds": rounds.length,
            "--bracket-slots": rounds[0].matches.length,
          }}
        >
          {rounds.map((round, column) => (
            <section
              key={round.round}
              className={`vb-bracket-round ${column === 0 ? "vb-first-round" : ""} ${column === rounds.length - 1 ? "vb-last-round" : ""}`}
              aria-label={`${tournament.name} ${round.stage} round`}
            >
              <h4>{round.stage}</h4>
              <div className="vb-bracket-matches">
                {round.matches.map((match) => (
                  <div
                    key={match.id}
                    className={`vb-bracket-cell ${match.index % 2 === 0 ? "vb-branch-upper" : "vb-branch-lower"} ${match.winner ? "vb-branch-decided" : ""}`}
                    style={{
                      gridRow: `${match.index * 2 ** column + 1} / span ${2 ** column}`,
                    }}
                  >
                    <BracketMatch
                      match={match}
                      teams={teams}
                      previousStage={rounds[column - 1]?.stage}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
