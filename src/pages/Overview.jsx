import React from "react";
import { ArrowUpRight, ArrowRight, MapPin, Plus } from "lucide-react";
import { groupName } from "../utils.js";
import { matchCategory, matchStageLabel, tournamentProgress } from "../../shared/matches.js";
import { isKnockoutOnly, minimumTeamsForDraw } from "../../shared/format.js";
import { useDesk } from "../hooks/useDesk.jsx";
import MatchCard from "../components/MatchCard.jsx";
import StageActions from "../components/StageActions.jsx";
import { Button } from "../components/ui/button.jsx";

function Overview() {
  const { state, filter, selected, live, upcoming, completed, categorySelect, team, tournament, open, setPage, admin } = useDesk();
  // Courts are event-wide resources, even when the match sheet is filtered.
  const occupied = new Map(state.matches.filter(m => m.status === "live").map(m => [m.court, m]));
  const fixtures = selected.filter(m => !m.bye);
  const done = fixtures.filter(m => m.status === "completed");
  const results = completed.filter(m => !m.bye);
  const categories = state.tournaments.filter(t => filter === "all" || t.id === filter);
  const drafts = categories.filter(t => !tournamentProgress(state, t.id).hasFixtures);
  const browse = (status = "all") => setPage("Matches", { filter, matchQuery: "", matchStage: "all", matchStatus: status });
  return <div className="match-day">
    <section className="court-board" aria-labelledby="court-board-title">
      <div className="court-board-heading">
        <div><h2 id="court-board-title">The courts <span className="court-availability">{state.event.courts - occupied.size} open / {state.event.courts}</span></h2>
          <p><MapPin size={14} aria-hidden="true"/>{state.event.venue || "Add your venue in Settings"}<span>All event courts</span></p></div>
        <Button variant="ghost" className="text-btn" onClick={() => setPage("Matches", { filter: "all", matchQuery: "", matchStatus: "upcoming", matchStage: "all" })}>Find a game <ArrowRight size={16}/></Button>
      </div>
      <div className="court-board-grid">
        {Array.from({ length: state.event.courts }, (_, i) => i + 1).map(court => {
          const match = occupied.get(court);
          return <button type="button" key={court} className={`court-tile ${match ? "occupied" : "available"}`}
            onClick={() => match ? open({ type: "match", matchId: match.id }) : setPage("Matches", { filter: "all", matchQuery: "", matchStatus: "upcoming", matchStage: "all" })}
            aria-label={match ? `Manage court ${court}: ${team(match.a)?.name} vs ${team(match.b)?.name}` : `Court ${court} is available, open matches`}>
            <span className="court-number"><span>Court</span><b>{String(court).padStart(2, "0")}</b></span>
            <span className="court-tile-detail"><strong><i className="dot"/>{match ? "In play" : "Open court"}</strong><small>{match ? matchCategory(match, tournament(match.tournamentId)) : "Choose an upcoming game"}</small></span>
            <ArrowUpRight size={17} aria-hidden="true"/>
          </button>;
        })}
      </div>
    </section>
    <div className="match-sheet-heading"><h2>Match sheet</h2><label className="sheet-filter"><span>Showing</span>{categorySelect}</label></div>
    <div className="match-totals" aria-label="Selected matches summary">
      <span><b>{live.length}</b> on court</span><span><b>{upcoming.length}</b> upcoming</span><span><b>{done.length}</b> finished</span>
      <div className="sheet-progress"><span>{done.length} of {fixtures.length} matches complete</span><progress max={fixtures.length || 1} value={done.length} aria-label="Selected fixtures completed"/></div>
    </div>
    <StageActions/>
    <div className="match-day-columns">
      <div className="match-day-main">
        <section aria-labelledby="in-play-title">
          <div className="sheet-section-heading"><h2 id="in-play-title">In play <span className="count">{live.length}</span></h2><span>Scoring & results</span></div>
          {live.length ? <div className="live-grid">{live.map(m => <MatchCard key={m.id} m={m}/>)}</div> : <div className="desk-empty-state">
            <h3>{!state.tournaments.length && !state.matches.length ? "Set up your first category" : "No games on court"}</h3>
            <p>{!state.tournaments.length && !state.matches.length ? "Choose a format, register the players, then generate fixtures." : upcoming.length ? "Choose an upcoming game and assign an open court. Player availability is checked before it starts." : drafts.length ? "Finish category setup below to put the first games on court." : "Check the category stages or review the results below."}</p>
            {!state.tournaments.length && !state.matches.length && admin ? <Button onClick={() => open({ type: "tournament" })}><Plus size={16}/>Create a tournament</Button> : upcoming.length > 0 ? <Button onClick={() => browse("upcoming")}>Choose a game <ArrowRight size={16}/></Button> : drafts.length ? <Button variant="outline" onClick={() => setPage("Tournaments")}>Continue category setup <ArrowRight size={16}/></Button> : fixtures.length > 0 && <Button variant="outline" onClick={() => browse()}>View matches <ArrowRight size={16}/></Button>}
          </div>}
        </section>
        <section className="upcoming-sheet" aria-labelledby="upcoming-title">
          <div className="sheet-section-heading"><h2 id="upcoming-title">Upcoming games <span className="count">{upcoming.length}</span></h2><Button variant="ghost" className="text-btn" onClick={() => browse("upcoming")}>All matches <ArrowRight size={16}/></Button></div>
          {upcoming.length ? <div className="match-queue">{upcoming.slice(0, 4).map(m => <button type="button" key={m.id} className="sheet-queue-row" onClick={() => open({ type: "match", matchId: m.id })}>
            <span className="queue-teams"><strong>{team(m.a)?.name} <em>vs</em> {team(m.b)?.name}</strong><small>{matchCategory(m, tournament(m.tournamentId))} · {groupName(m.group) || matchStageLabel(m, state.tournaments)}</small></span>
            <span className="queue-action">Start game <ArrowUpRight size={16}/></span>
          </button>)}</div> : <p className="sheet-empty">{drafts.length ? "Upcoming games appear after you generate fixtures." : "No upcoming games in this selection."}</p>}
        </section>
      </div>
      <aside className="match-day-aside" aria-label="Tournament progress and results">
        <section className="category-sheet">
          <div className="sheet-section-heading"><h2>Categories <span className="count">{categories.length}</span></h2><Button variant="ghost" className="text-btn" onClick={() => setPage("Tournaments")}>Manage <ArrowUpRight size={15}/></Button></div>
          {categories.length ? categories.map(t => {
            const progress = tournamentProgress(state, t.id);
            const entries = state.teams.filter(team => team.tournamentId === t.id).length;
            const knockoutOnly = isKnockoutOnly(t);
            const needsTeams = entries < minimumTeamsForDraw(t);
            const label = progress.champion ? "Final results" : progress.canCreateKnockouts ? "Review qualification" : progress.hasFixtures ? "Manage games" : needsTeams ? "Add teams" : knockoutOnly ? "Generate bracket" : "Generate fixtures";
            const next = () => {
              if (progress.champion || progress.canCreateKnockouts) setPage("Standings", { filter: t.id });
              else if (progress.hasFixtures) setPage("Matches", { filter: t.id, matchQuery: "", matchStatus: "all", matchStage: progress.postseason && !knockoutOnly ? "postseason" : "all" });
              else if (needsTeams) setPage("Teams & players", { filter: t.id, teamQuery: "" });
              else open({ type: "generate", tournament: t });
            };
            return <div className="category-sheet-row" key={t.id}><h3>{t.name}</h3><p>{progress.champion ? "Tournament complete" : progress.canCreateKnockouts ? "League complete" : progress.postseason ? "Knockout stage" : progress.hasFixtures ? `${progress.remaining} league games remaining` : `${entries} teams entered · Registration`}</p><Button variant="ghost" className="text-btn" onClick={next}>{label}<ArrowRight size={15}/></Button></div>;
          }) : <p className="sheet-empty">{filter === "custom" ? "Custom games run independently of tournament categories." : "Create a category to begin registration."}</p>}
        </section>
        <section className="results-sheet" aria-labelledby="results-title">
          <div className="sheet-section-heading"><h2 id="results-title">Latest results</h2><Button variant="ghost" className="text-btn" onClick={() => setPage("History", { filter, matchQuery: "" })}>History <ArrowUpRight size={15}/></Button></div>
          {results.length ? results.slice(0, 3).map(m => <div className="result-slip" key={m.id}>
            <div className="recent-meta"><span>{matchCategory(m, tournament(m.tournamentId))}</span><span>Final</span></div>
            {[m.a, m.b].map((id, index) => <div key={id} className={`result-team ${m.winner === id ? "winner" : ""}`}><span>{team(id)?.name}{m.winner === id && <span className="sr-only">, winner</span>}</span><b>{m.games.map((game, i) => <span key={i}>{game[index]}</span>)}</b></div>)}
          </div>) : <p className="sheet-empty">Completed games will appear here. Results stay available in match history.</p>}
        </section>
      </aside>
    </div>
  </div>;
}

export default Overview;
