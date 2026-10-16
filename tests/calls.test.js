import test from "node:test";
import assert from "node:assert/strict";
import { emptyState, applyAction, standings } from "../server/engine.js";
import { callQueue } from "../shared/calls.js";
import { practiceState } from "../server/demo.js";

function setup() {
  let s = emptyState();
  for (const name of ["Singles", "Other singles"]) {
    s = applyAction(s, "tournament", {name, size:1, groups:1, qualify:2, points:21, cap:30, bestOf:1});
    const tournamentId = s.tournaments.at(-1).id;
    s = applyAction(s, "teams", {tournamentId, teams:Array.from({length:4}, (_,i)=>({players:[`${name} Player ${i+1}`]}))});
    s = applyAction(s, "generate", {tournamentId});
  }
  return s;
}
const ids = s => callQueue(s).map(m=>m.id);

test("manual calls override times across categories; moving preserves fixtures and results", () => {
  let s = setup();
  const first = s.matches[0], last = s.matches.at(-1);
  s = applyAction(s,"schedule",{matchId:first.id,scheduled:"09:00"});
  s = applyAction(s,"schedule",{matchId:last.id,scheduled:"17:00"});
  assert.equal(ids(s)[0],first.id);
  const before = structuredClone(s);
  s = applyAction(s,"moveCall",{matchId:last.id,position:1});
  assert.equal(ids(s)[0],last.id);
  assert.deepEqual(s.matches,before.matches);
  assert.deepEqual(s.teams,before.teams);
  assert.deepEqual(before.callOrder,undefined);
  s = applyAction(s,"moveCall",{matchId:last.id,position:3});
  assert.equal(ids(s)[2],last.id);
  s = applyAction(s,"schedule",{matchId:last.id,scheduled:"08:00"});
  assert.equal(ids(s)[2],last.id);
  s = applyAction(s,"resetCallOrder");
  assert.equal(ids(s)[0],last.id);
  assert.equal(s.callOrder,undefined);
});

test("hold removes public calls, blocks start, and release appends to the queue", () => {
  let s = setup();
  const first = ids(s)[0], count = ids(s).length;
  s = applyAction(s,"holdMatch",{matchId:first});
  assert.equal(ids(s).length,count-1);
  assert.ok(!ids(s).includes(first));
  assert.throws(()=>applyAction(s,"start",{matchId:first,court:1}),/Release/);
  assert.throws(()=>applyAction(s,"moveCall",{matchId:first,position:1}),/Release/);
  s = applyAction(s,"releaseMatch",{matchId:first});
  assert.equal(ids(s).at(-1),first);
  assert.throws(()=>applyAction(s,"releaseMatch",{matchId:first}),/not on hold/);
  s = applyAction(s,"moveCall",{matchId:first,position:1});
  assert.equal(ids(s)[0],first);
});

test("unknown, invalid positions and active/completed calls fail without mutating state", () => {
  let s = setup(); const first = ids(s)[0];
  for (const position of [0,-1,1.5,ids(s).length+1,"bad"]) assert.throws(()=>applyAction(s,"moveCall",{matchId:first,position}),/Call position/);
  assert.throws(()=>applyAction(s,"moveCall",{matchId:"missing",position:1}),/not found/);
  s = applyAction(s,"start",{matchId:first,court:1});
  const before = structuredClone(s);
  for (const action of ["moveCall","holdMatch","releaseMatch"]) assert.throws(()=>applyAction(s,action,{matchId:first,position:1}),/Only upcoming/);
  assert.deepEqual(s,before);
  s = applyAction(s,"finish",{matchId:first,games:[[21,15]]});
  assert.throws(()=>applyAction(s,"returnMatch",{matchId:first}),/Only an on-court/);
});

test("starting any queued fixture is allowed, with courts and player conflicts still enforced", () => {
  let s = setup(); const queue = callQueue(s), last = queue.at(-1);
  s = applyAction(s,"moveCall",{matchId:queue[2].id,position:1});
  s = applyAction(s,"start",{matchId:last.id,court:1});
  assert.ok(!ids(s).includes(last.id));
  assert.ok(!s.callOrder.includes(last.id));
  assert.throws(()=>applyAction(s,"start",{matchId:queue[0].id,court:1}),/occupied/);
  const overlap = callQueue(s).find(m=>[m.a,m.b].some(id=>[last.a,last.b].includes(id)));
  assert.throws(()=>applyAction(s,"start",{matchId:overlap.id,court:2}),/already playing/);
});

test("wrong start can be returned to hold without changing standings or results", () => {
  let s = setup(); const first = ids(s)[0], tournamentId = s.matches[0].tournamentId;
  const before = standings(s,tournamentId);
  s = applyAction(s,"start",{matchId:first,court:1});
  s = applyAction(s,"returnMatch",{matchId:first});
  const m = s.matches.find(m=>m.id===first);
  assert.equal(m.status,"upcoming"); assert.equal(m.court,null); assert.equal(m.held,true);
  assert.equal(m.startedAt,undefined); assert.deepEqual(m.games,[]); assert.equal(m.winner,null);
  assert.deepEqual(standings(s,tournamentId),before);
  assert.ok(!ids(s).includes(first));
  s = applyAction(s,"start",{matchId:ids(s)[0],court:1});
  assert.equal(s.matches.filter(m=>m.status==="live").length,1);
});

test("unresolved knockouts stay out of calls; final joins after both winners advance", () => {
  let s = practiceState(emptyState());
  const t = s.tournaments.find(t=>t.name.includes("Knockout rehearsal"));
  const final = s.matches.find(m=>m.tournamentId===t.id && m.stage==="Final");
  assert.ok(!ids(s).includes(final.id));
  assert.throws(()=>applyAction(s,"moveCall",{matchId:final.id,position:1}),/both opponents/);
  const semis = s.matches.filter(m=>m.tournamentId===t.id && m.stage==="Semifinal");
  s = applyAction(s,"moveCall",{matchId:semis[0].id,position:1});
  for (const semi of semis) {
    s = applyAction(s,"start",{matchId:semi.id,court:4});
    s = applyAction(s,"finish",{matchId:semi.id,games:[[21,15]]});
  }
  assert.equal(ids(s).at(-1),final.id);
  assert.equal(new Set(ids(s)).size,ids(s).length);
});

test("removed fixtures are pruned from calls and held fixtures survive schedule reset", () => {
  let s = setup(); const first = s.matches[0], other = s.tournaments[1].id;
  s = applyAction(s,"moveCall",{matchId:first.id,position:1});
  const held = ids(s)[1]; s = applyAction(s,"holdMatch",{matchId:held});
  s = applyAction(s,"resetFixtures",{tournamentId:other});
  assert.ok(callQueue(s).every(m=>m.tournamentId!==other));
  assert.ok(s.callOrder.every(id=>s.matches.some(m=>m.id===id)));
  s = applyAction(s,"resetCallOrder");
  assert.ok(!ids(s).includes(held));
  s = applyAction(s,"deleteTournament",{tournamentId:first.tournamentId});
  assert.deepEqual(ids(s),[]);
});
