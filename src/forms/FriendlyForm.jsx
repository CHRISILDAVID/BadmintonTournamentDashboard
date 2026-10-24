import React, { useState } from "react";
import { useDesk } from "../hooks/useDesk.jsx";
import { RuleFields } from "../TournamentFormatFields.jsx";
import { Field } from "../components/common.jsx";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { NativeSelect } from "../components/ui/native-select.jsx";

export default function FriendlyForm() {
  const { admin, busy, act, setPage } = useDesk();
  const [size, setSize] = useState(1);
  const [sides, setSides] = useState([["", ""], ["", ""]]);
  const [scoring, setScoring] = useState({ bestOf: 1, points: 21, cap: 30, goldenPoint: false });
  if (!admin) return <p>Only organizers can create friendly games.</p>;
  return <form onSubmit={async e => {
    e.preventDefault();
    if (await act("friendly", { size, sides: sides.map(players => players.slice(0, size)), scoring }, "Friendly game created"))
      setPage("Matches", { filter: "friendly", matchQuery: "", matchStatus: "all", matchStage: "all" });
  }}>
    <p className="help-text">Create a standalone game for live scoring. Completed results stay in match history under Friendly.</p>
    <Field label="Format"><NativeSelect aria-label="Friendly format" value={size} onChange={e => setSize(+e.target.value)}>
      <option value={1}>Singles</option><option value={2}>Doubles</option>
    </NativeSelect></Field>
    <div className="form-row">{sides.map((players, side) => <fieldset key={side} className="stage-scoring">
      <legend>Side {side + 1}</legend>
      {players.slice(0, size).map((player, index) => <Field key={index} label={`Side ${side + 1} player ${index + 1}`}>
        <Input required maxLength={80} value={player} onChange={e => setSides(current => current.map((row, i) =>
          i === side ? row.map((name, j) => j === index ? e.target.value : name) : row))}/>
      </Field>)}
    </fieldset>)}</div>
    <RuleFields title="Friendly" value={scoring} change={setScoring}/>
    <div className="modal-actions"><Button type="submit" disabled={busy}>Create friendly game</Button></div>
  </form>;
}
