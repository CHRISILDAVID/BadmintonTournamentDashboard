import { standings } from "../shared/standings.js";
export { standings } from "../shared/standings.js";
import { randomUUID } from "node:crypto";
export const id = () => randomUUID();
export const emptyState = () => ({
  revision: 0,
  event: {
    name: "ShuttleHub Open",
    venue: "Tournament venue",
    date: "",
    courts: 4,
    announcement: "",
  },
  tournaments: [],
  teams: [],
  matches: [],
});
const fail = (message) => {
  throw new Error(message);
};
const integer = (v, min, max, label) => {
  if (!Number.isInteger(+v) || +v < min || +v > max)
    fail(`${label} must be between ${min} and ${max}.`);
  return +v;
};
const clean = (value, max = 120) =>
  String(value || "")
    .trim()
    .slice(0, max);

const match = (tournamentId, a, b, stage, group, round, index) => ({
  id: id(),
  tournamentId,
  a,
  b,
  stage,
  group,
  round,
  index,
  status: "upcoming",
  court: null,
  games: [],
  live: [0, 0],
  winner: null,
  scheduled: "",
});
export function validateGames(games, t) {
  if (!Array.isArray(games) || !games.length || games.length > t.bestOf)
    fail("Enter the completed games for this match.");
  const wins = [0, 0],
    needed = Math.ceil(t.bestOf / 2);
  for (const s of games) {
    if (wins.includes(needed))
      fail("Remove games played after the match was already won.");
    if (
      !Array.isArray(s) ||
      s.length !== 2 ||
      s.some((v) => !Number.isInteger(v) || v < 0 || v > t.cap)
    )
      fail(`Scores must be whole numbers from 0 to ${t.cap}.`);
    const hi = Math.max(...s),
      lo = Math.min(...s);
    if (
      hi === lo ||
      hi < t.points ||
      (hi < t.cap && hi - lo < 2) ||
      (hi > t.points && hi < t.cap && hi - lo !== 2) ||
      (hi === t.cap && lo < t.cap - 2)
    )
      fail(
        `Invalid game ${s.join("–")}. Play to ${t.points}, win by two, capped at ${t.cap}.`,
      );
    wins[s[0] > s[1] ? 0 : 1]++;
  }
  if (!wins.includes(needed)) fail(`A player/team must win ${needed} game(s).`);
  return wins[0] > wins[1] ? 0 : 1;
}
function propagate(state, m) {
  if (m.stage === "League" || m.stage === "Final") return;
  const next = state.matches.find(
    (x) =>
      x.tournamentId === m.tournamentId &&
      x.stage !== "League" &&
      x.round === m.round + 1 &&
      x.index === Math.floor(m.index / 2),
  );
  if (next) next[m.index % 2 === 0 ? "a" : "b"] = m.winner;
}
export function applyAction(previous, action, payload = {}) {
  const s = structuredClone(previous);
  const t = s.tournaments.find((t) => t.id === payload.tournamentId);
  const m = s.matches.find((m) => m.id === payload.matchId);
  if (action === "event") {
    const courts = integer(payload.courts, 1, 32, "Courts");
    if (s.matches.some((m) => m.status === "live" && m.court > courts))
      fail("Finish live matches on courts being removed first.");
    if (!clean(payload.name)) fail("Enter an event name.");
    s.event = {
      name: clean(payload.name),
      venue: clean(payload.venue),
      date: clean(payload.date, 10),
      courts,
      announcement: clean(payload.announcement, 250),
    };
  } else if (action === "tournament") {
    if (t && s.matches.some((m) => m.tournamentId === t.id))
      fail("Format is locked after fixtures are generated.");
    const name = clean(payload.name);
    if (!name) fail("Enter a category name.");
    const points = integer(payload.points, 5, 50, "Points");
    const config = {
      name,
      size: integer(payload.size, 1, 12, "Players per team"),
      groups: integer(payload.groups, 1, 8, "Groups"),
      qualify: integer(payload.qualify, 1, 16, "Qualifiers per group"),
      bestOf: integer(payload.bestOf, 1, 5, "Best of"),
      points,
      cap: integer(payload.cap, points + 1, 60, "Score cap"),
    };
    if (![1, 3, 5].includes(config.bestOf)) fail("Best of must be 1, 3 or 5.");
    const total = config.groups * config.qualify;
    if (![2, 4, 8, 16].includes(total))
      fail("Groups × qualifiers must equal 2, 4, 8 or 16 knockout places.");
    if (t) Object.assign(t, config);
    else s.tournaments.push({ id: id(), ...config });
  } else if (action === "teams") {
    if (!t) fail("Category not found.");
    if (
      !Array.isArray(payload.teams) ||
      !payload.teams.length ||
      payload.teams.length > 256
    )
      fail("Add between 1 and 256 teams per import.");
    if (s.matches.some((m) => m.tournamentId === t.id))
      fail(
        "Teams are locked after fixtures are generated. Reset unplayed fixtures to edit them.",
      );
    for (const row of payload.teams) {
      const name = clean(row.name),
        players = (Array.isArray(row.players) ? row.players : [])
          .map((p) => clean(p, 80))
          .filter(Boolean);
      if (!name || players.length !== t.size)
        fail(
          `Each ${t.name} entry needs a team name and exactly ${t.size} player(s).`,
        );
      const existing = row.id
        ? s.teams.find((x) => x.id === row.id && x.tournamentId === t.id)
        : null;
      if (row.id && !existing) fail("Team not found.");
      if (
        s.teams.some(
          (x) =>
            x.tournamentId === t.id &&
            x.id !== row.id &&
            x.name.toLowerCase() === name.toLowerCase(),
        )
      )
        fail(`Duplicate team name: ${name}.`);
      const normalized = players.map((p) => p.toLowerCase());
      if (
        new Set(normalized).size !== normalized.length ||
        s.teams.some(
          (x) =>
            x.tournamentId === t.id &&
            x.id !== row.id &&
            x.players.some((p) => normalized.includes(p.toLowerCase())),
        )
      )
        fail(`A player in ${name} is already entered in this category.`);
      const seed = integer(
        row.seed ||
          Math.max(
            0,
            ...s.teams
              .filter((x) => x.tournamentId === t.id)
              .map((x) => x.seed),
          ) + 1,
        1,
        10000,
        "Seed",
      );
      if (
        s.teams.some(
          (x) => x.tournamentId === t.id && x.id !== row.id && x.seed === seed,
        )
      )
        fail(`Seed ${seed} is already used. Give every team a unique seed.`);
      const team = { name, players, seed };
      if (existing) Object.assign(existing, team);
      else s.teams.push({ id: id(), tournamentId: t.id, group: null, ...team });
    }
  } else if (action === "deleteTeam") {
    if (!t || s.matches.some((m) => m.tournamentId === t.id))
      fail("Teams can only be removed before fixtures are generated.");
    s.teams = s.teams.filter(
      (x) => !(x.id === payload.teamId && x.tournamentId === t.id),
    );
  } else if (action === "resetFixtures") {
    if (
      !t ||
      s.matches.some((m) => m.tournamentId === t.id && m.status !== "upcoming")
    )
      fail("Only unplayed fixtures can be reset.");
    s.matches = s.matches.filter((m) => m.tournamentId !== t.id);
    s.teams
      .filter((x) => x.tournamentId === t.id)
      .forEach((x) => (x.group = null));
  } else if (action === "generate") {
    if (!t) fail("Category not found.");
    if (s.matches.some((m) => m.tournamentId === t.id))
      fail("Fixtures already exist.");
    const teams = s.teams
      .filter((x) => x.tournamentId === t.id)
      .sort((a, b) => a.seed - b.seed);
    if (teams.length < t.groups * Math.max(t.qualify, 2))
      fail(
        `Add at least ${t.groups * Math.max(t.qualify, 2)} teams for this format.`,
      );
    teams.forEach((x, i) => {
      const row = Math.floor(i / t.groups);
      x.group = row % 2 ? t.groups - 1 - (i % t.groups) : i % t.groups;
    });
    for (let g = 0; g < t.groups; g++) {
      const ring = teams.filter((x) => x.group === g).map((x) => x.id);
      if (ring.length % 2) ring.push(null);
      for (let r = 0; r < ring.length - 1; r++) {
        for (let i = 0; i < ring.length / 2; i++)
          if (ring[i] && ring[ring.length - 1 - i])
            s.matches.push(
              match(
                t.id,
                ring[i],
                ring[ring.length - 1 - i],
                "League",
                g,
                r,
                i,
              ),
            );
        ring.splice(1, 0, ring.pop());
      }
    }
    s.matches.sort(
      (a, b) => a.round - b.round || (a.group ?? 0) - (b.group ?? 0),
    );
  } else if (action === "knockouts") {
    if (!t) fail("Category not found.");
    const league = s.matches.filter((m) => m.tournamentId === t.id);
    if (
      !league.length ||
      league.some((m) => m.stage !== "League" || m.status !== "completed")
    )
      fail("Complete every league match before creating the knockout bracket.");
    const ranked = Array.from({ length: t.groups }, (_, g) =>
      standings(s, t.id, g).slice(0, t.qualify),
    );
    const entrants = [];
    for (let rank = 0; rank < t.qualify; rank++)
      for (let g = 0; g < t.groups; g++) entrants.push(ranked[g][rank].id);
    // Standard bracket seeding keeps highest-ranked entrants in opposite halves.
    let order = [1, 2];
    while (order.length < entrants.length) {
      const sum = order.length * 2 + 1;
      order = order.flatMap((seed) => [seed, sum - seed]);
    }
    const seeded = order.map((seed) => entrants[seed - 1]);
    let count = entrants.length / 2,
      round = 1;
    while (count >= 1) {
      const stage =
        count === 1
          ? "Final"
          : count === 2
            ? "Semifinal"
            : count === 4
              ? "Quarterfinal"
              : "Round of 16";
      for (let i = 0; i < count; i++)
        s.matches.push(
          match(
            t.id,
            round === 1 ? seeded[i * 2] : null,
            round === 1 ? seeded[i * 2 + 1] : null,
            stage,
            null,
            round,
            i,
          ),
        );
      count /= 2;
      round++;
    }
  } else if (["start", "score", "finish", "schedule"].includes(action)) {
    if (!m) fail("Match not found.");
    const config = s.tournaments.find((t) => t.id === m.tournamentId);
    if (action === "schedule") {
      if (m.status !== "upcoming")
        fail("Only upcoming matches can be scheduled.");
      m.scheduled = clean(payload.scheduled, 40);
      if (m.scheduled && !Number.isFinite(Date.parse(m.scheduled)))
        fail("Enter a valid date and time.");
    } else if (action === "start") {
      if (m.status !== "upcoming" || !m.a || !m.b)
        fail("Both opponents must be known and the match must be upcoming.");
      const court = integer(payload.court, 1, s.event.courts, "Court");
      if (s.matches.some((x) => x.status === "live" && x.court === court))
        fail("That court is already occupied.");
      const players = [m.a, m.b].flatMap((tid) =>
        s.teams.find((t) => t.id === tid).players.map((p) => p.toLowerCase()),
      );
      if (
        s.matches.some(
          (x) =>
            x.status === "live" &&
            [x.a, x.b].some((tid) =>
              s.teams
                .find((t) => t.id === tid)
                .players.some((p) => players.includes(p.toLowerCase())),
            ),
        )
      )
        fail("One of these players is already playing on another court.");
      m.status = "live";
      m.court = court;
      m.startedAt = new Date().toISOString();
    } else if (action === "score") {
      if (m.status !== "live")
        fail("Start this match before updating the score.");
      if (!Array.isArray(payload.live) || payload.live.length !== 2)
        fail("Enter both live scores.");
      m.live = payload.live.map((v) => integer(v, 0, config.cap, "Score"));
    } else {
      if (m.status !== "live")
        fail("Start the match before recording its result.");
      const winner = validateGames(payload.games, config);
      m.games = payload.games;
      m.winner = winner === 0 ? m.a : m.b;
      m.status = "completed";
      m.completedAt = new Date().toISOString();
      propagate(s, m);
    }
  } else fail("Unknown operation.");
  s.revision++;
  return s;
}
