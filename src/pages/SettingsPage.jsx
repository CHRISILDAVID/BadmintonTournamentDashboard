import React, { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import { useDesk } from "../hooks/useDesk.jsx";
import { Field } from "../components/common.jsx";

import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Textarea } from "../components/ui/textarea.jsx";
import AccessPanel from "../cloud/AccessPanel.jsx";

function SettingsPage() {
  const { state, modal, error, busy, act } = useDesk();
  const formRevision = useRef(state.revision);
  useEffect(() => {
    if (modal?.conflictRevision) formRevision.current = modal.conflictRevision;
  }, [modal?.conflictRevision]);
  useEffect(() => {
    if (error.includes("Another organizer"))
      formRevision.current = state.revision;
  }, [error, state.revision]);
  const [values, setValues] = useState(state.event);
  return (
    <div className="settings-grid">
      <nav className="section-jumps" aria-label="Settings sections"><a href="#venue-settings">Venue & courts</a><a href="#access-invite">Invitations</a><a href="#access-scoring">Scoring control</a><a href="#access-screens">Screens</a><a href="#access-revoke">Access</a><a href="#access-unresolved">Unresolved work</a><a href="#access-backup">Backup</a></nav>
      <form
        id="venue-settings"
        className="panel settings-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await act(
              "event",
              values,
              "Club details saved",
              formRevision.current,
            )
          )
            formRevision.current = state.revision + 1;
        }}
      >
        <h2>Club details</h2>
        <p>Set the defaults for your organizing team.</p>
        <Field label="Scoreboard title">
          <Input
            required
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
          />
        </Field>
        <Field label="Venue">
          <Input
            value={values.venue}
            onChange={(e) => setValues({ ...values, venue: e.target.value })}
          />
        </Field>
        <div className="form-row">
          <Field label="Number of courts">
            <Input
              required
              type="number"
              min="1"
              max="32"
              value={values.courts}
              onChange={(e) =>
                setValues({ ...values, courts: +e.target.value })
              }
            />
          </Field>
        </div>
        <Field
          label="Venue announcement"
          hint="Appears along the bottom of the venue display."
        >
          <Textarea
            maxLength="250"
            value={values.announcement}
            onChange={(e) =>
              setValues({ ...values, announcement: e.target.value })
            }
          />
        </Field>
        <Button variant="default" className="btn primary" disabled={busy}>
          {busy ? "Saving settings…" : "Save club settings"}
          <Check size={16} />
        </Button>
      </form>
      <AccessPanel state={state}/>
    </div>
  );
}

export default SettingsPage;
