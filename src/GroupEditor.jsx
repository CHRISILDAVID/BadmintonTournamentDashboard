import { Button } from "./components/ui/button.jsx";
import React, { useState } from "react";
import { groupEditLockReason } from "../shared/groups.js";
import { groupName } from "./utils.js";
import "./group-editor.css";

export default function GroupEditor({ state, tournamentId, initialTeamId = "", busy, act, close }) {
  const [mode, setMode] = useState("move");
  const [firstId, setFirstId] = useState(initialTeamId);
  const [secondId, setSecondId] = useState("");
  const [destination, setDestination] = useState(null);
  const tournament = state.tournaments.find(t => t.id === tournamentId);
  const teams = state.teams.filter(t => t.tournamentId === tournamentId);
  const first = teams.find(t => t.id === firstId);
  const second = teams.find(t => t.id === secondId);
  const onCourt = new Set(state.matches.filter(m => m.tournamentId === tournamentId && m.status === "live").flatMap(m => [m.a, m.b]));
  const reason = groupEditLockReason(state, tournamentId);
  const canMove = first && !onCourt.has(first.id) && Number.isInteger(destination) && destination >= 0 && destination < (tournament?.groups || 0) && destination !== first.group;
  const canSwap = first && second && first.group !== second.group && !onCourt.has(first.id) && !onCourt.has(second.id);
  const canSave = !busy && !reason && (mode === "move" ? canMove : canSwap);
  const clear = () => { setFirstId(""); setSecondId(""); setDestination(null); };
  function selectTeam(team) {
    setDestination(null);
    if (team.id === firstId) { clear(); return; }
    if (mode === "swap" && first && first.group !== team.group) {
      setSecondId(team.id === secondId ? "" : team.id);
    } else { setFirstId(team.id); setSecondId(""); }
  }
  return <form className="group-editor" onSubmit={async event => {
    event.preventDefault();
    if (!canSave) return;
    const saved = mode === "move"
      ? await act("moveGroup", { tournamentId, teamId: firstId, group: destination }, "Team moved and fixtures updated", state.revision)
      : await act("swapGroups", { tournamentId, teamAId: firstId, teamBId: secondId }, "Teams swapped and fixtures updated", state.revision);
    if (saved) clear();
  }}>
    <p><strong>{tournament?.name}</strong><br/>
      {mode === "move" ? "Select a team, then choose its destination group. No replacement team is needed." : "Select a team in each of two different groups to swap their places."}
    </p>
    <div className="group-editor-modes" role="group" aria-label="Group edit mode">
      {[["move", "Move team"], ["swap", "Swap teams"]].map(([value, label]) => <Button key={value} variant={mode === value ? "default" : "outline"} type="button" aria-pressed={mode === value} disabled={busy || !!reason} onClick={() => { setMode(value); setSecondId(""); setDestination(null); }}>{label}</Button>)}
    </div>
    {reason && <p className="group-lock" role="status">{reason}</p>}
    <div className="group-editor-rosters">
      {Array.from({ length: tournament?.groups || 0 }, (_, group) => {
        const roster = teams.filter(t => t.group === group).sort((a, b) => a.seed - b.seed);
        return <section key={group} aria-label={groupName(group)} className={destination === group ? "destination" : ""}>
          <h3>{groupName(group)} <span>{roster.length} teams</span></h3>
          {mode === "move" && <Button className="group-destination" type="button" variant="outline" aria-pressed={destination === group} disabled={busy || !!reason || !first || onCourt.has(first.id) || first.group === group} onClick={() => setDestination(group)}>Move to {groupName(group)}</Button>}
          <ul>{roster.map(team => <li key={team.id}>
            <button type="button" className="group-team" aria-label={`Select ${team.name} in ${groupName(group)}`} aria-pressed={[firstId, secondId].includes(team.id)} disabled={busy || !!reason || onCourt.has(team.id)} onClick={() => selectTeam(team)}>
              <span>{team.name}</span>
              <small>{onCourt.has(team.id) ? "On court" : firstId === team.id ? "Selected team" : secondId === team.id ? "Swap partner" : `Seed ${team.seed}`}</small>
            </button>
          </li>)}</ul>
          {!roster.length && <p className="group-empty">No teams in this group.</p>}
        </section>;
      })}
    </div>
    <div aria-live="polite">
      {mode === "move" && canMove && <p className="group-swap-preview">{first.name} moves from {groupName(first.group)} to {groupName(destination)}.<br/>Their previous fixtures and planned times will be removed. New fixtures will pair them with each team in {groupName(destination)}. Other matches are retained.</p>}
      {mode === "swap" && canSwap && <p className="group-swap-preview">{first.name} moves to {groupName(second.group)}.<br/>{second.name} moves to {groupName(first.group)}.<br/>Fixture IDs and planned times are retained.</p>}
    </div>
    <p className="group-editor-help">Editing locks after this tournament's first completed match. To move or swap an on-court team, return its match to waiting first.</p>
    <div className="modal-actions">
      <Button variant="outline" type="button" className="btn" onClick={close}>Done</Button>
      <Button variant="default" type="submit" className="btn primary" disabled={!canSave}>{mode === "move" ? "Confirm move" : "Confirm swap"}</Button>
    </div>
  </form>;
}
