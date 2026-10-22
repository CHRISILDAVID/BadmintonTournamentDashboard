import React, { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { useDesk } from "../hooks/useDesk.jsx";

import MatchTable from "../components/MatchTable.jsx";
import StageActions from "../components/StageActions.jsx";

import { Button } from "../components/ui/button.jsx";
import SearchField from "../components/SearchField.jsx";

import { NativeSelect } from "../components/ui/native-select.jsx";
import PageLink from "../components/PageLink.jsx";
import { Empty } from "../components/common.jsx";
import { cloudEnabled, currentSession } from "../cloud/storage.js";

function Matches({ history = false, onScore }) {
  const { state, filter, busy, admin, umpire, selected, live, upcoming, completed, categorySelect, team, tournament, open, setPage,
    matchStatus: status, setMatchStatus: setStatus, matchQuery: query, setMatchQuery: setQuery, matchStage: stage, setMatchStage: setStage } = useDesk();
  const [testTools, setTestTools] = useState(false);
  const openScorer = match => onScore ? onScore(match) : open({ type: "scorer", matchId: match.id });
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/features", { signal: controller.signal })
      .then(r => r.ok ? r.json() : {})
      .then(features => setTestTools(!!features.testTools))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const unfinishedCount = selected.filter(m => m.status !== "completed" && !m.bye).length;
  const waiting = selected.filter(m => m.status === "upcoming" && (!m.a || !m.b));
  const matches = (history ? completed : [...live, ...upcoming, ...waiting, ...completed]).filter(
    (m) =>
      (history || status === "all" || m.status === status) &&
      (history || stage === "all" || (stage === "postseason" ? m.stage !== "League" : m.stage === stage)) &&
      `${team(m.a)?.name} ${team(m.b)?.name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const filtered = !!query || (!umpire && filter !== "all") || (!history && (status !== "all" || stage !== "all"));
  const hasRecords = state.matches.some(m => !history || m.status === "completed");
  const reset = () => {
    setPage(history ? "History" : "Matches", { filter: umpire ? filter : "all", matchQuery: "", ...(history ? {} : { matchStatus: "all", matchStage: "all" }) });
    requestAnimationFrame(() => document.querySelector("#match-filters input")?.focus());
  };
  return (
    <section className="panel matches-panel">
      <div className="toolbar match-filters" id="match-filters" tabIndex={-1}>
        <SearchField label="Search players" placeholder="Type a player or team name…" value={query} onChange={setQuery}/>
        <label className="filter-control"><span className="control-label">Tournament</span>{categorySelect}</label>
        {!history && (
          <label className="filter-control"><span className="control-label">Status</span><NativeSelect
            aria-label="Match status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="live">On court</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
          </NativeSelect></label>
        )}
        {!history && <label className="filter-control"><span className="control-label">Stage</span><NativeSelect aria-label="Match stage" value={stage} onChange={e => setStage(e.target.value)}>
          <option value="all">All stages</option><option value="League">League</option>
          <option value="postseason">Playoffs & knockouts</option>
        </NativeSelect></label>}
      </div>
      <div className="results-summary">
        <span role="status" aria-live="polite" aria-atomic="true"><strong>{matches.length}</strong> of {history ? completed.length : selected.length} {history ? "results" : "matches"}{filter !== "all" ? ` · ${tournament(filter)?.name}` : " · All tournaments"}{query && <> · Search: “{query}”</>}</span>
        {filtered && <Button variant="ghost" onClick={reset}>Reset filters</Button>}
        <a href="#match-filters" className="filter-return">Filters ↑</a>
        {currentSession()?.role !== "umpire" && <Button variant="outline" asChild
          className="btn"
        >
          <PageLink page={history ? "Matches" : "History"}>
          {history ? "All matches" : "Match history"}
          <ArrowUpRight size={15} />
          </PageLink>
        </Button>}
      </div>
      {!history && <StageActions />}
      {cloudEnabled() && !history && live.length > 0 && <details className="point-scoring-disclosure">
        <summary>{live.length} on court · Quick scoring access</summary>
        <p>All on-court matches in the selected tournament, independent of search, status and stage filters.</p>
        <div className="point-scoring-toolbar" aria-label="Point scoring">{live.map(m => <Button key={m.id} variant="outline" className="point-scoring-match" aria-label={`Open scorer: ${team(m.a)?.name} vs ${team(m.b)?.name}`} onClick={() => openScorer(m)}>
          <strong>{team(m.a)?.name} vs {team(m.b)?.name}</strong><small>Court {m.court} · Open scorer</small>
        </Button>)}</div>
      </details>}
      {!history && admin && testTools && <div className="toolbar">
        <Button variant="destructive" className="btn danger" disabled={busy || !unfinishedCount}
          onClick={() => open({ type: "randomComplete", tournament: filter === "all" ? undefined : tournament(filter) })}>
          Testing: complete unfinished matches
        </Button>
        <span className="help-text">{unfinishedCount} unfinished games in {filter === "all" ? "all tournaments" : tournament(filter)?.name}, across every stage. Uses random scores.</span>
      </div>}
      {!matches.length && filtered && hasRecords ? <Empty title="No matches found" action={<Button variant="outline" onClick={reset}>Reset filters</Button>}>Try another player name or reset your filters to see {history ? "completed" : "all"} matches.</Empty> : <MatchTable matches={matches} history={history} onScore={openScorer} />}
    </section>
  );
}

export default Matches;
