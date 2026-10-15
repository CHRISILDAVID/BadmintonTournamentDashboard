import React, {
  useContext,
  createContext,
  useEffect,
  useRef,
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
  LogOut,
  Radio,
  Maximize,
  ChevronLeft,
  Activity,
  SlidersHorizontal,
  Wifi,
  ShieldCheck,
  Pencil,
  Trash2,
} from "lucide-react";
import { standings, groupName, time, importTeams, download } from "./utils.js";

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
      <div className="brand-mark">
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <path
            d="M8 30c6-9 15-5 21-13M10 34c11-7 20-6 23-17M13 21C4 22 10 12 24 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="m21 7 13-3 3 11-12-2z" fill="currentColor" />
          <path d="m25 6 3 7m2-8 2 9" stroke="#173f36" strokeWidth="1.5" />
        </svg>
      </div>
      <span>
        Shuttle<span className="brand-green">Hub</span>
        <small>TOURNAMENT DESK</small>
      </span>
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
    [session, setSession] = useState(null),
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
    fetch("/api/session")
      .then((r) => r.json())
      .then(setSession)
      .catch(() => setError("Cannot connect to the host."));
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
        if (r.status === 401)
          setSession((s) => ({ ...s, authenticated: false }));
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
  const admin = session?.authenticated && !display;
  const selected =
    state?.matches.filter(
      (m) => filter === "all" || m.tournamentId === filter,
    ) || [];
  const live = selected.filter((m) => m.status === "live");
  const upcoming = selected
    .filter((m) => m.status === "upcoming")
    .sort((a, b) => (a.scheduled || "z").localeCompare(b.scheduled || "z"));
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
  if (!state || !session)
    return (
      <div className="loading">
        <Logo />
        <p>{error || "Connecting to tournament desk…"}</p>
        {error && <button onClick={() => location.reload()}>Reconnect</button>}
      </div>
    );

  const titles = {
    Overview: "Tournament overview",
    Tournaments: "Your tournaments",
    "Teams & players": "Teams & players",
    Matches: "Match centre",
    History: "Match history",
    Standings: "Standings & brackets",
    Settings: "Event settings",
  };
  const subtitles = {
    Overview: "A little less organizing. A lot more badminton.",
    Tournaments: "Every category. One well-run event.",
    "Teams & players": "The people who make every rally count.",
    Matches: "From the first serve to match point.",
    History: "Every match, every result, all in one place.",
    Standings: "Follow the road from group stage to the final.",
    Settings: "Set the stage for a great tournament.",
  };
  const contextValue = {
    state,
    session,
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
    setSession,
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
              <small>{state.demo ? "Sample event" : "Local tournament"}</small>
            </div>
          </div>
          <span className="nav-label">WORKSPACE</span>
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
              <strong>Bring it to the big screen.</strong>
              <p>
                Every score. Every court.
                <br />
                Live at your venue.
              </p>
              <span>
                Launch venue display
                <ArrowRight size={15} />
              </span>
            </a>
            {admin && (
              <button
                className={`settings-nav ${page === "Settings" ? "active" : ""}`}
                onClick={() => setPage("Settings")}
              >
                <Settings size={18} />
                Event settings
              </button>
            )}
            <div className="sidebar-user">
              <div className="user-avatar">SH</div>
              <div>
                <strong>{admin ? "Organizer" : "Spectator"}</strong>
                <small>ShuttleHub team</small>
              </div>
              {admin ? (
                <button
                  className="icon-btn"
                  aria-label="Sign out"
                  onClick={async () => {
                    await fetch("/api/logout", { method: "POST" });
                    setSession({ ...session, authenticated: false });
                    setPage("Overview");
                  }}
                >
                  <LogOut size={17} />
                </button>
              ) : (
                <button
                  className="text-btn"
                  onClick={() => open({ type: "login" })}
                >
                  Sign in
                </button>
              )}
            </div>
          </div>
        </aside>
        <main>
          <header className="topbar">
            <div className="breadcrumb">
              Workspace
              <ChevronRight size={14} />
              <strong>{page}</strong>
            </div>
            <div>
              <span className={`connection ${connected ? "" : "disconnected"}`}>
                <i className="dot" />
                {connected ? "Connected locally" : "Reconnecting…"}
              </span>
              <span className="topbar-date">
                {now.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <div className="user-avatar small">SH</div>
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
                    ? "YOUR TOURNAMENT, AT A GLANCE"
                    : "SHUTTLEHUB TOURNAMENT DESK"}
                </div>
                <h1>{titles[page]}</h1>
                <p>{subtitles[page]}</p>
              </div>
              <div className="heading-actions">
                {admin && (
                  <button
                    className="btn settings-mobile"
                    aria-label="Event settings"
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
                {admin ? (
                  <button
                    className="btn primary"
                    onClick={() => open({ type: "tournament" })}
                  >
                    <Plus size={17} />
                    New tournament
                  </button>
                ) : (
                  <button
                    className="btn primary"
                    onClick={() => open({ type: "login" })}
                  >
                    {session.needsSetup
                      ? "Set up your event"
                      : "Organizer sign in"}
                    <ArrowRight size={16} />
                  </button>
                )}
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
              <span>MADE FOR THE GAME. BUILT FOR YOUR COMMUNITY.</span>
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
                login: session.needsSetup
                  ? "Welcome to ShuttleHub"
                  : "Organizer sign in",
                generate: "Ready to create fixtures?",
                knockouts: "Create the knockout bracket",
                resetFixtures: "Reset fixtures",
                deleteTeam: "Remove team",
                clearDemo: "Start your own event",
              }[modal.type]
            }
            wide={["tournament", "import"].includes(modal.type)}
            close={() => {
              setModal(null);
              setError("");
            }}
          >
            {modal.type === "login" ? (
              <LoginForm />
            ) : !admin ? (
              <p>Please sign in to continue.</p>
            ) : modal.type === "tournament" ? (
              <TournamentForm />
            ) : modal.type === "team" || modal.type === "import" ? (
              <TeamForm importing={modal.type === "import"} />
            ) : modal.type === "match" ? (
              <MatchForm />
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
    session,
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
    setSession,
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
        <span>{t?.name}</span>
        <Pill tone={m.status === "live" ? "green" : ""}>
          {m.status === "live" ? (
            <>
              <i className="dot" />
              LIVE
            </>
          ) : m.status === "completed" ? (
            "FINAL SCORE"
          ) : (
            m.stage
          )}
        </Pill>
      </div>
      <div className="match-sub">
        {groupName(m.group) || m.stage}
        {m.court ? ` · Court ${m.court}` : ""}
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
              <strong>{t?.name || "Awaiting qualifier"}</strong>
              {!compact && (
                <small>
                  {t?.players.join(" / ") || "Winner of previous round"}
                </small>
              )}
            </div>
            {m.status === "live" && <b className="live-score">{m.live[i]}</b>}
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
                : "Ready when called"}
        </span>
        {admin && (
          <button
            className="text-btn"
            onClick={() => open({ type: "match", matchId: m.id })}
          >
            {m.status === "live"
              ? "Update score"
              : m.status === "completed"
                ? "View result"
                : "Manage match"}
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
    session,
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
    setSession,
    setPage,
    setFilter,
    setModal,
    setError,
    setNotice,
    setDisplayHistory,
  } = useContext(AppContext);
  return matches.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>MATCH / TOURNAMENT</th>
            <th>STAGE</th>
            <th>{history ? "RESULT" : "SCHEDULE"}</th>
            <th>STATUS</th>
            {admin && <th />}
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => (
            <tr key={m.id}>
              <td>
                <strong>
                  {team(m.a)?.name || "Awaiting qualifier"}{" "}
                  <span className="versus">vs</span>{" "}
                  {team(m.b)?.name || "Awaiting qualifier"}
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
                    <small>{team(m.winner)?.name} won</small>
                  </>
                ) : (
                  <>
                    <span>
                      {m.scheduled ? time(m.scheduled) : "Unscheduled"}
                    </span>
                    <small>
                      {m.court ? `Court ${m.court}` : "Court assigned at start"}
                    </small>
                  </>
                )}
              </td>
              <td>
                <Pill tone={m.status === "live" ? "green" : ""}>
                  {m.status === "upcoming"
                    ? "Upcoming"
                    : m.status === "completed"
                      ? "Completed"
                      : "Live"}
                </Pill>
              </td>
              {admin && (
                <td>
                  <button
                    className="icon-btn"
                    aria-label={`Manage ${team(m.a)?.name || "match"}`}
                    onClick={() => open({ type: "match", matchId: m.id })}
                  >
                    <ArrowUpRight size={18} />
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
    session,
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
    setSession,
    setPage,
    setFilter,
    setModal,
    setError,
    setNotice,
    setDisplayHistory,
  } = useContext(AppContext);
  return (
    <>
      <div className="hero">
        <div className="hero-content">
          <span className="eyebrow">
            <span className="line" /> EVERY RALLY. ONE PLACE.
          </span>
          <h2>
            Let the games begin<span>.</span>
          </h2>
          <p>
            Your courts, your competitors, your tournament.
            <br />
            Keep every rally running smoothly.
          </p>
          <div className="hero-bottom">
            <span>
              <MapPinIcon />
              {state.event.venue || "Venue not set"}
            </span>
            <span>
              <CalendarDays size={15} />
              {state.event.date
                ? new Date(`${state.event.date}T00:00`).toLocaleDateString(
                    "en-IN",
                    { day: "numeric", month: "short", year: "numeric" },
                  )
                : "Event date not set"}
            </span>
          </div>
        </div>
        <div className="court-art" aria-hidden="true">
          <div className="court-lines">
            <i />
            <i />
            <i />
          </div>
          <div className="shuttle">
            <svg viewBox="0 0 100 120">
              <path d="M24 12 76 12 64 78 37 78z" fill="#d9f3d2" />
              <path
                d="M24 12 45 78M37 12 48 78M50 12v66M63 12 53 78M76 12 56 78M30 34h40M34 54h32"
                stroke="#538c72"
                strokeWidth="2"
              />
              <path d="M37 79h27v10a13.5 13.5 0 0 1-27 0z" fill="#fff" />
              <path d="M37 79h27" stroke="#c7e783" strokeWidth="6" />
            </svg>
          </div>
          <span className="court-tag">BUILT FOR THE LOVE OF THE GAME</span>
        </div>
      </div>
      <div className="stats-grid">
        {[
          [Trophy, "Tournaments", state.tournaments.length, "Running your way"],
          [
            Users,
            "Registered teams",
            state.teams.length,
            `${state.teams.reduce((n, t) => n + t.players.length, 0)} player entries`,
          ],
          [
            Activity,
            "Live matches",
            state.matches.filter((m) => m.status === "live").length,
            `${state.event.courts} courts available`,
          ],
          [
            CheckCircle2,
            "Completed",
            state.matches.filter((m) => m.status === "completed").length,
            `${state.matches.length} total fixtures`,
          ],
        ].map(([Icon, label, value, sub]) => (
          <div className="stat" key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <Icon size={18} />
            </div>
            <strong>{String(value).padStart(2, "0")}</strong>
            <small>{sub}</small>
          </div>
        ))}
      </div>
      <div className="section-heading">
        <h2>
          <i className="dot" /> On court{" "}
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
        <div className="quiet-courts">
          <div className="court-mini">
            <span />
          </div>
          <div>
            <strong>The courts are ready.</strong>
            <p>
              {state.matches.length
                ? "Start an upcoming match to bring the scoreboard to life."
                : "Set up your first tournament, add your teams, and let’s play."}
            </p>
          </div>
          {admin && (
            <button
              className="btn primary"
              onClick={() =>
                state.matches.length
                  ? setPage("Matches")
                  : open({ type: "tournament" })
              }
            >
              {state.matches.length ? "Go to matches" : "Set up tournament"}
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      )}
      <div className="overview-bottom">
        <section className="panel upcoming-panel">
          <div className="panel-heading">
            <h2>
              Up next <span className="count">{upcoming.length}</span>
            </h2>
            <button className="text-btn" onClick={() => setPage("Matches")}>
              All matches <ArrowRight size={15} />
            </button>
          </div>
          <MatchTable matches={upcoming.slice(0, 4)} />
        </section>
        <section className="panel recent-panel">
          <div className="panel-heading">
            <h2>Recent results</h2>
            <button
              className="text-btn"
              onClick={() => {
                setPage("History");
              }}
            >
              History <ArrowUpRight size={15} />
            </button>
          </div>
          {completed.length ? (
            completed.slice(0, 3).map((m) => (
              <div className="recent-result" key={m.id}>
                <div className="recent-meta">
                  {tournament(m.tournamentId)?.name}
                  <span>{time(m.completedAt)}</span>
                </div>
                <strong>
                  <Trophy size={14} />
                  {team(m.winner)?.name}
                </strong>
                <div className="result-bottom">
                  <span>vs {team(m.winner === m.a ? m.b : m.a)?.name}</span>
                  <b>{m.games.map((g) => g.join("–")).join(" · ")}</b>
                </div>
              </div>
            ))
          ) : (
            <Empty title="The first win is waiting">
              The three latest results will appear here.
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
    session,
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
    setSession,
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
                        ? "In progress"
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
                  {done} of {matches.length} matches completed · Best of{" "}
                  {t.bestOf}, {t.points} points
                </small>
                {champ && (
                  <p className="champion">
                    <Trophy size={16} />
                    {team(champ.winner)?.name} wins!
                  </p>
                )}
                <div className="tournament-actions">
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
                        Knockouts
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
    session,
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
    setSession,
    setPage,
    setFilter,
    setModal,
    setError,
    setNotice,
    setDisplayHistory,
  } = useContext(AppContext);
  const [query, setQuery] = useState("");
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
                    <small>{t.players.join(" / ")}</small>
                  </td>
                  <td>{tournament(t.tournamentId)?.name}</td>
                  <td>{groupName(t.group) || "Not assigned"}</td>
                  {admin && (
                    <td>
                      <button
                        className="icon-btn"
                        aria-label={`Edit ${t.name}`}
                        disabled={state.matches.some(
                          (m) => m.tournamentId === t.tournamentId,
                        )}
                        onClick={() => open({ type: "team", team: t })}
                      >
                        <Pencil size={16} />
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
function Matches({ history = false }) {
  const {
    state,
    session,
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
    setSession,
    setPage,
    setFilter,
    setModal,
    setError,
    setNotice,
    setDisplayHistory,
  } = useContext(AppContext);
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const matches = (history ? completed : selected).filter(
    (m) =>
      (status === "all" || m.status === status) &&
      `${team(m.a)?.name} ${team(m.b)?.name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <section className="panel">
      <div className="toolbar">
        <div className="search">
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
            <option value="live">Live</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
          </select>
        )}
        <button
          className="btn"
          onClick={() => setPage(history ? "Matches" : "History")}
        >
          {history ? "All matches" : "Match history"}
          <ArrowUpRight size={15} />
        </button>
      </div>
      <MatchTable matches={matches} history={history} />
    </section>
  );
}
function Standings() {
  const {
    state,
    session,
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
    setSession,
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
      {ts.length ? (
        ts.map((t) => (
          <section key={t.id} className="standing-section">
            <div className="section-heading">
              <h2>{t.name}</h2>
              <Pill>{t.qualify} qualify per group</Pill>
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
                                className={i < t.qualify ? "qualified" : ""}
                              >
                                <td>{i + 1}</td>
                                <td>
                                  <strong>{r.name}</strong>
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
              <i className="dot" /> Shaded places qualify once the league is
              complete. Seed breaks any remaining tie.
            </p>
            {state.matches.some(
              (m) => m.tournamentId === t.id && m.stage !== "League",
            ) && (
              <div className="bracket">
                {[
                  ...new Set(
                    state.matches
                      .filter(
                        (m) => m.tournamentId === t.id && m.stage !== "League",
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
                              m.stage !== "League" &&
                              m.round === round,
                          )?.stage
                        }
                      </h3>
                      <div>
                        {state.matches
                          .filter(
                            (m) =>
                              m.tournamentId === t.id &&
                              m.stage !== "League" &&
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
    session,
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
    setSession,
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
              "Event details saved",
              formRevision.current,
            )
          )
            formRevision.current = state.revision + 1;
        }}
      >
        <h2>Event details</h2>
        <p>Make it your tournament.</p>
        <Field label="Event name">
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
          <Field label="Event date">
            <input
              type="date"
              value={values.date}
              onChange={(e) => setValues({ ...values, date: e.target.value })}
            />
          </Field>
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
          Save event details
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
              <span>Venue display · no sign-in needed</span>
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
    session,
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
    setSession,
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
  const [form, setForm] = useState(existing || defaults),
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
            {presets.map(([name, size]) => (
              <button
                key={name}
                type="button"
                className={form.name === name ? "selected" : ""}
                onClick={() =>
                  setForm({
                    ...form,
                    name: name === "Custom" ? "" : name,
                    size,
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
          <div className="form-row">
            <Field label="Number of groups">
              <select
                value={form.groups}
                onChange={(e) => change("groups", +e.target.value)}
              >
                {[1, 2, 4, 8].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </Field>
            <Field label="Qualifiers per group">
              <select
                value={form.qualify}
                onChange={(e) => change("qualify", +e.target.value)}
              >
                {[1, 2, 4, 8, 16].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="format-preview">
            <GitBranch size={20} />
            <div>
              <strong>{form.groups * form.qualify} knockout places</strong>
              <span>
                {[2, 4, 8, 16].includes(form.groups * form.qualify)
                  ? `${form.groups} groups → ${form.groups * form.qualify === 8 ? "Quarterfinals → Semifinals → Final" : form.groups * form.qualify === 4 ? "Semifinals → Final" : form.groups * form.qualify === 2 ? "Final" : "Round of 16 → Quarterfinals → Semifinals → Final"}`
                  : "Choose a combination with 2, 4, 8 or 16 qualifiers."}
              </span>
            </div>
          </div>
          <div className="form-row three">
            <Field label="Best of">
              <select
                value={form.bestOf}
                onChange={(e) => change("bestOf", +e.target.value)}
              >
                {[1, 3, 5].map((n) => (
                  <option value={n} key={n}>
                    {n} game{n > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Points per game">
              <input
                type="number"
                min="5"
                max="50"
                required
                value={form.points}
                onChange={(e) => change("points", +e.target.value)}
              />
            </Field>
            <Field label="Score cap">
              <input
                type="number"
                min={form.points + 1}
                max="60"
                required
                value={form.cap}
                onChange={(e) => change("cap", +e.target.value)}
              />
            </Field>
          </div>
          <p className="help-text">
            Win by two, up to the score cap. Standings use wins, game
            difference, point difference, then seed. Formats stay editable until
            fixtures are generated.
          </p>
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
    session,
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
    setSession,
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
    (t) => !state.matches.some((m) => m.tournamentId === t.id),
  );
  const initial = modal.team;
  const [tid, setTid] = useState(
    initial?.tournamentId ||
      (unlocked.some((t) => t.id === filter) ? filter : unlocked[0]?.id) ||
      "",
  );
  const t = tournament(tid);
  const [name, setName] = useState(initial?.name || ""),
    [players, setPlayers] = useState(initial?.players || []),
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
                name,
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
                `team,${Array.from({ length: t?.size || 2 }, (_, i) => `player${i + 1}`).join(",")},seed\nExample Team,${Array.from({ length: t?.size || 2 }, (_, i) => `Player ${i + 1}`).join(",")},1\n`,
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
                      <th>PLAYERS</th>
                      <th>SEED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 12).map((r, i) => (
                      <tr key={i}>
                        <td>{r.name}</td>
                        <td>{r.players.join(" / ")}</td>
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
            Headers: team, player1
            {t?.size > 1 ? `, player2${t.size > 2 ? ", …" : ""}` : ""}, seed
            (optional). Names and seeds must be unique within a category. All
            rows are validated before anything is saved.
          </p>
        </>
      ) : (
        <>
          <Field label={t?.size === 1 ? "Entry name" : "Team name"}>
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                t?.size === 1 ? "Player or entry name" : "e.g. Smash Brothers"
              }
            />
          </Field>
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
            hint="Leave blank to assign the next seed. Use consistent player names across categories to prevent court conflicts."
          >
            <input
              type="number"
              min="1"
              max="10000"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="Automatic"
            />
          </Field>
        </>
      )}
      <div className="modal-actions">
        {initial ? (
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
  const {
    state,
    session,
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
    setSession,
    setPage,
    setFilter,
    setModal,
    setError,
    setNotice,
    setDisplayHistory,
  } = useContext(AppContext);
  const m = state.matches.find((m) => m.id === modal.matchId),
    t = tournament(m.tournamentId);
  const [court, setCourt] = useState(
      Array.from({ length: state.event.courts }, (_, i) => i + 1).find(
        (c) => !state.matches.some((x) => x.status === "live" && x.court === c),
      ) || 1,
    ),
    [scheduled, setScheduled] = useState(m.scheduled || ""),
    [score, setScore] = useState(m.live),
    [games, setGames] = useState(m.games.length ? m.games : [[0, 0]]);
  useEffect(() => setScore(m.live), [m.live[0], m.live[1]]);
  return (
    <>
      <div className="match-dialog-meta">
        <Pill>{t.name}</Pill>
        <span>
          {groupName(m.group) || m.stage} · Best of {t.bestOf} · {t.points}{" "}
          points
        </span>
      </div>
      <div className="scoreboard">
        {[m.a, m.b].map((tid, i) => (
          <div key={i}>
            <strong>{team(tid)?.name || "Awaiting qualifier"}</strong>
            <small>{team(tid)?.players.join(" / ")}</small>
            {m.status === "live" && (
              <div className="score-controls">
                <button
                  className="btn"
                  disabled={score[i] === 0}
                  onClick={() =>
                    setScore(
                      score.map((v, j) => (j === i ? Math.max(0, v - 1) : v)),
                    )
                  }
                >
                  −
                </button>
                <input
                  aria-label={`${team(tid)?.name} live score`}
                  type="number"
                  min="0"
                  max={t.cap}
                  value={score[i]}
                  onChange={(e) =>
                    setScore(
                      score.map((v, j) => (j === i ? +e.target.value : v)),
                    )
                  }
                />
                <button
                  className="btn"
                  disabled={score[i] >= t.cap}
                  onClick={() =>
                    setScore(
                      score.map((v, j) =>
                        j === i ? Math.min(t.cap, v + 1) : v,
                      ),
                    )
                  }
                >
                  +
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {m.status === "upcoming" ? (
        <>
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
              type="datetime-local"
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
              disabled={busy || !m.a || !m.b}
              onClick={async () => {
                if (
                  await act("start", { matchId: m.id, court }, "Match is live")
                )
                  setModal(null);
              }}
            >
              <Play size={16} />
              Start match
            </button>
          </div>
        </>
      ) : m.status === "live" ? (
        <>
          <button
            className="btn primary full"
            disabled={busy}
            onClick={() =>
              act(
                "score",
                { matchId: m.id, live: score },
                "Live score published",
              )
            }
          >
            Publish current-game score
            <Radio size={16} />
          </button>
          <div className="divider" />
          <h3>Record the final result</h3>
          <p className="help-text">
            Enter each completed game in opponent order above. This finishes the
            match and updates standings.
          </p>
          <div className="game-inputs">
            {games.map((g, i) => (
              <div key={i}>
                <span>Game {i + 1}</span>
                <input
                  aria-label={`Game ${i + 1} first team`}
                  type="number"
                  min="0"
                  max={t.cap}
                  value={g[0]}
                  onChange={(e) =>
                    setGames(
                      games.map((s, j) =>
                        j === i ? [+e.target.value, s[1]] : s,
                      ),
                    )
                  }
                />
                <span>–</span>
                <input
                  aria-label={`Game ${i + 1} second team`}
                  type="number"
                  min="0"
                  max={t.cap}
                  value={g[1]}
                  onChange={(e) =>
                    setGames(
                      games.map((s, j) =>
                        j === i ? [s[0], +e.target.value] : s,
                      ),
                    )
                  }
                />
                {i === games.length - 1 && i > 0 && (
                  <button
                    className="icon-btn"
                    aria-label="Remove last game"
                    onClick={() => setGames(games.slice(0, -1))}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="modal-actions">
            <button
              className="btn"
              disabled={games.length >= t.bestOf}
              onClick={() => setGames([...games, [0, 0]])}
            >
              <Plus size={15} />
              Add game
            </button>
            <button
              className="btn primary"
              disabled={busy}
              onClick={async () => {
                if (
                  await act(
                    "finish",
                    { matchId: m.id, games },
                    "Result recorded",
                  )
                )
                  setModal(null);
              }}
            >
              Confirm final result
              <Check size={16} />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="final-result">
            <Trophy />
            <h2>{team(m.winner)?.name} wins</h2>
            <p>{m.games.map((g) => g.join(" – ")).join(" / ")}</p>
            <small>
              Completed {new Date(m.completedAt).toLocaleString("en-IN")}
            </small>
          </div>
        </>
      )}
    </>
  );
}
function LoginForm() {
  const {
    state,
    session,
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
    setSession,
    setPage,
    setFilter,
    setModal,
    setError,
    setNotice,
    setDisplayHistory,
  } = useContext(AppContext);
  const [password, setPassword] = useState(""),
    [loading, setLoading] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
          const r = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
          });
          const data = await r.json();
          if (!r.ok) throw new Error(data.error);
          setSession({ ...session, needsSetup: false, authenticated: true });
          setModal(null);
          setNotice("Welcome to your tournament desk");
        } catch (e) {
          setError(e.message);
        } finally {
          setLoading(false);
        }
      }}
    >
      <div className="login-intro">
        <ShieldCheck size={32} />
        <p>
          {session.needsSetup
            ? "Create an organizer password to manage your event. Share it with your scoring team on the same Wi-Fi."
            : "Enter your organizer password to manage teams, fixtures, and scores."}
        </p>
      </div>
      {session.needsSetup && !session.canSetup ? (
        <p className="error">
          Open http://localhost:3000 on the host laptop to create the password
          first.
        </p>
      ) : (
        <>
          <Field
            label={
              session.needsSetup
                ? "Create organizer password"
                : "Organizer password"
            }
          >
            <input
              autoFocus
              type="password"
              required
              minLength={session.needsSetup ? 8 : 1}
              maxLength="200"
              autoComplete={
                session.needsSetup ? "new-password" : "current-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <button className="btn primary full" disabled={loading}>
            {session.needsSetup ? "Create password & get started" : "Sign in"}
            <ArrowRight size={16} />
          </button>
        </>
      )}
    </form>
  );
}
function ConfirmForm() {
  const {
    state,
    session,
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
    setSession,
    setPage,
    setFilter,
    setModal,
    setError,
    setNotice,
    setDisplayHistory,
  } = useContext(AppContext);
  const t = modal.tournament;
  const type = modal.type;
  const descriptions = {
    generate: `Create round-robin fixtures for ${t?.name}? Teams will be distributed into ${t?.groups} balanced groups using a snake draft by seed. Team registration will close for this category.`,
    knockouts: `Advance the top ${t?.qualify} teams from every group to the knockout bracket? Rankings use wins, game difference, point difference, then original seed. Review standings before confirming.`,
    resetFixtures:
      "Remove the unplayed fixtures for this category and reopen team registration? Your teams will be kept.",
    deleteTeam: `Remove ${modal.team?.name} from this category?`,
    clearDemo:
      "Clear the entire sample event, including any edits you made to it, and start with an empty tournament desk?",
  };
  return (
    <>
      <p className="form-intro">{descriptions[type]}</p>
      <div className="modal-actions">
        <button className="btn" onClick={() => setModal(null)}>
          Cancel
        </button>
        <button
          className="btn primary"
          disabled={busy}
          onClick={async () => {
            if (
              await act(
                type,
                { tournamentId: t?.id, teamId: modal.team?.id },
                "Tournament updated",
              )
            ) {
              setModal(null);
              if (type === "clearDemo") {
                setFilter("all");
                setPage("Overview");
              }
            }
          }}
        >
          Confirm
          <Check size={16} />
        </button>
      </div>
    </>
  );
}
function VenueDisplay() {
  const {
    state,
    session,
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
    setSession,
    setPage,
    setFilter,
    setModal,
    setError,
    setNotice,
    setDisplayHistory,
  } = useContext(AppContext);
  const courtPages = Math.max(1, Math.ceil(live.length / 3));
  const courtPage = Math.floor(now.getTime() / 12000) % courtPages;
  const visibleLive = live.slice(courtPage * 3, courtPage * 3 + 3);
  return (
    <div className="venue">
      <header>
        <Logo />
        <div className="venue-title">
          <span>LIVE FROM THE COURTS</span>
          <h1>{state.event.name}</h1>
        </div>
        <div className="venue-clock">
          <strong>
            {now.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </strong>
          <span>
            <i className={`dot ${connected ? "" : "offline"}`} />
            {connected ? "Live updates" : "Reconnecting — scores may be stale"}
          </span>
        </div>
      </header>
      {state.demo && (
        <div className="demo-strip">SAMPLE EVENT · Demonstration data</div>
      )}
      <div className="venue-toolbar">
        {categorySelect}
        <div>
          <button
            className="btn"
            onClick={() => setDisplayHistory(!displayHistory)}
          >
            {displayHistory ? "Back to live board" : "All match history"}
          </button>
          <button
            className="icon-btn"
            aria-label="Toggle fullscreen"
            onClick={() => {
              (document.fullscreenElement
                ? document.exitFullscreen()
                : document.documentElement.requestFullscreen()
              ).catch(() =>
                setError("Fullscreen is unavailable in this browser."),
              );
            }}
          >
            <Maximize size={19} />
          </button>
          <a className="icon-btn" href="/" aria-label="Open tournament desk">
            <LayoutDashboard size={19} />
          </a>
        </div>
      </div>
      {displayHistory ? (
        <section className="panel">
          <div className="panel-heading">
            <h2>Match history</h2>
          </div>
          <MatchTable matches={completed} history />
        </section>
      ) : (
        <>
          <div className="section-heading">
            <h2>
              <i className="dot" /> On court now
            </h2>
            <span>
              {live.length} matches in play
              {courtPages > 1
                ? ` ? Court page ${courtPage + 1} of ${courtPages} ? Rotates every 12s`
                : null}
            </span>
          </div>
          <div className="venue-live">
            {live.length ? (
              visibleLive.map((m) => <MatchCard key={m.id} m={m} />)
            ) : (
              <Empty title="Ready for the next rally">
                Live matches will appear here when play begins.
              </Empty>
            )}
          </div>
          <div className="venue-bottom">
            <section>
              <div className="section-heading">
                <h2>Up next</h2>
                <span>Players, please be ready</span>
              </div>
              {upcoming.length ? (
                <div className="venue-upcoming">
                  {upcoming.slice(0, 4).map((m, i) => (
                    <div key={m.id}>
                      <b className="queue-number">
                        {String(i + 1).padStart(2, "0")}
                      </b>
                      <div>
                        <small>
                          {tournament(m.tournamentId)?.name} ·{" "}
                          {groupName(m.group) || m.stage}
                        </small>
                        <strong>
                          {team(m.a)?.name || "Awaiting qualifier"}
                          <span> vs </span>
                          {team(m.b)?.name || "Awaiting qualifier"}
                        </strong>
                      </div>
                      <span>{m.scheduled ? time(m.scheduled) : "On deck"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="padded muted">No upcoming matches.</p>
              )}
            </section>
            <section>
              <div className="section-heading">
                <h2>Latest results</h2>
                <span>Last 3 matches</span>
              </div>
              {completed.length ? (
                completed.slice(0, 3).map((m) => (
                  <div className="venue-result" key={m.id}>
                    <Trophy size={22} />
                    <div>
                      <small>{tournament(m.tournamentId)?.name}</small>
                      <strong>{team(m.winner)?.name}</strong>
                      <span>
                        def. {team(m.winner === m.a ? m.b : m.a)?.name}
                      </span>
                    </div>
                    <b>{m.games.map((g) => g.join("–")).join(" / ")}</b>
                  </div>
                ))
              ) : (
                <p className="padded muted">
                  Results will appear when matches finish.
                </p>
              )}
            </section>
          </div>
        </>
      )}
      <footer>
        <span>
          <Radio size={17} /> COURTSIDE UPDATE
        </span>
        <p>
          {state.event.announcement ||
            "Welcome to ShuttleHub. Play hard. Play fair. Enjoy every rally."}
        </p>
        <Logo small />
      </footer>
      {error && (
        <div className="toast error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
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
