import React, { useEffect, useRef, useState } from "react";
import { Trophy, Plus, Check, Play, X } from "lucide-react";
import { groupName, time } from "../utils.js";

import ScoreInput from "../ScoreInput.jsx";
import { finalScores } from "../scores.js";

import { pendingOpponent, scoringRules, scoringLabel } from "../../shared/format.js";
import { isFriendly, matchCategory } from "../../shared/matches.js";

import { useDesk } from "../hooks/useDesk.jsx";
import { Pill, Empty, Field } from "../components/common.jsx";

import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";

import { NativeSelect } from "../components/ui/native-select.jsx";

function MatchForm() {
  const { state, modal, admin } = useDesk();
  if (!state.matches.some(m => m.id === modal.matchId)) return <Empty title="This match was removed">Its tournament or fixtures were removed on another device.</Empty>;
  if (!admin && state.matches.find(m => m.id === modal.matchId).status !== "upcoming") return <Empty title="Results are read only">Use the match scorer to record a live game. Ask an organizer to correct a completed result.</Empty>;
  return <MatchEditor />;
}
function MatchEditor() {
  const { state, modal, busy, team, tournament, open, act, setPage, setModal, setError } = useDesk();
  const m = state.matches.find((m) => m.id === modal.matchId),
    t = tournament(m.tournamentId);
  const rules = scoringRules(t, m.stage, m);
  const [court, setCourt] = useState(
      Array.from({ length: state.event.courts }, (_, i) => i + 1).find(
        (c) => !state.matches.some((x) => x.status === "live" && x.court === c),
      ) || 1,
    ),
    [scheduled, setScheduled] = useState(m.scheduled || ""),
    [games, setGames] = useState(m.games.length ? m.games.map(game => game.map(String)) : [["", ""]]);
  const [confirmCorrection, setConfirmCorrection] = useState(false);
  const [scoreError, setScoreError] = useState("");
  const resultRevision = useRef(state.revision);
  useEffect(() => {
    if (modal?.conflictRevision) {
      resultRevision.current = modal.conflictRevision;
      setConfirmCorrection(false);
    }
  }, [modal?.conflictRevision]);
  function updateGameScore(index, side, value) {
    setConfirmCorrection(false);
    setError("");
    setScoreError("");
    setGames(current => current.map((game,i) => i === index ? game.map((score,j) => j === side ? value : score) : game));
  }
  return (
    <>
      <div className="match-dialog-meta">
        <Pill>{matchCategory(m, t)}</Pill>
        <span>
          {m.stage}{groupName(m.group) ? ` · ${groupName(m.group)}` : ""} · {scoringLabel(rules)}
        </span>
      </div>
      <div className="scoreboard">
        {[m.a, m.b].map((tid, i) => (
          <div key={i}>
            <strong>{team(tid)?.name || pendingOpponent(m, i === 0 ? "a" : "b")}</strong>
            <small>{isFriendly(m) ? (m.size === 1 ? "Singles" : "Doubles") : team(tid) ? `Seed ${team(tid).seed}` : "Winner of previous round"}</small>
          </div>
        ))}
      </div>
      {m.status === "upcoming" ? (
        <>
          <p className="help-text">{m.a && m.b ? "Choose a free court and start when both teams are ready." : "Both opponents must qualify before this game can start."}</p>
          <Field label="Court">
            <NativeSelect value={court} onChange={(e) => setCourt(+e.target.value)}>
              {Array.from({ length: state.event.courts }, (_, i) => i + 1).map(
                (c) => (
                  <option
                    key={c}
                    value={c}
                    disabled={state.matches.some(
                      (x) => x.status === "live" && x.court === c,
                    )}
                  >
                    Court {c}
                    {state.matches.some(
                      (x) => x.status === "live" && x.court === c,
                    )
                      ? " · occupied"
                      : ""}
                  </option>
                ),
              )}
            </NativeSelect>
          </Field>
          <Field label="Optional scheduled start">
            <Input
              type="time"
              value={scheduled}
              onChange={(e) => setScheduled(e.target.value)}
            />
          </Field>
          <div className="modal-actions">
            <Button variant="outline"
              className="btn"
              disabled={busy}
              onClick={async () => {
                if (await act("schedule", { matchId: m.id, scheduled }))
                  setModal(null);
              }}
            >
              Save schedule
            </Button>
            <Button variant="default"
              className="btn primary"
              disabled={busy || !m.a || !m.b || state.matches.some(x => x.status === "live" && x.court === court)}
              onClick={async () => {
                if (
                  await act("start", { matchId: m.id, court }, "Match started")
                )
                  setModal(null);
              }}
            >
              <Play size={16} />
              Start game
            </Button>
          </div>
        </>
      ) : !m.bye && (m.status === "live" || m.status === "completed") ? (
        <>
          {m.status === "live" && <div className="return-match"><p>Players not ready and play has not begun?</p><Button variant="ghost" className="text-btn" disabled={busy} onClick={() => open({type:"returnMatch", matchId:m.id})}>Undo start and free court</Button></div>}
          <h3>{m.status === "completed" ? "Edit final result" : "Record the final result"}</h3>
          <p className="help-text">
            Enter each completed game in opponent order above. {isFriendly(m) ? "Saving adds the result to friendly game history." : "Saving updates the result and standings."}
          </p>
          {m.status === "completed" && <label className="help-text">
            <Input type="checkbox" checked={confirmCorrection} onChange={e => setConfirmCorrection(e.target.checked)} />
            {isFriendly(m) ? "I confirm this correction to the friendly game result." : "I confirm this correction. Standings and the draw will update. Later games whose opponents change will return to upcoming, clearing their scores and freeing any occupied courts. Unaffected results stay saved."}
          </label>}
          <div className="game-inputs">
            {scoreError && <p id="match-score-error" className="sr-only">{scoreError}</p>}
            {games.map((g, i) => (
              <div className="game-score-row" key={i}>
                <div className="game-score-heading">
                  <span>Game {i + 1}</span>
                  {i === games.length - 1 && i > 0 && <Button variant="ghost" type="button" className="icon-btn" disabled={busy} aria-label="Remove last game" onClick={() => setGames(games.slice(0,-1))}><X size={16}/></Button>}
                </div>
                <div className="game-score-sides">
                  <ScoreInput label={`Game ${i + 1} first team`} describedBy={scoreError ? "match-score-error" : undefined} invalid={!!scoreError && g[0] === ""} value={g[0]} cap={rules.cap} disabled={busy} onChange={value => updateGameScore(i,0,value)}/>
                  <span className="score-separator">&ndash;</span>
                  <ScoreInput label={`Game ${i + 1} second team`} describedBy={scoreError ? "match-score-error" : undefined} invalid={!!scoreError && g[1] === ""} value={g[1]} cap={rules.cap} disabled={busy} onChange={value => updateGameScore(i,1,value)}/>
                </div>
              </div>
            ))}
          </div>
          <div className="modal-actions">
            <Button variant="outline"
              className="btn"
              disabled={games.length >= rules.bestOf}
              onClick={() => setGames([...games, ["", ""]])}
            >
              <Plus size={15} />
              Add game
            </Button>
            <Button variant="default"
              className="btn primary"
              disabled={busy || (m.status === "completed" && !confirmCorrection)}
              onClick={async () => {
                let completedGames;
                try { completedGames = finalScores(games); }
                catch (error) { setScoreError(error.message); setError(error.message); return; }
                if (
                  await act(
                    m.status === "completed" ? "correctResult" : "finish",
                    { matchId: m.id, games: completedGames },
                    m.status === "completed" ? (isFriendly(m) ? "Friendly result corrected" : "Result corrected; standings and draw updated") : "Result recorded",
                    resultRevision.current,
                  )
                ) {
                  const leagueComplete = m.status !== "completed" && m.stage === "League" && state.matches
                    .filter(x => x.tournamentId === t.id && x.stage === "League" && x.id !== m.id)
                    .every(x => x.status === "completed");
                  if (leagueComplete) {
                    setPage("Matches", { filter: t.id, matchQuery: "", matchStatus: "all", matchStage: "all" });
                    open({ type: "knockouts", tournament: t });
                  } else setModal(null);
                }
              }}
            >
              {m.status === "completed" ? "Save corrected result" : "Confirm final result"}
              <Check size={16} />
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="final-result">
            <Trophy />
            <h2>{team(m.winner)?.name} {m.bye ? "advances by bye" : "wins"}</h2>
            <p>{m.games.map((g) => g.join(" – ")).join(" / ")}</p>
            <small>Completed {time(m.completedAt)}</small>
          </div>
        </>
      )}
    </>
  );
}

export default MatchForm;
