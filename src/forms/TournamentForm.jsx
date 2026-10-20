import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronRight, ChevronLeft } from "lucide-react";

import TournamentFormatFields from "../TournamentFormatFields.jsx";

import { playoffPreset, scoringRules } from "../../shared/format.js";

import { useDesk } from "../hooks/useDesk.jsx";
import { Field } from "../components/common.jsx";

import { defaults, presets } from "../config.js";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";

function TournamentForm() {
  const { state, modal, busy, act, setPage, setModal } = useDesk();
  const formRevision = useRef(state.revision);
  useEffect(() => {
    if (modal?.conflictRevision) formRevision.current = modal.conflictRevision;
  }, [modal?.conflictRevision]);
  const existing = modal.tournament;
  const [form, setForm] = useState(() => {
    const initial = existing || defaults;
    return { ...initial, scoring: initial.scoring || { league: scoringRules(initial), knockout: scoringRules(initial, "Final") } };
  }),
    [step, setStep] = useState(1);
  const change = (key, value) => setForm({ ...form, [key]: value });
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (step < 2) {
          setStep(2);
          return;
        }
        if (
          await act(
            "tournament",
            { ...form, tournamentId: existing?.id },
            "Tournament saved",
            formRevision.current,
          )
        ) {
          setModal(null);
          setPage("Tournaments");
        }
      }}
    >
      <div className="steps">
        <span className={step === 1 ? "active" : ""}>
          01 <b>Category</b>
        </span>
        <ChevronRight size={16} />
        <span className={step === 2 ? "active" : ""}>
          02 <b>Format & scoring</b>
        </span>
      </div>
      {step === 1 ? (
        <>
          <p className="form-intro">
            Start with the event you want to run. You can add teams and finalize
            fixtures later.
          </p>
          <div className="preset-grid">
            {presets.map(([name, size, mode]) => (
              <Button variant="ghost"
                key={name}
                type="button"
                className={form.name === name ? "selected" : ""}
                onClick={() =>
                  setForm({
                    ...form,
                    name: name === "Custom" ? "" : name,
                    size,
                    ...(mode ? playoffPreset(mode) : {}),
                  })
                }
              >
                {name}
              </Button>
            ))}
          </div>
          <Field label="Tournament name">
            <Input
              autoFocus
              required
              maxLength="120"
              placeholder="e.g. ShuttleHub 3v3"
              value={form.name}
              onChange={(e) => change("name", e.target.value)}
            />
          </Field>
          <Field label="Players per team">
            <Input
              type="number"
              min="1"
              max="12"
              required
              value={form.size}
              onChange={(e) => change("size", +e.target.value)}
            />
          </Field>
        </>
      ) : (
        <>
          <p className="form-intro">
            Teams play everyone in their group once. Qualifiers advance to a
            single-elimination bracket.
          </p>
          <TournamentFormatFields form={form} setForm={setForm}/>
        </>
      )}
      <div className="modal-actions">
        {step === 2 ? (
          <Button variant="outline" className="btn" type="button" onClick={() => setStep(1)}>
            <ChevronLeft size={16} />
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button variant="default" className="btn primary" disabled={busy}>
          {step === 1
            ? "Next: format & scoring"
            : existing
              ? "Save tournament"
              : "Create tournament"}
          <ArrowRight size={16} />
        </Button>
      </div>
    </form>
  );
}

export default TournamentForm;
