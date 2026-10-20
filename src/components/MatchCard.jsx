import React from "react";
import { ArrowUpRight, Check } from "lucide-react";
import { groupName, time } from "../utils.js";

import { PLAYOFF_STAGE, pendingOpponent } from "../../shared/format.js";

import { useDesk } from "../hooks/useDesk.jsx";
import { Pill } from "../components/common.jsx";

import { Button } from "../components/ui/button.jsx";

function MatchCard({ m, compact = false }) {
  const { admin, team, tournament, open } = useDesk();
  const t = tournament(m.tournamentId),
    a = team(m.a),
    b = team(m.b);
  return (
    <div className={`match-card ${m.status} ${compact ? "compact" : ""}`}>
      <div className="match-meta">
        <span className="court-heading">
          {m.status === "live"
            ? `COURT ${String(m.court).padStart(2, "0")}`
            : t?.name}
        </span>
        <Pill tone={m.status === "live" ? "green" : ""}>
          {m.status === "live" ? (
            <>
              <i className="dot" />
              ON COURT
            </>
          ) : m.status === "completed" ? (
            m.bye ? "BYE" : "FINAL SCORE"
          ) : (
            m.stage
          )}
        </Pill>
      </div>
      <div className="match-sub">
        {m.stage === PLAYOFF_STAGE ? `${groupName(m.group)} · ${m.playoffRanks.join(" vs ")} → slot ${m.qualifyingSlot}` : m.status === "live"
          ? `${t?.name} / ${groupName(m.group) || m.stage}`
          : groupName(m.group) || m.stage}
      </div>
      <div className="opponents">
        {[a, b].map((t, i) => (
          <div
            className={`opponent ${m.winner === t?.id ? "winner" : ""}`}
            key={i}
          >
            <span className="team-avatar">
              {t?.name
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("") || "?"}
            </span>
            <div>
              <strong>{t?.name || pendingOpponent(m, i === 0 ? "a" : "b")}</strong>
              {!compact && (
                <small>
                  {t ? `Seed ${t.seed}` : "Winner of previous round"}
                </small>
              )}
            </div>
            {m.status === "completed" && (
              <span className="game-scores">
                {m.games.map((g, j) => (
                  <b key={j} className={g[i] > g[1 - i] ? "won" : ""}>
                    {g[i]}
                  </b>
                ))}
                {m.winner === t?.id && <Check size={15} />}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="match-foot">
        <span>
          <span className="tiny-court" />
          {m.status === "live"
            ? `Court ${m.court}`
            : m.status === "completed"
              ? time(m.completedAt)
              : m.scheduled
                ? time(m.scheduled)
                : "Ready to start"}
        </span>
        {admin && (
          <Button variant="ghost"
            className="text-btn"
            disabled={m.status === "upcoming" && (!m.a || !m.b)}
            onClick={() => open({ type: "match", matchId: m.id })}
          >
            {m.status === "live"
              ? "Record result"
              : m.status === "completed"
                ? (m.bye ? "View bye" : "Edit result")
                : "Start game"}
            <ArrowUpRight size={15} />
          </Button>
        )}
      </div>
    </div>
  );
}

export default MatchCard;
