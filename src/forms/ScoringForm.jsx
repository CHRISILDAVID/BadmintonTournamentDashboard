import React, { useEffect, useRef, useState } from "react";
import { StageScoringFields } from "../TournamentFormatFields.jsx";
import { useDesk } from "../hooks/useDesk.jsx";
import { Button } from "../components/ui/button.jsx";
import { isPlayoffFormat, scoringRules, PLAYOFF_STAGE } from "../../shared/format.js";

export default function ScoringForm() {
  const { state, modal, busy, act, setModal } = useDesk();
  const [form, setForm] = useState(() => {
    const t = structuredClone(modal.tournament);
    return { ...t, scoring: { league: scoringRules(t), knockout: scoringRules(t, "Final"), ...(isPlayoffFormat(t) ? { playoff: scoringRules(t, PLAYOFF_STAGE) } : {}) } };
  });
  const revision = useRef(state.revision);
  useEffect(() => { if (modal.conflictRevision) revision.current = modal.conflictRevision; }, [modal.conflictRevision]);
  return <form onSubmit={async event => {
    event.preventDefault();
    if (await act("scoring", { tournamentId: form.id, scoring: form.scoring }, "Scoring updated for unfinished matches", revision.current)) setModal(null);
  }}>
    <p className="form-intro">{form.name}: changes apply to waiting and on-court matches. Completed results keep their original scoring rules, scores, and winners.</p>
    <StageScoringFields form={form} setForm={setForm}/>
    <div className="modal-actions"><Button type="button" variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button disabled={busy}>Save scoring</Button></div>
  </form>;
}
