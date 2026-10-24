import React, { useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import LiveScores from "../cloud/LiveScores.jsx";
import { Button } from "./ui/button.jsx";

export default function SharedLiveScores({ matches, teams, tournaments, flow }) {
  const scroll = useRef(null);
  const [edges, setEdges] = useState({ previous: false, next: false });
  const measure = () => {
    const node = scroll.current;
    if (node) setEdges({ previous: node.scrollLeft > 1, next: node.scrollLeft + node.clientWidth < node.scrollWidth - 1 });
  };
  useLayoutEffect(() => {
    const node = scroll.current, observer = new ResizeObserver(measure);
    measure(); observer.observe(node); observer.observe(node.firstElementChild);
    return () => observer.disconnect();
  }, [flow, matches]);
  const move = direction => {
    const node = scroll.current;
    if (node) node.scrollBy({ left: direction * ((node.querySelector(".live-score-card")?.getBoundingClientRect().width || node.clientWidth) + 12), behavior: "smooth" });
  };
  return <section className={`venue-shared-live ${flow}`} aria-label="Live scores across all matches">
    <header className="venue-widget-heading">
      <h3>Live scores <small>All matches · {matches.length} on court</small></h3>
      {flow === "horizontal" && <div className="flex gap-1">
        <Button variant="ghost" size="icon-sm" aria-label="Previous live matches" disabled={!edges.previous} onClick={() => move(-1)}><ChevronLeft/></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Next live matches" disabled={!edges.next} onClick={() => move(1)}><ChevronRight/></Button>
      </div>}
    </header>
    <div ref={scroll} className="venue-shared-live-scroll vb-scroll" data-auto-scroll="" data-scroll-axis={flow === "horizontal" ? "x" : "y"}
      tabIndex={0} aria-label={flow === "horizontal" ? "Live matches, scroll horizontally" : "Live matches, scroll for more"} onScroll={measure}>
      <LiveScores matches={matches} teams={teams} tournaments={tournaments}/>
    </div>
  </section>;
}
