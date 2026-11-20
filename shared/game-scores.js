export function gameWinner(score, rules) {
  if (!Array.isArray(score) || score.length !== 2 ||
    !score.every(n => Number.isInteger(n) && n >= 0 && n <= rules.cap))
    throw new Error(`Scores must be whole numbers from 0 to ${rules.cap}.`);
  const hi = Math.max(...score), lo = Math.min(...score);
  const valid = rules.goldenPoint
    ? hi === rules.points && lo < rules.points
    : hi !== lo && hi >= rules.points && (hi === rules.cap
      ? lo >= rules.cap - 2
      : hi - lo >= 2 && (hi === rules.points || hi - lo === 2));
  if (!valid) throw new Error(
    `Invalid game ${score.join("–")}. ${rules.goldenPoint ? `First to ${rules.points}, golden point (no deuce).` : `Play to ${rules.points}, win by two, capped at ${rules.cap}.`}`,
  );
  return score[0] > score[1] ? 0 : 1;
}

export function gameTally(games, rules) {
  const wins = [0, 0];
  const needed = Math.ceil(rules.bestOf / 2);
  for (const score of games) {
    if (wins.includes(needed)) throw new Error("Remove games played after the match was already won.");
    wins[gameWinner(score, rules)]++;
  }
  return { wins, complete: wins.includes(needed) };
}
