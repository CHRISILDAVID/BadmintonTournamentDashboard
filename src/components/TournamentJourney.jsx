import React from "react";
import { Check } from "lucide-react";
import { tournamentProgress } from "../../shared/matches.js";

export default function TournamentJourney({ state, tournament }) {
  const progress = tournamentProgress(state, tournament.id);
  const current = progress.champion ? 3 : progress.postseason || progress.canCreateKnockouts ? 2 : progress.hasFixtures ? 1 : 0;
  return <ol className="tournament-journey" aria-label={`${tournament.name} stages`}>
    {["Entries", "League", "Knockouts", "Finished"].map((label, index) => <li key={label}
      className={index < current ? "done" : index === current ? "current" : ""}
      aria-current={index === current ? "step" : undefined}>
      <span className="journey-mark" aria-hidden="true">{index < current ? <Check size={12}/> : index + 1}</span>
      <span>{label}</span>
    </li>)}
  </ol>;
}
