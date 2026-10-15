import { emptyState, applyAction } from "./engine.js";
export function demoState() {
  let s = emptyState();
  s.event = {
    ...s.event,
    name: "ShuttleHub Open",
    venue: "ShuttleHub Badminton Arena",
    announcement:
      "Welcome to ShuttleHub Open · Players, please report 10 minutes before your match.",
  };
  const names = ["Men’s Doubles", "Women’s Singles", "Mixed Doubles"];
  const pairs = [
    ["Arjun Mehta", "Rohan Das"],
    ["Karthik Rao", "Vikram Shah"],
    ["Aditya Singh", "Rahul Nair"],
    ["Pranav Kumar", "Dev Patel"],
    ["Siddharth Roy", "Nikhil Jain"],
    ["Aakash Menon", "Varun Iyer"],
    ["Anish Paul", "Surya Raj"],
    ["Manav Sethi", "Dhruv Sen"],
  ];
  for (let i = 0; i < 3; i++) {
    s = applyAction(s, "tournament", {
      name: names[i],
      size: i === 1 ? 1 : 2,
      groups: 2,
      qualify: 2,
      points: 21,
      cap: 30,
      bestOf: 3,
    });
    const tournamentId = s.tournaments.at(-1).id;
    const teams = pairs.map((p, j) => ({
      name:
        i === 0
          ? [
              "Smash Brothers",
              "Net Ninjas",
              "Birdie Brigade",
              "Court Kings",
              "Shuttle Strikers",
              "Drop Shot Duo",
              "Rally Rebels",
              "Ace Alliance",
            ][j]
          : i === 1
            ? [
                "Ananya Rao",
                "Meera Shah",
                "Priya Nair",
                "Diya Patel",
                "Isha Roy",
                "Tara Sen",
                "Riya Das",
                "Sara Khan",
              ][j]
            : [
                "Crosscourt Crew",
                "Perfect Pair",
                "Shuttle Stars",
                "Rally Together",
                "Net Partners",
                "Smash Squad",
                "Court Connect",
                "Double Trouble",
              ][j],
      players:
        i === 0
          ? p
          : i === 1
            ? [
                [
                  "Ananya Rao",
                  "Meera Shah",
                  "Priya Nair",
                  "Diya Patel",
                  "Isha Roy",
                  "Tara Sen",
                  "Riya Das",
                  "Sara Khan",
                ][j],
              ]
            : [`Player ${j + 1} A`, `Player ${j + 1} B`],
      seed: j + 1,
    }));
    s = applyAction(s, "teams", { tournamentId, teams });
    s = applyAction(s, "generate", { tournamentId });
  }
  for (const m of s.matches.slice(0, 3)) {
    s = applyAction(s, "start", { matchId: m.id, court: 1 });
    s = applyAction(s, "finish", {
      matchId: m.id,
      games: [
        [21, 16],
        [21, 18],
      ],
    });
  }
  const live = [
    s.matches.find(
      (m) => m.status === "upcoming" && m.tournamentId === s.tournaments[0].id,
    ),
    s.matches.find(
      (m) => m.status === "upcoming" && m.tournamentId === s.tournaments[1].id,
    ),
    s.matches.find(
      (m) => m.status === "upcoming" && m.tournamentId === s.tournaments[2].id,
    ),
  ];
  live.forEach((m, i) => {
    s = applyAction(s, "start", { matchId: m.id, court: i + 1 });
    s = applyAction(s, "score", {
      matchId: m.id,
      live: [
        [14, 11],
        [18, 16],
        [8, 12],
      ][i],
    });
  });
  s.demo = true;
  return s;
}
