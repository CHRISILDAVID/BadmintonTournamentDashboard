import React from "react";

import { groupName, time } from "../utils.js";

import { pendingOpponent } from "../../shared/format.js";
import { matchCategory, matchStageLabel } from "../../shared/matches.js";

import { useDesk } from "../hooks/useDesk.jsx";
import { Pill, Empty } from "../components/common.jsx";

import { Button } from "../components/ui/button.jsx";
import { cloudEnabled } from "../cloud/storage.js";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table.jsx";

function MatchTable({ matches, history = false, onScore }) {
  const { canManageMatches, admin, team, tournament, open } = useDesk();
  return matches.length ? (
    <div className="table-scroll">
      <Table className="match-table" aria-label={history ? "Completed matches" : "Event matches"}>
        <TableHeader>
          <TableRow>
            <TableHead>MATCH / TOURNAMENT</TableHead>
            <TableHead>STAGE</TableHead>
            <TableHead>{history ? "RESULT" : "COURT / TIME"}</TableHead>
            <TableHead>STATUS</TableHead>
            {canManageMatches && <TableHead><span className="sr-only">Actions</span></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {matches.map((m) => (
            <TableRow key={m.id} data-match-status={m.status}>
              <TableCell>
                <strong className="match-opponents">
                  <span>{team(m.a)?.name || pendingOpponent(m, "a")}</span>{" "}
                  <span className="versus">vs</span>{" "}
                  <span>{team(m.b)?.name || pendingOpponent(m, "b")}</span>
                </strong>
                <small>{matchCategory(m, tournament(m.tournamentId))}</small>
              </TableCell>
              <TableCell>
                {matchStageLabel(m)}
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
              {canManageMatches && (
                <TableCell className="match-actions-cell">
                  <div className="match-action-buttons">
                  {cloudEnabled() && m.status === "live" && <Button variant="default" className="btn primary"
                    aria-label={`Open scorer: ${team(m.a)?.name} vs ${team(m.b)?.name}`}
                    onClick={() => onScore ? onScore(m) : open({ type: "scorer", matchId: m.id })}>Open scorer</Button>}
                  {(admin || m.status === "upcoming") && <Button variant={m.status === "upcoming" ? "default" : "outline"}
                    className="btn"
                    disabled={m.status === "upcoming" && (!m.a || !m.b)}
                    aria-label={`${m.status === "upcoming" ? "Start game" : m.status === "live" ? "Record result" : (m.bye ? "View bye" : "Edit result")}: ${team(m.a)?.name || "match"} vs ${team(m.b)?.name || "qualifier"}`}
                    onClick={() => open({ type: "match", matchId: m.id })}
                  >
                    {m.status === "upcoming" ? "Start game" : m.status === "live" ? "Record result" : (m.bye ? "View bye" : "Edit result")}
                  </Button>}
                  </div>
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
        : admin ? "Create a custom game, or add teams and generate fixtures from Tournaments." : "Matches will appear when the organizer creates games."}
    </Empty>
  );
}

export default MatchTable;
