import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import BracketTeam from "./components/BracketTeam.jsx";
import { knockoutSource } from "../shared/knockouts.js";
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
      aria-label={match.stageLabel || `${match.stage} ${match.index + 1}`}
    >
      <div className="vb-ko-meta">
        <span>
          {match.stage === PLAYOFF_STAGE
            ? `${match.playoffRanks.join(" vs ")} → ${groupLabel(match.group)}${match.qualifyingSlot}`
            : match.stageLabel?.startsWith("Grand ") ? match.stageLabel : `Match ${match.index + 1}`}
        </span>
        <span className={`vb-ko-status ${match.status}`}>{status}</span>
      </div>
      {[match.a, match.b].map((id, side) => {
        const player = teams.get(id);
        const winner = !!id && match.winner === id;
        const placeholder = match.bye && !id && !match[`${side === 0 ? "a" : "b"}Source`] ? "Bye" : match[`${side === 0 ? "a" : "b"}Source`]
          ? pendingOpponent(match, side === 0 ? "a" : "b")
          : previousStage
            ? `Winner of ${previousStage === "Grand Semifinals" ? "Grand Semifinal" : previousStage} ${match.index * 2 + side + 1}`
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

export const VENUE_MATCHES_PER_SCREEN = 4;
const PAGE_INTERVAL = 7000;

function bracketPageRounds(rounds, level, screen) {
  const start = screen * VENUE_MATCHES_PER_SCREEN;
  const activeMatches = rounds[level].matches;
  const pageMatches = activeMatches.slice(start, start + VENUE_MATCHES_PER_SCREEN);
  // Preview one adjacent match to fill the first row while retaining the original page boundaries.
  const adjacent = activeMatches[start + pageMatches.length] ?? activeMatches[start - 1];
  if (adjacent) pageMatches.push(adjacent);
  const selected = new Set(pageMatches.map(match => match.id));
  const matches = rounds.flatMap(round => round.matches);
  const sourceIds = match => ["a", "b"].map(side => knockoutSource(matches, match, side).matchId);

  // Follow the displayed matches into the remaining rounds, including the final.
  for (const round of rounds.slice(level + 1)) {
    for (const match of round.matches) {
      if (match.stage === "Final" || sourceIds(match).some(id => selected.has(id))) selected.add(match.id);
    }
  }
  const centers = new Map();
  return rounds.slice(level).flatMap((round, index) => {
    const matches = round.matches.filter(match => selected.has(match.id));
    if (!matches.length) return [];
    const spacing = 1 / Math.max(3, pageMatches.length, matches.length);
    const cards = matches.map((match, index) => {
      const sources = sourceIds(match).filter(id => centers.has(id));
      const center = sources.length
        ? sources.reduce((sum, id) => sum + centers.get(id), 0) / sources.length
        : (index + 0.5) / matches.length;
      return { match, sources, center };
    }).sort((a, b) => a.center - b.center);
    let leftmost = spacing / 2;
    cards.forEach((card, index) => {
      // Keep the feeder alignment where space allows and keep neighboring cards apart.
      const rightmost = 1 - spacing * (cards.length - index - 0.5);
      card.center = Math.min(rightmost, Math.max(leftmost, card.center));
      centers.set(card.match.id, card.center);
      leftmost = card.center + spacing;
    });
    return [{ round: round.round, stage: round.stage, previousStage: rounds[level + index - 1]?.stage, cards, spacing }];
  });
}

function connectorPaths(flow, cards) {
  const container = flow.getBoundingClientRect();
  const positions = new Map([...flow.querySelectorAll("[data-venue-match]")].map(card => {
    const bounds = card.getBoundingClientRect();
    return [card.dataset.venueMatch, {
      x: bounds.left + bounds.width / 2 - container.left,
      top: bounds.top - container.top,
      bottom: bounds.bottom - container.top,
      column: Array.from(card.parentElement.children).indexOf(card),
      row: Number(card.parentElement.dataset.roundRow),
    }];
  }));
  return cards.flatMap(({ match, sources }) => sources.map(id => {
    const from = positions.get(id);
    const to = positions.get(match.id);
    const bend = from.bottom + 5 + to.column * 4;
    let d = `M ${from.x} ${from.bottom} V ${bend} H ${to.x} V ${to.top}`;
    if (to.row - from.row > 1) {
      const edge = container.width - 3 - Math.min(to.column, 2) * 3;
      d = `M ${from.x} ${from.bottom} V ${bend} H ${edge} V ${to.top - 8} H ${to.x} V ${to.top}`;
    }
    return { id: `${id}-${match.id}`, d };
  }));
}

function BracketPage({ rounds, view, teams, motion, onScroll, outgoing = false }) {
  const { level, screen } = view;
  const rows = useMemo(() => bracketPageRounds(rounds, level, screen), [rounds, level, screen]);
  const flow = useRef(null);
  const [paths, setPaths] = useState([]);
  useLayoutEffect(() => {
    const node = flow.current;
    const cards = rows.flatMap(row => row.cards);
    const update = () => setPaths(connectorPaths(node, cards));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    node.querySelectorAll(".vb-paged-round").forEach(row => observer.observe(row));
    return () => observer.disconnect();
  }, [rows]);
  return <div className={`vb-bracket-page ${motion}`} role="region" aria-label="Knockout match cards"
    inert={outgoing || undefined} aria-hidden={outgoing || undefined} tabIndex={outgoing ? undefined : 0} onScroll={onScroll}>
    <div className="vb-card-flow" ref={flow}>
      {rows.map((row, index) => <section key={row.round} className="vb-paged-round" aria-label={row.stage}>
        <h4>{row.stage}</h4>
        <div className="vb-paged-round-cards" data-round-row={index} style={{ "--bracket-card-width": `${row.spacing * 100}%` }}>
          {row.cards.map(({ match, center }) => <div key={match.id} data-venue-match={match.id} style={{ "--bracket-card-center": `${center * 100}%` }}>
            <BracketMatch match={match} teams={teams} previousStage={row.previousStage}/>
          </div>)}
        </div>
      </section>)}
      <svg className="vb-paged-connectors" aria-hidden="true">
        {paths.map(({ id, d }) => <path key={id} d={d}/>)}
      </svg>
    </div>
  </div>;
}

export function PagedVenueBracket({ tournament, rounds, teams, view, playing, advance }) {
  const advanceRef = useRef(advance);
  const restartRotation = useRef(null);
  useEffect(() => { advanceRef.current = advance; }, [advance]);
  useEffect(() => {
    if (!playing || view.totalScreens <= 1) return;
    let timer;
    const restart = () => {
      clearInterval(timer);
      timer = setInterval(() => advanceRef.current(), PAGE_INTERVAL);
    };
    restartRotation.current = restart;
    restart();
    return () => {
      clearInterval(timer);
      restartRotation.current = null;
    };
  }, [playing, view.level, view.screen, view.totalScreens]);
  const matches = rounds.flatMap(round => round.matches).filter(match => !match.bye);
  const motion = view.previous ? `vb-slide-${view.direction}` : "";
  const previous = view.previous;
  const showPrevious = previous && rounds[previous.level]?.matches[previous.screen * VENUE_MATCHES_PER_SCREEN];
  const step = view.step ?? 0;
  return <div className="venue-knockout-content">
    <p className="venue-widget-note">{matches.filter(match => match.status === "completed").length} / {matches.length} played · Knockout Matches</p>
    <div className="vb-paged-bracket" role="region" aria-label={`${tournament.name} knockout bracket`}
      onWheel={() => restartRotation.current?.()}>
      {showPrevious && <BracketPage key={step - 1} rounds={rounds} teams={teams} view={previous} outgoing motion={`${motion} vb-page-out`}/>}
      <BracketPage key={step} rounds={rounds} teams={teams} view={view} motion={showPrevious ? motion : ""}
        onScroll={() => restartRotation.current?.()}/>
    </div>
  </div>;
}
