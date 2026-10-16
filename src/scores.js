export function scoreText(value) {
  if (!/^\d*$/.test(value)) return null;
  return value.replace(/^0+(?=\d)/, "");
}

export function stepScore(value, change, cap) {
  return String(Math.max(0, Math.min(cap, Number(value || 0) + change)));
}

export function finalScores(games) {
  if (games.some((game) => game.some((value) => value === "")))
    throw new Error(
      "Enter both scores for every game. Enter 0 for a score of zero.",
    );
  return games.map((game) => game.map(Number));
}
