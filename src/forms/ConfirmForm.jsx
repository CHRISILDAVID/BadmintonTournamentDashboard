import React from "react";
import { Check } from "lucide-react";
import { standings, groupName } from "../utils.js";

import { PLAYOFF_STAGE, directPlaces, qualificationStatus, isPlayoffFormat, scoringRules, scoringLabel } from "../../shared/format.js";

import { useDesk } from "../hooks/useDesk.jsx";

import { Button } from "../components/ui/button.jsx";

function ConfirmForm() {
  const { state, modal, busy, team, act, setPage, setModal } = useDesk();
  const t = modal.tournament;
  const type = modal.type;
  const returning = state.matches.find(m => m.id === modal.matchId);
  const descriptions = {
    randomComplete: `TESTING ONLY: Complete every unfinished fixture in ${t ? t.name : "all tournaments"} with random scores? This includes on-court games and later rounds waiting for winners, across all stages and search/status filters. Existing completed results stay saved. Courts are freed and standings and brackets update. New stages are not created automatically.`,
    returnMatch: `Return ${team(returning?.a)?.name || "this match"} vs ${team(returning?.b)?.name || "opponent"} to waiting? Use this only if play has not begun. The court will be freed and this game will return to the upcoming list.`,
    generate: `Create round-robin fixtures for ${t?.name}? Teams will be distributed into ${t?.groups} balanced groups using a snake draft by seed. Late entries and removals remain available during the league.`,
    knockouts: isPlayoffFormat(t) ? `Create qualification playoffs and the knockout bracket for ${t.name}? Top ${directPlaces(t)} per group advance directly; playoff winners earn the remaining slots. Playoffs: ${scoringLabel(scoringRules(t, PLAYOFF_STAGE))}. Main knockout: ${scoringLabel(scoringRules(t, "Final"))}. Review final league standings before confirming. League ranks will not change after playoffs.` : `Advance the top ${t?.qualify} teams from every group to the knockout bracket? Rankings use wins, game difference, point difference, then original seed. Review standings before confirming.`,
    resetFixtures:
      "Remove the unplayed fixtures for this category and reopen team registration? Your teams will be kept.",
    deleteTeam: `Remove ${modal.team?.name} from this category? All ${state.matches.filter(m => m.tournamentId === t?.id && [m.a, m.b].includes(modal.team?.id)).length} matches involving this team, including completed results and scheduled or live matches, will be deleted. Any occupied court will be freed. Standings and qualification will be recalculated from the remaining results. This cannot be undone.`,
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
            <strong>{row.name}</strong><span>{qualificationStatus(state, t, row, rank) === "direct" ? "Direct qualifier" : qualificationStatus(state, t, row, rank) === "playoff" ? "Qualification playoff" : "Eliminated"}</span>
          </li>)}</ol>
        </section>)}
      </div>}
      <div className="modal-actions">
        <Button variant="outline" className="btn" onClick={() => setModal(null)}>
          Cancel
        </Button>
        <Button variant={type === "deleteTournament" ? "destructive" : "default"}
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
                setPage("Matches", { filter: t.id, matchQuery: "", matchStatus: "all", matchStage: type === "knockouts" ? "postseason" : "all" });
              }
              if (type === "clearDemo") {
                setPage("Overview", { filter: "all" });
              }
            }
          }}
        >
          {type === "randomComplete" ? "Complete with random scores" : type === "deleteTournament" ? "Delete tournament" : type === "knockouts" ? isPlayoffFormat(t) ? "Create playoffs + bracket" : "Create knockouts" : "Confirm"}
          <Check size={16} />
        </Button>
      </div>
    </>
  );
}

export default ConfirmForm;
