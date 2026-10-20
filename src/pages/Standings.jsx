import React from "react";

import { standings, groupName } from "../utils.js";

import { PLAYOFF_STAGE, directPlaces, isPlayoffFormat, qualificationStatus, scoringRules, scoringLabel } from "../../shared/format.js";

import { useDesk } from "../hooks/useDesk.jsx";
import { Pill, Empty } from "../components/common.jsx";
import MatchCard from "../components/MatchCard.jsx";

import StageActions from "../components/StageActions.jsx";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table.jsx";

function Standings() {
  const { state, filter, categorySelect } = useDesk();
  const ts = state.tournaments.filter(
    (t) => filter === "all" || filter === t.id,
  );
  return (
    <>
      <div className="toolbar standalone">
        {categorySelect}
        <span className="muted">
          Ranked by wins → game difference → point difference → seed.
        </span>
      </div>
      <StageActions />
      {ts.length ? (
        ts.map((t) => (
          <section key={t.id} className="standing-section">
            <div className="section-heading">
              <h2>{t.name}</h2>
              <Pill>{isPlayoffFormat(t) ? `Top ${directPlaces(t)} direct + playoffs` : `${t.qualify} qualify per group`}</Pill>
            </div>
            <div className="standings-grid">
              {Array.from({ length: t.groups }, (_, g) => {
                const rows = standings(state, t.id, g);
                return (
                  <div className="panel" key={g}>
                    <div className="panel-heading">
                      <h3>{groupName(g)}</h3>
                      <span className="muted">{rows.length} teams</span>
                    </div>
                    {rows.length ? (
                      <div className="table-scroll">
                        <Table className="standing-table">
                          <TableHeader>
                            <TableRow>
                              <TableHead>#</TableHead>
                              <TableHead>TEAM</TableHead>
                              <TableHead>P</TableHead>
                              <TableHead>W</TableHead>
                              <TableHead>L</TableHead>
                              <TableHead>GD</TableHead>
                              <TableHead>PD</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((r, i) => (
                              <TableRow
                                key={r.id}
                                className={["direct", "qualified"].includes(qualificationStatus(state, t, r, i)) ? "qualified" : qualificationStatus(state,t,r,i) === "playoff" ? "playoff-place" : ""}
                              >
                                <TableCell>{i + 1}</TableCell>
                                <TableCell>
                                  <strong>{r.name}</strong>
                                  {isPlayoffFormat(t) && <small className={`qualification-marker ${qualificationStatus(state,t,r,i)}`}>{({direct:"Direct place",playoff:"Qualification playoff",qualified:"Qualified via playoff",eliminated:"Eliminated in playoff"})[qualificationStatus(state,t,r,i)]}</small>}
                                </TableCell>
                                <TableCell>{r.played}</TableCell>
                                <TableCell>{r.wins}</TableCell>
                                <TableCell>{r.losses}</TableCell>
                                <TableCell>{r.gameDiff}</TableCell>
                                <TableCell>{r.pointDiff}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="padded muted">
                        Groups are assigned when you generate fixtures.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="standings-note">
              <i className="dot" /> {isPlayoffFormat(t) ? "Green: direct places or playoff winners. Amber: playoff places. League rankings stay unchanged after playoffs." : "Shaded places qualify once the league is complete."} Seed breaks any remaining tie.
            </p>
            {state.matches.some(m => m.tournamentId === t.id && m.stage === PLAYOFF_STAGE) && <section className="organizer-playoffs">
              <h3>Qualification playoffs</h3><p className="muted">{scoringLabel(scoringRules(t, PLAYOFF_STAGE))}. Winners fill the named knockout slots.</p>
              <div className="organizer-playoff-groups">{Array.from({ length: t.groups }, (_, g) => g).map(g => <div key={g}><h4>{groupName(g)}</h4>{state.matches.filter(m => m.tournamentId === t.id && m.stage === PLAYOFF_STAGE && m.group === g).map(m => <MatchCard key={m.id} m={m} compact/>)}</div>)}</div>
            </section>}
            {state.matches.some(
              (m) => m.tournamentId === t.id && m.stage !== "League" && m.stage !== PLAYOFF_STAGE,
            ) && (
              <div className="bracket">
                {[
                  ...new Set(
                    state.matches
                      .filter(
                        (m) => m.tournamentId === t.id && m.stage !== "League" && m.stage !== PLAYOFF_STAGE,
                      )
                      .map((m) => m.round),
                  ),
                ]
                  .sort()
                  .map((round) => (
                    <div className="bracket-round" key={round}>
                      <h3>
                        {
                          state.matches.find(
                            (m) =>
                              m.tournamentId === t.id &&
                              m.stage !== "League" && m.stage !== PLAYOFF_STAGE &&
                              m.round === round,
                          )?.stage
                        }
                      </h3>
                      <div>
                        {state.matches
                          .filter(
                            (m) =>
                              m.tournamentId === t.id &&
                              m.stage !== "League" && m.stage !== PLAYOFF_STAGE &&
                              m.round === round,
                          )
                          .map((m) => (
                            <MatchCard key={m.id} m={m} compact />
                          ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>
        ))
      ) : (
        <Empty title="Every point will count">
          Standings and brackets appear here once you create a tournament.
        </Empty>
      )}
    </>
  );
}

export default Standings;
