import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { knockoutDependents } from "../../shared/knockouts.js";
import { isLinkedPlayoffs } from "../../shared/format.js";
import MatchCard from "./MatchCard.jsx";

function measurePaths(canvas, matches, dependents) {
  const bounds = canvas.getBoundingClientRect();
  const positions = new Map([...canvas.querySelectorAll("[data-match-id]")].map(card => {
    const rect = card.getBoundingClientRect();
    return [card.dataset.matchId, {
      left: rect.left - bounds.left,
      right: rect.right - bounds.left,
      y: rect.top + rect.height / 2 - bounds.top,
    }];
  }));
  return matches.flatMap(source => (dependents.get(source.id) || []).map(target => {
    const from = positions.get(source.id);
    const to = positions.get(target.id);
    const bend = (from.right + to.left) / 2;
    // A manually moved feeder can skip a column or feed a match to its left.
    const d = target.round === source.round + 1
      ? `M ${from.right} ${from.y} H ${bend} V ${to.y} H ${to.left}`
      : `M ${from.right} ${from.y} H ${from.right + 8} V ${bounds.height - 8} H ${to.left - 8} V ${to.y} H ${to.left}`;
    return { from: source.id, to: target.id, advanced: !!source.winner, d };
  }));
}

export default function StandingsBracket({ tournament, matches }) {
  const canvas = useRef(null);
  const [paths, setPaths] = useState([]);
  const { rounds, dependents } = useMemo(() => {
    const rounds = new Map();
    for (const match of matches) {
      if (!rounds.has(match.round)) rounds.set(match.round, []);
      rounds.get(match.round).push(match);
    }
    return { rounds: [...rounds].sort(([a], [b]) => a - b), dependents: knockoutDependents(matches) };
  }, [matches]);

  useLayoutEffect(() => {
    const node = canvas.current;
    const update = () => setPaths(measurePaths(node, matches, dependents));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    node.querySelectorAll("[data-match-id]").forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [matches, dependents]);

  return <div className="bracket" id={`bracket-${tournament.id}`} role="region" tabIndex={0}
    aria-label={`${tournament.name} knockout bracket; scroll for all rounds`}>
    <div className="bracket-canvas" ref={canvas}>
      <svg className="bracket-connectors" aria-hidden="true" focusable="false">
        {paths.map(path => <path key={`${path.from}:${path.to}`} data-from-match={path.from} data-to-match={path.to}
          className={path.advanced ? "advanced" : undefined} d={path.d}/>)}
      </svg>
      {rounds.map(([round, fixtures]) => <div className="bracket-round" key={round}>
        <h3>{isLinkedPlayoffs(tournament) ? (fixtures[0].stage === "Final" ? "Grand Final" : "Grand Semifinals") : fixtures[0].stage}</h3>
        <div>{fixtures.map(match => <div className="bracket-card" key={match.id} data-match-id={match.id}>
          <MatchCard m={match} compact/>
        </div>)}</div>
      </div>)}
    </div>
  </div>;
}
