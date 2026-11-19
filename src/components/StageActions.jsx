import React from "react";

import { tournamentProgress } from "../../shared/matches.js";

import { isKnockoutOnly, isPlayoffFormat } from "../../shared/format.js";

import { useDesk } from "../hooks/useDesk.jsx";

import { Button } from "../components/ui/button.jsx";

function StageActions() {
  const { state, filter, page, busy, admin, open, setPage } = useDesk();
  const categories = state.tournaments.map(t => ({ t, progress: tournamentProgress(state, t.id) }))
    .filter(({ t, progress }) => filter === "all" ? progress.canCreateKnockouts : t.id === filter);
  if (!categories.length) return null;
  return <div className="stage-actions" aria-label="Tournament next steps">
    {categories.map(({ t, progress }) => {
      const knockoutOnly = isKnockoutOnly(t);
      let description = knockoutOnly ? "Add teams, then generate the knockout bracket." : "Add players, then generate fixtures.";
      if (progress.champion) description = "Tournament complete";
      else if (progress.canCreateKnockouts) description = "League complete. Ready for the next stage.";
      else if (progress.postseason) description = knockoutOnly
        ? "The knockout bracket is ready. Winners advance automatically."
        : "Playoffs and knockouts are ready. Winners advance automatically.";
      else if (progress.hasFixtures) description = `${progress.remaining} league games remaining`;
      return (
        <section className="stage-action" key={t.id} aria-label={`${t.name} next steps`}>
          <div><strong>{t.name}</strong><p>{description}</p></div>
          <div className="stage-buttons">
            {progress.canCreateKnockouts && admin && <Button variant="default" className="btn primary" disabled={busy} onClick={() => open({ type: "knockouts", tournament: t })}>{isPlayoffFormat(t) ? "Create playoffs + bracket" : "Create knockouts"}</Button>}
            {progress.hasFixtures && page !== "Matches" && <Button variant="outline" className="btn" onClick={() => setPage("Matches", { filter: t.id, matchQuery: "", matchStatus: "all", matchStage: progress.postseason && !knockoutOnly ? "postseason" : "all" })}>Manage games</Button>}
            {progress.hasFixtures && page !== "Standings" && <Button variant="outline" className="btn" onClick={() => setPage("Standings", { filter: t.id })}>{knockoutOnly ? "View bracket" : progress.postseason ? "Standings & bracket" : "Review standings"}</Button>}
          </div>
        </section>
      );
    })}
  </div>;
}

export default StageActions;
