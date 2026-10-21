import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyState,
  applyAction,
  standings,
  validateGames,
} from "../server/engine.js";
import { demoState, practiceState } from "../server/demo.js";
import { parseCSV, importTeams } from "../src/utils.js";

function setup(count = 8, groups = 2, qualify = 2) {
  let s = applyAction(emptyState(), "tournament", {
    name: "Doubles",
    size: 2,
    groups,
    qualify,
    points: 21,
    cap: 30,
    bestOf: 3,
  });
  const tournamentId = s.tournaments[0].id;
  s = applyAction(s, "teams", {
    tournamentId,
    teams: Array.from({ length: count }, (_, i) => ({
      name: `Team ${i + 1}`,
      players: [`Player ${i + 1} A`, `Player ${i + 1} B`],
      seed: i + 1,
    })),
  });
  return { s, tournamentId };
}
test("round robin: every pair plays exactly once, with no duplicate team in a round, including odd groups", () => {
  for (const count of [4, 6, 8, 9, 10, 16]) {
    const groups = count === 9 ? 1 : 2;
    let { s, tournamentId } = setup(count, groups, 2);
    s = applyAction(s, "generate", { tournamentId });
    for (let g = 0; g < groups; g++) {
      const teams = s.teams.filter((t) => t.group === g),
        matches = s.matches.filter((m) => m.group === g);
      assert.equal(matches.length, (teams.length * (teams.length - 1)) / 2);
      assert.equal(
        new Set(matches.map((m) => [m.a, m.b].sort().join(":"))).size,
        matches.length,
      );
      for (const round of new Set(matches.map((m) => m.round))) {
        const ids = matches
          .filter((m) => m.round === round)
          .flatMap((m) => [m.a, m.b]);
        assert.equal(ids.length, new Set(ids).size);
      }
    }
    assert.ok(
      Math.max(
        ...Array.from(
          { length: groups },
          (_, g) => s.teams.filter((t) => t.group === g).length,
        ),
      ) -
        Math.min(
          ...Array.from(
            { length: groups },
            (_, g) => s.teams.filter((t) => t.group === g).length,
          ),
        ) <=
        1,
    );
  }
});
test("league to knockout to champion, and winner propagation", () => {
  let { s, tournamentId } = setup();
  s = applyAction(s, "generate", { tournamentId });
  assert.throws(
    () => applyAction(s, "knockouts", { tournamentId }),
    /Complete every league/,
  );
  for (const m of s.matches) {
    s = applyAction(s, "start", { matchId: m.id, court: 1 });
    s = applyAction(s, "finish", {
      matchId: m.id,
      games: [
        [21, 12],
        [21, 16],
      ],
    });
  }
  const rank = standings(s, tournamentId, 0);
  assert.equal(
    rank.reduce((n, t) => n + t.wins, 0),
    6,
  );
  assert.equal(
    rank.reduce((n, t) => n + t.pointDiff, 0),
    0,
  );
  s = applyAction(s, "knockouts", { tournamentId });
  assert.equal(s.matches.filter((m) => m.stage === "Semifinal").length, 2);
  const final = s.matches.find((m) => m.stage === "Final");
  assert.equal(final.a, null);
  assert.throws(
    () => applyAction(s, "start", { matchId: final.id, court: 1 }),
    /Both opponents/,
  );
  for (const m of s.matches.filter((m) => m.stage === "Semifinal")) {
    s = applyAction(s, "start", { matchId: m.id, court: 1 });
    s = applyAction(s, "finish", {
      matchId: m.id,
      games: [
        [21, 0],
        [21, 0],
      ],
    });
  }
  s = applyAction(s, "start", { matchId: final.id, court: 1 });
  s = applyAction(s, "finish", {
    matchId: final.id,
    games: [
      [22, 20],
      [28, 30],
      [30, 29],
    ],
  });
  assert.ok(s.matches.find((m) => m.id === final.id).winner);
  assert.throws(
    () => applyAction(s, "knockouts", { tournamentId }),
    /Complete every league/,
  );
});
test("court conflicts and player overlap across categories are rejected", () => {
  let { s, tournamentId } = setup();
  s = applyAction(s, "generate", { tournamentId });
  const first = s.matches[0];
  s = applyAction(s, "start", { matchId: first.id, court: 1 });
  assert.throws(
    () => applyAction(s, "start", { matchId: s.matches[1].id, court: 1 }),
    /court is already/,
  );
  s = applyAction(s, "tournament", {
    name: "Singles",
    size: 1,
    groups: 1,
    qualify: 2,
    points: 21,
    cap: 30,
    bestOf: 1,
  });
  const singles = s.tournaments.at(-1).id;
  s = applyAction(s, "teams", {
    tournamentId: singles,
    teams: [
      {
        name: "Shared player",
        players: [s.teams.find((t) => t.id === first.a).players[0]],
      },
      { name: "Opponent", players: ["Another player"] },
    ],
  });
  s = applyAction(s, "generate", { tournamentId: singles });
  assert.throws(
    () =>
      applyAction(s, "start", {
        matchId: s.matches.find((m) => m.tournamentId === singles).id,
        court: 2,
      }),
    /already playing/,
  );
});
test("scores enforce deuce, cap, match victory, and no extra games", () => {
  const t = { bestOf: 3, points: 21, cap: 30 };
  for (const games of [
    [
      [21, 20],
      [21, 0],
    ],
    [
      [22, 19],
      [21, 0],
    ],
    [
      [31, 29],
      [21, 0],
    ],
    [
      [30, 1],
      [21, 0],
    ],
    [[21, 0]],
    [
      [21, 0],
      [21, 0],
      [21, 0],
    ],
    [
      [21.5, 0],
      [21, 0],
    ],
    [[0, 0]],
  ])
    assert.throws(() => validateGames(games, t));
  assert.equal(
    validateGames(
      [
        [21, 19],
        [23, 21],
      ],
      t,
    ),
    0,
  );
  assert.equal(
    validateGames(
      [
        [28, 30],
        [29, 30],
      ],
      t,
    ),
    1,
  );
  assert.equal(
    validateGames(
      [
        [30, 28],
        [30, 29],
      ],
      t,
    ),
    0,
  );
});
test("imports are atomic, duplicate seeds and players rejected, late entrants require a group", () => {
  let { s, tournamentId } = setup();
  const before = structuredClone(s);
  assert.throws(
    () =>
      applyAction(s, "teams", {
        tournamentId,
        teams: [
          { name: "Valid", players: ["New A", "New B"], seed: 9 },
          { name: "Invalid", players: ["New C"], seed: 10 },
        ],
      }),
    /exactly 2/,
  );
  assert.deepEqual(s, before);
  assert.throws(
    () =>
      applyAction(s, "teams", {
        tournamentId,
        teams: [
          { name: "Duplicate seed", players: ["New A", "New B"], seed: 1 },
        ],
      }),
    /Seed 1/,
  );
  assert.throws(
    () =>
      applyAction(s, "teams", {
        tournamentId,
        teams: [{ name: "Duplicate player", players: ["Player 1 A", "New B"] }],
      }),
    /already entered/,
  );
  s = applyAction(s, "generate", { tournamentId });
  assert.throws(
    () =>
      applyAction(s, "teams", {
        tournamentId,
        teams: [{ name: "Late", players: ["New A", "New B"] }],
      }),
    /Choose an existing group/,
  );
  s = applyAction(s, "resetFixtures", { tournamentId });
  assert.equal(s.matches.length, 0);
  assert.equal(s.teams.length, 8);
  s = applyAction(s, "generate", { tournamentId });
  s = applyAction(s, "start", { matchId: s.matches[0].id, court: 1 });
  assert.throws(
    () => applyAction(s, "resetFixtures", { tournamentId }),
    /Only unplayed/,
  );
});
test("CSV supports commas, escaped quotes and CRLF; malformed quotes fail", () => {
  assert.deepEqual(
    parseCSV('team,player1,seed\r\n"Team, A","A ""Ace"" Roy",1\r\n'),
    [
      ["team", "player1", "seed"],
      ["Team, A", 'A "Ace" Roy', "1"],
    ],
  );
  assert.throws(() => parseCSV('team,"bad'), /unclosed/);
});
test("real XLSX workbook import reads team, player and seed columns", async () => {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Teams");
  sheet.addRow(["team", "player1", "player2", "seed"]);
  sheet.addRow(["Duo", "A", "B", 1]);
  const bytes = await wb.xlsx.writeBuffer();
  const file = {
    name: "teams.xlsx",
    size: bytes.length,
    arrayBuffer: async () => bytes,
  };
  assert.deepEqual(await importTeams(file), [
    { name: "A - B", players: ["A", "B"], seed: 1 },
  ]);
});
test("sample event has live, upcoming and completed matches in three categories", () => {
  const s = demoState();
  assert.equal(s.tournaments.length, 3);
  assert.equal(s.matches.filter((m) => m.status === "live").length, 3);
  assert.equal(s.matches.filter((m) => m.status === "completed").length, 3);
  assert.ok(s.matches.some((m) => m.status === "upcoming"));
});

test("reusable tournaments schedule matches by time without an event date", () => {
  let { s, tournamentId } = setup();
  assert.equal("date" in s.event, false);
  s = applyAction(s, "generate", { tournamentId });
  const matchId = s.matches[0].id;
  s = applyAction(s, "schedule", { matchId, scheduled: "14:30" });
  assert.equal(s.matches[0].scheduled, "14:30");
  for (const scheduled of ["24:00", "12:60", "2026-10-15T14:30", "tomorrow"]) {
    assert.throws(
      () => applyAction(s, "schedule", { matchId, scheduled }),
      /valid start time/,
    );
  }
  s = applyAction(s, "schedule", { matchId, scheduled: "" });
  assert.equal(s.matches[0].scheduled, "");
  s = applyAction(s, "event", { ...s.event, date: "2026-10-15" });
  assert.equal("date" in s.event, false);
});


test("entry labels derive from players for singles, doubles and 3v3, including edits", () => {
  for (const size of [1,2,3]) {
    let s = applyAction(emptyState(), "tournament", {name:"Test",size,groups:1,qualify:2,points:21,cap:30,bestOf:1});
    const tournamentId = s.tournaments[0].id;
    const players = Array.from({length:size}, (_,i) => `Player ${i+1}`);
    s = applyAction(s,"teams",{tournamentId,teams:[{name:"Ignore this nickname",players:players.map(p=>` ${p} `)}]});
    assert.equal(s.teams[0].name,players.join(" - "));
    const edited = [...players]; edited[0]="Corrected Player";
    s = applyAction(s,"teams",{tournamentId,teams:[{id:s.teams[0].id,players:edited,seed:1}]});
    assert.equal(s.teams[0].name,edited.join(" - "));
  }
});

test("CSV and XLSX accept player-only columns; legacy team names are ignored", async () => {
  const csv = "player1,player2,seed\nAnil,Ravi,1\n";
  assert.deepEqual(await importTeams({name:"teams.csv",size:csv.length,text:async()=>csv}),[{name:"Anil - Ravi",players:["Anil","Ravi"],seed:1}]);
  const {default:ExcelJS} = await import("exceljs");
  const wb = new ExcelJS.Workbook(); const sheet = wb.addWorksheet("Players");
  sheet.addRow(["player1","player2","player3"]); sheet.addRow(["A","B","C"]);
  const bytes = await wb.xlsx.writeBuffer();
  assert.deepEqual(await importTeams({name:"players.xlsx",size:bytes.length,arrayBuffer:async()=>bytes}),[{name:"A - B - C",players:["A","B","C"],seed:undefined}]);
});

test("deletion cascades through draft, unplayed fixtures and completed results, preserving other categories", () => {
  for (const mode of ["draft","fixtures","completed"]) {
    let {s,tournamentId} = setup(4,1,2);
    if (mode !== "draft") s = applyAction(s,"generate",{tournamentId});
    if (mode === "completed") {
      s = applyAction(s,"start",{matchId:s.matches[0].id,court:1});
      s = applyAction(s,"finish",{matchId:s.matches[0].id,games:[[21,10],[21,12]]});
    }
    s = practiceState(s);
    const before = structuredClone(s);
    const after = applyAction(s,"deleteTournament",{tournamentId});
    for (const key of ["tournaments","teams","matches"]) {
      assert.deepEqual(after[key],before[key].filter(x => (key === "tournaments" ? x.id : x.tournamentId) !== tournamentId));
    }
    assert.deepEqual(s,before);
    assert.throws(()=>applyAction(after,"deleteTournament",{tournamentId}),/not found/);
  }
});

test("deletion refuses matches on court and does not mutate data", () => {
  const s = demoState(), before = structuredClone(s);
  assert.throws(()=>applyAction(s,"deleteTournament",{tournamentId:s.matches.find(m=>m.status === "live").tournamentId}),/on court/);
  assert.deepEqual(s,before);
});

test("practice pack appends five marked categories, preserves existing data, and does not double-book courts", () => {
  const previous = demoState();
  previous.teams.forEach(t => { t.players = t.players.map(p=>`Existing ${p}`); t.name=t.players.join(" - "); });
  const snapshot = structuredClone(previous);
  const s = practiceState(previous);
  assert.deepEqual(previous,snapshot);
  for (const key of ["tournaments","teams","matches"]) assert.deepEqual(previous[key].map(x=>s[key].find(y=>y.id===x.id)),previous[key]);
  assert.deepEqual(s.event,previous.event);
  assert.equal(s.tournaments.filter(t=>t.practice).length,5);
  assert.equal(s.teams.length-previous.teams.length,30);
  assert.equal(s.matches.length-previous.matches.length,41);
  const live = s.matches.filter(m=>m.status === "live");
  assert.equal(live.length,4); assert.equal(new Set(live.map(m=>m.court)).size,4);
  assert.equal(s.revision,previous.revision+1);
  assert.throws(()=>practiceState(s),/already loaded/);
  const knockout = s.tournaments.find(t=>t.name.includes("Knockout rehearsal"));
  assert.equal(s.matches.filter(m=>m.tournamentId===knockout.id && m.stage==="Semifinal").length,2);
});
