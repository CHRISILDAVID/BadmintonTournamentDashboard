import React from "react";
import { Plus, Upload, Pencil } from "lucide-react";
import { groupName } from "../utils.js";

import { tournamentProgress } from "../../shared/matches.js";

import { groupEditLockReason, hasLeagueDraw, leagueEntryLockReason } from "../../shared/groups.js";

import { useDesk } from "../hooks/useDesk.jsx";
import { Empty } from "../components/common.jsx";

import { Button } from "../components/ui/button.jsx";
import SearchField from "../components/SearchField.jsx";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table.jsx";

function Teams() {
  const { state, filter, admin, categorySelect, tournament, open, setPage, teamQuery: query, setTeamQuery: setQuery } = useDesk();
  const selectedTournament = state.tournaments.find((t) => t.id === filter);
  const groupLock = selectedTournament ? groupEditLockReason(state, filter) : "";
  const teams = state.teams.filter(
    (t) =>
      (filter === "all" || t.tournamentId === filter) &&
      `${t.name} ${t.players.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <section className="panel teams-panel">
      <div className="toolbar teams-toolbar">
        <SearchField placeholder="Search teams or players…" value={query} onChange={setQuery}/>
        <label className="filter-control"><span className="control-label">Tournament</span>{categorySelect}</label>
        {selectedTournament?.groups > 1 && (
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
            {selectedTournament && hasLeagueDraw(state, filter) && !leagueEntryLockReason(state, filter) && <Button variant="outline" className="btn" onClick={() => open({ type: "import", newGroup: true })}>
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
      <div className="results-summary"><span role="status">{teams.length} of {state.teams.filter(t => filter === "all" || t.tournamentId === filter).length} teams{query && <> · Search: “{query}”</>}</span>{(query || filter !== "all") && <Button variant="ghost" onClick={() => setPage("Teams & players", { filter: "all", teamQuery: "" })}>Reset filters</Button>}</div>
      {selectedTournament?.groups > 1 && <p className="group-edit-hint">
        {groupLock || "Select teams in Edit groups to move or swap them. Editing locks after the first completed match."}
      </p>}
      {teams.length ? (
        <div className="table-scroll">
          <Table className="teams-table" aria-label="Teams and players">
            <TableHeader>
              <TableRow>
                <TableHead>SEED</TableHead>
                <TableHead>TEAM / PLAYER</TableHead>
                <TableHead>TOURNAMENT</TableHead>
                <TableHead>GROUP</TableHead>
                {admin && <TableHead><span className="sr-only">Actions</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((t) => (
                <TableRow key={t.id}>
                  <TableCell data-label="Seed">
                    <span className="seed">{t.seed}</span>
                  </TableCell>
                  <TableCell>
                    <strong>{t.name}</strong>
                  </TableCell>
                  <TableCell data-label="Tournament">{tournament(t.tournamentId)?.name}</TableCell>
                  <TableCell data-label="Group">{groupName(t.group) || "Not assigned"}</TableCell>
                  {admin && (
                    <TableCell>
                      {t.group != null ? (
                        <Button variant="ghost"
                          className="text-btn"
                          aria-label={`Change group for ${t.name} in ${tournament(t.tournamentId)?.name}`}
                          disabled={!!groupEditLockReason(state, t.tournamentId)}
                          title={groupEditLockReason(state, t.tournamentId) || "Move this team or swap with a team in another group"}
                          onClick={() => open({ type: "groups", tournament: tournament(t.tournamentId), team: t })}
                        >
                          <Pencil size={14} />Change group
                        </Button>
                      ) : null}
                      <Button variant="ghost"
                        className="text-btn"
                        aria-label={`Edit ${t.name}`}
                        disabled={!!tournamentProgress(state, t.tournamentId).champion}
                        title={tournamentProgress(state, t.tournamentId).champion ? "Player names are locked after the tournament ends" : "Edit player names"}
                        onClick={() => open({ type: "team", team: t })}
                      >
                        <Pencil size={16} /> Edit players
                      </Button>
                      {groupEditLockReason(state, t.tournamentId) && <small className="lock-reason">{groupEditLockReason(state, t.tournamentId)}</small>}
                      {tournamentProgress(state, t.tournamentId).champion && <small className="lock-reason">Player names are locked after the tournament ends.</small>}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Empty title={query || filter !== "all" ? "No teams found" : "Make room for your competitors"} action={(query || filter !== "all") && <Button variant="outline" onClick={() => setPage("Teams & players", { filter: "all", teamQuery: "" })}>Reset filters</Button>}>
          {query || filter !== "all" ? "Try another player name or reset your tournament filter." : "Create a tournament, then add teams manually or import a CSV / Excel workbook."}
        </Empty>
      )}
    </section>
  );
}

export default Teams;
