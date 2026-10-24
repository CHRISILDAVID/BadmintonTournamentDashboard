import { scoringRules } from "../../shared/format.js";

// Keep the current game's points distinct from the games won in the match.
export function liveScoreCard(match, record, tournament, connected, now = Date.now()) {
  const score = record?.score;
  const rules = score?.rules || (match.scoring || tournament ? scoringRules(tournament, match.stage, match) : null);
  const games = score?.games || [];
  const gameNumber = score ? (score.complete ? games.length : games.length + 1) : 1;
  const points = score ? (score.complete ? games.at(-1) : score.points) : null;
  const needed = rules ? Math.ceil(rules.bestOf / 2) : null;
  let status = { label: "Live", tone: "live", note: "" };
  if (!connected) status = { label: "Display offline", tone: "warning", note: score ? "Showing last received score" : "Waiting for connection and first score" };
  else if (record?.invalidated) status = { label: "Score under review", tone: "warning", note: "Showing last received score · Awaiting organizer review" };
  else if (!score) status = { label: "Awaiting score", tone: "waiting", note: "The umpire has not started scoring yet" };
  else if (score.complete) status = { label: score.confirmed ? "Final" : "Result pending", tone: "complete", note: score.confirmed ? "" : "Awaiting umpire confirmation" };
  else if (record.control === "available") status = { label: "Awaiting umpire", tone: "waiting", note: "Last saved score · Scoring control is available" };
  else if (score.paused) status = { label: "Paused", tone: "waiting", note: "Play is paused" };
  else if (!record.contactAt || now - record.contactAt > 45000) status = { label: "Updates delayed", tone: "warning", note: "Showing last received score" };
  const pointLabels = [0, 1].map(side => {
    if (!score || score.complete || score.paused || record.invalidated || record.control === "available") return "";
    const next = points[side] + 1, opponent = points[1 - side];
    const winsNextPoint = rules.goldenPoint ? next >= rules.points : next >= rules.points && (next - opponent >= 2 || next >= rules.cap);
    return winsNextPoint ? (score.wins[side] + 1 >= needed ? "Match point" : "Game point") : "";
  });
  return { rules, gameNumber, points, games, wins: score?.wins || null, needed,
    showGamesWon: !!rules && rules.bestOf > 1, pointLabels, status };
}
