import React, { useState } from "react";
import { Plus, Upload, Pencil } from "lucide-react";
import { groupName, time } from "../utils.js";

import { tournamentProgress } from "../../shared/matches.js";

import { groupEditLockReason, hasLeagueDraw, teamEntryLockReason } from "../../shared/groups.js";
import { isKnockoutOnly } from "../../shared/format.js";

import { useDesk } from "../hooks/useDesk.jsx";
import { Empty, Pill } from "../components/common.jsx";

import { Button } from "../components/ui/button.jsx";
import { NativeSelect } from "../components/ui/native-select.jsx";
import SearchField from "../components/SearchField.jsx";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table.jsx";

function Teams() {
  const { state, filter, admin, busy, act, categorySelect, tournament, open, setPage, teamQuery: query, setTeamQuery: setQuery } = useDesk();
  const [arrival, setArrival] = useState("all");
  const selectedTournament = state.tournaments.find((t) => t.id === filter);
  const showGroups = selectedTournament ? !isKnockoutOnly(selectedTournament) : state.tournaments.some(t => !isKnockoutOnly(t));
  const groupLock = selectedTournament ? groupEditLockReason(state, filter) : "";
  const categoryTeams = state.teams.filter(t => t.tournamentId && (filter === "all" || t.tournamentId === filter));
  const matchingTeams = categoryTeams.filter(
    (t) =>
      `${t.name} ${t.players.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const arrived = matchingTeams.filter(t => t.arrivedAt).length;
  const teams = arrival === "all" ? matchingTeams : matchingTeams.filter(t => Boolean(t.arrivedAt) === (arrival === "arrived"));
  const filtered = query || filter !== "all" || arrival !== "all";
  const reset = () => {
    setArrival("all");
    setPage("Teams & players", { filter: "all", teamQuery: "" });
  };
  return (
    <section className="panel teams-panel">
      <div className="toolbar teams-toolbar">
        <SearchField placeholder="Search teams or players…" value={query} onChange={setQuery}/>
        <label className="filter-control"><span className="control-label">Tournament</span>{categorySelect}</label>
        <label className="filter-control"><span className="control-label">Arrival</span>
          <NativeSelect aria-label="Filter by arrival" value={arrival} onChange={event => setArrival(event.target.value)}>
            <option value="all">All teams ({matchingTeams.length})</option>
            <option value="arrived">Arrived ({arrived})</option>
            <option value="not-arrived">Not arrived ({matchingTeams.length - arrived})</option>
          </NativeSelect>
        </label>
        {showGroups && selectedTournament?.groups > 1 && (
          <Button variant="outline" className="btn" disabled={!!groupLock} title={groupLock || "Move or swap teams between groups"}
            onClick={() => open({ type: "groups", tournament: selectedTournament })}>
            <Pencil size={16} />Edit groups
          </Button>
        )}
        {admin && (
          <>
            <Button variant="outline" className="btn" onClick={() => open({ type: "import" })}>
              <Upload size={16} />
              Import teams
            </Button>
            {selectedTournament && hasLeagueDraw(state, filter) && !teamEntryLockReason(state, filter) && <Button variant="outline" className="btn" onClick={() => open({ type: "import", newGroup: true })}>
              <Plus size={16}/>New group
            </Button>}
            <Button variant="default"
              className="btn primary"
              onClick={() => open({ type: "team" })}
            >
              <Plus size={16} />
              Add team
            </Button>
          </>
        )}
      </div>
      <div className="results-summary"><span role="status">{teams.length} of {categoryTeams.length} teams{query && <> · Search: “{query}”</>}</span>{filtered && <Button variant="ghost" onClick={reset}>Reset filters</Button>}</div>
      {showGroups && selectedTournament?.groups > 1 && <p className="group-edit-hint">
        {groupLock || "Select teams in Edit groups to move or swap them. Editing locks after the first completed match."}
      </p>}
      {admin && <p className="help-text">Mark a team arrived when all its players are present. Ready matches with the longest-waiting team appear first in Arrival priority order. {teams.filter(t => t.arrivedAt).length} of {teams.length} shown teams have arrived.</p>}
      {teams.length ? (
        <div className="table-scroll">
          <Table className="teams-table" aria-label="Teams and players">
            <TableHeader>
              <TableRow>
                <TableHead>SEED</TableHead>
                <TableHead>TEAM / PLAYER</TableHead>
                <TableHead>TOURNAMENT</TableHead>
                {showGroups && <TableHead>GROUP</TableHead>}
                <TableHead>ARRIVAL</TableHead>
                {admin && <TableHead><span className="sr-only">Actions</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((t) => {
                const category = tournament(t.tournamentId);
                const groupLock = isKnockoutOnly(category) ? "" : groupEditLockReason(state, t.tournamentId);
                const namesLocked = !!tournamentProgress(state, t.tournamentId).champion;
                return (
                <TableRow key={t.id}>
                  <TableCell data-label="Seed">
                    <span className="seed">{t.seed}</span>
                  </TableCell>
                  <TableCell>
                    <strong>{t.name}</strong>
                  </TableCell>
                  <TableCell data-label="Tournament">{category?.name}</TableCell>
                  {showGroups && <TableCell data-label="Group">{isKnockoutOnly(category) || t.knockoutEntry ? "Knockout entry" : groupName(t.group) || "Not assigned"}</TableCell>}
                  <TableCell data-label="Arrival" className="team-arrival">
                    <Pill tone={t.arrivedAt ? "green" : ""}>{t.arrivedAt ? "Arrived" : "Not arrived"}</Pill>
                    {t.arrivedAt && <small>At {time(t.arrivedAt)}</small>}
                    {admin && <Button variant="outline" disabled={busy}
                      aria-label={`${t.arrivedAt ? "Undo arrival" : "Mark arrived"}: ${t.name} in ${tournament(t.tournamentId)?.name}`}
                      onClick={() => act("teamArrival", { tournamentId: t.tournamentId, teamId: t.id, arrived: !t.arrivedAt },
                        t.arrivedAt ? "Team arrival undone" : "Team marked arrived")}>
                      {t.arrivedAt ? "Undo arrival" : "Mark arrived"}
                    </Button>}
                  </TableCell>
                  {admin && (
                    <TableCell>
                      {t.group != null ? (
                        <Button variant="ghost"
                          className="text-btn"
                          aria-label={`Change group for ${t.name} in ${tournament(t.tournamentId)?.name}`}
                          disabled={!!groupLock}
                          title={groupLock || "Move this team or swap with a team in another group"}
                          onClick={() => open({ type: "groups", tournament: tournament(t.tournamentId), team: t })}
                        >
                          <Pencil size={14} />Change group
                        </Button>
                      ) : null}
                      <Button variant="ghost"
                        className="text-btn"
                        aria-label={`Edit ${t.name}`}
                        disabled={namesLocked}
                        title={namesLocked ? "Player names are locked after the tournament ends" : "Edit player names"}
                        onClick={() => open({ type: "team", team: t })}
                      >
                        <Pencil size={16} /> Edit players
                      </Button>
                      {groupLock && <small className="lock-reason">{groupLock}</small>}
                      {namesLocked && <small className="lock-reason">Player names are locked after the tournament ends.</small>}
                    </TableCell>
                  )}
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Empty title={filtered ? "No teams found" : "Make room for your competitors"} action={filtered && <Button variant="outline" onClick={reset}>Reset filters</Button>}>
          {filtered ? "Try another player name or change your filters." : "Create a tournament, then add teams manually or import a CSV / Excel workbook."}
        </Empty>
      )}
    </section>
  );
}

export default Teams;
