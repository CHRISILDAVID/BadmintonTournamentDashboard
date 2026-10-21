import React, { useEffect, useRef, useState } from "react";
import { Check, Download, Wifi } from "lucide-react";

import { useDesk } from "../hooks/useDesk.jsx";
import { Field } from "../components/common.jsx";

import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Textarea } from "../components/ui/textarea.jsx";
import { cloudEnabled } from "../cloud/storage.js";
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
  const [values, setValues] = useState(state.event),
    [network, setNetwork] = useState([]);
  useEffect(() => {
    if (cloudEnabled()) return;
    fetch("/api/network")
      .then((r) => r.json())
      .then((d) => setNetwork(d.addresses || []));
  }, []);
  return (
    <div className="settings-grid">
      <form
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
          Save club settings
          <Check size={16} />
        </Button>
      </form>
      {cloudEnabled() ? <AccessPanel state={state}/> : <div>
        <section className="panel settings-panel">
          <div className="settings-icon">
            <Wifi />
          </div>
          <h2>One Wi-Fi. Every screen.</h2>
          <p>
            Keep this host laptop running. Connect phones and the venue screen
            to the same local network, then open one of these addresses.
          </p>
          {network.map((url) => (
            <div className="network-address" key={url}>
              <span>Organizer</span>
              <a href={url} target="_blank" rel="noreferrer">
                {url}
              </a>
              <span>Venue display</span>
              <a href={`${url}/display`} target="_blank" rel="noreferrer">
                {url}/display
              </a>
            </div>
          ))}
          {!network.length && (
            <p>
              No network address found. Connect this laptop to Wi-Fi or
              Ethernet.
            </p>
          )}
          <small>
            Internet is not needed. Allow Node.js through the Windows firewall
            on your private network if devices cannot connect.
          </small>
        </section>
        <section className="panel settings-panel">
          <h2>Keep a copy</h2>
          <p>
            Tournament data is saved automatically on this laptop. Export an
            additional readable snapshot at any time.
          </p>
          <a className="btn" href="/api/export">
            <Download size={16} />
            Export event data
          </a>
        </section>
      </div>}
    </div>
  );
}

export default SettingsPage;
