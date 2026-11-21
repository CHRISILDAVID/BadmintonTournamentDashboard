import { useStore } from "zustand";
import { venueStore } from "./stores/venue.js";
import VenueGrid from "./components/VenueGrid.jsx";
import { Button } from "./components/ui/button.jsx";
import { NativeSelect } from "./components/ui/native-select.jsx";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import VenueBracket, { PagedVenueBracket, VENUE_MATCHES_PER_SCREEN, VenuePlayoffs } from "./VenueBracket.jsx";
import VenueWidgets from "./components/VenueWidgets.jsx";
import SharedLiveScores from "./components/SharedLiveScores.jsx";
import { cleanLiveScoreLayout, cleanWidgetPreferences, visibleWidgets } from "./lib/venue-widgets.js";
import { selectionKey } from "./lib/venue-layout.js";
import { directPlaces, isKnockoutOnly, isLinkedPlayoffs, isPlayoffFormat } from "../shared/format.js";
import { isCustomGame, matchStageLabel } from "../shared/matches.js";
import logo from "../assets/logo.jpg";
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
                {m.stage !== "League" && <small>{matchStageLabel(m)}</small>}
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

function VenueStandings({ data, sharedLiveScores }) {
  const ref = useRef(null);
  const { tournament, groups, hasLeague, linkedPlaces } = data;
  useLayoutEffect(() => {
    const scroll = ref.current;
    const viewport = scroll.closest(".vb-display-content");
    const clippingAreas = [viewport, scroll.closest(".venue-grid-viewport"), scroll.closest(".venue-widget-canvas")].filter(Boolean);
    const measure = () => {
      const visibleBottom = Math.min(window.innerHeight, ...clippingAreas.map(area =>
        area.getBoundingClientRect().top + area.clientTop + area.clientHeight));
      const clipped = Math.max(0, Math.ceil(scroll.getBoundingClientRect().bottom - visibleBottom));
      scroll.style.setProperty("--standings-clipped-bottom", `${Math.min(clipped, scroll.clientHeight)}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(scroll);
    for (const area of clippingAreas) {
      observer.observe(area);
      area.addEventListener("scroll", measure, { passive: true });
    }
    const scores = viewport?.querySelector(":scope > .venue-shared-live");
    if (scores) observer.observe(scores);
    measure();
    return () => {
      observer.disconnect();
      for (const area of clippingAreas) area.removeEventListener("scroll", measure);
    };
  }, [sharedLiveScores]);
  return <div ref={ref} className="venue-widget-scroll venue-standings-scroll vb-scroll" data-auto-scroll="" tabIndex={0}
    aria-label={`${tournament.name} standings, scroll for all groups`}>
    <p className="venue-widget-note">{hasLeague ? (linkedPlaces ? `Top ${linkedPlaces} to linked playoffs` : isPlayoffFormat(tournament) ? `Top ${directPlaces(tournament)} direct · remaining places through playoffs` : `Top ${tournament.qualify} per group advance`) : "Entries · draw pending"}</p>
    <div className="venue-standing-groups">{groups.map(group => <StandingsGroup key={group.key} group={group} tournament={tournament} hasLeague={hasLeague}/>)}</div>
  </div>;
}

function TournamentPanel({ data, upcoming, teams, tournaments, liveMatches, sharedLiveScores, bracketView, playing, advance }) {
  const { tournament: t, onCourt, knockoutRounds, playoffs, hasKnockouts, champion } = data;
  const results = [...data.resultGroups, ...(data.knockoutResults.length ? [{ key: "postseason", label: isKnockoutOnly(t) ? "Knockouts" : "Playoffs & knockouts", results: data.knockoutResults }] : [])];
  const scroll = (label, children) => <div className="venue-widget-scroll vb-scroll" data-auto-scroll="" tabIndex={0} aria-label={`${t.name} ${label}`}>{children}</div>;
  const renderWidget = widget => {
    if (widget === "live") return <SharedLiveScores matches={liveMatches} teams={teams} tournaments={tournaments} tournament={t} showHeading={false}/>;
    if (widget === "standings") return <VenueStandings data={data} sharedLiveScores={sharedLiveScores}/>;
    if (widget === "upcoming") return scroll("upcoming games", <>
      <p className="venue-widget-note">{upcoming.length} ready · {onCourt.length} on court</p>
      {[...onCourt, ...upcoming].map(m => <div className={`vb-call-row ${m.status === "live" ? "is-live" : ""}`} key={m.id}>
        <small>{groupName(m.group) || matchStageLabel(m, tournaments.values())} · {m.status === "live" ? `On court ${m.court}` : "Ready to start"}</small>
        <strong>{teams.get(m.a)?.name}<em> vs </em>{teams.get(m.b)?.name}</strong>
      </div>)}
      {!upcoming.length && !onCourt.length && <p className="vb-empty">{champion ? "All matches complete." : "No upcoming games ready to start."}</p>}
    </>);
    if (widget === "results") return scroll("latest results", results.length ? <div className="venue-result-groups">{results.map(group => <ResultGroup key={group.key} group={group} teams={teams}/>)}</div> : <p className="vb-empty">Results appear when matches are completed.</p>);
    if (widget === "playoffs") return <VenuePlayoffs tournament={t} playoffs={playoffs} teams={teams}/>;
    if (bracketView) return <PagedVenueBracket tournament={t} rounds={knockoutRounds} teams={teams}
      view={bracketView} playing={playing} advance={advance}/>;
    return knockoutRounds.length ? <VenueBracket tournament={t} rounds={knockoutRounds} teams={teams}/> : <p className="vb-empty">The knockout bracket appears when the draw is created.</p>;
  };
  return <article className="vb-tournament" aria-label={`${t.name} tournament board`}>
    <header className="vb-tournament-heading">
      <div><span className="vb-kicker">{t.size === 1 ? "SINGLES" : t.size === 2 ? "DOUBLES" : `${t.size}v${t.size}`} · {data.completed} / {data.total} MATCHES</span><h2>{t.name}</h2></div>
      {champion ? <span className="vb-champion"><Trophy size={16}/>{champion.name}{isLinkedPlayoffs(t) && " · Overall champion"}</span> : <span className="vb-stage">{isLinkedPlayoffs(t) ? "LINKED PLAYOFFS" : hasKnockouts ? playoffs.some(m => m.status !== "completed") ? "PLAYOFFS" : "KNOCKOUTS" : data.hasLeague ? "LEAGUE" : "REGISTRATION"}</span>}
    </header>
    <VenueWidgets data={data} renderWidget={renderWidget} sharedLiveScores={sharedLiveScores}/>
  </article>;
}

function knockoutView(rounds, view) {
  const level = Math.min(view?.level ?? 0, rounds.length - 1);
  const totalScreens = Math.ceil(rounds[level].matches.length / VENUE_MATCHES_PER_SCREEN);
  const screen = Math.min(view?.screen ?? 0, totalScreens - 1);
  return { ...view, level, screen, totalScreens };
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
  const contentRef = useRef(null);
  const [scoresInView, setScoresInView] = useState(true);
  const { selection: preferences, setSelection: setPreferences, editing, draft, savedLayouts } = useStore(venueStore);
  const [autoScroll, setAutoScroll] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [layoutControls, setLayoutControls] = useState(null);
  const [bracketViews, setBracketViews] = useState({});
  const [controlledBracket, setControlledBracket] = useState(null);
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
  const sharedLiveScores = liveLayout.position === "top" || liveMatches.some(isCustomGame) || !panels.length;
  useEffect(() => {
    if (!sharedLiveScores) return;
    const node = contentRef.current;
    const measure = () => setScoresInView(node.scrollTop + node.clientHeight < node.scrollHeight - 1);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    observer.observe(node.firstElementChild);
    node.addEventListener("scroll", measure, { passive: true });
    measure();
    return () => {
      observer.disconnect();
      node.removeEventListener("scroll", measure);
    };
  }, [sharedLiveScores]);
  const layout = editing ? draft : savedLayouts[selectionKey(selection.ids)];
  const knockoutPanels = panels.filter(data => isKnockoutOnly(data.tournament) && data.knockoutRounds.length &&
    visibleWidgets(data, cleanWidgetPreferences(layout?.widgets?.[data.tournament.id])).includes("knockouts"));
  const controlledPanel = knockoutPanels.find(data => data.tournament.id === controlledBracket) ?? knockoutPanels[0];
  const controlledView = controlledPanel && knockoutView(controlledPanel.knockoutRounds, bracketViews[controlledPanel.tournament.id]);
  const moveBracket = ({ tournament, knockoutRounds }, axis, delta) => {
    setBracketViews(views => {
      const view = knockoutView(knockoutRounds, views[tournament.id]);
      const level = axis === "round" ? view.level + delta : view.level;
      if (level < 0 || level >= knockoutRounds.length || (axis === "screen" && view.totalScreens <= 1)) return views;
      const screen = axis === "screen" ? (view.screen + delta + view.totalScreens) % view.totalScreens : 0;
      const direction = axis === "round" ? (delta > 0 ? "up" : "down") : (delta > 0 ? "left" : "right");
      return { ...views, [tournament.id]: { level, screen, direction, step: (view.step ?? 0) + 1,
        previous: { level: view.level, screen: view.screen } } };
    });
  };
  useEffect(() => {
    if (editing || !controlledPanel || controlledView.totalScreens <= 1) return;
    const navigate = event => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        !["ArrowLeft", "ArrowRight"].includes(event.key) ||
        event.target.closest?.("input, select, textarea, [contenteditable], [role=dialog], [data-auto-scroll]")) return;
      event.preventDefault();
      moveBracket(controlledPanel, "screen", event.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", navigate);
    return () => window.removeEventListener("keydown", navigate);
  }, [controlledPanel, controlledView?.totalScreens, editing]);
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
        {controlledView && <div className="vb-bracket-controls" role="group" aria-label="Knockout display controls">
          {knockoutPanels.length > 1 && <NativeSelect aria-label="Knockout bracket to control" value={controlledPanel.tournament.id}
            disabled={editing} onChange={event => setControlledBracket(event.target.value)}>
            {knockoutPanels.map(({ tournament }) => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}
          </NativeSelect>}
          <span className="vb-screen-badge">{controlledView.totalScreens > 1
            ? `Screen ${controlledView.screen + 1} of ${controlledView.totalScreens} · ${autoScroll && !editing ? "7s Timer" : "Paused"}`
            : "Static Screen"}</span>
          <Button variant="outline" size="xs" disabled={editing || controlledView.totalScreens <= 1}
            onClick={() => moveBracket(controlledPanel, "screen", 1)}>Next Screen</Button>
          <Button variant="outline" size="xs" disabled={editing || controlledView.level === 0}
            onClick={() => moveBracket(controlledPanel, "round", -1)}>Undo</Button>
          <Button variant="default" size="xs" disabled={editing || controlledView.level === controlledPanel.knockoutRounds.length - 1}
            onClick={() => moveBracket(controlledPanel, "round", 1)}>Next Round</Button>
        </div>}
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
      <div ref={contentRef} className={`vb-display-content${sharedLiveScores ? " has-shared-scores" : ""}${sharedLiveScores && scoresInView ? " scores-in-view" : ""}`}
        tabIndex={sharedLiveScores ? 0 : undefined} role="region" aria-label="Venue display content">
        {sharedLiveScores && <SharedLiveScores matches={liveMatches} teams={teams} tournaments={tournaments} flow={liveLayout.flow}/>}
        <VenueGrid controls={layoutControls} panels={panels} renderPanel={data => <TournamentPanel data={data} teams={teams} tournaments={tournaments} sharedLiveScores={sharedLiveScores}
          liveMatches={liveMatches.filter(match => match.tournamentId === data.tournament.id)}
          upcoming={upcoming.filter(m => m.tournamentId === data.tournament.id)}
          bracketView={isKnockoutOnly(data.tournament) && data.knockoutRounds.length ? knockoutView(data.knockoutRounds, bracketViews[data.tournament.id]) : null}
          playing={!editing && autoScroll} advance={() => moveBracket(data, "screen", 1)}/>} />
      </div>

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
