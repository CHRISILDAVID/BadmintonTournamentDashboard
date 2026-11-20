import React, { useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import LiveScores from "../cloud/LiveScores.jsx";
import { Button } from "./ui/button.jsx";

export default function SharedLiveScores({ matches, teams, tournaments, tournament, flow = "horizontal", showHeading = true }) {
  const scroll = useRef(null);
  const horizontal = matches.length > 5 || flow === "horizontal";
  const [edges, setEdges] = useState({ previous: false, next: false });
  const measure = () => {
    const node = scroll.current;
    if (!node) return;
    const previous = node.scrollLeft > 1;
    const next = node.scrollLeft + node.clientWidth < node.scrollWidth - 1;
    setEdges(current => current.previous === previous && current.next === next ? current : { previous, next });
  };
  useLayoutEffect(() => {
    const node = scroll.current, observer = new ResizeObserver(measure);
    measure(); observer.observe(node); observer.observe(node.firstElementChild);
    return () => observer.disconnect();
  }, [horizontal, matches.length]);
  const move = direction => {
    const node = scroll.current;
    if (node) node.scrollBy({ left: direction * ((node.querySelector(".live-score-card")?.getBoundingClientRect().width || node.clientWidth) + 8), behavior: "smooth" });
  };
  const controls = horizontal && <div className="venue-live-arrows">
        <Button variant="ghost" size="icon-sm" aria-label="Previous live matches" disabled={!edges.previous} onClick={() => move(-1)}><ChevronLeft/></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Next live matches" disabled={!edges.next} onClick={() => move(1)}><ChevronRight/></Button>
      </div>;
  return <section className={`venue-live-strip ${horizontal ? "horizontal" : "wrap"} ${showHeading ? "venue-shared-live" : "venue-widget-live"}`}
    aria-label={showHeading ? "Live scores across all matches" : `${tournament.name} live scores`}>
    {showHeading ? <header className="venue-widget-heading">
      <h3>Live scores <small>All matches · {matches.length} on court</small></h3>
      {controls}
    </header> : (edges.next || edges.previous) && controls}
    <div ref={scroll} className="venue-shared-live-scroll vb-scroll" data-auto-scroll={horizontal ? "" : undefined}
      data-scroll-axis={horizontal ? "x" : undefined}
      tabIndex={0} aria-label={horizontal ? "Live matches, scroll horizontally" : "Live matches, scroll for more"} onScroll={measure}>
      <LiveScores matches={matches} teams={teams} tournaments={tournaments} tournament={tournament}/>
    </div>
  </section>;
}
