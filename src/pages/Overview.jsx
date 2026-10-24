import React from "react";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { groupName } from "../utils.js";
import { matchCategory, matchStageLabel } from "../../shared/matches.js";

import { useDesk } from "../hooks/useDesk.jsx";
import { Empty, MapPinIcon } from "../components/common.jsx";
import MatchCard from "../components/MatchCard.jsx";

import StageActions from "../components/StageActions.jsx";

import { Button } from "../components/ui/button.jsx";

function Overview() {
  const { state, live, upcoming, completed, categorySelect, team, tournament, open, setPage } = useDesk();
  const allLive = state.matches.filter((m) => m.status === "live");
  const playedFixtures = state.matches.filter(m => !m.bye);
  const allDone = playedFixtures.filter((m) => m.status === "completed");
  return (
    <>
      <div className="venue-strip">
        <div>
          <span className="eyebrow">HOME COURT</span>
          <strong>
            <MapPinIcon />
            {state.event.venue || "Set your venue in Club settings"}
          </strong>
        </div>
        <div className="court-switches">
          {Array.from({ length: state.event.courts }, (_, i) => i + 1).map(
            (c) => {
              const m = allLive.find((m) => m.court === c);
              return (
                <Button variant="ghost"
                  key={c}
                  className={m ? "occupied" : "available"}
                  onClick={() =>
                    m
                      ? open({ type: "match", matchId: m.id })
                      : setPage("Matches")
                  }
                  aria-label={
                    m
                      ? `Manage court ${c}`
                      : `Court ${c} is available, open matches`
                  }
                >
                  <span className="tiny-court" />{" "}
                  <b>{String(c).padStart(2, "0")}</b>
                  <span>{m ? "In play" : "Open"}</span>
                </Button>
              );
            },
          )}
        </div>
      </div>
      <div className="score-strip">
        {[
          ["Categories", state.tournaments.length],
          ["Teams entered", state.teams.filter(t => t.tournamentId).length],
          ["On court", allLive.length],
          ["Matches finished", allDone.length],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{String(value).padStart(2, "0")}</strong>
          </div>
        ))}
        <div className="score-strip-progress">
          <span>Draw progress</span>
          <div className="progress">
            <span
              style={{
                width: `${playedFixtures.length ? (allDone.length / playedFixtures.length) * 100 : 0}%`,
              }}
            />
          </div>
          <small>
            {allDone.length} / {playedFixtures.length} matches
          </small>
        </div>
      </div>
      <div className="section-heading live-heading">
        <h2>
          <i className="dot" /> In play{" "}
          <span className="count">{live.length}</span>
        </h2>
        {categorySelect}
      </div>
      {live.length ? (
        <div className="live-grid">
          {live.map((m) => (
            <MatchCard key={m.id} m={m} />
          ))}
        </div>
      ) : (
        <div className="ready-court">
          <div className="ready-court-lines" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="ready-copy">
            <span className="eyebrow">THE FLOOR IS YOURS</span>
            <h2>
              {state.tournaments.length
                ? "Ready for the first serve."
                : "Build your next draw."}
            </h2>
            <p>
              {state.matches.length
                ? "Choose a fixture, assign an open court, and start the match."
                : state.tournaments.length
                  ? "Add your players, then generate the group fixtures."
                  : "Choose a category. Add your players. We will take care of the draw."}
            </p>
            <Button variant="default"
              className="btn primary"
              onClick={() =>
                state.matches.length
                  ? setPage("Matches")
                  : state.tournaments.length
                    ? setPage("Teams & players")
                    : open({ type: "tournament" })
              }
            >
              {state.matches.length
                ? "Start a game"
                : state.tournaments.length
                  ? "Add teams"
                  : "Create a tournament"}
              <ArrowUpRight size={18} />
            </Button>
          </div>
          <div className="ready-label">
            COURT
            <br />
            <b>01</b>
            <span>AWAITING PLAYERS</span>
          </div>
        </div>
      )}
      <StageActions />
      <div className="overview-bottom">
        <section className="panel upcoming-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">UPCOMING GAMES</span>
              <h2>
                Next on court <span className="count">{upcoming.length}</span>
              </h2>
            </div>
            <Button variant="ghost" className="text-btn" onClick={() => setPage("Matches")}>
              All matches <ArrowUpRight size={16} />
            </Button>
          </div>
          {upcoming.length ? (
            <div className="match-queue">
              {upcoming.slice(0, 4).map((m, i) => (
                <Button variant="ghost"
                  key={m.id}
                  className="queue-row"
                  onClick={() => open({ type: "match", matchId: m.id })}
                >

                  <span className="queue-teams">
                    <strong>
                      {team(m.a)?.name || "Awaiting qualifier"} <em>vs</em>{" "}
                      {team(m.b)?.name || "Awaiting qualifier"}
                    </strong>
                    <small>
                      {matchCategory(m, tournament(m.tournamentId))} <span>/</span>{" "}
                      {groupName(m.group) || matchStageLabel(m)}
                    </small>
                  </span>
                  <span className="queue-time">
                    Start game
                  </span>
                  <ArrowUpRight size={18} />
                </Button>
              ))}
            </div>
          ) : (
            <Empty title="Your upcoming games appear here">
              Group fixtures appear here once you have added teams and generated
              the draw.
            </Empty>
          )}
        </section>
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">RECENT RESULTS</span>
              <h2>Just finished</h2>
            </div>
            <Button variant="ghost" className="text-btn" onClick={() => setPage("History")}>
              All results <ArrowUpRight size={16} />
            </Button>
          </div>
          {completed.length ? (
            completed.slice(0, 3).map((m) => (
              <div className="result-slip" key={m.id}>
                <div className="recent-meta">
                  <span>{matchCategory(m, tournament(m.tournamentId))}</span>
                  <span>FINAL</span>
                </div>
                {[m.a, m.b].map((tid, i) => (
                  <div
                    key={tid}
                    className={`result-team ${m.winner === tid ? "winner" : ""}`}
                  >
                    <span>
                      {m.winner === tid && <ChevronRight size={14} />}{" "}
                      {team(tid)?.name}
                    </span>
                    <b>
                      {m.games.map((g, j) => (
                        <span key={j}>{g[i]}</span>
                      ))}
                    </b>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <Empty title="No results yet">
              The three latest completed matches will stay here. All results
              remain in match history.
            </Empty>
          )}
        </section>
      </div>
    </>
  );
}

export default Overview;
