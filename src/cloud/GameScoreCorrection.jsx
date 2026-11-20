import React, { useState } from "react";
import { reduceScore } from "../../shared/live-scoring.js";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog.jsx";

export default function GameScoreCorrection({ score, gameIndex, sides, teamName, busy, blocked, error, save, close }) {
  const original = score.games[gameIndex];
  const [draft, setDraft] = useState(() => original.map(String));
  const [confirmed, setConfirmed] = useState(false);
  const points = draft.map(value => value === "" ? NaN : Number(value));
  const changed = points.some((value, side) => value !== original[side]);
  const winnerChanged = (points[0] > points[1]) !== (original[0] > original[1]);
  const correction = { gameIndex, score: points, confirmWinnerChange: confirmed };
  let preview, invalid;
  if (changed && draft.every(value => value !== "")) {
    try {
      preview = reduceScore(score, { type: "correctGame", ...correction, confirmWinnerChange: true });
    } catch (error) {
      invalid = error.message;
    }
  }
  const canSave = !busy && !blocked && preview && (!winnerChanged || confirmed);
  return <Dialog open onOpenChange={open => { if (!open && !busy) close(); }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Correct Game {gameIndex + 1} score</DialogTitle>
        <DialogDescription>Enter the final points for this game. The scorer keeps any points already played in the current game.</DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={async event => {
        event.preventDefault();
        if (canSave && await save(correction)) close();
      }}>
        {sides.map(side => <label key={side} className="grid gap-1">
          <span>{teamName(side)}</span>
          <Input type="number" inputMode="numeric" required step="1" min="0" max={score.rules.cap}
            value={draft[side]} disabled={busy} onChange={event => {
              const value = event.target.value;
              setDraft(draft.map((current, index) => index === side ? value : current));
              setConfirmed(false);
            }}/>
        </label>)}
        {(invalid || error) && <p role="alert" className="score-error">{invalid || error}</p>}
        {preview && winnerChanged && <div className="score-correction-warning">
          <p>New games-won tally: {sides.map(side => preview.wins[side]).join("–")}. {preview.complete
            ? "The match would be complete."
            : `Game ${preview.games.length + 1} of ${preview.rules.bestOf} ${score.complete ? "would be needed" : "would continue"}.`}</p>
          <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)}/> Confirm winner change</label>
        </div>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={close}>Cancel</Button>
          <Button type="submit" disabled={!canSave}>Save correction</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
