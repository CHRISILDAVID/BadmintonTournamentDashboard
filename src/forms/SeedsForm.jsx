import React, { useEffect, useRef, useState } from "react";
import { isLinkedPlayoffs } from "../../shared/format.js";
import { hasTournamentDraw } from "../../shared/matches.js";
import { useDesk } from "../hooks/useDesk.jsx";
import SeedPicker from "../components/SeedPicker.jsx";
import { Button } from "../components/ui/button.jsx";
import { NativeSelect } from "../components/ui/native-select.jsx";

export default function SeedsForm() {
  const { state, modal, busy, act, setModal } = useDesk();
  const revision = useRef(state.revision);
  useEffect(() => {
    if (modal.conflictRevision) revision.current = modal.conflictRevision;
  }, [modal.conflictRevision]);
  const categories = state.tournaments.filter(t => !isLinkedPlayoffs(t));
  const [id, choose] = useState(modal.tournament?.id ?? "");
  const category = categories.find(t => t.id === id);
  const [order, change] = useState(category?.seedOrder ?? []);
  const locked = category && hasTournamentDraw(state, id);
  const entries = state.teams.filter(t => t.tournamentId === id);
  return <form onSubmit={async e => {
    e.preventDefault();
    if (category && !locked && await act("seeds", { tournamentId: id, teamIds: order }, "Seeds saved", revision.current))
      setModal(null);
  }}>
    <label className="field">
      <span>Tournament</span>
      <NativeSelect required value={id} onChange={e => {
        choose(e.target.value);
        change(categories.find(t => t.id === e.target.value)?.seedOrder ?? []);
      }}>
        <option value="">Choose a tournament</option>
        {categories.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </NativeSelect>
    </label>
    {locked ? <p className="help-text">Seeds are locked after fixtures are generated.</p> : category && <>
      <p className="help-text">{category.seedOrder === undefined && "Saving replaces the previous draw order with the seeds you choose here. "}Unseeded teams are placed randomly when fixtures are generated.</p>
      <SeedPicker key={id} entries={entries} order={order} change={change}/>
    </>}
    <div className="modal-actions">
      <Button type="button" variant="outline" onClick={() => setModal(null)}>Cancel</Button>
      <Button disabled={busy || !category || locked || order.some(teamId => !teamId)}>Save seeds</Button>
    </div>
  </form>;
}
