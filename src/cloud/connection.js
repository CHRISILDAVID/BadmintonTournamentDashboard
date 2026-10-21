import { createStore } from "zustand/vanilla";
import { api, currentSession, namespace, write } from "./storage.js";
export const liveStore = createStore(() => ({ records: {}, connected: false, preset: null }));
const subscribers = new Set();
let socket, timer, stopped = false, confirmedSnapshot = null, cacheWrite = Promise.resolve();
function cacheConfirmed() {
  const s = currentSession();
  if (!confirmedSnapshot || !s || !["display", "umpire"].includes(s.role)) return;
  const key = `${namespace(s)}:snapshot`, snapshot = structuredClone(confirmedSnapshot);
  cacheWrite = cacheWrite.catch(() => {}).then(() => write(key, snapshot));
  cacheWrite.catch(() => {});
}
if (typeof window !== "undefined") {
  window.addEventListener("offline", () => liveStore.setState({ connected: false }));
  window.addEventListener("online", () => { socket?.close(); if (!socket) connectCloud(); });
}
function ingest(message) {
  if (message.type === "snapshot") {
    liveStore.setState({ records: Object.fromEntries(message.live.map(r => [r.matchId, r])), preset: message.preset });
    window.dispatchEvent(new CustomEvent("shuttle-snapshot", { detail: message.state }));
    confirmedSnapshot = { state: message.state, live: message.live, preset: message.preset };
    cacheConfirmed();
  }
  if (message.type === "score") {
    liveStore.setState(s => ({ records: { ...s.records, [message.record.matchId]: message.record } }));
    if (confirmedSnapshot) {
      confirmedSnapshot.live = Object.values(liveStore.getState().records); cacheConfirmed();
    }
  }
  if (message.type === "contact") liveStore.setState(s => {
    const r = s.records[message.matchId];
    return r ? { records: { ...s.records, [message.matchId]: { ...r, contactAt: message.contactAt } } } : {};
  });
  if (message.type === "refresh") socket?.send(JSON.stringify({ type: "snapshot" }));
  for (const listener of subscribers) listener(message);
}
export function connectCloud() {
  if (socket || stopped) return;
  const identity = currentSession();
  if (!identity) return;
  socket = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/socket?eventId=${identity.eventId}&sessionId=${identity.sessionId}`);
  socket.onopen = () => { liveStore.setState({ connected: true }); for (const fn of subscribers) fn({ type: "connected" }); };
  socket.onmessage = event => { if (event.data !== "pong") ingest(JSON.parse(event.data)); };
  socket.onerror = () => liveStore.setState({ connected: false });
  socket.onclose = event => {
    socket = null; liveStore.setState({ connected: false });
    if (event.code === 4001) { stopped = true; window.dispatchEvent(new Event("shuttle-revoked")); return; }
    if (!stopped) timer = setTimeout(connectCloud, 2500 + Math.random() * 1500);
  };
}
export function stopCloud() { stopped = true; clearTimeout(timer); socket?.close(); liveStore.setState({ connected: false, records: {}, preset: null }); }
export const subscribeCloud = fn => { subscribers.add(fn); connectCloud(); return () => subscribers.delete(fn); };
export function contact(record, device) {
  if (socket?.readyState === 1) socket.send(JSON.stringify({ type: "contact", matchId: record.matchId, generation: record.generation, device }));
}
export function cloudEventSource() {
  const adapter = { readyState: 0, onopen: null, onmessage: null, onerror: null };
  const unsub = subscribeCloud(message => {
    if (message.type === "connected") { adapter.readyState = 1; adapter.onopen?.(); }
    if (message.type === "snapshot") { adapter.readyState = 1; adapter.onmessage?.(); }
  });
  const unsubState = liveStore.subscribe(s => { if (!s.connected) { adapter.readyState = 0; adapter.onerror?.(); } });
  if (liveStore.getState().connected) { adapter.readyState = 1; queueMicrotask(() => adapter.onopen?.()); }
  adapter.close = () => { unsub(); unsubState(); };
  return adapter;
}
export async function refreshLive() { const data = await api("live"); liveStore.setState({ records: Object.fromEntries(data.live.map(r => [r.matchId, r])), preset: data.preset }); }
