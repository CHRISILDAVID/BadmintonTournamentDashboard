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
  });
  s.demo = true;
  return s;
}

// Append a repeatable practice pack without replacing the organizer's event.
export function practiceState(previous) {
  if (previous.tournaments.some((t) => t.practice))
    throw new Error("Practice tournaments are already loaded. Delete the remaining practice categories before loading a fresh pack.");
  const practice = demoState();
  const onCourt = practice.matches.filter((match) => match.status === "live").map((match) => match.id);
  practice.tournaments.forEach((t) => { t.name = `Practice / ${t.name}`; t.practice = true; });
  practice.matches.forEach((match) => {
    if (match.status === "live") {
      match.status = "upcoming";
      match.court = null;
      delete match.startedAt;
    }
  });
  let s = structuredClone(previous);
  s.tournaments.push(...practice.tournaments);
  s.teams.push(...practice.teams);
  s.matches.push(...practice.matches);

  // Use only free courts. Player conflicts are still validated by the engine.
  for (const matchId of onCourt) {
    const court = Array.from({length:s.event.courts}, (_,i) => i+1)
      .find(c => !s.matches.some(m => m.status === "live" && m.court === c));
    if (!court) break;
    try { s = applyAction(s, "start", {matchId, court}); }
    catch (error) {
      if (!error.message.includes("already playing")) throw error;
    }
  }

  s = applyAction(s, "tournament", {name:"Practice / Knockout rehearsal", size:1, groups:2, qualify:2, points:21, cap:30, bestOf:1});
  const knockoutId = s.tournaments.at(-1).id;
  s.tournaments.at(-1).practice = true;
  s = applyAction(s, "teams", {tournamentId:knockoutId, teams:['Aditi Rao','Bhavna Shah','Charu Nair','Deepa Menon'].map((name,i) => ({players:[name],seed:i+1}))});
  s = applyAction(s, "generate", {tournamentId:knockoutId});
  // These are explicitly sample results, prepared before the practice pack is loaded.
  for (const m of s.matches.filter(m => m.tournamentId === knockoutId)) {
    m.status = "completed"; m.games = [[21,15]]; m.winner = m.a;
    m.completedAt = new Date().toISOString();
  }
  s = applyAction(s, "knockouts", {tournamentId:knockoutId});
  s = applyAction(s, "tournament", {name:"Practice / Unused draft",size:2,groups:1,qualify:2,points:21,cap:30,bestOf:3});
  const draftId = s.tournaments.at(-1).id;
  s.tournaments.at(-1).practice = true;
  s = applyAction(s, "teams", {tournamentId:draftId,teams:[{players:['Test Player A','Test Player B'],seed:1},{players:['Test Player C','Test Player D'],seed:2}]});
  s.revision = previous.revision + 1;
  return s;
}
