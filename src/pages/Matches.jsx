import React, { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { useDesk } from "../hooks/useDesk.jsx";

import MatchTable from "../components/MatchTable.jsx";
import StageActions from "../components/StageActions.jsx";

import { Button } from "../components/ui/button.jsx";
import SearchField from "../components/SearchField.jsx";

import { NativeSelect } from "../components/ui/native-select.jsx";
import PageLink from "../components/PageLink.jsx";
import { cloudEnabled } from "../cloud/storage.js";
import Scorer from "../cloud/Scorer.jsx";

function Matches({ history = false }) {
  const { state, filter, busy, admin, selected, live, upcoming, completed, categorySelect, team, tournament, open,
    matchStatus: status, setMatchStatus: setStatus, matchQuery: query, setMatchQuery: setQuery, matchStage: stage, setMatchStage: setStage } = useDesk();
  const [testTools, setTestTools] = useState(false);
  const [scoring, setScoring] = useState(null);
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
  if (scoring) return <Scorer match={scoring} teams={state.teams} category={tournament(scoring.tournamentId)} onClose={() => setScoring(null)}/>;
  return (
    <section className="panel">
      {!history && <StageActions />}
      {cloudEnabled() && !history && live.length > 0 && <div className="toolbar">
        <span>Point scoring</span>{live.map(m => <Button key={m.id} variant="outline" onClick={() => setScoring(m)}>Court {m.court} · Open scorer</Button>)}
      </div>}
      <div className="toolbar">
        <SearchField placeholder="Find a match…" value={query} onChange={setQuery}/>
        {categorySelect}
        {!history && (
          <NativeSelect
            aria-label="Match status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="live">On court</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
          </NativeSelect>
        )}
        {!history && <NativeSelect aria-label="Match stage" value={stage} onChange={e => setStage(e.target.value)}>
          <option value="all">All stages</option><option value="League">League</option>
          <option value="postseason">Playoffs & knockouts</option>
        </NativeSelect>}
        <Button variant="outline" asChild
          className="btn"
        >
          <PageLink page={history ? "Matches" : "History"}>
          {history ? "All matches" : "Match history"}
          <ArrowUpRight size={15} />
          </PageLink>
        </Button>
      </div>
      {!history && admin && testTools && <div className="toolbar">
        <Button variant="destructive" className="btn danger" disabled={busy || !unfinishedCount}
          onClick={() => open({ type: "randomComplete", tournament: filter === "all" ? undefined : tournament(filter) })}>
          Testing: complete unfinished matches
        </Button>
        <span className="help-text">{unfinishedCount} unfinished games in {filter === "all" ? "all tournaments" : tournament(filter)?.name}, across every stage. Uses random scores.</span>
      </div>}
      <MatchTable matches={matches} history={history} />
    </section>
  );
}

export default Matches;
