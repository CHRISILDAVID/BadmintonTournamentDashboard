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
  const { state, filter, admin, categorySelect, tournament, open, teamQuery: query, setTeamQuery: setQuery } = useDesk();
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
    <section className="panel">
      <div className="toolbar">
        <SearchField placeholder="Search teams or players…" value={query} onChange={setQuery}/>
        {categorySelect}
        {selectedTournament?.groups > 1 && (
          <Button variant="outline" className="btn" disabled={!!groupLock} title={groupLock || "Swap teams between groups"}
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
      {selectedTournament?.groups > 1 && <p className="group-edit-hint">
        {groupLock || "Edit groups by swapping teams. Group sizes stay fixed; editing locks after the first completed match."}
      </p>}
      {teams.length ? (
        <div className="table-scroll">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SEED</TableHead>
                <TableHead>TEAM / PLAYER</TableHead>
                <TableHead>TOURNAMENT</TableHead>
                <TableHead>GROUP</TableHead>
                {admin && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <span className="seed">{t.seed}</span>
                  </TableCell>
                  <TableCell>
                    <strong>{t.name}</strong>
                  </TableCell>
                  <TableCell>{tournament(t.tournamentId)?.name}</TableCell>
                  <TableCell>{groupName(t.group) || "Not assigned"}</TableCell>
                  {admin && (
                    <TableCell>
                      {t.group != null ? (
                        <Button variant="ghost"
                          className="text-btn"
                          aria-label={`Change group for ${t.name} in ${tournament(t.tournamentId)?.name}`}
                          disabled={!!groupEditLockReason(state, t.tournamentId)}
                          title={groupEditLockReason(state, t.tournamentId) || "Swap with a team in another group"}
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
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Empty title="Make room for your competitors">
          Create a tournament, then add teams manually or import a CSV / Excel
          workbook.
        </Empty>
      )}
    </section>
  );
}

export default Teams;
