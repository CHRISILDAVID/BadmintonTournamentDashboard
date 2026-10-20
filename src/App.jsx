import { Toaster } from "./components/ui/sonner.jsx";
import { toast } from "sonner";
import React, { Suspense, lazy, useEffect, useRef } from "react";
import { LayoutDashboard, Trophy, Users, CalendarDays, GitBranch, Settings, Monitor, ArrowUpRight, ArrowRight, Plus, ChevronRight } from "lucide-react";

const VenueBoard = lazy(() => import("./VenueBoard.jsx"));

import GroupEditor from "./GroupEditor.jsx";

import { useDesk } from "./hooks/useDesk.jsx";
import { Logo, Modal } from "./components/common.jsx";

import { Button } from "./components/ui/button.jsx";

import { tournamentStore, organizerStore } from "./stores/index.js";
import PageLink from "./components/PageLink.jsx";
import Overview from "./pages/Overview.jsx";
import Tournaments from "./pages/Tournaments.jsx";
import Teams from "./pages/Teams.jsx";
import Matches from "./pages/Matches.jsx";
import Standings from "./pages/Standings.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import TournamentForm from "./forms/TournamentForm.jsx";
import ScoringForm from "./forms/ScoringForm.jsx";
import TeamForm from "./forms/TeamForm.jsx";
import MatchForm from "./forms/MatchForm.jsx";
import ConfirmForm from "./forms/ConfirmForm.jsx";

const NAV = [
  ["Overview", LayoutDashboard],
  ["Tournaments", Trophy],
  ["Teams & players", Users],
  ["Matches", CalendarDays],
  ["Standings", GitBranch],
];
function App() {
  const { state, page, filter, modal, error, notice, connected, busy, admin, display, readyMatches, act, open, setPage, setFilter, setModal, setError, setNotice } = useDesk();
  useEffect(() => tournamentStore.getState().connect(), []);
  useEffect(() => organizerStore.getState().connectNavigation(), []);
  const heading = useRef(null);
  useEffect(() => {
    document.querySelector("nav [aria-current='page']")?.scrollIntoView({ block: "nearest", inline: "nearest" });
    window.scrollTo(0, 0);
    document.title = `${page === "Display" ? "Venue display" : page} · ShuttleHub`;
    heading.current?.focus({ preventScroll: true });
  }, [page, !!state]);
  useEffect(() => {
    if (notice) { const timer = setTimeout(() => setNotice(""), 4500); return () => clearTimeout(timer); }
  }, [notice, setNotice]);
  useEffect(() => {
    if (state && filter !== "all" && !state.tournaments.some(t => t.id === filter)) setFilter("all", true);
  }, [state, filter, setFilter]);
  useEffect(() => { if (notice) toast.success(notice); }, [notice]);
  useEffect(() => {
    if (error && !modal) toast.error(error, { id: "desk-error", onDismiss: () => setError("") });
    else toast.dismiss("desk-error");
  }, [error, modal, setError]);
  if (!state) return <div className="loading"><Logo/><p>{error || "Connecting to tournament desk..."}</p>{error && <Button variant="ghost" onClick={() => location.reload()}>Reconnect</Button>}</div>;
  if (display) return <Suspense fallback={<div className="loading"><Logo/><p>Preparing venue screen...</p></div>}><VenueBoard state={state} upcoming={readyMatches} connected={connected}/></Suspense>;
  const titles = {
    Overview: "Courtside",
    Tournaments: "Your tournaments",
    "Teams & players": "Teams & players",
    Matches: "Match centre",
    History: "Match history",
    Standings: "Standings & brackets",
    Settings: "Club settings",
    "Not found": "Page not found",
  };
  const subtitles = {
    Overview: "On court. Upcoming games. Final results.",
    Tournaments: "Set up categories, seed groups, and build the draw.",
    "Teams & players": "Register your players and manage team entries.",
    Matches: "Choose any ready game, assign a court, and record the result.",
    History: "Completed matches across all your tournaments.",
    Standings: "Group tables and the route to the final.",
    Settings: "Your venue, courts, and connected screens.",
    "Not found": "This address does not match a tournament desk page.",
  };
  return (
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
          <nav aria-label="Main navigation">
            {NAV.map(([label, Icon]) => (
              <Button variant="ghost" asChild
                key={label}
                className={
                  page === label || (label === "Matches" && page === "History")
                    ? "active justify-start bg-emerald-900 text-white hover:bg-emerald-900 hover:text-white md:w-full"
                    : "justify-start hover:bg-white/10 hover:text-white md:w-full"
                }
                aria-current={page === label || (label === "Matches" && page === "History") ? "page" : undefined}
              >
                <PageLink page={label}>
                <Icon size={19} />
                {label}
                {label === "Matches" &&
                  state.matches.some((m) => m.status === "live") && (
                    <span className="nav-number">
                      {state.matches.filter((m) => m.status === "live").length}
                    </span>
                  )}
                </PageLink>
              </Button>
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
              <Button variant="ghost" asChild
                className={`settings-nav ${page === "Settings" ? "active" : ""}`}
              >
                <PageLink page="Settings" aria-current={page === "Settings" ? "page" : undefined}>
                <Settings size={18} />
                Club settings
                </PageLink>
              </Button>
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
                  <Button variant="ghost" onClick={() => open({ type: "clearDemo" })}>
                    Clear sample & start your event
                    <ArrowRight size={14} />
                  </Button>
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
                <h1 ref={heading} tabIndex={-1} className="page-title">{titles[page]}</h1>
                <p>{subtitles[page]}</p>
              </div>
              <div className="heading-actions">
                {admin && (
                  <Button variant="outline"
                    className="btn settings-mobile"
                    aria-label="Club settings"
                    onClick={() => setPage("Settings")}
                  >
                    <Settings size={16} />
                  </Button>
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
                <Button variant="default"
                  className="btn primary"
                  onClick={() => open({ type: "tournament" })}
                >
                  <Plus size={17} />
                  New tournament
                </Button>
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
            ) : page === "Settings" && admin ? (
              <SettingsPage />
            ) : <div className="panel p-6"><p className="mb-4">Use the navigation to continue, or return to the overview.</p><Button asChild><PageLink page="Overview">Go to overview</PageLink></Button></div>}
            {admin && !state.tournaments.length && (
              <div className="sample-offer">
                <span>Want to see how match day looks?</span>
                <Button variant="ghost"
                  className="text-btn"
                  disabled={busy}
                  onClick={() => act("demo", {}, "Sample tournament loaded")}
                >
                  Explore a sample event
                  <ArrowUpRight size={15} />
                </Button>
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
                scoring: "Correct tournament scoring",
              }[modal.type]
            }
            wide={["tournament", "scoring", "import", "groups"].includes(modal.type)}
            close={() => {
              setModal(null);
              setError("");
            }}
          >
            {modal.type === "tournament" ? (
              <TournamentForm />
            ) : modal.type === "scoring" ? (
              <ScoringForm />
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
        <Toaster position="bottom-right" closeButton richColors />
      </div>
  );
}

export default App;
