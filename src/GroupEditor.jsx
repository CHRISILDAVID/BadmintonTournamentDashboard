import React, { useState } from "react";
import { groupEditLockReason } from "../shared/groups.js";
import "./group-editor.css";

export default function GroupEditor({ state, tournamentId, initialTeamId = "", busy, act, close }) {
  const [firstId, setFirstId] = useState(initialTeamId);
  const [secondId, setSecondId] = useState("");
  const tournament = state.tournaments.find((t) => t.id === tournamentId);
  const teams = state.teams.filter((t) => t.tournamentId === tournamentId);
  const first = teams.find((t) => t.id === firstId);
  const second = teams.find((t) => t.id === secondId);
  const onCourt = new Set(
    state.matches
      .filter((m) => m.tournamentId === tournamentId && m.status === "live")
      .flatMap((m) => [m.a, m.b]),
  );
  const reason = groupEditLockReason(state, tournamentId);
  const canSwap =
    !reason &&
    first &&
    second &&
    first.group !== second.group &&
    !onCourt.has(first.id) &&
    !onCourt.has(second.id);
  const groupName = (group) => `Group ${String.fromCharCode(65 + group)}`;
  return (
    <form
      className="group-editor"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!canSwap) return;
        if (
          await act(
            "swapGroups",
            { tournamentId, teamAId: firstId, teamBId: secondId },
            "Groups and fixtures updated",
            state.revision,
          )
        ) {
          setFirstId("");
          setSecondId("");
        }
      }}
    >
      <p>
        <strong>{tournament?.name}</strong>
        <br />
        Swap two teams to keep every group the same size. Their fixtures update;
        planned times, holds and call positions stay with the fixtures.
      </p>
      {reason && (
        <p className="group-lock" role="status">
          {reason}
        </p>
      )}
      <div className="group-editor-rosters">
        {Array.from({ length: tournament?.groups || 0 }, (_, group) => {
          const roster = teams
            .filter((t) => t.group === group)
            .sort((a, b) => a.seed - b.seed);
          return (
            <section key={group}>
              <h3>
                {groupName(group)} <span>{roster.length} teams</span>
              </h3>
              <ul>
                {roster.map((t) => (
                  <li
                    key={t.id}
                    className={
                      [firstId, secondId].includes(t.id) ? "selected" : ""
                    }
                  >
                    {t.name}
                    {onCourt.has(t.id) && <small>On court</small>}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <fieldset disabled={busy || !!reason}>
        <label>
          First team
          <select
            aria-label="First team"
            value={firstId}
            required
            onChange={(e) => {
              setFirstId(e.target.value);
              setSecondId("");
            }}
          >
            <option value="">Choose a team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id} disabled={onCourt.has(t.id)}>
                {groupName(t.group)}: {t.name}
                {onCourt.has(t.id) ? " (on court)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Swap with
          <select
            aria-label="Swap with"
            value={secondId}
            required
            disabled={!first}
            onChange={(e) => setSecondId(e.target.value)}
          >
            <option value="">Choose a team in another group</option>
            {teams
              .filter((t) => first && t.group !== first.group)
              .map((t) => (
                <option key={t.id} value={t.id} disabled={onCourt.has(t.id)}>
                  {groupName(t.group)}: {t.name}
                  {onCourt.has(t.id) ? " (on court)" : ""}
                </option>
              ))}
          </select>
        </label>
      </fieldset>
      {canSwap && (
        <p className="group-swap-preview">
          {first.name} moves to {groupName(second.group)}.<br />
          {second.name} moves to {groupName(first.group)}.
        </p>
      )}
      <p className="group-editor-help">
        Editing locks after this tournament's first completed match. To move an
        on-court team, return its match to waiting first.
      </p>
      <div className="modal-actions">
        <button type="button" className="btn" onClick={close}>
          Done
        </button>
        <button
          type="submit"
          className="btn primary"
          disabled={busy || !canSwap}
        >
          Swap teams
        </button>
      </div>
    </form>
  );
}
