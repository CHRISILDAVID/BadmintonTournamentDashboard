import React, { useEffect, useState } from "react";
import VenueBracket from "./VenueBracket.jsx";
import { tournamentDisplayData } from "../shared/display.js";
import { eligibleKnockoutTeams, knockoutSlotLockReason } from "../shared/knockouts.js";
import { Button } from "./components/ui/button.jsx";
import { Input } from "./components/ui/input.jsx";
import { NativeSelect } from "./components/ui/native-select.jsx";
import { Field } from "./components/common.jsx";
import "./venue-board.css";
import "./knockout-editor.css";

export default function KnockoutEditor({ state, tournamentId, busy, act, close }) {
  const [selected, setSelected] = useState([]);
  const [players, setPlayers] = useState([]);
  const [teamId, setTeamId] = useState("");
  const [revisionNotice, setRevisionNotice] = useState("");
  const data = tournamentDisplayData(state, tournamentId);
  const teams = new Map(state.teams.map(team => [team.id, team]));
  const eligible = eligibleKnockoutTeams(state, tournamentId);
  useEffect(() => {
    if (selected.some(slot => slot.revision !== state.revision)) {
      setSelected([]);
      setRevisionNotice("The draw has updated. Select places again to make another change.");
    }
  }, [state.revision, selected]);
  if (!data) return <p>This tournament is no longer available.</p>;
  const matchFor = slot => state.matches.find(m => m.id === slot?.matchId);
  const first = matchFor(selected[0]);
  const second = matchFor(selected[1]);
  const fillingBye = first?.bye && !first[selected[0].side];
  const canSave = !busy && selected.length > 0 && selected.every(slot =>
    slot.revision === state.revision && !knockoutSlotLockReason(state, matchFor(slot), slot.side)) &&
    (fillingBye ? (teamId || Array.from({ length: data.tournament.size }, (_, i) => players[i]?.trim()).every(Boolean)) : !!second);
  function select(match, side) {
    setRevisionNotice("");
    const slot = { matchId: match.id, side, revision: state.revision };
    if (selected.some(s => s.matchId === match.id && s.side === side)) {
      setSelected(selected.filter(s => s.matchId !== match.id || s.side !== side));
    } else if (!match[side] || fillingBye || selected.length === 2) setSelected([slot]);
    else setSelected([...selected, slot]);
  }
  async function save(event) {
    event.preventDefault();
    if (!canSave) return;
    const payload = { tournamentId, matchId: first.id, side: selected[0].side };
    const saved = fillingBye
      ? await act("fillKnockoutBye", { ...payload, ...(teamId ? { teamId } : { players }) }, "Team added to the knockout draw", selected[0].revision)
      : await act("swapKnockouts", { ...payload, otherMatchId: second.id, otherSide: selected[1].side }, "Knockout teams swapped", selected[0].revision);
    if (saved) { setSelected([]); setPlayers([]); setTeamId(""); setRevisionNotice(""); }
  }
  return <form className="knockout-editor" onSubmit={save}>
    <p><strong>{data.tournament.name}</strong><br/>Select two teams in uncompleted games to swap them, or select a Bye to add a new team.</p>
    <p className="help-text">Completed games are locked. Return on-court games to waiting before editing. Teams eliminated in the league cannot be added.</p>
    <VenueBracket tournament={data.tournament} rounds={data.knockoutRounds} teams={teams}
      slotProps={(match, side, team, placeholder) => {
        const reason = knockoutSlotLockReason(state, match, side);
        return { type: "button", disabled: busy || !!reason, title: reason || (team ? "Select team to swap" : "Add a team in this bye"),
          "aria-pressed": selected.some(s => s.matchId === match.id && s.side === side),
          "aria-label": `Select ${team?.name || placeholder} in ${match.stage} ${match.index + 1}, side ${side.toUpperCase()}`,
          onClick: () => select(match, side) };
      }}/>
    <div className="ko-edit-summary" aria-live="polite">
      {revisionNotice && <p role="status">{revisionNotice}</p>}
      {!fillingBye && first && <p>{second
        ? `Swap ${teams.get(first[selected[0].side])?.name} with ${teams.get(second[selected[1].side])?.name}.`
        : `${teams.get(first[selected[0].side])?.name} selected. Select a second team to swap.`}</p>}
    </div>
    {fillingBye && <fieldset className="ko-new-team" disabled={busy}>
      <legend>Replace bye in {first.stage} {first.index + 1}</legend>
      {eligible.length > 0 && <Field label="Team">
        <NativeSelect value={teamId} onChange={e => setTeamId(e.target.value)}>
          <option value="">Register a new team</option>
          {eligible.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
        </NativeSelect>
      </Field>}
      {!teamId && Array.from({ length: data.tournament.size }, (_, i) => <Field key={i} label={`Player ${i + 1}`}>
        <Input aria-label={`Player ${i + 1}`} value={players[i] || ""} required maxLength={80}
          onChange={e => setPlayers(current => Array.from({ length: data.tournament.size }, (_, j) => j === i ? e.target.value : current[j] || ""))}/>
      </Field>)}
      <p className="help-text">The new team enters the knockout draw directly. Adding it replaces the automatic bye advancement.</p>
    </fieldset>}
    <div className="modal-actions">
      <Button variant="outline" type="button" onClick={close} disabled={busy}>Done</Button>
      {selected.length > 0 && <Button variant="ghost" type="button" disabled={busy} onClick={() => setSelected([])}>Clear selection</Button>}
      <Button type="submit" disabled={!canSave}>{fillingBye ? "Add team to bye" : "Confirm swap"}</Button>
    </div>
  </form>;
}
