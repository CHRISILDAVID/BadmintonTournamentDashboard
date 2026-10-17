export const PLAYOFF_STAGE = "Qualification playoff";

export const qualificationFormats = {
  direct: { label: "Direct qualification" },
  intermediate: {
    label: "Intermediate: top 3 + fourth-place playoff",
    teamsPerGroup: 5,
    direct: 3,
    pairs: [[4, 5, 4]],
  },
  beginner: {
    label: "Beginner: top 2 + third/fourth-place playoffs",
    teamsPerGroup: 6,
    direct: 2,
    pairs: [
      [3, 6, 3],
      [4, 5, 4],
    ],
  },
};

export const qualificationFormat = (t) =>
  qualificationFormats[t?.qualification || "direct"];
export const isPlayoffFormat = (t) => !!qualificationFormat(t)?.pairs;
export const directPlaces = (t) => qualificationFormat(t)?.direct ?? t.qualify;

export function scoringRules(t, stage = "League") {
  const key =
    stage === "League"
      ? "league"
      : stage === PLAYOFF_STAGE
        ? "playoff"
        : "knockout";
  return (
    t.scoring?.[key] || {
      points: t.points,
      cap: t.cap,
      bestOf: t.bestOf,
      goldenPoint: false,
    }
  );
}

export function scoringLabel(rules) {
  return `${rules.points} points, ${rules.goldenPoint ? "golden point" : `deuce to ${rules.cap}`} · Best of ${rules.bestOf}`;
}

export function knockoutStage(entrants) {
  return (
    { 2: "Final", 4: "Semifinal", 8: "Quarterfinal" }[entrants] ||
    `Round of ${entrants}`
  );
}

export function playoffPreset(mode, groups = 2) {
  return {
    qualification: mode,
    size: 2,
    groups,
    qualify: 4,
    scoring: {
      league: { points: 15, cap: 15, goldenPoint: true, bestOf: 1 },
      playoff: { points: 15, cap: 15, goldenPoint: true, bestOf: 1 },
      knockout: { points: 21, cap: 30, goldenPoint: false, bestOf: 1 },
    },
  };
}

export function pendingOpponent(match, side) {
  return match[`${side}Source`]?.label || "Awaiting qualifier";
}

// Playoffs do not alter the league ranking: winners earn named draw slots.
export function qualificationStatus(state, t, row, rank) {
  if (!isPlayoffFormat(t)) return rank < t.qualify ? "direct" : "";
  if (rank < directPlaces(t)) return "direct";
  const playoff = state.matches.find(
    (m) =>
      m.tournamentId === t.id &&
      m.stage === PLAYOFF_STAGE &&
      (m.a === row.id || m.b === row.id),
  );
  if (playoff?.winner)
    return playoff.winner === row.id ? "qualified" : "eliminated";
  return "playoff";
}
