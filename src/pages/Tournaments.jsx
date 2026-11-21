import React from "react";
import { Trophy, Plus, ChevronRight, Pencil, Trash2 } from "lucide-react";

import { groupEditLockReason } from "../../shared/groups.js";
import { canResetFixtures, tournamentProgress } from "../../shared/matches.js";
import { PLAYOFF_STAGE, drawSize, isKnockoutOnly, isLinkedPlayoffs, isPlayoffFormat, scoringRules, scoringLabel, tournamentFormats } from "../../shared/format.js";
import { linkedEntryConflict, qualifiesFromLeague } from "../../shared/linked-playoffs.js";
import { isKnockout } from "../../shared/knockouts.js";

import { useDesk } from "../hooks/useDesk.jsx";
import { Pill, Empty } from "../components/common.jsx";

import { Button } from "../components/ui/button.jsx";
import TournamentJourney from "../components/TournamentJourney.jsx";

function Tournaments() {
  const { state, admin, busy, team, open, setPage } = useDesk();
  return (
    <>
      {!state.tournaments.length ? (
        <Empty
          title="Your first tournament starts here"
          action={
            admin && (
              <Button variant="default"
                className="btn primary"
                onClick={() => open({ type: "tournament" })}
              >
                <Plus size={16} />
                Create tournament
              </Button>
            )
          }
        >
          Singles, doubles, mixed, or something entirely your own.
        </Empty>
      ) : (
        <div className="tournament-grid">
          {state.tournaments.map(t => {
            const { hasFixtures: drawn, champion: champ, postseason, canCreateKnockouts } = tournamentProgress(state, t.id);
            const knockoutOnly = isKnockoutOnly(t);
            const linked = isLinkedPlayoffs(t);
            const leagueQualifies = qualifiesFromLeague(state, t.id);
            const teams = state.teams.filter((x) => x.tournamentId === t.id),
              matches = state.matches.filter((m) => m.tournamentId === t.id),
              playable = matches.filter(m => !m.bye),
              done = playable.filter(m => m.status === "completed").length;
            const qualifiers = linked ? new Set(matches.flatMap(m => [m.a, m.b]).filter(Boolean)).size : 0;
            const slots = linked ? (t.linkedPlayoffs.mode === "final" ? 2 : 4) : teams.length >= 2 ? drawSize(teams.length) : 0;
            const byes = drawn ? matches.filter(m => m.bye).length : slots ? slots - teams.length : 0;
            const canEditGroups = !knockoutOnly && matches.length > 0 && t.groups > 1 && !postseason;
            const groupLock = canEditGroups ? groupEditLockReason(state, t.id) : "";
            return (
              <section className="panel tournament-card" key={t.id}>
                <div className="tournament-top">
                  <span className="category-kind">{t.size === 1 ? "Singles" : `${t.size} players per team`} · {tournamentFormats[t.format ?? "league"]}</span>
                  <Pill tone={champ ? "green" : ""}>
                    {champ
                      ? "Finished"
                      : drawn
                        ? (playable.some(m => m.status !== "upcoming") ? "In progress" : "Ready")
                        : "Registration"}
                  </Pill>
                </div>
                <h2>{t.name}</h2>
                {linked ? <p className="help-text">{t.linkedPlayoffs.sources.map(source => state.tournaments.find(t => t.id === source.tournamentId)?.name).join(" + ")} · {qualifiers < slots ? "Waiting for qualifiers" : linkedEntryConflict(state, t.id) || "Qualifiers confirmed"}</p> : <TournamentJourney state={state} tournament={t}/>}
                <div className="tournament-numbers">
                  <div>
                    <b>{linked ? qualifiers : teams.length}</b>
                    <span>{linked ? "Qualified teams" : "Teams"}</span>
                  </div>
                  <div>
                    <b>{knockoutOnly ? slots || "–" : t.groups}</b>
                    <span>{knockoutOnly ? "Bracket slots" : "Groups"}</span>
                  </div>
                  <div>
                    <b>{linked ? matches.length : knockoutOnly ? slots ? byes : "–" : t.groups * t.qualify}</b>
                    <span>{linked ? "Matches" : knockoutOnly ? "Byes" : "Qualifiers"}</span>
                  </div>
                </div>
                <div className="progress">
                  <span
                    style={{
                      width: `${playable.length ? (done / playable.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <small>
                  {done} of {playable.length} matches completed
                  {!knockoutOnly && <> · League: {scoringLabel(scoringRules(t))}</>}
                  {(knockoutOnly || t.scoring) && <><br/>{knockoutOnly ? "Knockout" : "Main knockout"}: {scoringLabel(scoringRules(t, "Final"))}</>}
                  {isPlayoffFormat(t) && <><br/>Playoffs: {scoringLabel(scoringRules(t, PLAYOFF_STAGE))}</>}
                </small>
                {champ && (
                  <p className="champion">
                    <Trophy size={16} />
                    {team(champ.winner)?.name} {linked ? "· Overall champion" : "wins!"}
                  </p>
                )}
                <div className="tournament-actions">
                  {drawn && <Button variant="outline" onClick={() => setPage("Matches", { filter: t.id, matchQuery: "", matchStatus: "all", matchStage: postseason && !knockoutOnly ? "postseason" : "all" })}>Manage games<ChevronRight size={15}/></Button>}
                  {admin && matches.length > 0 && <Button variant="outline" className="btn" onClick={() => open({ type: "scoring", tournament: t })}>Edit scoring</Button>}
                  {canEditGroups && (
                    <Button variant="outline" className="btn" disabled={!!groupLock}
                      title={groupLock || "Move or swap teams between groups"}
                      onClick={() => open({ type: "groups", tournament: t })}>
                      Edit groups
                    </Button>
                  )}
                  {admin && !linked && matches.some(isKnockout) && (
                    <Button variant="outline" className="btn" disabled={busy}
                      onClick={() => open({ type: "editKnockouts", tournament: t })}>
                      Edit knockouts
                    </Button>
                  )}
                  {!linked && <Button variant="outline"
                    className="btn"
                    onClick={() => {
                      setPage("Teams & players", { filter: t.id, teamQuery: "" });
                    }}
                  >
                    Manage teams
                    <ChevronRight size={15} />
                  </Button>}
                  {admin && !drawn && (
                    <Button variant="ghost"
                      className="icon-btn"
                      aria-label={`Edit ${t.name}`}
                      onClick={() =>
                        open({ type: "tournament", tournament: t })
                      }
                    >
                      <Pencil size={16} />
                    </Button>
                  )}
                  {admin && (!leagueQualifies || !drawn) &&
                    (!drawn ? (
                      <Button variant="default"
                        className="btn primary"
                        onClick={() =>
                          open({ type: "generate", tournament: t })
                        }
                      >
                        {knockoutOnly ? "Generate bracket" : "Generate fixtures"}
                      </Button>
                    ) : !postseason ? (
                      <Button variant="default"
                        className="btn primary"
                        disabled={!canCreateKnockouts}
                        onClick={() =>
                          open({ type: "knockouts", tournament: t })
                        }
                      >
                        {isPlayoffFormat(t) ? "Playoffs + bracket" : "Knockouts"}
                      </Button>
                    ) : (
                      <Button variant="default"
                        className="btn primary"
                        onClick={() => {
                          setPage("Standings", { filter: t.id });
                        }}
                      >
                        Bracket
                      </Button>
                    ))}
                </div>
                {groupLock && <p className="lock-reason">Groups: {groupLock}</p>}
                {drawn && leagueQualifies && <p className="help-text">Final league standings feed the linked playoffs.</p>}
                {drawn && !leagueQualifies && !postseason && !canCreateKnockouts && <p className="lock-reason">Complete all league matches before creating the knockout draw.</p>}
                {admin && !linked &&
                  drawn &&
                  canResetFixtures(matches) && (
                    <Button variant="ghost"
                      className="text-btn reset-link"
                      onClick={() =>
                        open({ type: "resetFixtures", tournament: t })
                      }
                    >
                      Reset unplayed fixtures
                    </Button>
                  )}
                <div className="tournament-delete">
                  <Button variant="ghost" className="text-btn" aria-label={`Delete ${t.name}`}
                    disabled={matches.some(m => m.status === "live")}
                    onClick={() => open({type:"deleteTournament", tournament:t})}>
                    <Trash2 size={14} />Delete tournament
                  </Button>
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

export default Tournaments;
