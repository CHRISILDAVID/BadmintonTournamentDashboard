import React from "react";
import { Trophy, Plus, ChevronRight, SlidersHorizontal, Pencil, Trash2 } from "lucide-react";

import { groupEditLockReason, hasLeagueDraw } from "../../shared/groups.js";
import { tournamentProgress } from "../../shared/matches.js";
import { PLAYOFF_STAGE, isPlayoffFormat, scoringRules, scoringLabel } from "../../shared/format.js";

import { useDesk } from "../hooks/useDesk.jsx";
import { Pill, Empty } from "../components/common.jsx";

import { Button } from "../components/ui/button.jsx";
import { cloudEnabled } from "../cloud/storage.js";

function Tournaments() {
  const { state, admin, busy, act, team, open, setPage } = useDesk();
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
      {admin && !cloudEnabled() && !state.demo && <div className="practice-banner">
        <div><strong>Rehearse match day</strong><p>Add five practice categories with teams and fixtures to try the tournament workflows.</p></div>
        <Button variant="outline" disabled={busy || state.tournaments.some(t => t.practice)} onClick={() => act("practice", {}, "Practice tournaments loaded")}>
          Load practice tournaments
        </Button>
      </div>}
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
          {state.tournaments.map((t, i) => {
            const drawn = hasLeagueDraw(state, t.id);
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
                      : drawn
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
                  {admin && matches.length > 0 && <Button variant="outline" className="btn" onClick={() => open({ type: "scoring", tournament: t })}>Edit scoring</Button>}
                  {matches.length > 0 && t.groups > 1 && (
                    <Button variant="outline" className="btn" disabled={!!groupEditLockReason(state, t.id)}
                      title={groupEditLockReason(state, t.id) || "Swap teams between groups"}
                      onClick={() => open({ type: "groups", tournament: t })}>
                      Edit groups
                    </Button>
                  )}
                  <Button variant="outline"
                    className="btn"
                    onClick={() => {
                      setPage("Teams & players", { filter: t.id, teamQuery: "" });
                    }}
                  >
                    Manage teams
                    <ChevronRight size={15} />
                  </Button>
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
                  {admin &&
                    (!drawn ? (
                      <Button variant="default"
                        className="btn primary"
                        onClick={() =>
                          open({ type: "generate", tournament: t })
                        }
                      >
                        Fixtures
                      </Button>
                    ) : !matches.some((m) => m.stage !== "League") ? (
                      <Button variant="default"
                        className="btn primary"
                        disabled={!tournamentProgress(state, t.id).canCreateKnockouts}
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
                {admin &&
                  drawn &&
                  done === 0 &&
                  !matches.some((m) => m.status === "live") && (
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
