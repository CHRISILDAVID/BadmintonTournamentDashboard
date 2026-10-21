import React, { useEffect, useRef, useState } from "react";
import { Check, Upload, Download, Trash2 } from "lucide-react";
import { importTeams, download, playerLabel, groupName } from "../utils.js";
import { hasLeagueDraw, leagueEntryLockReason } from "../../shared/groups.js";

import { tournamentProgress } from "../../shared/matches.js";

import { useDesk } from "../hooks/useDesk.jsx";
import { Empty, Field } from "../components/common.jsx";

import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";

import { NativeSelect } from "../components/ui/native-select.jsx";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table.jsx";

function TeamForm({ importing = false }) {
  const { state, filter, modal, busy, tournament, open, act, setModal, setError } = useDesk();
  const formRevision = useRef(state.revision);
  useEffect(() => {
    if (modal?.conflictRevision) formRevision.current = modal.conflictRevision;
  }, [modal?.conflictRevision]);
  const unlocked = state.tournaments.filter(
    (t) => !leagueEntryLockReason(state, t.id) ||
      (modal.team?.tournamentId === t.id && !tournamentProgress(state, t.id).champion),
  );
  const initial = modal.team;
  const [tid, setTid] = useState(
    initial?.tournamentId ||
      (unlocked.some((t) => t.id === filter) ? filter : unlocked[0]?.id) ||
      "",
  );
  const t = tournament(tid);
  const registrationLocked = hasLeagueDraw(state, tid);
  const [group, setGroup] = useState(modal.newGroup ? "new" : "");
  const [players, setPlayers] = useState(initial?.players || []),
    [seed, setSeed] = useState(initial?.seed || ""),
    [rows, setRows] = useState(null),
    [fileName, setFileName] = useState(""),
    [fileBusy, setFileBusy] = useState(false);
  if (!unlocked.length)
    return (
      <Empty title="Create an editable tournament first">
        Teams can be added or removed during the league, until the playoff or knockout draw is created.
      </Empty>
    );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const teams = importing
          ? rows
          : [
              {
                id: initial?.id,
                players,
                seed: seed ? +seed : undefined,
              },
            ];
        if (
          await act(
            "teams",
            { tournamentId: tid, teams, ...(registrationLocked && !initial ? { group } : {}) },
            importing ? "Teams imported" : "Team saved",
            formRevision.current,
          )
        )
          setModal(null);
      }}
    >
      <Field label="Tournament">
        <NativeSelect
          value={tid}
          disabled={!!initial}
          onChange={(e) => {
            setTid(e.target.value);
            setPlayers([]);
            setRows(null);
            setGroup(modal.newGroup ? "new" : "");
          }}
        >
          {unlocked.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {registrationLocked && !initial && <>
        <Field label="Add teams to group">
          <NativeSelect aria-label="Add teams to group" value={group} required onChange={e => setGroup(e.target.value)}>
            <option value="">Choose a group</option>
            {Array.from({ length: t.groups }, (_, g) => <option key={g} value={g}>{groupName(g)}</option>)}
            {importing && <option value="new">New group ({groupName(t.groups)})</option>}
          </NativeSelect>
        </Field>
        <p className="help-text">{group === "new" ? "Import at least two teams to create this group and its round-robin fixtures." : "New teams will play each other and every existing team in this group. Existing fixtures and results are retained."} Qualification places per group stay as configured; ranks outside the configured playoff places are eliminated.</p>
      </>}
      {importing ? (
        <>
          <div className="import-drop">
            <Upload size={28} />
            <h3>Bring your teams to the court</h3>
            <p>CSV or Excel (.xlsx), up to 5 MB. First worksheet is used.</p>
            <Input
              aria-label="Team spreadsheet"
              type="file"
              accept=".csv,.xlsx"
              disabled={fileBusy}
              onChange={async (e) => {
                const input = e.currentTarget;
                const file = e.target.files[0];
                if (!file) return;
                setFileBusy(true);
                setError("");
                setRows(null);
                try {
                  const data = await importTeams(file);
                  setRows(data);
                  setFileName(file.name);
                } catch (err) {
                  setError(err.message);
                  input.value = "";
                } finally {
                  setFileBusy(false);
                }
              }}
            />
          </div>
          <Button variant="ghost"
            type="button"
            className="text-btn"
            onClick={() =>
              download(
                "shuttlehub-team-template.csv",
                `${Array.from({ length: t?.size || 2 }, (_, i) => `player${i + 1}`).join(",")},seed\n${Array.from({ length: t?.size || 2 }, (_, i) => `Player ${i + 1}`).join(",")},1\n`,
              )
            }
          >
            <Download size={15} />
            Download CSV template
          </Button>
          {rows && (
            <div className="import-preview">
              <strong>{rows.length} teams ready to review</strong>
              <small>{fileName}</small>
              <div className="table-scroll">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>TEAM</TableHead>
                      <TableHead>SEED</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 12).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>{r.seed || "Auto"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {rows.length > 12 && (
                <small>…and {rows.length - 12} more entries</small>
              )}
            </div>
          )}
          <p className="help-text">
            Headers: player1
            {t?.size > 1 ? `, player2${t.size > 2 ? ", …" : ""}` : ""}, seed
            (optional). Team labels are made from player names. Players and seeds must be unique within a category. All
            rows are validated before anything is saved.
          </p>
        </>
      ) : (
        <>
          <div className="auto-team-name"><span>Entry name (automatic)</span><strong>{playerLabel(players) || "Enter player names below"}</strong></div>
          {Array.from({ length: t?.size || 1 }, (_, i) => (
            <Field key={`${tid}-${i}`} label={`Player ${i + 1}`}>
              <Input
                required
                value={players[i] || ""}
                onChange={(e) => {
                  const next = [...players];
                  next[i] = e.target.value;
                  setPlayers(next);
                }}
                placeholder="Full name"
              />
            </Field>
          ))}
          <Field
            label="Seed"
            hint={registrationLocked && initial ? "Seeds are locked after fixtures are generated. Player names remain editable until the tournament ends." : "Leave blank to assign the next seed. Use consistent player names across categories to prevent court conflicts."}
          >
            <Input
              type="number"
              min="1"
              max="10000"
              disabled={registrationLocked && !!initial}
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="Automatic"
            />
          </Field>
        </>
      )}
      <div className="modal-actions">
        {initial && !leagueEntryLockReason(state, tid) ? (
          <Button variant="destructive"
            className="btn danger"
            type="button"
            onClick={() =>
              open({ type: "deleteTeam", team: initial, tournament: t })
            }
          >
            <Trash2 size={15} />
            Remove team
          </Button>
        ) : (
          <span />
        )}
        <Button variant="default"
          className="btn primary"
          disabled={busy || fileBusy || (importing && !rows?.length)}
        >
          {importing ? "Import teams" : "Save team"}
          <Check size={16} />
        </Button>
      </div>
    </form>
  );
}

export default TeamForm;
