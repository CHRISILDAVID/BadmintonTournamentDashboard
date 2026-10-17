import React, { useLayoutEffect, useRef } from "react";
import { Check } from "lucide-react";
import {
  PLAYOFF_STAGE,
  scoringRules,
  scoringLabel,
  pendingOpponent,
} from "../shared/format.js";

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
        <span>
          {match.stage === PLAYOFF_STAGE
            ? `${match.playoffRanks.join(" vs ")} → ${String.fromCharCode(65 + match.group)}${match.qualifyingSlot}`
            : `Match ${match.index + 1}`}
        </span>
        <span className={`vb-ko-status ${match.status}`}>{status}</span>
      </div>
      {[match.a, match.b].map((id, side) => {
        const player = teams.get(id);
        const winner = !!id && match.winner === id;
        const placeholder = match[`${side === 0 ? "a" : "b"}Source`]
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

export default function VenueBracket({
  tournament,
  rounds,
  teams,
  playoffs = [],
}) {
  const canvas = useRef(null);
  const viewport = useRef(null);
  // Measure unscaled cards so resizing never feeds the previous scale back in.
  useLayoutEffect(() => {
    const element = canvas.current;
    const frame = viewport.current;
    const cards = [...element.querySelectorAll(".vb-ko-card")];
    const measure = () => {
      const row = Math.max(118, ...cards.map((card) => card.offsetHeight + 16));
      element.style.setProperty("--vb-bracket-row", `${row}px`);
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const scale = Math.min(
        1.5,
        frame.clientWidth / width,
        frame.clientHeight / height,
      );
      // Spread the rounds over the available height when width limits the scale.
      if (scale > 0) {
        const headings = [
          ...element.querySelectorAll(".vb-bracket-round > h4"),
        ];
        const headingHeight = Math.max(
          ...headings.map((heading) => heading.offsetHeight),
        );
        const expandedRow = Math.floor(
          (frame.clientHeight / scale - headingHeight) /
            rounds[0].matches.length,
        );
        element.style.setProperty(
          "--vb-bracket-row",
          `${Math.max(row, expandedRow)}px`,
        );
      }
      element.style.transform = `scale(${scale})`;
      element.style.left = `${Math.max(0, (frame.clientWidth - width * scale) / 2)}px`;
      element.style.top = `${Math.max(0, (frame.clientHeight - element.offsetHeight * scale) / 2)}px`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(element);
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [rounds, teams]);
  const completed = rounds
    .flatMap((round) => round.matches)
    .filter((m) => m.status === "completed").length;
  const total = rounds.reduce((sum, round) => sum + round.matches.length, 0);
  const showPlayoffs = playoffs.some((m) => m.status !== "completed");
  return (
    <div className={`vb-postseason ${showPlayoffs ? "vb-with-playoffs" : ""}`}>
      {showPlayoffs && (
        <section
          className="vb-playoff-section"
          aria-label={`${tournament.name} qualification playoffs`}
        >
          <div className="vb-section-heading">
            <h3>Qualification Playoffs</h3>
            <span>
              {playoffs.filter((m) => m.status === "completed").length} /{" "}
              {playoffs.length} played
            </span>
          </div>
          <div className="vb-playoff-rules">
            {scoringLabel(scoringRules(tournament, PLAYOFF_STAGE))}
          </div>
          <div
            className="vb-playoff-list vb-scroll"
            data-auto-scroll=""
            tabIndex={0}
            aria-label={`${tournament.name} qualification playoff matches, automatically scrolling`}
          >
            <div className="vb-playoff-grid">
              {[...new Set(playoffs.map((m) => m.group))].map((group) => (
                <section
                  key={group}
                  aria-label={`Group ${String.fromCharCode(65 + group)} qualification playoffs`}
                >
                  <h5>Group {String.fromCharCode(65 + group)}</h5>
                  {playoffs
                    .filter((m) => m.group === group)
                    .map((m) => (
                      <BracketMatch key={m.id} match={m} teams={teams} />
                    ))}
                </section>
              ))}
            </div>
          </div>
        </section>
      )}
      <section
        className="vb-bracket-section"
        aria-label={`${tournament.name} knockout bracket`}
      >
        <div className="vb-section-heading">
          <h3>Knockouts</h3>
          <span>
            {completed} / {total} played
          </span>
        </div>
        <div className="vb-bracket-viewport" ref={viewport}>
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
    </div>
  );
}
