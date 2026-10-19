import { standings } from "../shared/standings.js";
export { standings } from "../shared/standings.js";
import { randomUUID } from "node:crypto";
import { playerLabel } from "../shared/players.js";
import { removeLegacyCalls } from "../shared/matches.js";
import { groupEditLockReason } from "../shared/groups.js";
import { randomGames } from "./random-scores.js";
import {
  PLAYOFF_STAGE,
  qualificationFormats,
  qualificationFormat,
  isPlayoffFormat,
  scoringRules,
  knockoutStage,
  drawSize,
  groupLabel,
} from "../shared/format.js";
export const id = () => randomUUID();
export const emptyState = () => ({
  revision: 0,
  event: {
    name: "ShuttleHub Open",
    venue: "Tournament venue",
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
      t.goldenPoint
        ? hi !== t.points || lo >= t.points
        : hi === lo ||
          hi < t.points ||
          (hi < t.cap && hi - lo < 2) ||
          (hi > t.points && hi < t.cap && hi - lo !== 2) ||
          (hi === t.cap && lo < t.cap - 2)
    )
      fail(
        `Invalid game ${s.join("–")}. ${t.goldenPoint ? `First to ${t.points}, golden point (no deuce).` : `Play to ${t.points}, win by two, capped at ${t.cap}.`}`,
      );
    wins[s[0] > s[1] ? 0 : 1]++;
  }
  if (!wins.includes(needed)) fail(`A player/team must win ${needed} game(s).`);
  return wins[0] > wins[1] ? 0 : 1;
}
function createDraw(s, t) {
  const ranked = Array.from({ length: t.groups }, (_, g) =>
    standings(s, t.id, g),
  );
  const slots = ranked.map((rows) =>
    rows.slice(0, t.qualify).map((row) => ({ id: row.id, group: row.group })),
  );
  if (isPlayoffFormat(t)) {
    const format = qualificationFormat(t);
    if (ranked.some((rows) => rows.length !== format.teamsPerGroup))
      fail("Group sizes do not match this playoff format.");
    for (let g = 0; g < t.groups; g++) {
      for (const [high, low, slot] of format.pairs) {
        const playoff = {
          ...match(
            t.id,
            ranked[g][high - 1].id,
            ranked[g][low - 1].id,
            PLAYOFF_STAGE,
            g,
            0,
            g * format.pairs.length +
              format.pairs.findIndex((pair) => pair[2] === slot),
          ),
          qualifyingSlot: slot,
          playoffRanks: [high, low],
        };
        s.matches.push(playoff);
        slots[g][slot - 1] = {
          id: null,
          group: g,
          source: {
            matchId: playoff.id,
            label: `Winner of Group ${groupLabel(g)} playoff for ${groupLabel(g)}${slot}`,
          },
        };
      }
    }
  }
  const entrants = [];
  for (let rank = 0; rank < t.qualify; rank++)
    for (let g = 0; g < t.groups; g++) entrants.push(slots[g][rank]);
  // Standard bracket seeding keeps highest-ranked entrants in opposite halves.
  let order = [1, 2];
  while (order.length < drawSize(entrants.length)) {
    const sum = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, sum - seed]);
  }
  const seeded = order.map((seed) => entrants[seed - 1] || { id: null, bye: true });
  // Re-pair lower seeds only when the standard order would create a same-group opener.
  const pairs = Array.from({ length: seeded.length / 2 }, (_, i) => i)
    .filter(i => !seeded[i * 2].bye && !seeded[i * 2 + 1].bye);
  if (t.groups > 1 && pairs.some(i => seeded[i * 2].group === seeded[i * 2 + 1].group)) {
    const opponents = pairs.map(i => seeded[i * 2 + 1]);
    const assigned = new Map();
    function assign(i, seen) {
      for (let j = 0; j < opponents.length; j++) {
        if (seen.has(j) || seeded[pairs[i] * 2].group === opponents[j].group) continue;
        seen.add(j);
        if (!assigned.has(j) || assign(assigned.get(j), seen)) {
          assigned.set(j, i);
          return true;
        }
      }
      return false;
    }
    if (pairs.every((_, i) => assign(i, new Set())))
      for (const [j, i] of assigned) seeded[pairs[i] * 2 + 1] = opponents[j];
  }
  let count = seeded.length / 2,
    round = 1;
  while (count >= 1) {
    const stage = knockoutStage(count * 2);
    for (let i = 0; i < count; i++) {
      const fixture = match(
        t.id,
        round === 1 ? seeded[i * 2].id : null,
        round === 1 ? seeded[i * 2 + 1].id : null,
        stage,
        null,
        round,
        i,
      );
      if (round === 1 && (seeded[i * 2].bye || seeded[i * 2 + 1].bye)) fixture.bye = true;
      if (round === 1)
        for (const [j, side] of ["a", "b"].entries()) {
          if (seeded[i * 2 + j].source)
            fixture[`${side}Source`] = seeded[i * 2 + j].source;
        }
      s.matches.push(fixture);
    }
    count /= 2;
    round++;
  }
}

function resetResult(m) {
  m.status = "upcoming";
  m.games = [];
  m.winner = null;
  m.court = null;
  delete m.startedAt;
  delete m.completedAt;
  delete m.correctedAt;
}

// Recompute in feeder order; retain results only while both opponents stay the same.
function reconcileDraw(s, t, rebuild = false) {
  const fixtures = s.matches.filter(m => m.tournamentId === t.id && m.stage !== "League");
  if (!fixtures.length) return;
  const key = m => `${m.stage}:${m.round}:${m.index}`;
  let blueprints;
  if (rebuild) {
    const draft = { ...s, matches: s.matches.filter(m => m.tournamentId === t.id && m.stage === "League") };
    createDraw(draft, t);
    draft.matches = draft.matches.filter(m => m.stage !== "League");
    const oldByKey = new Map(fixtures.map(m => [key(m), m]));
    const ids = new Map(draft.matches.map(m => [m.id, oldByKey.get(key(m)).id]));
    for (const m of draft.matches)
      for (const side of ["a", "b"])
        if (m[`${side}Source`]) m[`${side}Source`].matchId = ids.get(m[`${side}Source`].matchId);
    blueprints = new Map(draft.matches.map(m => [key(m), m]));
  }
  const byId = new Map(fixtures.map(m => [m.id, m]));
  const mainByPosition = new Map(fixtures.filter(m => m.stage !== PLAYOFF_STAGE).map(m => [`${m.round}:${m.index}`, m]));
  fixtures.sort((a, b) => (a.stage === PLAYOFF_STAGE ? 0 : a.round) - (b.stage === PLAYOFF_STAGE ? 0 : b.round));
  for (const m of fixtures) {
    const opponents = [m.a, m.b];
    for (const [i, side] of ["a", "b"].entries()) {
      const blueprint = blueprints?.get(key(m));
      if (blueprint && (m.stage === PLAYOFF_STAGE || m.round === 1)) {
        opponents[i] = blueprint[side];
        if (blueprint[`${side}Source`]) m[`${side}Source`] = blueprint[`${side}Source`];
        else delete m[`${side}Source`];
      }
      if (m[`${side}Source`]) opponents[i] = byId.get(m[`${side}Source`].matchId)?.winner || null;
      else if (m.stage !== PLAYOFF_STAGE && m.round > 1)
        opponents[i] = mainByPosition.get(`${m.round - 1}:${m.index * 2 + i}`)?.winner || null;
    }
    if (m.a !== opponents[0] || m.b !== opponents[1]) resetResult(m);
    [m.a, m.b] = opponents;
    if (m.bye && (m.a || m.b)) {
      m.status = "completed";
      m.winner = m.a || m.b;
      m.completedAt ||= new Date().toISOString();
    }
  }
}
function validateScoring(input, label) {
  if (!input || typeof input !== "object")
    fail(`Enter ${label} scoring rules.`);
  if (typeof input.goldenPoint !== "boolean")
    fail(`Choose golden point or deuce for ${label}.`);
  const points = integer(input.points, 5, 50, `${label} points`);
  const bestOf = integer(input.bestOf, 1, 5, `${label} best of`);
  if (![1, 3, 5].includes(bestOf)) fail("Best of must be 1, 3 or 5.");
  const cap = integer(
    input.cap,
    input.goldenPoint ? points : points + 1,
    60,
    `${label} score cap`,
  );
  if (input.goldenPoint && cap !== points)
    fail(`Golden point ${label} must stop at ${points}.`);
  return { points, cap, bestOf, goldenPoint: input.goldenPoint };
}
export function applyAction(previous, action, payload = {}) {
  const s = structuredClone(previous);
  removeLegacyCalls(s);
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
      courts,
      announcement: clean(payload.announcement, 250),
    };
  } else if (action === "tournament") {
    if (t && s.matches.some((m) => m.tournamentId === t.id))
      fail("Format is locked after fixtures are generated.");
    const name = clean(payload.name);
    if (!name) fail("Enter a category name.");
    const qualification = payload.qualification || "direct";
    if (!Object.hasOwn(qualificationFormats, qualification))
      fail("Choose a supported qualification format.");
    const leagueRules = payload.scoring
      ? validateScoring(payload.scoring.league, "League")
      : null;
    const points =
      leagueRules?.points ?? integer(payload.points, 5, 50, "Points");
    const config = {
      name,
      size: integer(payload.size, 1, 12, "Players per team"),
      groups: integer(payload.groups, 1, 256, "Groups"),
      qualify: integer(payload.qualify, 1, 256, "Qualifiers per group"),
      bestOf: leagueRules?.bestOf ?? integer(payload.bestOf, 1, 5, "Best of"),
      points,
      cap:
        leagueRules?.cap ?? integer(payload.cap, points + 1, 60, "Score cap"),
      qualification,
    };
    if (payload.scoring) {
      config.scoring = {
        league: leagueRules,
        knockout: validateScoring(payload.scoring.knockout, "Knockout"),
      };
      if (isPlayoffFormat(config))
        config.scoring.playoff = validateScoring(
          payload.scoring.playoff,
          "Playoff",
        );
    } else if (isPlayoffFormat(config))
      fail("Set scoring rules for league, playoffs and knockouts.");
    if (
      isPlayoffFormat(config) &&
      (config.size !== 2 || config.qualify !== 4)
    )
      fail(
        "These playoff formats require doubles and four knockout slots per group.",
      );
    if (![1, 3, 5].includes(config.bestOf)) fail("Best of must be 1, 3 or 5.");
    const total = config.groups * config.qualify;
    if (total < 2 || total > 4096)
      fail("Groups times qualifiers must provide between 2 and 4096 knockout places.");
    if (t) {
      delete t.scoring;
      Object.assign(t, config);
    } else s.tournaments.push({ id: id(), ...config });
  } else if (action === "deleteTournament") {
    if (!t) fail("Tournament not found.");
    if (
      s.matches.some(
        (match) => match.tournamentId === t.id && match.status === "live",
      )
    )
      fail(
        "Finish the matches currently on court before deleting this tournament.",
      );
    s.matches = s.matches.filter((match) => match.tournamentId !== t.id);
    s.teams = s.teams.filter((team) => team.tournamentId !== t.id);
    s.tournaments = s.tournaments.filter(
      (tournament) => tournament.id !== t.id,
    );
  } else if (action === "teams") {
    if (!t) fail("Category not found.");
    if (
      !Array.isArray(payload.teams) ||
      !payload.teams.length ||
      payload.teams.length > 256
    )
      fail("Add between 1 and 256 teams per import.");
    const locked = s.matches.some(m => m.tournamentId === t.id);
    if (s.matches.some(m => m.tournamentId === t.id && m.stage === "Final" && m.winner))
      fail("Player names are locked after the tournament ends.");
    if (locked && payload.teams.some(row => !row.id))
      fail("Registration is locked after fixtures are generated; existing player names can still be edited.");
    for (const row of payload.teams) {
      const players = (Array.isArray(row.players) ? row.players : [])
        .map((p) => clean(p, 80))
        .filter(Boolean);
      const name = playerLabel(players);
      if (players.length !== t.size)
        fail(`Each ${t.name} entry needs exactly ${t.size} player(s).`);
      const existing = row.id
        ? s.teams.find((x) => x.id === row.id && x.tournamentId === t.id)
        : null;
      if (row.id && !existing) fail("Team not found.");
      if (locked && row.seed != null && +row.seed !== existing.seed)
        fail("Seeds are locked after fixtures are generated.");
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
        (locked ? existing.seed : row.seed) ||
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
    const livePlayers = new Set();
    for (const fixture of s.matches.filter(m => m.status === "live"))
      for (const teamId of [fixture.a, fixture.b])
        for (const player of s.teams.find(team => team.id === teamId).players) {
          const normalized = player.toLowerCase();
          if (livePlayers.has(normalized)) fail("This name would put the same player on court more than once. Finish or undo the conflicting match first.");
          livePlayers.add(normalized);
        }
  } else if (action === "deleteTeam") {
    if (!t || s.matches.some((m) => m.tournamentId === t.id))
      fail("Teams can only be removed before fixtures are generated.");
    s.teams = s.teams.filter(
      (x) => !(x.id === payload.teamId && x.tournamentId === t.id),
    );
  } else if (action === "swapGroups") {
    const reason = groupEditLockReason(s, payload.tournamentId);
    if (reason) fail(reason);
    const first = s.teams.find((x) => x.id === payload.teamAId && x.tournamentId === t.id);
    const second = s.teams.find((x) => x.id === payload.teamBId && x.tournamentId === t.id);
    if (!first || !second) fail("Choose two teams from this tournament.");
    if (first.group == null || second.group == null || first.group === second.group)
      fail("Choose teams from different assigned groups.");
    const fixtures = s.matches.filter((m) => m.tournamentId === t.id);
    if (fixtures.some((m) => m.status === "live" &&
      [m.a, m.b].some((id) => id === first.id || id === second.id)))
      fail("A selected team is on court. Return its match to waiting before swapping groups.");
    [first.group, second.group] = [second.group, first.group];
    // Exchange their places in the existing draw, retaining fixture IDs and planned times.
    for (const fixture of fixtures) {
      for (const side of ["a", "b"]) {
        if (fixture[side] === first.id) fixture[side] = second.id;
        else if (fixture[side] === second.id) fixture[side] = first.id;
      }
    }
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
    if (
      isPlayoffFormat(t) &&
      teams.length !== t.groups * qualificationFormat(t).teamsPerGroup
    )
      fail(
        `This format needs exactly ${t.groups * qualificationFormat(t).teamsPerGroup} teams (${qualificationFormat(t).teamsPerGroup} per group).`,
      );
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
    createDraw(s, t);
    reconcileDraw(s, t);
  } else if (action === "randomComplete") {
    // Temporary testing operation: one atomic save, including dependent rounds.
    if (payload.tournamentId && !t) fail("Category not found.");
    const fixtures = s.matches.filter(m => !t || m.tournamentId === t.id);
    if (!fixtures.some(m => m.status !== "completed"))
      fail("There are no unfinished matches in this selection.");
    const configs = new Map(s.tournaments.map(t => [t.id, t]));
    while (fixtures.some(m => m.status !== "completed")) {
      const ready = fixtures.filter(m => m.status !== "completed" && m.a && m.b && !m.bye);
      if (!ready.length)
        fail("Some matches are missing opponents or feeder fixtures. No random results were saved.");
      const changed = new Set();
      for (const fixture of ready) {
        const games = randomGames(scoringRules(configs.get(fixture.tournamentId), fixture.stage));
        const winner = validateGames(games, scoringRules(configs.get(fixture.tournamentId), fixture.stage));
        fixture.games = games;
        fixture.winner = winner === 0 ? fixture.a : fixture.b;
        fixture.status = "completed";
        fixture.completedAt = new Date().toISOString();
        fixture.court = null;
        changed.add(fixture.tournamentId);
      }
      for (const tournamentId of changed) reconcileDraw(s, configs.get(tournamentId));
    }
  } else if (action === "returnMatch") {
    if (!m) fail("Match not found.");
    if (m.status !== "live" || m.games.length)
      fail("Only an on-court match without a recorded result can be returned.");
    m.status = "upcoming";
    m.court = null;
    delete m.startedAt;
  } else if (["start", "finish", "correctResult", "schedule"].includes(action)) {
    if (!m) fail("Match not found.");
    const config = s.tournaments.find((t) => t.id === m.tournamentId);
    if (action === "schedule") {
      if (m.status !== "upcoming")
        fail("Only upcoming matches can be scheduled.");
      m.scheduled = clean(payload.scheduled, 40);
      if (m.scheduled && !/^([01]\d|2[0-3]):[0-5]\d$/.test(m.scheduled))
        fail("Enter a valid start time (HH:mm).");
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
    } else {
      const correcting = action === "correctResult";
      if (m.bye) fail("A bye has no game scores to edit.");
      if (correcting ? m.status !== "completed" : m.status !== "live")
        fail(correcting ? "Only completed results can be corrected." : "Start the match before recording its result.");
      const winner = validateGames(
        payload.games,
        scoringRules(config, m.stage),
      );
      m.games = structuredClone(payload.games);
      m.winner = winner === 0 ? m.a : m.b;
      m.status = "completed";
      if (correcting) m.correctedAt = new Date().toISOString();
      else m.completedAt = new Date().toISOString();
      reconcileDraw(s, config, correcting && m.stage === "League");
    }
  } else fail("Unknown operation.");
  s.revision++;
  return s;
}
