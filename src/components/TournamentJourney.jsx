import React from "react";
import { Check } from "lucide-react";
import { tournamentProgress } from "../../shared/matches.js";
import { isKnockoutOnly } from "../../shared/format.js";

export default function TournamentJourney({ state, tournament }) {
  const progress = tournamentProgress(state, tournament.id);
  const labels = isKnockoutOnly(tournament) ? ["Entries", "Knockouts", "Finished"] : ["Entries", "League", "Knockouts", "Finished"];
  const stage = progress.champion ? "Finished" : progress.postseason || progress.canCreateKnockouts ? "Knockouts" : progress.hasFixtures ? "League" : "Entries";
  const current = labels.indexOf(stage);
  return <ol className="tournament-journey" aria-label={`${tournament.name} stages`}>
    {labels.map((label, index) => <li key={label}
      className={index < current ? "done" : index === current ? "current" : ""}
      aria-current={index === current ? "step" : undefined}>
      <span className="journey-mark" aria-hidden="true">{index < current ? <Check size={12}/> : index + 1}</span>
      <span>{label}</span>
    </li>)}
  </ol>;
}
