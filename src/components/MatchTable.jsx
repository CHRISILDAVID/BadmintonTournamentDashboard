import React from "react";

import { groupName, time } from "../utils.js";

import { pendingOpponent } from "../../shared/format.js";

import { useDesk } from "../hooks/useDesk.jsx";
import { Pill, Empty } from "../components/common.jsx";

import { Button } from "../components/ui/button.jsx";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table.jsx";

function MatchTable({ matches, history = false }) {
  const { admin, team, tournament, open } = useDesk();
  return matches.length ? (
    <div className="table-scroll">
      <Table className="match-table">
        <TableHeader>
          <TableRow>
            <TableHead>MATCH / TOURNAMENT</TableHead>
            <TableHead>STAGE</TableHead>
            <TableHead>{history ? "RESULT" : "COURT / TIME"}</TableHead>
            <TableHead>STATUS</TableHead>
            {admin && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {matches.map((m) => (
            <TableRow key={m.id}>
              <TableCell>
                <strong>
                  {team(m.a)?.name || pendingOpponent(m, "a")}{" "}
                  <span className="versus">vs</span>{" "}
                  {team(m.b)?.name || pendingOpponent(m, "b")}
                </strong>
                <small>{tournament(m.tournamentId)?.name}</small>
              </TableCell>
              <TableCell>
                {m.stage}
                <small>{groupName(m.group)}</small>
              </TableCell>
              <TableCell>
                {m.status === "completed" ? (
                  <>
                    <strong>
                      {m.games.map((g) => g.join("–")).join(" / ")}
                    </strong>
                    <small>{team(m.winner)?.name} {m.bye ? "advances by bye" : "won"}</small>
                  </>
                ) : (
                  <>
                    <strong>{m.status === "upcoming" ? (m.a && m.b ? "Ready to start" : "Awaiting opponents") : `Court ${m.court}`}</strong>
                    {m.scheduled && <small>Planned {time(m.scheduled)}</small>}
                    {m.status === "upcoming" && <small>Court assigned at start</small>}
                  </>
                )}
              </TableCell>
              <TableCell>
                <Pill tone={m.status === "live" ? "green" : ""}>
                  {m.status === "upcoming"
                    ? "Upcoming"
                    : m.status === "completed"
                      ? (m.bye ? "Bye" : "Completed")
                      : "On court"}
                </Pill>
              </TableCell>
              {admin && (
                <TableCell className="match-actions-cell">
                  <Button variant="outline"
                    className="btn"
                    disabled={m.status === "upcoming" && (!m.a || !m.b)}
                    aria-label={`${m.status === "upcoming" ? "Start game" : m.status === "live" ? "Record result" : (m.bye ? "View bye" : "Edit result")}: ${team(m.a)?.name || "match"} vs ${team(m.b)?.name || "qualifier"}`}
                    onClick={() => open({ type: "match", matchId: m.id })}
                  >
                    {m.status === "upcoming" ? "Start game" : m.status === "live" ? "Record result" : (m.bye ? "View bye" : "Edit result")}
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ) : (
    <Empty title={history ? "No results yet" : "No matches here yet"}>
      {history
        ? "Completed matches will appear here automatically."
        : "Add teams and generate fixtures from Tournaments."}
    </Empty>
  );
}

export default MatchTable;
