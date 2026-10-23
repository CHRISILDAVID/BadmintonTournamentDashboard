import React from "react";
import { Check } from "lucide-react";

export default function BracketTeam({ team, placeholder, winner, games, side, completed, bye, slotProps }) {
  const name = team?.name || placeholder;
  const Element = slotProps ? "button" : "div";
  return <Element {...slotProps} className={`vb-ko-opponent ${winner ? "vb-ko-winner" : ""} ${!team ? "vb-ko-pending" : ""} ${slotProps ? "ko-edit-slot" : ""}`}>
    <strong title={name}>{name}</strong>
    {completed && team && <span className="vb-ko-scores" aria-label={`${name} ${bye ? "advances by bye" : "game scores"}`}>
      {games.map((game, index) => <b key={index} className={game[side] > game[1 - side] ? "won" : ""}>{game[side]}</b>)}
      {winner && <Check size={14} aria-label="Winner"/>}
    </span>}
  </Element>;
}
