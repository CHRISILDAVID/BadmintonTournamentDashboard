// Temporary testing helper. Generates completed games using the stage's rules.
export function randomGames(rules, random = Math.random) {
  const pick = (values) => values[Math.floor(random() * values.length)];
  const winningScores = [];
  if (rules.goldenPoint) {
    for (let loser = 0; loser < rules.points; loser++)
      winningScores.push([rules.points, loser]);
  } else {
    for (let loser = 0; loser <= rules.points - 2; loser++)
      winningScores.push([rules.points, loser]);
    for (let winner = rules.points + 1; winner < rules.cap; winner++)
      winningScores.push([winner, winner - 2]);
    winningScores.push([rules.cap, rules.cap - 2], [rules.cap, rules.cap - 1]);
  }
  const games = [], wins = [0, 0], needed = Math.ceil(rules.bestOf / 2);
  while (!wins.includes(needed)) {
    const winner = random() < 0.5 ? 0 : 1;
    const score = pick(winningScores);
    games.push(winner === 0 ? [...score] : [...score].reverse());
    wins[winner]++;
  }
  return games;
}
