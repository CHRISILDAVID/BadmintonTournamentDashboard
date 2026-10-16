import React, { useEffect, useMemo, useState } from "react";
import { Maximize, Radio, Trophy, X } from "lucide-react";
import {
  displayTournamentOptions,
  resolveDisplaySelection,
  resultScore,
  tournamentDisplayData,
} from "../shared/display.js";
import { groupName, time } from "./utils.js";
import logo from "../assets/logo.jpg";
import "./venue-board.css";

const STORAGE_KEY = "shuttlehub.venue.selection.v1";
function savedSelection() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

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
        tabIndex={0}
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
                  hasLeague && i < tournament.qualify ? "vb-qualifier" : ""
                }
              >
                <td>{i + 1}</td>
                <th scope="row">{row.name}</th>
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
        tabIndex={0}
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

function TournamentPanel({
  data,
  calls,
  callPositions,
  teams,
  manual,
  firstCall,
}) {
  const {
    tournament: t,
    groups,
    onCourt,
    resultGroups,
    knockoutResults,
    champion,
  } = data;
  const results = [...resultGroups];
  if (knockoutResults.length)
    results.push({
      key: "knockouts",
      label: "Knockouts",
      results: knockoutResults,
    });
  return (
    <article
      className="vb-tournament"
      aria-label={`${t.name} tournament board`}
    >
      <header className="vb-tournament-heading">
        <div>
          <span className="vb-kicker">
            {t.size === 1
              ? "SINGLES"
              : t.size === 2
                ? "DOUBLES"
                : `${t.size}v${t.size}`}{" "}
            · {data.completed} / {data.total} MATCHES
          </span>
          <h2>{t.name}</h2>
        </div>
        {champion ? (
          <span className="vb-champion">
            <Trophy size={15} />
            {champion.name}
          </span>
        ) : (
          <div className="vb-category-meta">
            <span className="vb-stage">
              {data.hasLeague ? "LEAGUE + KNOCKOUT" : "REGISTRATION"}
            </span>
            {onCourt.length > 0 && (
              <div
                className="vb-court-badges"
                aria-label={`${t.name} active courts`}
              >
                {onCourt.slice(0, 2).map((m) => (
                  <span
                    key={m.id}
                    title={`${teams.get(m.a)?.name} vs ${teams.get(m.b)?.name}`}
                  >
                    Court {m.court}
                  </span>
                ))}
                {onCourt.length > 2 && <span>+{onCourt.length - 2}</span>}
              </div>
            )}
          </div>
        )}
      </header>

      <section
        className="vb-leaderboards"
        aria-label={`${t.name} leaderboards`}
      >
        <div className="vb-section-heading">
          <h3>Standings</h3>
          <span className="vb-qualification">
            <i />
            {data.hasLeague
              ? `Top ${t.qualify} per group advance`
              : "Groups assigned with fixtures"}
          </span>
        </div>
        <div
          className="vb-standings-grid"
          style={{ "--groups": Math.min(groups.length, 4) }}
        >
          {groups.map((group) => (
            <StandingsGroup
              key={group.key}
              group={group}
              tournament={t}
              hasLeague={data.hasLeague}
            />
          ))}
        </div>
        <p className="vb-standings-key">
          <span className="vb-full-key">
            P played · W wins · GD game difference · PD point difference
          </span>
          <span className="vb-compact-key">
            W/P wins / played · PD point difference
          </span>
        </p>
      </section>

      <div className="vb-tournament-bottom">
        <section className="vb-calls" aria-label={`${t.name} upcoming games`}>
          <div className="vb-section-heading">
            <h3>Up next</h3>
            <span>
              {calls.length} waiting
              {onCourt.length ? ` · ${onCourt.length} on court` : ""}
            </span>
          </div>
          <div
            className="vb-call-list vb-scroll"
            tabIndex={0}
            aria-label={`${t.name} courts and upcoming calls`}
          >
            {calls.map((m) => (
              <div className="vb-call-row" key={m.id}>
                <b className="vb-call-number">
                  {String(callPositions.get(m.id)).padStart(2, "0")}
                </b>
                <div>
                  <small>
                    {groupName(m.group) || m.stage} ·{" "}
                    {firstCall === m.id
                      ? "Next call"
                      : !manual && m.scheduled
                        ? time(m.scheduled)
                        : "On deck"}
                  </small>
                  <strong>
                    {teams.get(m.a)?.name}
                    <em> vs </em>
                    {teams.get(m.b)?.name}
                  </strong>
                </div>
              </div>
            ))}
            {!calls.length && (
              <p className="vb-empty">
                {champion
                  ? "All matches complete."
                  : "No upcoming games currently called."}
              </p>
            )}
          </div>
        </section>
        <section className="vb-results" aria-label={`${t.name} latest results`}>
          <div className="vb-section-heading">
            <h3>Latest results</h3>
            <span>All {data.completed} · scroll by group</span>
          </div>
          {results.length ? (
            <div
              className="vb-results-grid"
              style={{ "--result-groups": Math.min(results.length, 4) }}
            >
              {results.map((group) => (
                <ResultGroup key={group.key} group={group} teams={teams} />
              ))}
            </div>
          ) : (
            <p className="vb-empty">
              Group results appear after fixtures are created.
            </p>
          )}
        </section>
      </div>
    </article>
  );
}

export default function VenueBoard({
  state,
  calls,
  callPositions,
  connected,
  now,
}) {
  const [preferences, setPreferences] = useState(savedSelection);
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
    } catch {
      /* Screen still works without local storage. */
    }
  }, [selection, preferences]);
  const chooseTournament = (index, id) => {
    const ids = [...selection.ids];
    const previous = ids[index];
    const other = ids.indexOf(id);
    ids[index] = id;
    if (other >= 0 && other !== index) ids[other] = previous;
    setPreferences({ count: selection.count, ids });
  };
  const columns = selection.count <= 3 ? Math.max(1, selection.count) : 2;
  return (
    <div
      className={`venue-board ${selection.count > 1 ? "vb-multiple" : "vb-single"} ${selection.count >= 3 ? "vb-dense" : ""}`}
    >
      <header className="vb-header">
        <img className="vb-logo" src={logo} alt="ShuttleHub" />
        <div className="vb-title">
          <span>THE TOURNAMENT BOARD</span>
          <h1>{state.event.name}</h1>
        </div>
        <div className="vb-clock">
          <strong>
            {now.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </strong>
          <span className={connected ? "" : "vb-disconnected"}>
            <i />
            {connected
              ? "Connected locally"
              : "Reconnecting · standings may be out of date"}
          </span>
        </div>
      </header>
      {state.demo && (
        <div className="vb-demo">SAMPLE EVENT · Demonstration data</div>
      )}
      <div className="vb-toolbar">
        <div className="vb-selectors">
          <label className="vb-count">
            Show{" "}
            <select
              aria-label="Number of tournaments"
              value={selection.count}
              disabled={!options.length}
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
            </select>
          </label>
          {selection.ids.map((id, i) => (
            <label className="vb-tournament-select" key={i}>
              <span>
                {selection.count > 1 ? `Tournament ${i + 1}` : "Tournament"}
              </span>
              <select
                aria-label={`Tournament ${i + 1}`}
                value={id}
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
              </select>
            </label>
          ))}
        </div>
        <button
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
        </button>
      </div>
      <main
        className={`vb-board-grid ${selection.count > 3 ? "vb-many" : ""}`}
        style={{
          "--board-columns": columns,
          "--board-rows": Math.ceil(selection.count / columns),
        }}
      >
        {panels.length ? (
          panels.map((data) => (
            <TournamentPanel
              key={data.tournament.id}
              data={data}
              teams={teams}
              calls={calls.filter((m) => m.tournamentId === data.tournament.id)}
              callPositions={callPositions}
              manual={!!state.callOrder}
              firstCall={calls[0]?.id}
            />
          ))
        ) : (
          <div className="vb-no-tournaments">
            <Trophy size={36} />
            <h2>Ready for your first tournament</h2>
            <p>
              Standings, results, and upcoming games will appear here once a
              tournament is created.
            </p>
          </div>
        )}
      </main>
      <footer className="vb-footer">
        <span>
          <Radio size={15} />
          COURTSIDE UPDATE
        </span>
        <p>
          {state.event.announcement ||
            "Welcome to ShuttleHub. Play hard. Play fair. Enjoy every rally."}
        </p>
      </footer>
      {error && (
        <div className="toast error" role="alert">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
