import React, { useMemo, useRef, useState } from "react";
import { knockoutDependents, knockoutSlotLockReason } from "../shared/knockouts.js";
import { pendingOpponent } from "../shared/format.js";
import { playerLabel } from "../shared/players.js";
import { Button } from "./components/ui/button.jsx";
import { Input } from "./components/ui/input.jsx";
import { NativeSelect } from "./components/ui/native-select.jsx";
import { Field } from "./components/common.jsx";

const blankRow = id => ({ id, slot: "", teamId: "", players: [] });
const matchLabel = match => `${match.stage} ${match.index + 1}`;

export default function KnockoutByeBatch({ state, tournament, rounds, teams, eligible, busy, act, back }) {
  const [rows, setRows] = useState(() => [blankRow(0)]);
  const nextId = useRef(1);
  const { slots, dependents } = useMemo(() => {
    const fixtures = rounds.flatMap(round => round.matches);
    const dependents = knockoutDependents(fixtures);
    const slots = new Map();
    for (const match of fixtures) {
      if (!match.bye) continue;
      for (const side of ["a", "b"]) {
        if (!knockoutSlotLockReason(state, match, side, dependents))
          slots.set(`${match.id}:${side}`, { match, side });
      }
    }
    return { slots, dependents };
  }, [state, rounds]);
  const eligibleIds = new Set(eligible.map(team => team.id));
  const chosenSlots = rows.map(row => row.slot);
  const registeredIds = rows.flatMap(row => row.teamId ? [row.teamId] : []);
  const canSave = !busy && new Set(chosenSlots).size === rows.length &&
    new Set(registeredIds).size === registeredIds.length &&
    rows.every(row => slots.has(row.slot) && (row.teamId
      ? eligibleIds.has(row.teamId)
      : Array.from({ length: tournament.size }, (_, i) => row.players[i]?.trim()).every(Boolean)));
  const update = (id, patch) => setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : row));
  const opponent = ({ match, side }) => {
    const other = side === "a" ? "b" : "a";
    return teams.get(match[other])?.name || pendingOpponent(match, other);
  };
  const save = async event => {
    event.preventDefault();
    if (!canSave) return;
    const entries = rows.map(row => {
      const { match, side } = slots.get(row.slot);
      return { matchId: match.id, side, ...(row.teamId ? { teamId: row.teamId } : { players: row.players }) };
    });
    const saved = await act("fillKnockoutByes", { tournamentId: tournament.id, entries },
      entries.length === 1 ? "Late team added to the knockout draw" : `${entries.length} late teams added to the knockout draw`, state.revision);
    if (saved) back();
  };

  return <form className="knockout-editor" onSubmit={save}>
    <div>
      <h3 className="ko-batch-title">Add late teams</h3>
      <p className="help-text">{tournament.name} · {slots.size} eligible {slots.size === 1 ? "bye" : "byes"}</p>
    </div>
    <p className="help-text">Assign a different bye to each team. All assignments are checked and saved together.</p>
    {!slots.size && <p role="status">There are no eligible byes in this draw.</p>}
    {rows.map((row, index) => {
      const slot = slots.get(row.slot);
      const name = row.teamId ? teams.get(row.teamId)?.name : playerLabel(row.players.filter(name => name?.trim()).map(name => name.trim()));
      const nextMatches = slot ? dependents.get(slot.match.id) || [] : [];
      return <fieldset className="ko-new-team" key={row.id} disabled={busy}>
        <legend>Late team {index + 1}</legend>
        <Field label="Bye slot">
          <NativeSelect value={row.slot} required onChange={event => update(row.id, { slot: event.target.value })}>
            <option value="">Choose a bye</option>
            {row.slot && !slot && <option value={row.slot} disabled>Bye no longer available</option>}
            {[...slots].filter(([key]) => key === row.slot || !chosenSlots.includes(key)).map(([key, candidate]) =>
              <option key={key} value={key}>{matchLabel(candidate.match)} · {opponent(candidate)}</option>)}
          </NativeSelect>
        </Field>
        {(eligible.length > 0 || row.teamId) && <Field label="Team">
          <NativeSelect value={row.teamId} onChange={event => update(row.id, { teamId: event.target.value })}>
            <option value="">Register a new team</option>
            {row.teamId && !eligibleIds.has(row.teamId) && <option value={row.teamId} disabled>Team no longer available</option>}
            {eligible.filter(team => team.id === row.teamId || !registeredIds.includes(team.id)).map(team =>
              <option key={team.id} value={team.id}>{team.name}</option>)}
          </NativeSelect>
        </Field>}
        {!row.teamId && Array.from({ length: tournament.size }, (_, player) => <Field key={player} label={`Player ${player + 1}`}>
          <Input value={row.players[player] || ""} required maxLength={80} onChange={event =>
            update(row.id, { players: Array.from({ length: tournament.size }, (_, i) =>
              i === player ? event.target.value : row.players[i] || "") })}/>
        </Field>)}
        {row.slot && !slot && <p className="ko-batch-preview" role="status">This bye is no longer eligible. Choose another slot to keep this team in the batch.</p>}
        {slot && <div className="ko-batch-preview">
          <strong>{matchLabel(slot.match)} · {opponent(slot)} vs {name || "Late team"}</strong>
          {nextMatches.length > 0 && <p>{nextMatches.map(matchLabel).join(", ")} will wait for the winner.</p>}
        </div>}
        {rows.length > 1 && <Button type="button" variant="ghost" className="ko-batch-remove"
          aria-label={`Remove late team ${index + 1}`} onClick={() => setRows(current => current.filter(entry => entry.id !== row.id))}>Remove team</Button>}
      </fieldset>;
    })}
    <div className="ko-batch-tools"><Button type="button" variant="outline" disabled={busy || rows.length >= slots.size}
      onClick={() => {
        const row = blankRow(nextId.current++);
        setRows(current => [...current, row]);
      }}>Add another late team</Button></div>
    <div className="modal-actions">
      <Button type="button" variant="outline" onClick={back} disabled={busy}>Back to bracket</Button>
      <Button type="submit" disabled={!canSave}>Save {rows.length === 1 ? "late team" : `${rows.length} late teams`}</Button>
    </div>
  </form>;
}
