import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronRight, RefreshCw, Trophy } from "lucide-react";
import { groupLabel, scoringLabel } from "../../shared/format.js";
import { maintainerRequest } from "./maintainer-api.js";
import "./history.css";

const statusLabels = { completed: "Completed", registration: "Registration", ready: "Ready to play", ongoing: "In progress", upcoming: "Upcoming", live: "In play" };
const dateLabel = value => value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : null;
const entryLabel = size => size === 1 ? "Singles" : size === 2 ? "Doubles" : `${size} players per entry`;

// Only the visible level requests a page. Parent pages and cursors survive a
// drill-down; aborting on navigation also prevents stale responses replacing it.
function useHistoryPage(path, size, enabled, onLock) {
  const [data, setData] = useState(null), [error, setError] = useState(null), [loading, setLoading] = useState(false);
  const [cursors, setCursors] = useState([""]), [page, setPage] = useState(0), [reload, setReload] = useState(0);
  const revision = useRef(), lock = useRef(onLock);
  lock.current = onLock;
  const cursor = cursors[page];
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setLoading(true); setError(null); setData(null);
    const params = new URLSearchParams({ after: cursor, limit: String(size) });
    if (revision.current !== undefined) params.set("revision", revision.current);
    maintainerRequest(`${path}${path.includes("?") ? "&" : "?"}${params}`, undefined, controller.signal)
      .then(result => { if (!controller.signal.aborted) { revision.current = result.revision; setData(result); } })
      .catch(e => { if (!controller.signal.aborted) { if (e.status === 401) lock.current(); else setError(e); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, size, cursor, page, reload, enabled]);
  return {
    data, error, loading, page, size,
    refresh() { revision.current = undefined; setCursors([""]); setPage(0); setReload(n => n + 1); },
    next() { if (data?.nextCursor) { setCursors([...cursors.slice(0, page + 1), data.nextCursor]); setPage(page + 1); } },
    previous() { setPage(n => Math.max(0, n - 1)); },
  };
}

function useHeading(enabled, page = 0) {
  const ref = useRef(null);
  useEffect(() => { if (enabled) ref.current?.focus(); }, [enabled, page]);
  return ref;
}
function Status({ status }) { return <span className={`history-status history-status-${status}`}>{statusLabels[status] || status}</span>; }
function Results({ tournament }) {
  const awaiting = tournament.status !== "completed" && !tournament.archivedAt;
  return <dl className="history-results">
    <div><dt><Trophy size={15} aria-hidden="true"/>Winner</dt><dd>{tournament.winner?.name || (awaiting ? "Awaiting final" : "Not recorded")}</dd></div>
    <div><dt>Runner-up</dt><dd>{tournament.runnerUp?.name || (awaiting ? "Awaiting final" : "Not awarded")}</dd></div>
  </dl>;
}
function PageState({ pager, empty, children }) {
  if (pager.loading) return <p className="history-message" role="status">Loading history…</p>;
  if (pager.error) return <div className="history-message" role="alert"><p>{pager.error.message}</p><button onClick={pager.refresh}>Refresh this view</button></div>;
  if (!pager.data) return null;
  if (!pager.data.items.length) return <p className="history-message" role="status">{empty}</p>;
  return children;
}
function Pager({ pager, label }) {
  const total = pager.data?.total;
  return <nav className="history-pager" aria-label={`${label} pagination`}>
    <p role="status" aria-live="polite">{total === undefined ? "" : total === 0 ? `0 ${label}` : `${pager.page * pager.size + 1}–${Math.min((pager.page + 1) * pager.size, total)} of ${total} ${label} · Page ${pager.page + 1}`}</p>
    <div><button disabled={pager.loading || !!pager.error || pager.page === 0} onClick={pager.previous}><ArrowLeft size={16} aria-hidden="true"/>Previous</button>
      <button disabled={pager.loading || !!pager.error || !pager.data?.nextCursor} onClick={pager.next}>Next<ArrowRight size={16} aria-hidden="true"/></button></div>
  </nav>;
}
function Refresh({ pager }) { return <button disabled={pager.loading} onClick={pager.refresh}><RefreshCw size={15} aria-hidden="true"/>Refresh</button>; }

function CategoryHistory({ event, category, onBack, onLock }) {
  const [view, setView] = useState("matches");
  return <div className="maintainer-history">
    <nav className="history-breadcrumb" aria-label="History location"><button onClick={onBack}><ArrowLeft size={16} aria-hidden="true"/>{event.event.name || "Event"}</button><ChevronRight size={16} aria-hidden="true"/><span>{category.name}</span></nav>
    <CategoryPage key={view} {...{ event, category, view, setView, onLock }}/>
  </div>;
}
function CategoryPage({ event, category, view, setView, onLock }) {
  const pager = useHistoryPage(`maintainer/history/${event.eventId}/tournaments/${encodeURIComponent(category.id)}?view=${view}`, 20, true, onLock);
  const heading = useHeading(true, pager.page), result = pager.data?.tournament || category;
  return <>
    <div className="history-heading"><div><h2 ref={heading} tabIndex={-1}>{result.name}</h2><p>{entryLabel(result.size)} · {result.teams} entries · {result.completedMatches}/{result.matches} matches finished</p></div><Refresh pager={pager}/></div>
    {!pager.error && <div className="history-detail-summary"><div className="history-badges"><Status status={result.status}/>{result.archivedAt && <span className="history-status">Archived</span>}</div><Results tournament={result}/>
      {result.completedAt && <p>Final completed {dateLabel(result.completedAt)}</p>}{result.archivedAt && <p>Archived {dateLabel(result.archivedAt)}. Results reflect the last recorded state before removal.</p>}
      {pager.data?.rules && <details><summary>Scoring rules</summary><p>League: {scoringLabel(pager.data.rules.league)}<br/>Knockout: {scoringLabel(pager.data.rules.knockout)}</p></details>}
    </div>}
    <nav className="history-switcher" aria-label="Sub-tournament details">{["matches", "entries"].map(item => <button key={item} aria-current={view === item ? "page" : undefined} onClick={() => setView(item)}>{item === "matches" ? "Match results" : "Entries"}</button>)}</nav>
    <PageState pager={pager} empty={view === "matches" ? "No matches were recorded for this sub-tournament." : "No entries were recorded for this sub-tournament."}>
      <ul className="history-list history-detail-list">{pager.data?.items.map(item => <li key={item.id}>{view === "entries" ? <>
        <div className="history-heading"><h3>{item.name}</h3><span>Seed {item.seed}{item.group !== undefined && item.group !== null ? ` · Group ${groupLabel(item.group)}` : ""}</span></div>
        <p>{item.players.join(" · ")}</p>
      </> : <>
        <div className="history-heading"><span>{item.stage}{item.group !== undefined && item.group !== null ? ` · Group ${groupLabel(item.group)}` : ""}{item.court ? ` · Court ${item.court}` : ""}</span><Status status={item.status}/></div>
        <div className="history-match"><strong>{item.a}</strong><span aria-label="versus">vs</span><strong>{item.b}</strong></div>
        <p className="history-scores">{item.games?.length ? item.games.map(game => game.join("–")).join(" · ") : item.bye ? "Bye" : "No confirmed score"}</p>
        {item.winner && <p>Winner: <strong>{item.winner}</strong></p>}{item.completedAt ? <small>Completed {dateLabel(item.completedAt)}</small> : item.scheduled && <small>Scheduled {item.scheduled}</small>}
      </>}</li>)}</ul>
    </PageState>
    <Pager pager={pager} label={view}/>
  </>;
}

function EventHistory({ event, onBack, onLock }) {
  const [category, setCategory] = useState(null), enabled = !category;
  const pager = useHistoryPage(`maintainer/history/${event.eventId}`, 10, enabled, onLock);
  const heading = useHeading(enabled, pager.page), info = pager.data || event;
  return <>
    <div hidden={!enabled} className="maintainer-history">
      <nav className="history-breadcrumb" aria-label="History location"><button onClick={onBack}><ArrowLeft size={16} aria-hidden="true"/>All events</button><ChevronRight size={16} aria-hidden="true"/><span>{info.event?.name || "Event"}</span></nav>
      <div className="history-heading"><div><h2 ref={heading} tabIndex={-1}>{info.event?.name || "Unnamed event"}</h2><p>{event.owner} · {info.event?.venue || "Venue not recorded"}</p></div><Refresh pager={pager}/></div>
      <p>All sub-tournaments, including archived results. Winners and runners-up appear after the final is completed.</p>
      <PageState pager={pager} empty="This event has no recorded sub-tournaments yet.">
        <ul className="history-list">{pager.data?.items.map(item => <li key={item.id}>
          <div className="history-heading"><div><h3>{item.name}</h3><p>{entryLabel(item.size)} · {item.teams} entries · {item.completedMatches}/{item.matches} matches finished</p></div><div className="history-badges"><Status status={item.status}/>{item.archivedAt && <span className="history-status">Archived</span>}</div></div>
          <Results tournament={item}/><button className="history-open" onClick={() => setCategory(item)} aria-label={`View results for ${item.name}`}>View results and entries<ChevronRight size={16} aria-hidden="true"/></button>
        </li>)}</ul>
      </PageState>
      <Pager pager={pager} label="sub-tournaments"/>
    </div>
    {category && <CategoryHistory event={info} category={category} onBack={() => setCategory(null)} onLock={onLock}/>}
  </>;
}

export default function MaintainerHistory({ onLock }) {
  const [event, setEvent] = useState(null), enabled = !event;
  const pager = useHistoryPage("maintainer/history", 10, enabled, onLock), heading = useHeading(enabled, pager.page);
  return <section className="maintainer-history" aria-label="Event history">
    <div hidden={!enabled}>
      <div className="history-heading"><div><h2 ref={heading} tabIndex={-1}>All events</h2><p>Browse events by organizer, then open a sub-tournament for its podium and recorded matches.</p></div><Refresh pager={pager}/></div>
      <PageState pager={pager} empty="No events have been created yet.">
        <ul className="history-list">{pager.data?.items.map(item => <li key={item.eventId}>
          <div className="history-heading"><div><h3>{item.event?.name || (item.unavailable ? "Event temporarily unavailable" : "Unnamed event")}</h3><p className="history-owner">Organizer: {item.owner}</p></div>{!item.unavailable && <span className="history-status">{item.completed} completed</span>}</div>
          {item.unavailable ? <p>Could not retrieve this event. Open it to retry, or refresh this page.</p> : <p>{item.event.venue || "Venue not recorded"} · {item.tournaments} sub-tournaments{item.archived ? ` · ${item.archived} archived` : ""}</p>}
          <button className="history-open" onClick={() => setEvent(item)} aria-label={`View event for ${item.owner}`}>View sub-tournaments<ChevronRight size={16} aria-hidden="true"/></button>
        </li>)}</ul>
      </PageState>
      <Pager pager={pager} label="events"/>
      <p className="history-footnote">History includes current data and sub-tournaments archived since history was introduced. Previously deleted records cannot be recovered.</p>
    </div>
    {event && <EventHistory event={event} onBack={() => setEvent(null)} onLock={onLock}/>}
  </section>;
}
