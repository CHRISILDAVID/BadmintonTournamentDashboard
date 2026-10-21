import { useStore } from "zustand";
import { venueStore } from "./stores/venue.js";
import VenueGrid from "./components/VenueGrid.jsx";
import { Button } from "./components/ui/button.jsx";
import { NativeSelect } from "./components/ui/native-select.jsx";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Maximize, Trophy, X, Pause, Play } from "lucide-react";
import {
  displayTournamentOptions,
  resolveDisplaySelection,
  resultScore,
  tournamentDisplayData,
  liveDisplayMatches,
} from "../shared/display.js";
import { groupName } from "./utils.js";
import useAutoScroll from "./useAutoScroll.js";
import VenueBracket, { VenuePlayoffs } from "./VenueBracket.jsx";
import VenueWidgets from "./components/VenueWidgets.jsx";
import SharedLiveScores from "./components/SharedLiveScores.jsx";
import { cleanLiveScoreLayout } from "./lib/venue-widgets.js";
import { selectionKey } from "./lib/venue-layout.js";
import { directPlaces, isPlayoffFormat } from "../shared/format.js";
import logo from "../assets/logo.jpg";
import LiveScores from "./cloud/LiveScores.jsx";
import { liveStore } from "./cloud/connection.js";
import "./venue-board.css";
import "./styles/venue-layout.css";

function StandingsGroup({ group, tournament, hasLeague }) {
  return (
    <section
      className="vb-standing-group"
      aria-label={`${tournament.name} ${group.label} standings`}
    >
      <div className="vb-group-heading">
        <h4>{group.label}</h4>
        <span>{group.rows.length} entries</span>
      </div>
      <div
        className="vb-table-scroll vb-scroll"
        aria-label={`${group.label} standings, scroll for all players`}
      >
        <table className="vb-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">PLAYERS</th>
              <th className="vb-stat-played" scope="col" title="Matches played">
                P
              </th>
              <th className="vb-stat-wins" scope="col" title="Matches won">
                W
              </th>
              <th className="vb-stat-game" scope="col" title="Game difference">
                GD
              </th>
              <th
                className="vb-stat-record"
                scope="col"
                title="Wins / matches played"
              >
                W/P
              </th>
              <th
                className="vb-stat-points"
                scope="col"
                title="Point difference"
              >
                PD
              </th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row, i) => (
              <tr
                key={row.id}
                className={
                  hasLeague
                    ? ["direct", "qualified"].includes(row.qualificationStatus)
                      ? "vb-qualifier"
                      : row.qualificationStatus === "playoff"
                        ? "vb-playoff-place"
                        : ""
                    : ""
                }
              >
                <td>{i + 1}</td>
                <th scope="row">
                  {row.name}
                  {hasLeague && isPlayoffFormat(tournament) && (
                    <small className="vb-entry-route">
                      {
                        {
                          direct: "Direct place",
                          playoff: "Playoff place",
                          qualified: "Qualified via playoff",
                          eliminated: "Eliminated in playoff",
                        }[row.qualificationStatus]
                      }
                    </small>
                  )}
                </th>
                <td className="vb-stat-played">{row.played}</td>
                <td className="vb-wins vb-stat-wins">{row.wins}</td>
                <td className="vb-stat-game">
                  {row.gameDiff > 0 ? "+" : ""}
                  {row.gameDiff}
                </td>
                <td className="vb-stat-record vb-wins">
                  {row.wins}/{row.played}
                </td>
                <td className="vb-stat-points">
                  {row.pointDiff > 0 ? "+" : ""}
                  {row.pointDiff}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!group.rows.length && (
          <p className="vb-empty">No players in this group yet.</p>
        )}
      </div>
    </section>
  );
}

function ResultGroup({ group, teams }) {
  return (
    <section className="vb-result-group" aria-label={`${group.label} results`}>
      <div className="vb-group-heading">
        <h4>{group.label}</h4>
        <span>{group.results.length} results</span>
      </div>
      <div
        className="vb-result-list vb-scroll"
        aria-label={`${group.label} results, scroll for all matches`}
      >
        {group.results.length ? (
          group.results.map((m) => (
            <article className="vb-result-row" key={m.id}>
              <div>
                <strong>{teams.get(m.winner)?.name || "Winner"}</strong>
                <span>
                  def.{" "}
                  {teams.get(m.winner === m.a ? m.b : m.a)?.name || "Opponent"}
                </span>
                {m.stage !== "League" && <small>{m.stage}</small>}
              </div>
              <b className="vb-final-score">{resultScore(m)}</b>
            </article>
          ))
        ) : (
          <p className="vb-empty">No completed matches yet.</p>
        )}
      </div>
    </section>
  );
}

function TournamentPanel({ data, upcoming, teams, sharedLiveScores }) {
  const { tournament: t, groups, onCourt, knockoutRounds, playoffs, hasKnockouts, champion } = data;
  const results = [...data.resultGroups, ...(data.knockoutResults.length ? [{ key: "postseason", label: "Playoffs & knockouts", results: data.knockoutResults }] : [])];
  const scroll = (label, children) => <div className="venue-widget-scroll vb-scroll" data-auto-scroll="" tabIndex={0} aria-label={`${t.name} ${label}`}>{children}</div>;
  const renderWidget = widget => {
    if (widget === "live") return scroll("live scores", <LiveScores matches={onCourt} teams={teams} category={t.name}/>);
    if (widget === "standings") return scroll("standings, scroll for all groups", <>
      <p className="venue-widget-note">{data.hasLeague ? (isPlayoffFormat(t) ? `Top ${directPlaces(t)} direct · remaining places through playoffs` : `Top ${t.qualify} per group advance`) : "Entries · draw pending"}</p>
      <div className="venue-standing-groups">{groups.map(group => <StandingsGroup key={group.key} group={group} tournament={t} hasLeague={data.hasLeague}/>)}</div>
    </>);
    if (widget === "upcoming") return scroll("upcoming games", <>
      <p className="venue-widget-note">{upcoming.length} ready · {onCourt.length} on court</p>
      {[...onCourt, ...upcoming].map(m => <div className={`vb-call-row ${m.status === "live" ? "is-live" : ""}`} key={m.id}>
        <small>{groupName(m.group) || m.stage} · {m.status === "live" ? `On court ${m.court}` : "Ready to start"}</small>
        <strong>{teams.get(m.a)?.name}<em> vs </em>{teams.get(m.b)?.name}</strong>
      </div>)}
      {!upcoming.length && !onCourt.length && <p className="vb-empty">{champion ? "All matches complete." : "No upcoming games ready to start."}</p>}
    </>);
    if (widget === "results") return scroll("latest results", results.length ? <div className="venue-result-groups">{results.map(group => <ResultGroup key={group.key} group={group} teams={teams}/>)}</div> : <p className="vb-empty">Results appear when matches are completed.</p>);
    if (widget === "playoffs") return <VenuePlayoffs tournament={t} playoffs={playoffs} teams={teams}/>;
    return knockoutRounds.length ? <VenueBracket tournament={t} rounds={knockoutRounds} teams={teams}/> : <p className="vb-empty">The knockout bracket appears when the draw is created.</p>;
  };
  return <article className="vb-tournament" aria-label={`${t.name} tournament board`}>
    <header className="vb-tournament-heading">
      <div><span className="vb-kicker">{t.size === 1 ? "SINGLES" : t.size === 2 ? "DOUBLES" : `${t.size}v${t.size}`} · {data.completed} / {data.total} MATCHES</span><h2>{t.name}</h2></div>
      {champion ? <span className="vb-champion"><Trophy size={16}/>{champion.name}</span> : <span className="vb-stage">{hasKnockouts ? playoffs.some(m => m.status !== "completed") ? "PLAYOFFS" : "KNOCKOUTS" : data.hasLeague ? "LEAGUE" : "REGISTRATION"}</span>}
    </header>
    <VenueWidgets data={data} renderWidget={renderWidget} sharedLiveScores={sharedLiveScores}/>
  </article>;
}

export default function VenueBoard({ state: fullState, upcoming, connected }) {
  const preset = useStore(liveStore, s => s.preset);
  const state = useMemo(() => preset?.categories?.length ? { ...fullState, tournaments: fullState.tournaments.filter(t => preset.categories.includes(t.id)) } : fullState, [fullState, preset]);
  useEffect(() => {
    if (preset?.layout) {
      const saved = preset.layout;
      venueStore.setState({ selection: saved.selection, savedLayouts: saved.savedLayouts, editing: false, draft: null });
    }
  }, [preset?.updatedAt]);
  const boardRef = useRef(null);
  const { selection: preferences, setSelection: setPreferences, editing, draft, savedLayouts } = useStore(venueStore);
  const [autoScroll, setAutoScroll] = useState(true);
  const [layoutControls, setLayoutControls] = useState(null);
  useAutoScroll(boardRef, !editing && autoScroll);
  const [error, setError] = useState("");
  const options = useMemo(() => displayTournamentOptions(state), [state]);
  const selection = useMemo(
    () => resolveDisplaySelection(options, preferences),
    [options, preferences],
  );
  const teams = useMemo(
    () => new Map(state.teams.map((t) => [t.id, t])),
    [state.teams],
  );
  const tournaments = useMemo(() => new Map(state.tournaments.map(t => [t.id, t])), [state.tournaments]);
  const liveMatches = useMemo(() => liveDisplayMatches(state, preset), [state, preset]);
  const liveLayout = cleanLiveScoreLayout((editing ? draft : savedLayouts[selectionKey(selection.ids)])?.liveScores);
  const panels = useMemo(
    () => selection.ids.map((id) => tournamentDisplayData(state, id)),
    [state, selection],
  );
  useEffect(() => {
    if (
      selection.count !== preferences.count ||
      JSON.stringify(selection.ids) !== JSON.stringify(preferences.ids)
    )
      setPreferences(selection);
  }, [selection, preferences]);
  const chooseTournament = (index, id) => {
    const ids = [...selection.ids];
    const previous = ids[index];
    const other = ids.indexOf(id);
    ids[index] = id;
    if (other >= 0 && other !== index) ids[other] = previous;
    setPreferences({ count: selection.count, ids });
  };
  return (
    <div
      ref={boardRef}
      className={`venue-board ${selection.count > 1 ? "vb-multiple" : "vb-single"} ${selection.count >= 3 ? "vb-dense" : ""}`}
    >
      <header className="vb-header">
        <img className="vb-logo" src={logo} alt="ShuttleHub" />
        <div className="vb-title">
          <h1>{state.event.name}</h1>
        </div>
        <span
          className={`vb-connection ${connected ? "" : "vb-disconnected"}`}
          role="status"
        >
          <i />
          {connected ? "Connected" : "Disconnected · Last confirmed board"}
        </span>
      </header>
      {state.demo && (
        <div className="vb-demo">SAMPLE EVENT · Demonstration data</div>
      )}
      <div className="vb-toolbar">
        <div className="vb-selectors">
          <label className="vb-count">
            Show{" "}
            <NativeSelect
              aria-label="Number of tournaments"
              value={selection.count}
              disabled={!options.length || editing}
              onChange={(e) =>
                setPreferences({ count: +e.target.value, ids: selection.ids })
              }
            >
              {!options.length && <option value={0}>0 tournaments</option>}
              {options.map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1} tournament{i ? "s" : ""}
                </option>
              ))}
            </NativeSelect>
          </label>
          {selection.ids.map((id, i) => (
            <label className="vb-tournament-select" key={i}>
              <span>
                {selection.count > 1 ? `Tournament ${i + 1}` : "Tournament"}
              </span>
              <NativeSelect
                aria-label={`Tournament ${i + 1}`}
                value={id}
                disabled={editing}
                onChange={(e) => chooseTournament(i, e.target.value)}
              >
                {options.map((t) => (
                  <option
                    key={t.id}
                    value={t.id}
                    disabled={selection.ids.includes(t.id) && t.id !== id}
                  >
                    {t.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
          ))}
        </div>
        <div className="vb-screen-actions">
        <Button variant="ghost" size="icon" aria-label={autoScroll ? "Pause automatic scrolling" : "Resume automatic scrolling"} title={autoScroll ? "Pause automatic scrolling" : "Resume automatic scrolling"} disabled={editing} onClick={() => setAutoScroll(value => !value)}>{autoScroll ? <Pause/> : <Play/>}</Button>
        <span className="venue-layout-actions" ref={setLayoutControls}/>
        <Button variant="ghost" size="icon"
          className="vb-fullscreen"
          aria-label="Toggle fullscreen"
          title="Fullscreen"
          onClick={() => {
            const request = document.fullscreenElement
              ? document.exitFullscreen?.()
              : document.documentElement.requestFullscreen?.();
            if (request)
              request.catch(() =>
                setError("Fullscreen is unavailable in this browser."),
              );
            else setError("Fullscreen is unavailable in this browser.");
          }}
        >
          <Maximize size={19} />
        </Button>
        </div>
      </div>
      {liveLayout.position === "top" && <SharedLiveScores matches={liveMatches} teams={teams} tournaments={tournaments} flow={liveLayout.flow}/>}
      <VenueGrid controls={layoutControls} panels={panels} renderPanel={data => <TournamentPanel data={data} teams={teams} sharedLiveScores={liveLayout.position === "top"} upcoming={upcoming.filter(m => m.tournamentId === data.tournament.id)}/>} />

      {error && (
        <div className="toast error" role="alert">
          {error}
          <Button variant="ghost" aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
