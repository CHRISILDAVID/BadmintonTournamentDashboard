import React, {
  useContext,
  createContext,
  useEffect,
  useRef,
  useMemo,
  useState,
} from "react";
import {
  LayoutDashboard,
  Trophy,
  Users,
  CalendarDays,
  GitBranch,
  Settings,
  Monitor,
  ArrowUpRight,
  ArrowRight,
  Plus,
  ChevronRight,
  Check,
  CheckCircle2,
  Clock3,
  Play,
  X,
  Upload,
  Download,
  Search,
  Radio,
  Maximize,
  ChevronLeft,
  Activity,
  SlidersHorizontal,
  Wifi,
  Pencil,
  Trash2,
} from "lucide-react";
import { standings, groupName, time, importTeams, download, playerLabel } from "./utils.js";

import { upcomingMatches, tournamentProgress } from "../shared/matches.js";

import ScoreInput from "./ScoreInput.jsx";
import { finalScores } from "./scores.js";

import VenueBoard from "./VenueBoard.jsx";
import TournamentFormatFields from "./TournamentFormatFields.jsx";
import GroupEditor from "./GroupEditor.jsx";
import { groupEditLockReason } from "../shared/groups.js";
import { PLAYOFF_STAGE, directPlaces, isPlayoffFormat, qualificationStatus, playoffPreset, pendingOpponent, scoringRules, scoringLabel } from "../shared/format.js";

import shuttleHubLogo from "../assets/logo.jpg";

const AppContext = createContext(null);
const NAV = [
  ["Overview", LayoutDashboard],
  ["Tournaments", Trophy],
  ["Teams & players", Users],
  ["Matches", CalendarDays],
  ["Standings", GitBranch],
];
const defaults = {
  name: "Men’s Doubles",
  size: 2,
  groups: 2,
  qualify: 2,
  points: 21,
  cap: 30,
  bestOf: 3,
};
const presets = [
  ["2v2 Intermediate men", 2, "intermediate"],
  ["2v2 Beginner men", 2, "beginner"],
  ["Men’s Doubles", 2],
  ["Men’s Singles", 1],
  ["Women’s Singles", 1],
  ["Women’s Doubles", 2],
  ["Mixed Doubles", 2],
  ["3v3", 3],
  ["Custom", 2],
];
function Logo({ small = false }) {
  return (
    <div className={`brand ${small ? "small" : ""}`}>
      <img src={shuttleHubLogo} alt="ShuttleHub" width="150" height="150" />
    </div>
  );
}
function Pill({ children, tone = "" }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}
function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <Trophy size={32} />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function Modal({ title, children, close, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    const dialog = ref.current;
    const cancel = (e) => {
      e.preventDefault();
      close();
    };
    dialog.addEventListener("cancel", cancel);
    return () => {
      dialog.removeEventListener("cancel", cancel);
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="modal-head">
        <div>
          <span className="eyebrow">SHUTTLEHUB TOURNAMENT DESK</span>
          <h2>{title}</h2>
        </div>
        <button className="icon-btn" aria-label="Close dialog" onClick={close}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function App() {
  const [state, setState] = useState(null),
    [page, setPage] = useState("Overview"),
    [filter, setFilter] = useState("all"),
    [modal, setModal] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [connected, setConnected] = useState(false),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(new Date());
  const display = location.pathname === "/display",
    [displayHistory, setDisplayHistory] = useState(false);
  const stateRef = useRef(null);
  const busyRef = useRef(false);
  function accept(next) {
    if (!stateRef.current || next.revision >= stateRef.current.revision) {
      stateRef.current = next;
      setState(next);
    }
  }
  async function refresh() {
    const r = await fetch("/api/state");
    if (!r.ok) throw new Error("Unable to load tournament data.");
    accept(await r.json());
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    const es = new EventSource("/api/events");
    es.onmessage = () => {
      setConnected(true);
      refresh().catch(() => setConnected(false));
    };
    es.onerror = () => setConnected(false);
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => {
      es.close();
      clearInterval(interval);
    };
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  useEffect(() => {
    if (state && filter !== "all" && !state.tournaments.some(t => t.id === filter)) setFilter("all");
  }, [state, filter]);
  async function act(
    action,
    payload = {},
    message = "Changes saved",
    expectedRevision,
  ) {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          payload,
          revision: expectedRevision ?? stateRef.current.revision,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (r.status === 409) {
          await refresh();
          setModal((current) =>
            current
              ? { ...current, conflictRevision: stateRef.current.revision }
              : current,
          );
        }
        throw new Error(data.error);
      }
      accept(data);
      setNotice(message);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const team = (id) => state?.teams.find((t) => t.id === id),
    tournament = (id) => state?.tournaments.find((t) => t.id === id);
  const open = (data) => {
    setError("");
    setModal(data);
  };
  const admin = !display;
  const selected =
    state?.matches.filter(
      (m) => filter === "all" || m.tournamentId === filter,
    ) || [];
  const live = selected
    .filter((m) => m.status === "live")
    .sort((a, b) => a.court - b.court);
  const readyMatches = useMemo(() => upcomingMatches(state), [state]);
  const upcoming = readyMatches.filter(m => filter === "all" || m.tournamentId === filter);
  const completed = selected
    .filter((m) => m.status === "completed")
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const categorySelect = (
    <select
      aria-label="Filter by tournament"
      className="category-select"
      value={filter}
      onChange={(e) => setFilter(e.target.value)}
    >
      <option value="all">All tournaments</option>
      {state?.tournaments.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
  if (!state)
    return (
      <div className="loading">
        <Logo />
        <p>{error || "Connecting to tournament desk…"}</p>
        {error && <button onClick={() => location.reload()}>Reconnect</button>}
      </div>
    );

  const titles = {
    Overview: "Courtside",
    Tournaments: "Your tournaments",
    "Teams & players": "Teams & players",
    Matches: "Match centre",
    History: "Match history",
    Standings: "Standings & brackets",
    Settings: "Club settings",
  };
  const subtitles = {
    Overview: "On court. Upcoming games. Final results.",
    Tournaments: "Set up categories, seed groups, and build the draw.",
    "Teams & players": "Register your players and manage team entries.",
    Matches: "Choose any ready game, assign a court, and record the result.",
    History: "Completed matches across all your tournaments.",
    Standings: "Group tables and the route to the final.",
    Settings: "Your venue, courts, and connected screens.",
  };
  const contextValue = {
    readyMatches,
    state,
    page,
    filter,
    modal,
    error,
    notice,
    connected,
    busy,
    now,
    display,
    displayHistory,
    admin,
    selected,
    live,
    upcoming,
    completed,
    categorySelect,
    team,
    tournament,
    open,
    act,
    setState,
    setPage,
    setFilter,
    setModal,
    setError,
    setNotice,
    setDisplayHistory,
  };
  if (display)
    return (
      <AppContext.Provider value={contextValue}>
        <VenueDisplay />
      </AppContext.Provider>
    );
  return (
    <AppContext.Provider value={contextValue}>
      <div className="app-shell">
        <aside className="sidebar">
          <Logo />
          <div className="event-label">
            <span className="event-icon">
              <Trophy size={18} />
            </span>
            <div>
              <strong>{state.event.name}</strong>
              <small>{state.demo ? "Demo courts" : "Organizing desk"}</small>
            </div>
          </div>
          <span className="nav-label">TOURNAMENT CONTROL</span>
          <nav>
            {NAV.map(([label, Icon]) => (
              <button
                key={label}
                className={
                  page === label || (label === "Matches" && page === "History")
                    ? "active"
                    : ""
                }
                onClick={() => setPage(label)}
              >
                <Icon size={19} />
                {label}
                {label === "Matches" &&
                  state.matches.some((m) => m.status === "live") && (
                    <span className="nav-number">
                      {state.matches.filter((m) => m.status === "live").length}
                    </span>
                  )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <a
              className="display-promo"
              href="/display"
              target="_blank"
              rel="noreferrer"
            >
              <span className="display-icon">
                <Monitor size={23} />
                <ArrowUpRight size={16} />
              </span>
              <strong>The courtside screen</strong>
              <p>
                Results and upcoming games,
                <br />
                ready for the whole venue.
              </p>
              <span>
                Open scoreboard
                <ArrowRight size={15} />
              </span>
            </a>
            {admin && (
              <button
                className={`settings-nav ${page === "Settings" ? "active" : ""}`}
                onClick={() => setPage("Settings")}
              >
                <Settings size={18} />
                Club settings
              </button>
            )}
            <div className="club-signature">
              <span>SHUTTLEHUB</span>
              <span>
                COURTSIDE CONTROL <ArrowUpRight size={13} />
              </span>
            </div>
          </div>
        </aside>
        <main>
          <header className="topbar">
            <div className="breadcrumb">
              CONTROL DESK
              <ChevronRight size={14} />
              <strong>{page}</strong>
            </div>
            <div>
              <span className={`connection ${connected ? "" : "disconnected"}`}>
                <i className="dot" />
                {connected ? "Connected locally" : "Reconnecting…"}
              </span>
              <span className="topbar-courts">
                <span className="tiny-court" />
                {state.event.courts} courts
              </span>
            </div>
          </header>
          <div className="main-content">
            {state.demo && (
              <div className="demo-strip">
                You’re exploring a sample event.
                {admin && (
                  <button onClick={() => open({ type: "clearDemo" })}>
                    Clear sample & start your event
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            )}
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  {page === "Overview"
                    ? "SHUTTLEHUB / CONTROL DESK"
                    : "SHUTTLEHUB / CONTROL DESK"}
                </div>
                <h1>{titles[page]}</h1>
                <p>{subtitles[page]}</p>
              </div>
              <div className="heading-actions">
                {admin && (
                  <button
                    className="btn settings-mobile"
                    aria-label="Club settings"
                    onClick={() => setPage("Settings")}
                  >
                    <Settings size={16} />
                  </button>
                )}
                <a
                  className="btn"
                  href="/display"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Monitor size={16} />
                  Venue display
                  <ArrowUpRight size={14} />
                </a>
                <button
                  className="btn primary"
                  onClick={() => open({ type: "tournament" })}
                >
                  <Plus size={17} />
                  New tournament
                </button>
              </div>
            </div>
            {page === "Overview" ? (
              <Overview />
            ) : page === "Tournaments" ? (
              <Tournaments />
            ) : page === "Teams & players" ? (
              <Teams />
            ) : page === "Matches" || page === "History" ? (
              <Matches key={page} history={page === "History"} />
            ) : page === "Standings" ? (
              <Standings />
            ) : admin ? (
              <SettingsPage />
            ) : null}
            {admin && !state.tournaments.length && (
              <div className="sample-offer">
                <span>Want to see how match day looks?</span>
                <button
                  className="text-btn"
                  disabled={busy}
                  onClick={() => act("demo", {}, "Sample tournament loaded")}
                >
                  Explore a sample event
                  <ArrowUpRight size={15} />
                </button>
              </div>
            )}
            <footer className="app-footer">
              <span>SHUTTLEHUB.IN / COURTSIDE CONTROL</span>
              <span>
                ShuttleHub <span className="footer-dot">●</span> Tournament desk
              </span>
            </footer>
          </div>
        </main>
        {modal && (
          <Modal
            title={
              {
                tournament: modal.tournament
                  ? "Edit tournament"
                  : "Create a tournament",
                team: modal.team ? "Edit team" : "Add a team",
                import: "Import your teams",
                match: "Match desk",
                generate: "Ready to create fixtures?",
                knockouts: "Create the knockout bracket",
                resetFixtures: "Reset fixtures",
                groups: "Edit groups",
                deleteTeam: "Remove team",
                deleteTournament: "Delete tournament",
                returnMatch: "Return this match to waiting?",
                clearDemo: "Start your own event",
                randomComplete: "Complete unfinished matches with random scores?",
              }[modal.type]
            }
            wide={["tournament", "import", "groups"].includes(modal.type)}
            close={() => {
              setModal(null);
              setError("");
            }}
          >
            {modal.type === "tournament" ? (
              <TournamentForm />
            ) : modal.type === "team" || modal.type === "import" ? (
              <TeamForm importing={modal.type === "import"} />
            ) : modal.type === "match" ? (
              <MatchForm />
            ) : modal.type === "groups" ? (
              <GroupEditor state={state} tournamentId={modal.tournament.id}
                initialTeamId={modal.team?.id} busy={busy} act={act} close={() => setModal(null)} />
            ) : (
              <ConfirmForm />
            )}
            {error && (
              <div className="error inline-error" role="alert">
                {error}
              </div>
            )}
          </Modal>
        )}
        {!modal && error && (
          <div className="toast error" role="alert">
            {error}
            <button onClick={() => setError("")} aria-label="Dismiss error">
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div className="toast success" role="status">
            <CheckCircle2 size={18} />
            {notice}
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
}
function MatchCard({ m, compact = false }) {
  const {
    state,
    page,
    filter,
    modal,
    error,
    notice,
    connected,
    busy,
    now,
    display,
    displayHistory,
    admin,
    selected,
    live,
    upcoming,
    completed,
    categorySelect,
    team,
    tournament,
    open,
    act,
    setState,
    setPage,
    setFilter,
    setModal,
    setError,
    setNotice,
    setDisplayHistory,
  } = useContext(AppContext);
  const t = tournament(m.tournamentId),
    a = team(m.a),
    b = team(m.b);
  return (
    <div className={`match-card ${m.status} ${compact ? "compact" : ""}`}>
      <div className="match-meta">
        <span className="court-heading">
          {m.status === "live"
            ? `COURT ${String(m.court).padStart(2, "0")}`
            : t?.name}
        </span>
        <Pill tone={m.status === "live" ? "green" : ""}>
          {m.status === "live" ? (
            <>
              <i className="dot" />
              ON COURT
            </>
          ) : m.status === "completed" ? (
            m.bye ? "BYE" : "FINAL SCORE"
          ) : (
            m.stage
          )}
        </Pill>
      </div>
      <div className="match-sub">
        {m.stage === PLAYOFF_STAGE ? `${groupName(m.group)} · ${m.playoffRanks.join(" vs ")} → slot ${m.qualifyingSlot}` : m.status === "live"
          ? `${t?.name} / ${groupName(m.group) || m.stage}`
          : groupName(m.group) || m.stage}
      </div>
      <div className="opponents">
        {[a, b].map((t, i) => (
          <div
            className={`opponent ${m.winner === t?.id ? "winner" : ""}`}
            key={i}
          >
            <span className="team-avatar">
              {t?.name
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("") || "?"}
            </span>
            <div>
              <strong>{t?.name || pendingOpponent(m, i === 0 ? "a" : "b")}</strong>
              {!compact && (
                <small>
                  {t ? `Seed ${t.seed}` : "Winner of previous round"}
                </small>
              )}
            </div>
            {m.status === "completed" && (
              <span className="game-scores">
                {m.games.map((g, j) => (
                  <b key={j} className={g[i] > g[1 - i] ? "won" : ""}>
                    {g[i]}
                  </b>
                ))}
                {m.winner === t?.id && <Check size={15} />}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="match-foot">
        <span>
          <span className="tiny-court" />
          {m.status === "live"
            ? `Court ${m.court}`
            : m.status === "completed"
              ? time(m.completedAt)
              : m.scheduled
                ? time(m.scheduled)
                : "Ready to start"}
        </span>
        {admin && (
          <button
            className="text-btn"
            disabled={m.status === "upcoming" && (!m.a || !m.b)}
            onClick={() => open({ type: "match", matchId: m.id })}
          >
            {m.status === "live"
              ? "Record result"
              : m.status === "completed"
                ? (m.bye ? "View bye" : "Edit result")
                : "Start game"}
            <ArrowUpRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
function MatchTable({ matches, history = false }) {
  const {
    state,
    readyMatches,
    page,
    filter,
    modal,
    error,
    notice,
    connected,
    busy,
    now,
    display,
    displayHistory,
    admin,
    selected,
    live,
    upcoming,
    completed,
    categorySelect,
    team,
    tournament,
    open,
    act,
    setState,
    setPage,
    setFilter,
    setModal,
    setError,
    setNotice,
    setDisplayHistory,
  } = useContext(AppContext);
  return matches.length ? (
    <div className="table-scroll">
      <table className="match-table">
        <thead>
          <tr>
            <th>MATCH / TOURNAMENT</th>
            <th>STAGE</th>
            <th>{history ? "RESULT" : "COURT / TIME"}</th>
            <th>STATUS</th>
            {admin && <th />}
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => (
            <tr key={m.id}>
              <td>
                <strong>
                  {team(m.a)?.name || pendingOpponent(m, "a")}{" "}
                  <span className="versus">vs</span>{" "}
                  {team(m.b)?.name || pendingOpponent(m, "b")}
                </strong>
                <small>{tournament(m.tournamentId)?.name}</small>
              </td>
              <td>
                {m.stage}
                <small>{groupName(m.group)}</small>
              </td>
              <td>
                {m.status === "completed" ? (
                  <>
                    <strong>
                      {m.games.map((g) => g.join("–")).join(" / ")}
                    </strong>
                    <small>{team(m.winner)?.name} {m.bye ? "advances by bye" : "won"}</small>
                  </>
                ) : (
                  <>
                    <strong>{m.status === "upcoming" ? (m.a && m.b ? "Ready to start" : "Awaiting opponents") : `Court ${m.court}`}</strong>
                    {m.scheduled && <small>Planned {time(m.scheduled)}</small>}
                    {m.status === "upcoming" && <small>Court assigned at start</small>}
                  </>
                )}
              </td>
              <td>
                <Pill tone={m.status === "live" ? "green" : ""}>
                  {m.status === "upcoming"
                    ? "Upcoming"
                    : m.status === "completed"
                      ? (m.bye ? "Bye" : "Completed")
                      : "On court"}
                </Pill>
              </td>
              {admin && (
                <td className="match-actions-cell">
                  <button
                    className="btn"
                    disabled={m.status === "upcoming" && (!m.a || !m.b)}
                    aria-label={`${m.status === "upcoming" ? "Start game" : m.status === "live" ? "Record result" : (m.bye ? "View bye" : "Edit result")}: ${team(m.a)?.name || "match"} vs ${team(m.b)?.name || "qualifier"}`}
                    onClick={() => open({ type: "match", matchId: m.id })}
                  >
                    {m.status === "upcoming" ? "Start game" : m.status === "live" ? "Record result" : (m.bye ? "View bye" : "Edit result")}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty title={history ? "No results yet" : "No matches here yet"}>
      {history
        ? "Completed matches will appear here automatically."
        : "Add teams and generate fixtures from Tournaments."}
    </Empty>
  );
}
function Overview() {
  const {
    state,
    readyMatches,
    live,
    upcoming,
    completed,
    categorySelect,
    team,
    tournament,
    open,
    setPage,
  } = useContext(AppContext);
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
                <button
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
                </button>
              );
            },
          )}
        </div>
      </div>
      <div className="score-strip">
        {[
          ["Categories", state.tournaments.length],
          ["Teams entered", state.teams.length],
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
            <button
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
            </button>
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
            <button className="text-btn" onClick={() => setPage("Matches")}>
              All matches <ArrowUpRight size={16} />
            </button>
          </div>
          {upcoming.length ? (
            <div className="match-queue">
              {upcoming.slice(0, 4).map((m, i) => (
                <button
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
                      {tournament(m.tournamentId)?.name} <span>/</span>{" "}
                      {groupName(m.group) || m.stage}
                    </small>
                  </span>
                  <span className="queue-time">
                    Start game
                  </span>
                  <ArrowUpRight size={18} />
                </button>
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
            <button className="text-btn" onClick={() => setPage("History")}>
              All results <ArrowUpRight size={16} />
            </button>
          </div>
          {completed.length ? (
            completed.slice(0, 3).map((m) => (
              <div className="result-slip" key={m.id}>
                <div className="recent-meta">
                  <span>{tournament(m.tournamentId)?.name}</span>
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
function Tournaments() {
  const {
    state,
    page,
    filter,
    modal,
    error,
    notice,
    connected,
    busy,
    now,
    display,
    displayHistory,
    admin,
    selected,
    live,
    upcoming,
    completed,
    categorySelect,
    team,
    tournament,
    open,
    act,
    setState,
    setPage,
    setFilter,
    setModal,
    setError,
    setNotice,
    setDisplayHistory,
  } = useContext(AppContext);
  return (
    <>
      <div className="info-banner">
        <SlidersHorizontal size={20} />
        <div>
          <strong>A format that fits your tournament.</strong>
          <span>
            Start with a category. Add teams as they register. Generate fixtures
            when you’re ready.
          </span>
        </div>
      </div>
      {!state.tournaments.length ? (
        <Empty
          title="Your first tournament starts here"
          action={
            admin && (
              <button
                className="btn primary"
                onClick={() => open({ type: "tournament" })}
              >
                <Plus size={16} />
                Create tournament
              </button>
            )
          }
        >
          Singles, doubles, mixed, or something entirely your own.
        </Empty>
      ) : (
        <div className="tournament-grid">
          {state.tournaments.map((t, i) => {
            const teams = state.teams.filter((x) => x.tournamentId === t.id),
              matches = state.matches.filter((m) => m.tournamentId === t.id),
              done = matches.filter((m) => m.status === "completed").length,
              champ = matches.find((m) => m.stage === "Final" && m.winner);
            return (
              <section className="panel tournament-card" key={t.id}>
                <div className="tournament-top">
                  <div className={`category-icon color-${i % 3}`}>
                    <Trophy size={23} />
                  </div>
                  <Pill tone={champ ? "green" : ""}>
                    {champ
                      ? "Finished"
                      : matches.length
                        ? (matches.some(m => m.status !== "upcoming") ? "In progress" : "Ready")
                        : "Registration"}
                  </Pill>
                </div>
                <h2>{t.name}</h2>
                <p>
                  League + knockout ·{" "}
                  {t.size === 1 ? "Singles" : `${t.size} players per team`}
                </p>
                <div className="tournament-numbers">
                  <div>
                    <b>{teams.length}</b>
                    <span>Teams</span>
                  </div>
                  <div>
                    <b>{t.groups}</b>
                    <span>Groups</span>
                  </div>
                  <div>
                    <b>{t.groups * t.qualify}</b>
                    <span>Qualifiers</span>
                  </div>
                </div>
                <div className="progress">
                  <span
                    style={{
                      width: `${matches.length ? (done / matches.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <small>
                  {matches.filter(m => m.status === "completed" && !m.bye).length} of {matches.filter(m => !m.bye).length} matches completed · League: {scoringLabel(scoringRules(t))}
                  {t.scoring && <><br/>Main knockout: {scoringLabel(scoringRules(t, "Final"))}</>}
                  {isPlayoffFormat(t) && <><br/>Playoffs: {scoringLabel(scoringRules(t, PLAYOFF_STAGE))}</>}
                </small>
                {champ && (
                  <p className="champion">
                    <Trophy size={16} />
                    {team(champ.winner)?.name} wins!
                  </p>
                )}
                <div className="tournament-actions">
                  {matches.length > 0 && t.groups > 1 && (
                    <button className="btn" disabled={!!groupEditLockReason(state, t.id)}
                      title={groupEditLockReason(state, t.id) || "Swap teams between groups"}
                      onClick={() => open({ type: "groups", tournament: t })}>
                      Edit groups
                    </button>
                  )}
                  <button
                    className="btn"
                    onClick={() => {
                      setFilter(t.id);
                      setPage("Teams & players");
                    }}
                  >
                    Manage teams
                    <ChevronRight size={15} />
                  </button>
                  {admin && !matches.length && (
                    <button
                      className="icon-btn"
                      aria-label={`Edit ${t.name}`}
                      onClick={() =>
                        open({ type: "tournament", tournament: t })
                      }
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                  {admin &&
                    (!matches.length ? (
                      <button
                        className="btn primary"
                        onClick={() =>
                          open({ type: "generate", tournament: t })
                        }
                      >
                        Fixtures
                      </button>
                    ) : !matches.some((m) => m.stage !== "League") ? (
                      <button
                        className="btn primary"
                        disabled={done !== matches.length}
                        onClick={() =>
                          open({ type: "knockouts", tournament: t })
                        }
                      >
                        {isPlayoffFormat(t) ? "Playoffs + bracket" : "Knockouts"}
                      </button>
                    ) : (
                      <button
                        className="btn primary"
                        onClick={() => {
                          setFilter(t.id);
                          setPage("Standings");
                        }}
                      >
                        Bracket
                      </button>
                    ))}
                </div>
                {admin &&
                  matches.length > 0 &&
                  done === 0 &&
                  !matches.some((m) => m.status === "live") && (
                    <button
                      className="text-btn reset-link"
                      onClick={() =>
                        open({ type: "resetFixtures", tournament: t })
                      }
                    >
                      Reset unplayed fixtures
                    </button>
                  )}
                <div className="tournament-delete">
                  <button className="text-btn" aria-label={`Delete ${t.name}`}
                    disabled={matches.some(m => m.status === "live")}
                    onClick={() => open({type:"deleteTournament", tournament:t})}>
                    <Trash2 size={14} />Delete tournament
                  </button>
                  {matches.some(m => m.status === "live") && <small>Finish on-court matches first</small>}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
function Teams() {
  const {
    state,
    page,
    filter,
    modal,
    error,
    notice,
    connected,
    busy,
    now,
    display,
    displayHistory,
    admin,
    selected,
    live,
    upcoming,
    completed,
    categorySelect,
    team,
    tournament,
    open,
    act,
    setState,
    setPage,
    setFilter,
    setModal,
    setError,
    setNotice,
    setDisplayHistory,
  } = useContext(AppContext);
  const [query, setQuery] = useState("");
  const selectedTournament = state.tournaments.find((t) => t.id === filter);
  const groupLock = selectedTournament ? groupEditLockReason(state, filter) : "";
  const teams = state.teams.filter(
    (t) =>
      (filter === "all" || t.tournamentId === filter) &&
      `${t.name} ${t.players.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <section className="panel">
      <div className="toolbar">
        <div className="search">
          <Search size={17} />
          <input
            placeholder="Search teams or players…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {categorySelect}
        {selectedTournament?.groups > 1 && (
          <button className="btn" disabled={!!groupLock} title={groupLock || "Swap teams between groups"}
            onClick={() => open({ type: "groups", tournament: selectedTournament })}>
            <Pencil size={16} />Edit groups
          </button>
        )}
        {admin && (
          <>
            <button className="btn" onClick={() => open({ type: "import" })}>
              <Upload size={16} />
              Import teams
            </button>
            <button
              className="btn primary"
              onClick={() => open({ type: "team" })}
            >
              <Plus size={16} />
              Add team
            </button>
          </>
        )}
      </div>
      {selectedTournament?.groups > 1 && <p className="group-edit-hint">
        {groupLock || "Edit groups by swapping teams. Group sizes stay fixed; editing locks after the first completed match."}
      </p>}
      {teams.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>SEED</th>
                <th>TEAM / PLAYER</th>
                <th>TOURNAMENT</th>
                <th>GROUP</th>
                {admin && <th />}
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id}>
                  <td>
                    <span className="seed">{t.seed}</span>
                  </td>
                  <td>
                    <strong>{t.name}</strong>
                  </td>
                  <td>{tournament(t.tournamentId)?.name}</td>
                  <td>{groupName(t.group) || "Not assigned"}</td>
                  {admin && (
                    <td>
                      {t.group != null ? (
                        <button
                          className="text-btn"
                          aria-label={`Change group for ${t.name} in ${tournament(t.tournamentId)?.name}`}
                          disabled={!!groupEditLockReason(state, t.tournamentId)}
                          title={groupEditLockReason(state, t.tournamentId) || "Swap with a team in another group"}
                          onClick={() => open({ type: "groups", tournament: tournament(t.tournamentId), team: t })}
                        >
                          <Pencil size={14} />Change group
                        </button>
                      ) : null}
                      <button
                        className="text-btn"
                        aria-label={`Edit ${t.name}`}
                        disabled={!!tournamentProgress(state, t.tournamentId).champion}
                        title={tournamentProgress(state, t.tournamentId).champion ? "Player names are locked after the tournament ends" : "Edit player names"}
                        onClick={() => open({ type: "team", team: t })}
                      >
                        <Pencil size={16} /> Edit players
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="Make room for your competitors">
          Create a tournament, then add teams manually or import a CSV / Excel
          workbook.
        </Empty>
      )}
    </section>
  );
}
function StageActions() {
  const { state, filter, page, busy, open, setFilter, setPage } = useContext(AppContext);
  const categories = state.tournaments.map(t => ({ t, progress: tournamentProgress(state, t.id) }))
    .filter(({ t, progress }) => filter === "all" ? progress.canCreateKnockouts : t.id === filter);
  if (!categories.length) return null;
  return <div className="stage-actions" aria-label="Tournament next steps">
    {categories.map(({ t, progress }) => <section className="stage-action" key={t.id} aria-label={`${t.name} next steps`}>
      <div><strong>{t.name}</strong><p>{progress.champion ? "Tournament complete" : progress.canCreateKnockouts ? "League complete. Ready for the next stage." : progress.postseason ? "Playoffs and knockouts are ready. Winners advance automatically." : progress.hasFixtures ? `${progress.remaining} league games remaining` : "Add players, then generate fixtures."}</p></div>
      <div className="stage-buttons">
        {progress.canCreateKnockouts && <button className="btn primary" disabled={busy} onClick={() => open({ type: "knockouts", tournament: t })}>{isPlayoffFormat(t) ? "Create playoffs + bracket" : "Create knockouts"}</button>}
        {progress.hasFixtures && page !== "Matches" && <button className="btn" onClick={() => { setFilter(t.id); setPage("Matches"); }}>Manage games</button>}
        {progress.hasFixtures && page !== "Standings" && <button className="btn" onClick={() => { setFilter(t.id); setPage("Standings"); }}>{progress.postseason ? "Standings & bracket" : "Review standings"}</button>}
      </div>
    </section>)}
  </div>;
}

function Matches({ history = false }) {
  const {
    state,
    readyMatches,
    page,
    filter,
    modal,
    error,
    notice,
    connected,
    busy,
    now,
    display,
    displayHistory,
    admin,
    selected,
    live,
    upcoming,
    completed,
    categorySelect,
    team,
    tournament,
    open,
    act,
    setState,
    setPage,
    setFilter,
    setModal,
    setError,
    setNotice,
    setDisplayHistory,
  } = useContext(AppContext);
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const [testTools, setTestTools] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/features", { signal: controller.signal })
      .then(r => r.ok ? r.json() : {})
      .then(features => setTestTools(!!features.testTools))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const unfinishedCount = selected.filter(m => m.status !== "completed" && !m.bye).length;
  const postseasonCount = selected.filter(m => m.stage !== "League").length;
  useEffect(() => { setStatus("all"); setQuery(""); setStage(filter !== "all" && postseasonCount ? "postseason" : "all"); }, [filter, postseasonCount]);
  const waiting = selected.filter(m => m.status === "upcoming" && (!m.a || !m.b));
  const matches = (history ? completed : [...live, ...upcoming, ...waiting, ...completed]).filter(
    (m) =>
      (status === "all" || m.status === status) &&
      (history || stage === "all" || (stage === "postseason" ? m.stage !== "League" : m.stage === stage)) &&
      `${team(m.a)?.name} ${team(m.b)?.name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <section className="panel">
      {!history && <StageActions />}
      <div className="toolbar">
        <div className="search search-match">
          <Search size={17} />
          <input
            placeholder="Find a match…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {categorySelect}
        {!history && (
          <select
            aria-label="Match status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="live">On court</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
          </select>
        )}
        {!history && <select aria-label="Match stage" value={stage} onChange={e => setStage(e.target.value)}>
          <option value="all">All stages</option><option value="League">League</option>
          <option value="postseason">Playoffs & knockouts</option>
        </select>}
        <button
          className="btn"
          onClick={() => setPage(history ? "Matches" : "History")}
        >
          {history ? "All matches" : "Match history"}
          <ArrowUpRight size={15} />
        </button>
      </div>
      {!history && admin && testTools && <div className="toolbar">
        <button className="btn danger" disabled={busy || !unfinishedCount}
          onClick={() => open({ type: "randomComplete", tournament: filter === "all" ? undefined : tournament(filter) })}>
          Testing: complete unfinished matches
        </button>
        <span className="help-text">{unfinishedCount} unfinished games in {filter === "all" ? "all tournaments" : tournament(filter)?.name}, across every stage. Uses random scores.</span>
      </div>}
      <MatchTable matches={matches} history={history} />
    </section>
  );
}
function Standings() {
  const {
    state,
    page,
    filter,
    modal,
    error,
    notice,
    connected,
    busy,
    now,
    display,
    displayHistory,
    admin,
    selected,
    live,
    upcoming,
    completed,
    categorySelect,
    team,
    tournament,
    open,
    act,
    setState,
    setPage,
    setFilter,
    setModal,
    setError,
    setNotice,
    setDisplayHistory,
  } = useContext(AppContext);
  const ts = state.tournaments.filter(
    (t) => filter === "all" || filter === t.id,
  );
  return (
    <>
      <div className="toolbar standalone">
        {categorySelect}
        <span className="muted">
          Ranked by wins → game difference → point difference → seed.
        </span>
      </div>
      <StageActions />
      {ts.length ? (
        ts.map((t) => (
          <section key={t.id} className="standing-section">
            <div className="section-heading">
              <h2>{t.name}</h2>
              <Pill>{isPlayoffFormat(t) ? `Top ${directPlaces(t)} direct + playoffs` : `${t.qualify} qualify per group`}</Pill>
            </div>
            <div className="standings-grid">
              {Array.from({ length: t.groups }, (_, g) => {
                const rows = standings(state, t.id, g);
                return (
                  <div className="panel" key={g}>
                    <div className="panel-heading">
                      <h3>{groupName(g)}</h3>
                      <span className="muted">{rows.length} teams</span>
                    </div>
                    {rows.length ? (
                      <div className="table-scroll">
                        <table className="standing-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>TEAM</th>
                              <th>P</th>
                              <th>W</th>
                              <th>L</th>
                              <th>GD</th>
                              <th>PD</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, i) => (
                              <tr
                                key={r.id}
                                className={["direct", "qualified"].includes(qualificationStatus(state, t, r, i)) ? "qualified" : qualificationStatus(state,t,r,i) === "playoff" ? "playoff-place" : ""}
                              >
                                <td>{i + 1}</td>
                                <td>
                                  <strong>{r.name}</strong>
                                  {isPlayoffFormat(t) && <small className={`qualification-marker ${qualificationStatus(state,t,r,i)}`}>{({direct:"Direct place",playoff:"Qualification playoff",qualified:"Qualified via playoff",eliminated:"Eliminated in playoff"})[qualificationStatus(state,t,r,i)]}</small>}
                                </td>
                                <td>{r.played}</td>
                                <td>{r.wins}</td>
                                <td>{r.losses}</td>
                                <td>{r.gameDiff}</td>
                                <td>{r.pointDiff}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="padded muted">
                        Groups are assigned when you generate fixtures.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="standings-note">
              <i className="dot" /> {isPlayoffFormat(t) ? "Green: direct places or playoff winners. Amber: playoff places. League rankings stay unchanged after playoffs." : "Shaded places qualify once the league is complete."} Seed breaks any remaining tie.
            </p>
            {state.matches.some(m => m.tournamentId === t.id && m.stage === PLAYOFF_STAGE) && <section className="organizer-playoffs">
              <h3>Qualification playoffs</h3><p className="muted">{scoringLabel(scoringRules(t, PLAYOFF_STAGE))}. Winners fill the named knockout slots.</p>
              <div className="organizer-playoff-groups">{Array.from({ length: t.groups }, (_, g) => g).map(g => <div key={g}><h4>{groupName(g)}</h4>{state.matches.filter(m => m.tournamentId === t.id && m.stage === PLAYOFF_STAGE && m.group === g).map(m => <MatchCard key={m.id} m={m} compact/>)}</div>)}</div>
            </section>}
            {state.matches.some(
              (m) => m.tournamentId === t.id && m.stage !== "League" && m.stage !== PLAYOFF_STAGE,
            ) && (
              <div className="bracket">
                {[
                  ...new Set(
                    state.matches
                      .filter(
                        (m) => m.tournamentId === t.id && m.stage !== "League" && m.stage !== PLAYOFF_STAGE,
                      )
                      .map((m) => m.round),
                  ),
                ]
                  .sort()
                  .map((round) => (
                    <div className="bracket-round" key={round}>
                      <h3>
                        {
                          state.matches.find(
                            (m) =>
                              m.tournamentId === t.id &&
                              m.stage !== "League" && m.stage !== PLAYOFF_STAGE &&
                              m.round === round,
                          )?.stage
                        }
                      </h3>
                      <div>
                        {state.matches
                          .filter(
                            (m) =>
                              m.tournamentId === t.id &&
                              m.stage !== "League" && m.stage !== PLAYOFF_STAGE &&
                              m.round === round,
                          )
                          .map((m) => (
                            <MatchCard key={m.id} m={m} compact />
                          ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>
        ))
      ) : (
        <Empty title="Every point will count">
          Standings and brackets appear here once you create a tournament.
        </Empty>
      )}
    </>
  );
}
function SettingsPage() {
  const {
    state,
    page,
    filter,
    modal,
    error,
    notice,
    connected,
    busy,
    now,
    display,
    displayHistory,
    admin,
    selected,
    live,
    upcoming,
    completed,
    categorySelect,
    team,
    tournament,
    open,
    act,
    setState,
    setPage,
    setFilter,
    setModal,
    setError,
    setNotice,
    setDisplayHistory,
  } = useContext(AppContext);
  const formRevision = useRef(state.revision);
  useEffect(() => {
    if (modal?.conflictRevision) formRevision.current = modal.conflictRevision;
  }, [modal?.conflictRevision]);
  useEffect(() => {
    if (error.includes("Another organizer"))
      formRevision.current = state.revision;
  }, [error, state.revision]);
  const [values, setValues] = useState(state.event),
    [network, setNetwork] = useState([]);
  useEffect(() => {
    fetch("/api/network")
      .then((r) => r.json())
      .then((d) => setNetwork(d.addresses || []));
  }, []);
  return (
    <div className="settings-grid">
      <form
        className="panel settings-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await act(
              "event",
              values,
              "Club details saved",
              formRevision.current,
            )
          )
            formRevision.current = state.revision + 1;
        }}
      >
        <h2>Club details</h2>
        <p>Set the defaults for your organizing team.</p>
        <Field label="Scoreboard title">
          <input
            required
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
          />
        </Field>
        <Field label="Venue">
          <input
            value={values.venue}
            onChange={(e) => setValues({ ...values, venue: e.target.value })}
          />
        </Field>
        <div className="form-row">
          <Field label="Number of courts">
            <input
              required
              type="number"
              min="1"
              max="32"
              value={values.courts}
              onChange={(e) =>
                setValues({ ...values, courts: +e.target.value })
              }
            />
          </Field>
        </div>
        <Field
          label="Venue announcement"
          hint="Appears along the bottom of the venue display."
        >
          <textarea
            maxLength="250"
            value={values.announcement}
            onChange={(e) =>
              setValues({ ...values, announcement: e.target.value })
            }
          />
        </Field>
        <button className="btn primary" disabled={busy}>
          Save club settings
          <Check size={16} />
        </button>
      </form>
      <div>
        <section className="panel settings-panel">
          <div className="settings-icon">
            <Wifi />
          </div>
          <h2>One Wi-Fi. Every screen.</h2>
          <p>
            Keep this host laptop running. Connect phones and the venue screen
            to the same local network, then open one of these addresses.
          </p>
          {network.map((url) => (
            <div className="network-address" key={url}>
              <span>Organizer</span>
              <a href={url} target="_blank" rel="noreferrer">
                {url}
              </a>
              <span>Venue display</span>
              <a href={`${url}/display`} target="_blank" rel="noreferrer">
                {url}/display
              </a>
            </div>
          ))}
          {!network.length && (
            <p>
              No network address found. Connect this laptop to Wi-Fi or
              Ethernet.
            </p>
          )}
          <small>
            Internet is not needed. Allow Node.js through the Windows firewall
            on your private network if devices cannot connect.
          </small>
        </section>
        <section className="panel settings-panel">
          <h2>Keep a copy</h2>
          <p>
            Tournament data is saved automatically on this laptop. Export an
            additional readable snapshot at any time.
          </p>
          <a className="btn" href="/api/export">
            <Download size={16} />
            Export event data
          </a>
        </section>
      </div>
    </div>
  );
}
function TournamentForm() {
  const {
    state,
    page,
    filter,
    modal,
    error,
    notice,
    connected,
    busy,
    now,
    display,
    displayHistory,
    admin,
    selected,
    live,
    upcoming,
    completed,
    categorySelect,
    team,
    tournament,
    open,
    act,
    setState,
    setPage,
    setFilter,
    setModal,
    setError,
    setNotice,
    setDisplayHistory,
  } = useContext(AppContext);
  const formRevision = useRef(state.revision);
  useEffect(() => {
    if (modal?.conflictRevision) formRevision.current = modal.conflictRevision;
  }, [modal?.conflictRevision]);
  const existing = modal.tournament;
  const [form, setForm] = useState(() => {
    const initial = existing || defaults;
    return { ...initial, scoring: initial.scoring || { league: scoringRules(initial), knockout: scoringRules(initial, "Final") } };
  }),
    [step, setStep] = useState(1);
  const change = (key, value) => setForm({ ...form, [key]: value });
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (step < 2) {
          setStep(2);
          return;
        }
        if (
          await act(
            "tournament",
            { ...form, tournamentId: existing?.id },
            "Tournament saved",
            formRevision.current,
          )
        ) {
          setModal(null);
          setPage("Tournaments");
        }
      }}
    >
      <div className="steps">
        <span className={step === 1 ? "active" : ""}>
          01 <b>Category</b>
        </span>
        <ChevronRight size={16} />
        <span className={step === 2 ? "active" : ""}>
          02 <b>Format & scoring</b>
        </span>
      </div>
      {step === 1 ? (
        <>
          <p className="form-intro">
            Start with the event you want to run. You can add teams and finalize
            fixtures later.
          </p>
          <div className="preset-grid">
            {presets.map(([name, size, mode]) => (
              <button
                key={name}
                type="button"
                className={form.name === name ? "selected" : ""}
                onClick={() =>
                  setForm({
                    ...form,
                    name: name === "Custom" ? "" : name,
                    size,
                    ...(mode ? playoffPreset(mode) : {}),
                  })
                }
              >
                {name}
              </button>
            ))}
          </div>
          <Field label="Tournament name">
            <input
              autoFocus
              required
              maxLength="120"
              placeholder="e.g. ShuttleHub 3v3"
              value={form.name}
              onChange={(e) => change("name", e.target.value)}
            />
          </Field>
          <Field label="Players per team">
            <input
              type="number"
              min="1"
              max="12"
              required
              value={form.size}
              onChange={(e) => change("size", +e.target.value)}
            />
          </Field>
        </>
      ) : (
        <>
          <p className="form-intro">
            Teams play everyone in their group once. Qualifiers advance to a
            single-elimination bracket.
          </p>
          <TournamentFormatFields form={form} setForm={setForm}/>
        </>
      )}
      <div className="modal-actions">
        {step === 2 ? (
          <button className="btn" type="button" onClick={() => setStep(1)}>
            <ChevronLeft size={16} />
            Back
          </button>
        ) : (
          <span />
        )}
        <button className="btn primary" disabled={busy}>
          {step === 1
            ? "Next: format & scoring"
            : existing
              ? "Save tournament"
              : "Create tournament"}
          <ArrowRight size={16} />
        </button>
      </div>
    </form>
  );
}
function TeamForm({ importing = false }) {
  const {
    state,
    page,
    filter,
    modal,
    error,
    notice,
    connected,
    busy,
    now,
    display,
    displayHistory,
    admin,
    selected,
    live,
    upcoming,
    completed,
    categorySelect,
    team,
    tournament,
    open,
    act,
    setState,
    setPage,
    setFilter,
    setModal,
    setError,
    setNotice,
    setDisplayHistory,
  } = useContext(AppContext);
  const formRevision = useRef(state.revision);
  useEffect(() => {
    if (modal?.conflictRevision) formRevision.current = modal.conflictRevision;
  }, [modal?.conflictRevision]);
  const unlocked = state.tournaments.filter(
    (t) => !state.matches.some((m) => m.tournamentId === t.id) ||
      (modal.team?.tournamentId === t.id && !tournamentProgress(state, t.id).champion),
  );
  const initial = modal.team;
  const [tid, setTid] = useState(
    initial?.tournamentId ||
      (unlocked.some((t) => t.id === filter) ? filter : unlocked[0]?.id) ||
      "",
  );
  const t = tournament(tid);
  const registrationLocked = state.matches.some(m => m.tournamentId === tid);
  const [players, setPlayers] = useState(initial?.players || []),
    [seed, setSeed] = useState(initial?.seed || ""),
    [rows, setRows] = useState(null),
    [fileName, setFileName] = useState(""),
    [fileBusy, setFileBusy] = useState(false);
  if (!unlocked.length)
    return (
      <Empty title="Create an editable tournament first">
        Team registration closes when fixtures are generated. You can reset
        fixtures if no matches have started.
      </Empty>
    );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const teams = importing
          ? rows
          : [
              {
                id: initial?.id,
                players,
                seed: seed ? +seed : undefined,
              },
            ];
        if (
          await act(
            "teams",
            { tournamentId: tid, teams },
            importing ? "Teams imported" : "Team saved",
            formRevision.current,
          )
        )
          setModal(null);
      }}
    >
      <Field label="Tournament">
        <select
          value={tid}
          disabled={!!initial}
          onChange={(e) => {
            setTid(e.target.value);
            setPlayers([]);
            setRows(null);
          }}
        >
          {unlocked.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>
      {importing ? (
        <>
          <div className="import-drop">
            <Upload size={28} />
            <h3>Bring your teams to the court</h3>
            <p>CSV or Excel (.xlsx), up to 5 MB. First worksheet is used.</p>
            <input
              aria-label="Team spreadsheet"
              type="file"
              accept=".csv,.xlsx"
              disabled={fileBusy}
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                setFileBusy(true);
                setError("");
                setRows(null);
                try {
                  const data = await importTeams(file);
                  setRows(data);
                  setFileName(file.name);
                } catch (err) {
                  setError(err.message);
                } finally {
                  setFileBusy(false);
                }
              }}
            />
          </div>
          <button
            type="button"
            className="text-btn"
            onClick={() =>
              download(
                "shuttlehub-team-template.csv",
                `${Array.from({ length: t?.size || 2 }, (_, i) => `player${i + 1}`).join(",")},seed\n${Array.from({ length: t?.size || 2 }, (_, i) => `Player ${i + 1}`).join(",")},1\n`,
              )
            }
          >
            <Download size={15} />
            Download CSV template
          </button>
          {rows && (
            <div className="import-preview">
              <strong>{rows.length} teams ready to review</strong>
              <small>{fileName}</small>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>TEAM</th>
                      <th>SEED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 12).map((r, i) => (
                      <tr key={i}>
                        <td>{r.name}</td>
                        <td>{r.seed || "Auto"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 12 && (
                <small>…and {rows.length - 12} more entries</small>
              )}
            </div>
          )}
          <p className="help-text">
            Headers: player1
            {t?.size > 1 ? `, player2${t.size > 2 ? ", …" : ""}` : ""}, seed
            (optional). Team labels are made from player names. Players and seeds must be unique within a category. All
            rows are validated before anything is saved.
          </p>
        </>
      ) : (
        <>
          <div className="auto-team-name"><span>Entry name (automatic)</span><strong>{playerLabel(players) || "Enter player names below"}</strong></div>
          {Array.from({ length: t?.size || 1 }, (_, i) => (
            <Field key={`${tid}-${i}`} label={`Player ${i + 1}`}>
              <input
                required
                value={players[i] || ""}
                onChange={(e) => {
                  const next = [...players];
                  next[i] = e.target.value;
                  setPlayers(next);
                }}
                placeholder="Full name"
              />
            </Field>
          ))}
          <Field
            label="Seed"
            hint={registrationLocked ? "Seeds are locked after fixtures are generated. Player names remain editable until the tournament ends." : "Leave blank to assign the next seed. Use consistent player names across categories to prevent court conflicts."}
          >
            <input
              type="number"
              min="1"
              max="10000"
              disabled={registrationLocked}
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="Automatic"
            />
          </Field>
        </>
      )}
      <div className="modal-actions">
        {initial && !registrationLocked ? (
          <button
            className="btn danger"
            type="button"
            onClick={() =>
              open({ type: "deleteTeam", team: initial, tournament: t })
            }
          >
            <Trash2 size={15} />
            Remove team
          </button>
        ) : (
          <span />
        )}
        <button
          className="btn primary"
          disabled={busy || fileBusy || (importing && !rows?.length)}
        >
          {importing ? "Import teams" : "Save team"}
          <Check size={16} />
        </button>
      </div>
    </form>
  );
}
function MatchForm() {
  const {state, modal} = useContext(AppContext);
  if (!state.matches.some(m => m.id === modal.matchId)) return <Empty title="This match was removed">Its tournament or fixtures were removed on another device.</Empty>;
  return <MatchEditor />;
}
function MatchEditor() {
  const {
    state,
    readyMatches,
    page,
    filter,
    modal,
    error,
    notice,
    connected,
    busy,
    now,
    display,
    displayHistory,
    admin,
    selected,
    live,
    upcoming,
    completed,
    categorySelect,
    team,
    tournament,
    open,
    act,
    setState,
    setPage,
    setFilter,
    setModal,
    setError,
    setNotice,
    setDisplayHistory,
  } = useContext(AppContext);
  const m = state.matches.find((m) => m.id === modal.matchId),
    t = tournament(m.tournamentId);
  const rules = scoringRules(t, m.stage);
  const [court, setCourt] = useState(
      Array.from({ length: state.event.courts }, (_, i) => i + 1).find(
        (c) => !state.matches.some((x) => x.status === "live" && x.court === c),
      ) || 1,
    ),
    [scheduled, setScheduled] = useState(m.scheduled || ""),
    [games, setGames] = useState(m.games.length ? m.games.map(game => game.map(String)) : [["", ""]]);
  const [confirmCorrection, setConfirmCorrection] = useState(false);
  const resultRevision = useRef(state.revision);
  useEffect(() => {
    if (modal?.conflictRevision) {
      resultRevision.current = modal.conflictRevision;
      setConfirmCorrection(false);
      if (m.status === "completed") setGames(m.games.map(game => game.map(String)));
    }
  }, [modal?.conflictRevision]);
  function updateGameScore(index, side, value) {
    setConfirmCorrection(false);
    setError("");
    setGames(current => current.map((game,i) => i === index ? game.map((score,j) => j === side ? value : score) : game));
  }
  return (
    <>
      <div className="match-dialog-meta">
        <Pill>{t.name}</Pill>
        <span>
          {m.stage}{groupName(m.group) ? ` · ${groupName(m.group)}` : ""} · {scoringLabel(rules)}
        </span>
      </div>
      <div className="scoreboard">
        {[m.a, m.b].map((tid, i) => (
          <div key={i}>
            <strong>{team(tid)?.name || pendingOpponent(m, i === 0 ? "a" : "b")}</strong>
            <small>{team(tid) ? `Seed ${team(tid).seed}` : "Winner of previous round"}</small>
          </div>
        ))}
      </div>
      {m.status === "upcoming" ? (
        <>
          <p className="help-text">{m.a && m.b ? "Choose a free court and start when both teams are ready." : "Both opponents must qualify before this game can start."}</p>
          <Field label="Court">
            <select value={court} onChange={(e) => setCourt(+e.target.value)}>
              {Array.from({ length: state.event.courts }, (_, i) => i + 1).map(
                (c) => (
                  <option
                    key={c}
                    value={c}
                    disabled={state.matches.some(
                      (x) => x.status === "live" && x.court === c,
                    )}
                  >
                    Court {c}
                    {state.matches.some(
                      (x) => x.status === "live" && x.court === c,
                    )
                      ? " · occupied"
                      : ""}
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field label="Optional scheduled start">
            <input
              type="time"
              value={scheduled}
              onChange={(e) => setScheduled(e.target.value)}
            />
          </Field>
          <div className="modal-actions">
            <button
              className="btn"
              disabled={busy}
              onClick={async () => {
                if (await act("schedule", { matchId: m.id, scheduled }))
                  setModal(null);
              }}
            >
              Save schedule
            </button>
            <button
              className="btn primary"
              disabled={busy || !m.a || !m.b || state.matches.some(x => x.status === "live" && x.court === court)}
              onClick={async () => {
                if (
                  await act("start", { matchId: m.id, court }, "Match started")
                )
                  setModal(null);
              }}
            >
              <Play size={16} />
              Start game
            </button>
          </div>
        </>
      ) : !m.bye && (m.status === "live" || m.status === "completed") ? (
        <>
          {m.status === "live" && <div className="return-match"><p>Players not ready and play has not begun?</p><button className="text-btn" disabled={busy} onClick={() => open({type:"returnMatch", matchId:m.id})}>Undo start and free court</button></div>}
          <h3>{m.status === "completed" ? "Edit final result" : "Record the final result"}</h3>
          <p className="help-text">
            Enter each completed game in opponent order above. Saving updates the result and standings.
          </p>
          {m.status === "completed" && <label className="help-text">
            <input type="checkbox" checked={confirmCorrection} onChange={e => setConfirmCorrection(e.target.checked)} />
            I confirm this correction. Standings and the draw will update. Later games whose opponents change will return to upcoming, clearing their scores and freeing any occupied courts. Unaffected results stay saved.
          </label>}
          <div className="game-inputs">
            {games.map((g, i) => (
              <div className="game-score-row" key={i}>
                <div className="game-score-heading">
                  <span>Game {i + 1}</span>
                  {i === games.length - 1 && i > 0 && <button type="button" className="icon-btn" disabled={busy} aria-label="Remove last game" onClick={() => setGames(games.slice(0,-1))}><X size={16}/></button>}
                </div>
                <div className="game-score-sides">
                  <ScoreInput label={`Game ${i + 1} first team`} value={g[0]} cap={rules.cap} disabled={busy} onChange={value => updateGameScore(i,0,value)}/>
                  <span className="score-separator">&ndash;</span>
                  <ScoreInput label={`Game ${i + 1} second team`} value={g[1]} cap={rules.cap} disabled={busy} onChange={value => updateGameScore(i,1,value)}/>
                </div>
              </div>
            ))}
          </div>
          <div className="modal-actions">
            <button
              className="btn"
              disabled={games.length >= rules.bestOf}
              onClick={() => setGames([...games, ["", ""]])}
            >
              <Plus size={15} />
              Add game
            </button>
            <button
              className="btn primary"
              disabled={busy || (m.status === "completed" && !confirmCorrection)}
              onClick={async () => {
                let completedGames;
                try { completedGames = finalScores(games); }
                catch (error) { setError(error.message); return; }
                if (
                  await act(
                    m.status === "completed" ? "correctResult" : "finish",
                    { matchId: m.id, games: completedGames },
                    m.status === "completed" ? "Result corrected; standings and draw updated" : "Result recorded",
                    resultRevision.current,
                  )
                ) {
                  const leagueComplete = m.status !== "completed" && m.stage === "League" && state.matches
                    .filter(x => x.tournamentId === t.id && x.stage === "League" && x.id !== m.id)
                    .every(x => x.status === "completed");
                  if (leagueComplete) {
                    setFilter(t.id);
                    setPage("Matches");
                    open({ type: "knockouts", tournament: t });
                  } else setModal(null);
                }
              }}
            >
              {m.status === "completed" ? "Save corrected result" : "Confirm final result"}
              <Check size={16} />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="final-result">
            <Trophy />
            <h2>{team(m.winner)?.name} {m.bye ? "advances by bye" : "wins"}</h2>
            <p>{m.games.map((g) => g.join(" – ")).join(" / ")}</p>
            <small>Completed {time(m.completedAt)}</small>
          </div>
        </>
      )}
    </>
  );
}
function ConfirmForm() {
  const {
    state,
    page,
    filter,
    modal,
    error,
    notice,
    connected,
    busy,
    now,
    display,
    displayHistory,
    admin,
    selected,
    live,
    upcoming,
    completed,
    categorySelect,
    team,
    tournament,
    open,
    act,
    setState,
    setPage,
    setFilter,
    setModal,
    setError,
    setNotice,
    setDisplayHistory,
  } = useContext(AppContext);
  const t = modal.tournament;
  const type = modal.type;
  const returning = state.matches.find(m => m.id === modal.matchId);
  const descriptions = {
    randomComplete: `TESTING ONLY: Complete every unfinished fixture in ${t ? t.name : "all tournaments"} with random scores? This includes on-court games and later rounds waiting for winners, across all stages and search/status filters. Existing completed results stay saved. Courts are freed and standings and brackets update. New stages are not created automatically.`,
    returnMatch: `Return ${team(returning?.a)?.name || "this match"} vs ${team(returning?.b)?.name || "opponent"} to waiting? Use this only if play has not begun. The court will be freed and this game will return to the upcoming list.`,
    generate: `Create round-robin fixtures for ${t?.name}? Teams will be distributed into ${t?.groups} balanced groups using a snake draft by seed. Team registration will close for this category.`,
    knockouts: isPlayoffFormat(t) ? `Create qualification playoffs and the knockout bracket for ${t.name}? Top ${directPlaces(t)} per group advance directly; playoff winners earn the remaining slots. Playoffs: ${scoringLabel(scoringRules(t, PLAYOFF_STAGE))}. Main knockout: ${scoringLabel(scoringRules(t, "Final"))}. Review final league standings before confirming. League ranks will not change after playoffs.` : `Advance the top ${t?.qualify} teams from every group to the knockout bracket? Rankings use wins, game difference, point difference, then original seed. Review standings before confirming.`,
    resetFixtures:
      "Remove the unplayed fixtures for this category and reopen team registration? Your teams will be kept.",
    deleteTeam: `Remove ${modal.team?.name} from this category?`,
    deleteTournament: `Delete "${t?.name}"? This permanently removes ${state.teams.filter(x => x.tournamentId === t?.id).length} teams, ${state.matches.filter(m => m.tournamentId === t?.id).length} fixtures, and ${state.matches.filter(m => m.tournamentId === t?.id && m.status === "completed").length} completed results. This cannot be undone. Other tournaments are kept.`,
    clearDemo:
      "Clear the entire sample event, including any edits you made to it, and start with an empty tournament desk?",
  };
  return (
    <>
      <p className="form-intro">{descriptions[type]}</p>
      {type === "knockouts" && <div className="qualification-review" aria-label="League qualification review">
        {Array.from({ length: t.groups }, (_, group) => <section key={group}>
          <h3>{groupName(group)}</h3>
          <ol>{standings(state, t.id, group).map((row, rank) => <li key={row.id}>
            <strong>{row.name}</strong><span>{rank < directPlaces(t) ? "Direct qualifier" : isPlayoffFormat(t) ? "Qualification playoff" : "Eliminated"}</span>
          </li>)}</ol>
        </section>)}
      </div>}
      <div className="modal-actions">
        <button className="btn" onClick={() => setModal(null)}>
          Cancel
        </button>
        <button
          className={`btn ${type === "deleteTournament" ? "danger" : "primary"}`}
          disabled={busy}
          onClick={async () => {
            if (
              await act(
                type,
                { tournamentId: t?.id, teamId: modal.team?.id, matchId:modal.matchId },
                type === "randomComplete" ? "Unfinished matches completed with random test scores" : type === "returnMatch" ? "Court freed; game returned to upcoming" : type === "deleteTournament" ? "Tournament deleted" : "Tournament updated",
              )
            ) {
              setModal(null);
              if (type === "knockouts" || type === "generate") {
                setFilter(t.id);
                setPage("Matches");
              }
              if (type === "clearDemo") {
                setFilter("all");
                setPage("Overview");
              }
            }
          }}
        >
          {type === "randomComplete" ? "Complete with random scores" : type === "deleteTournament" ? "Delete tournament" : type === "knockouts" ? isPlayoffFormat(t) ? "Create playoffs + bracket" : "Create knockouts" : "Confirm"}
          <Check size={16} />
        </button>
      </div>
    </>
  );
}
function VenueDisplay() {
  const { state, readyMatches, connected } = useContext(AppContext);
  return <VenueBoard state={state} upcoming={readyMatches} connected={connected}/>;
}
function MapPinIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
export default App;
