import React from "react";
import { Check } from "lucide-react";

export default function BracketTeam({ team, placeholder, winner, games, side, completed, bye }) {
  const name = team?.name || placeholder;
  return <div className={`vb-ko-opponent ${winner ? "vb-ko-winner" : ""} ${!team ? "vb-ko-pending" : ""}`}>
    <strong title={name}>{name}</strong>
    {completed && team && <span className="vb-ko-scores" aria-label={`${name} ${bye ? "advances by bye" : "game scores"}`}>
      {games.map((game, index) => <b key={index} className={game[side] > game[1 - side] ? "won" : ""}>{game[side]}</b>)}
      {winner && <Check size={14} aria-label="Winner"/>}
    </span>}
  </div>;
}
